---
step: S03
title: "Postgres schema and database scripts"
status: done
started: 2026-11-29
completed: 2026-11-29
---

# S03 · Postgres schema and database scripts

**Read before starting:** [README: rules and choices](../README.md) · [progress.md](../progress.md)

**Needs:** S02

**Creates:** `db/schema.sql`, `scripts/db.mjs`, `scripts/db.test.mjs`

**Build**

- `db/schema.sql`, exactly:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
CREATE SCHEMA IF NOT EXISTS langgraph;

CREATE FUNCTION touch_updated_at() RETURNS trigger LANGUAGE plpgsql AS
$$ BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TABLE workspaces (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 200),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE threads (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  workspace_id uuid NOT NULL REFERENCES workspaces ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'New thread' CHECK (char_length(title) BETWEEN 1 AND 200),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON threads (workspace_id, id);

CREATE TABLE documents (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  workspace_id uuid NOT NULL REFERENCES workspaces ON DELETE CASCADE,
  filename text NOT NULL CHECK (char_length(filename) BETWEEN 1 AND 255),
  extension text NOT NULL CHECK (extension IN
    ('txt','md','pdf','doc','docx','xls','xlsx','ppt','pptx','png','jpg','jpeg','tif','tiff')),
  size_bytes bigint NOT NULL CHECK (size_bytes BETWEEN 1 AND 26214400),
  sha256 text NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','processing','ready','failed')),
  error text,
  page_count int,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON documents (workspace_id, id);
CREATE TRIGGER documents_touch BEFORE UPDATE ON documents FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TABLE jobs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES workspaces ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('ingest','run','resume')),
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','done','failed')),
  attempts int NOT NULL DEFAULT 0,
  locked_until timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX jobs_claim ON jobs (kind, id) WHERE status IN ('queued','running');
CREATE TRIGGER jobs_touch BEFORE UPDATE ON jobs FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TABLE runs (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  workspace_id uuid NOT NULL REFERENCES workspaces ON DELETE CASCADE,
  thread_id uuid NOT NULL REFERENCES threads ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN
    ('queued','running','awaiting_approval','done','failed','cancelled','expired')),
  cancel_requested_at timestamptz,
  approval_requested_at timestamptz,
  approval_decision boolean,
  llm_calls int NOT NULL DEFAULT 0,
  running_ms bigint NOT NULL DEFAULT 0,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);
CREATE UNIQUE INDEX runs_one_active_per_thread ON runs (thread_id)
  WHERE status IN ('queued','running','awaiting_approval');
CREATE TRIGGER runs_touch BEFORE UPDATE ON runs FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TABLE messages (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  workspace_id uuid NOT NULL REFERENCES workspaces ON DELETE CASCADE,
  thread_id uuid NOT NULL REFERENCES threads ON DELETE CASCADE,
  run_id uuid REFERENCES runs ON DELETE SET NULL,
  role text NOT NULL CHECK (role IN ('user','assistant','tool')),
  content text NOT NULL,
  tool_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON messages (thread_id, id);

CREATE TABLE run_events (
  workspace_id uuid NOT NULL REFERENCES workspaces ON DELETE CASCADE,
  run_id uuid NOT NULL REFERENCES runs ON DELETE CASCADE,
  seq int NOT NULL CHECK (seq >= 1),
  type text NOT NULL CHECK (type IN
    ('text','tool_start','tool_end','approval_required','done','cancelled','expired','error')),
  data jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (run_id, seq)
);

CREATE TABLE tool_calls (
  workspace_id uuid NOT NULL REFERENCES workspaces ON DELETE CASCADE,
  run_id uuid NOT NULL REFERENCES runs ON DELETE CASCADE,
  message_id text NOT NULL,
  tool_call_id text NOT NULL,
  name text NOT NULL,
  args jsonb NOT NULL,
  result jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (run_id, message_id, tool_call_id)
);

CREATE TABLE document_pages (
  workspace_id uuid NOT NULL REFERENCES workspaces ON DELETE CASCADE,
  document_id uuid NOT NULL REFERENCES documents ON DELETE CASCADE,
  page int NOT NULL CHECK (page >= 1),
  text text NOT NULL,
  confidence real CHECK (confidence BETWEEN 0 AND 1),
  PRIMARY KEY (document_id, page)
);

CREATE TABLE chunks (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  workspace_id uuid NOT NULL REFERENCES workspaces ON DELETE CASCADE,
  document_id uuid NOT NULL REFERENCES documents ON DELETE CASCADE,
  page int NOT NULL CHECK (page >= 1),
  ordinal int NOT NULL CHECK (ordinal >= 0),
  text text NOT NULL,
  embedding vector(384) NOT NULL,
  UNIQUE (document_id, ordinal)
);
CREATE INDEX ON chunks (workspace_id);
CREATE INDEX chunks_embedding ON chunks USING hnsw (embedding vector_cosine_ops);

CREATE TABLE entities (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  workspace_id uuid NOT NULL REFERENCES workspaces ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN
    ('person','organization','place','product','project','event','concept')),
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 200),
  normalized_name text NOT NULL,
  UNIQUE (workspace_id, kind, normalized_name)
);
CREATE INDEX ON entities (workspace_id, normalized_name);

CREATE TABLE relations (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  workspace_id uuid NOT NULL REFERENCES workspaces ON DELETE CASCADE,
  source_entity_id uuid NOT NULL REFERENCES entities ON DELETE CASCADE,
  target_entity_id uuid NOT NULL REFERENCES entities ON DELETE CASCADE,
  type text NOT NULL CHECK (type ~ '^[a-z][a-z0-9_]{0,63}$'),
  document_id uuid NOT NULL REFERENCES documents ON DELETE CASCADE,
  chunk_id uuid NOT NULL REFERENCES chunks ON DELETE CASCADE,
  UNIQUE (chunk_id, source_entity_id, type, target_entity_id)
);
CREATE INDEX ON relations (workspace_id, source_entity_id);
CREATE INDEX ON relations (workspace_id, target_entity_id);

CREATE TABLE artifacts (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  workspace_id uuid NOT NULL REFERENCES workspaces ON DELETE CASCADE,
  thread_id uuid REFERENCES threads ON DELETE SET NULL,
  run_id uuid REFERENCES runs ON DELETE SET NULL,
  source_key text NOT NULL UNIQUE,
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON artifacts (workspace_id, id);
CREATE TRIGGER artifacts_touch BEFORE UPDATE ON artifacts FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TABLE eval_runs (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  model text NOT NULL,
  judge_model text NOT NULL,
  git_sha text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);

CREATE TABLE eval_results (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  eval_run_id uuid NOT NULL REFERENCES eval_runs ON DELETE CASCADE,
  case_id text NOT NULL,
  layer text NOT NULL CHECK (layer IN ('ocr','retrieval','graph','agent','answer')),
  passed boolean NOT NULL,
  score real,
  details jsonb NOT NULL DEFAULT '{}',
  UNIQUE (eval_run_id, case_id)
);
```

- `scripts/db.mjs`:
  - `migrate` applies `db/schema.sql` to the `DATABASE_URL` database if that database has no `workspaces` table. If it does, it exits 1 with "schema already applied; use yarn db:reset".
  - `reset [--main|--test|--eval|--all]`, default `--main`, connects with `PG_ADMIN_URL`. For each chosen database it runs `DROP DATABASE IF EXISTS <db> WITH (FORCE)`, then `CREATE DATABASE <db> OWNER taskmaster`. Then, as admin in the new database, it runs `CREATE EXTENSION vector` and `GRANT ALL ON SCHEMA public TO taskmaster`, and applies `schema.sql` as `taskmaster`.
  - Database names come from the last path segment of `DATABASE_URL`, `TEST_DATABASE_URL` and `EVAL_DATABASE_URL`.
- `scripts/db.test.mjs` uses `node:test` against `TEST_DATABASE_URL` and checks:
  1. All 15 tables exist.
  2. Inserting a second active run for the same thread fails with SQLSTATE `23505`.
  3. Deleting a document cascades to its pages, chunks and relations.
  4. `uuidv7()` IDs sort by creation time.

**Verify**

```text
yarn db:reset --all
node --env-file=.env --test scripts/db.test.mjs
yarn db:migrate     # must exit 1: schema already applied
```

## Finish

1. Every **Verify** command above exits 0, and so does `yarn check:arch`.
2. Update [README.md](../../README.md) as [AGENTS.md](../../AGENTS.md#keeping-readmemd-current) describes, or note in the progress entry why no change was needed.
3. Add the S03 entry to [progress.md](../progress.md).
4. Set `status: done` and `completed:` at the top of this file.
5. Commit everything as `S03: Postgres schema and database scripts`.

## Blocked

Empty unless `status: blocked`. Then: what failed, the exact error, and what the user needs to decide.

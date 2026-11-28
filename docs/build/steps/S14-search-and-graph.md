---
step: S14
title: "Search and graph"
status: not-started
started:
completed:
---

# S14 · Search and graph

**Read before starting:** [README: rules and choices](../README.md) · [progress.md](../progress.md) · [Internal HTTP](../contracts.md#internal-http-agent-and-ocr) · [Fastify REST API](../contracts.md#fastify-rest-api)

**Needs:** S13

**Creates:**
- `services/agent/app/search.py`, `app/graph_store.py`
- `services/agent/tests/test_search.py`, `tests/test_graph_store.py`
- `apps/api/src/routes/search.ts`, `src/agentClient.ts`, `test/search.test.ts`

Edits `services/agent/app/main.py` to add `POST /search` and `POST /graph`.

**Build**

- `search(workspace_id, query)` runs in one transaction:

```sql
SET LOCAL hnsw.iterative_scan = strict_order;
SELECT c.id, c.document_id, d.filename, c.page, c.text, 1 - (c.embedding <=> %(q)s) AS score
FROM chunks c JOIN documents d ON d.id = c.document_id
WHERE c.workspace_id = %(w)s AND d.status = 'ready'
ORDER BY c.embedding <=> %(q)s, c.id
LIMIT 5;
```

- `graph(workspace_id, entity)`:
  - Start entities are those whose normalized name equals `normalize(entity)`. If there are none, use up to 3 entities whose normalized name contains it, ordered by `char_length(name)` then `id`.
  - Then run this fixed query. It returns at most 50 relations whose chunk's document is `ready`, ordered by `depth, relation id`:

```sql
WITH RECURSIVE walk(entity_id, depth, relation_id) AS (
  SELECT id, 0, NULL::uuid FROM entities WHERE id = ANY(%(start)s)
  UNION
  SELECT CASE WHEN r.source_entity_id = w.entity_id THEN r.target_entity_id ELSE r.source_entity_id END,
         w.depth + 1, r.id
  FROM walk w JOIN relations r
    ON r.workspace_id = %(w)s AND (r.source_entity_id = w.entity_id OR r.target_entity_id = w.entity_id)
  WHERE w.depth < 2
)
SELECT DISTINCT ON (r.id) r.*, w.depth, c.page, c.text, d.filename
FROM walk w JOIN relations r ON r.id = w.relation_id
JOIN chunks c ON c.id = r.chunk_id JOIN documents d ON d.id = r.document_id AND d.status = 'ready'
ORDER BY r.id, w.depth;
```

  Afterward, sort by `(depth, id)` in Python and keep the first 50.
- `agentClient.ts` calls `AGENT_URL` with `X-Internal-Token` and a 10-second timeout. A network error or a 5xx response becomes 502 `agent_unavailable`.
- Tests:
  1. In the agent, with `handbook.md` and `project-kestrel.docx` (as text) ingested: the query "How many days of annual leave?" ranks the handbook's leave chunk first.
  2. Search never returns chunks from another workspace, or from a document that is `processing`.
  3. From "Tomas Berg", the graph reaches Project Kestrel in 2 hops.
  4. Graph results never include another workspace's relations.
  5. In the API, with the agent mocked through undici's `MockAgent`, search passes the results through, and an agent 500 becomes 502. Add `undici` as a devDependency of `apps/api` for this, since Node's built-in `fetch` does not expose `MockAgent`.

**Verify:** both workspaces' `test` scripts pass.

## Finish

1. Every **Verify** command above exits 0, and so does `yarn check:arch`.
2. Add the S14 entry to [progress.md](../progress.md).
3. Set `status: done` and `completed:` at the top of this file.
4. Commit everything as `S14: Search and graph`.

## Blocked

Empty unless `status: blocked`. Then: what failed, the exact error, and what the user needs to decide.

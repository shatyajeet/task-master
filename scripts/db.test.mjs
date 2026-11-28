// Schema tests. Run: node --env-file=.env --test scripts/db.test.mjs
// They use TEST_DATABASE_URL, and each test removes the workspace it creates.
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import pg from "pg";

const TABLES = [
  "artifacts",
  "chunks",
  "document_pages",
  "documents",
  "entities",
  "eval_results",
  "eval_runs",
  "jobs",
  "messages",
  "relations",
  "run_events",
  "runs",
  "threads",
  "tool_calls",
  "workspaces",
];

const SHA = "a".repeat(64);

describe("database schema", () => {
  let db;

  before(async () => {
    assert.ok(process.env.TEST_DATABASE_URL, "TEST_DATABASE_URL is not set");
    db = new pg.Client({ connectionString: process.env.TEST_DATABASE_URL });
    await db.connect();
  });

  after(async () => {
    await db?.end();
  });

  async function one(sql, params = []) {
    const { rows } = await db.query(sql, params);
    return rows[0];
  }

  async function newWorkspace() {
    return (await one("INSERT INTO workspaces (name) VALUES ('test') RETURNING id")).id;
  }

  async function newThread(workspaceId) {
    return (await one("INSERT INTO threads (workspace_id) VALUES ($1) RETURNING id", [workspaceId])).id;
  }

  it("has all 15 tables", async () => {
    const { rows } = await db.query(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
       ORDER BY table_name`,
    );
    assert.deepEqual(
      rows.map((row) => row.table_name),
      TABLES,
    );
  });

  it("allows only one active run per thread", async () => {
    const workspaceId = await newWorkspace();
    try {
      const threadId = await newThread(workspaceId);
      const insert = "INSERT INTO runs (workspace_id, thread_id, status) VALUES ($1, $2, $3)";
      await db.query(insert, [workspaceId, threadId, "queued"]);
      await assert.rejects(db.query(insert, [workspaceId, threadId, "running"]), { code: "23505" });
      // A finished run does not count as active.
      await db.query(insert, [workspaceId, threadId, "done"]);
      await db.query(insert, [workspaceId, threadId, "cancelled"]);
    } finally {
      await db.query("DELETE FROM workspaces WHERE id = $1", [workspaceId]);
    }
  });

  it("deleting a document cascades to its pages, chunks and relations", async () => {
    const workspaceId = await newWorkspace();
    try {
      const documentId = (
        await one(
          `INSERT INTO documents (workspace_id, filename, extension, size_bytes, sha256)
           VALUES ($1, 'a.txt', 'txt', 10, $2) RETURNING id`,
          [workspaceId, SHA],
        )
      ).id;
      await db.query("INSERT INTO document_pages (workspace_id, document_id, page, text) VALUES ($1, $2, 1, 'hello')", [
        workspaceId,
        documentId,
      ]);
      const chunkId = (
        await one(
          `INSERT INTO chunks (workspace_id, document_id, page, ordinal, text, embedding)
           VALUES ($1, $2, 1, 0, 'hello', array_fill(0.1::real, ARRAY[384])::vector) RETURNING id`,
          [workspaceId, documentId],
        )
      ).id;
      const entityIds = [];
      for (const name of ["Ada", "Acme"]) {
        const kind = name === "Ada" ? "person" : "organization";
        const row = await one(
          "INSERT INTO entities (workspace_id, kind, name, normalized_name) VALUES ($1, $2, $3, lower($3)) RETURNING id",
          [workspaceId, kind, name],
        );
        entityIds.push(row.id);
      }
      await db.query(
        `INSERT INTO relations (workspace_id, source_entity_id, target_entity_id, type, document_id, chunk_id)
         VALUES ($1, $2, $3, 'works_at', $4, $5)`,
        [workspaceId, entityIds[0], entityIds[1], documentId, chunkId],
      );

      await db.query("DELETE FROM documents WHERE id = $1", [documentId]);

      for (const table of ["document_pages", "chunks", "relations"]) {
        const row = await one("SELECT count(*)::int AS n FROM " + table + " WHERE workspace_id = $1", [workspaceId]);
        assert.equal(row.n, 0, `${table} still has rows`);
      }
      // The entities belong to the workspace, not the document, so they stay.
      const entities = await one("SELECT count(*)::int AS n FROM entities WHERE workspace_id = $1", [workspaceId]);
      assert.equal(entities.n, 2);
    } finally {
      await db.query("DELETE FROM workspaces WHERE id = $1", [workspaceId]);
    }
  });

  it("uuidv7() ids sort by creation time", async () => {
    const created = [];
    try {
      for (let i = 0; i < 20; i++) {
        created.push((await one("INSERT INTO workspaces (name) VALUES ('order') RETURNING id")).id);
        if (i % 5 === 0) await new Promise((resolve) => setTimeout(resolve, 3));
      }
      assert.deepEqual([...created].sort(), created);
      assert.equal(new Set(created).size, created.length);
      for (const id of created) assert.equal(id[14], "7", `${id} is not a version 7 UUID`);
    } finally {
      await db.query("DELETE FROM workspaces WHERE id = ANY($1::uuid[])", [created]);
    }
  });
});

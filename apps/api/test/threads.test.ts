import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { after, before, beforeEach, describe, it } from "node:test";
import type { FastifyInstance } from "fastify";
import pg from "pg";
import { headers, makeApp, makeUploadDir, resetDb, testDatabaseUrl } from "./helpers.ts";

const THREAD_KEYS = ["created_at", "id", "title", "workspace_id"];
const MESSAGE_KEYS = ["content", "created_at", "id", "role", "run_id", "thread_id", "tool_name", "workspace_id"];
const MISSING_ID = "00000000-0000-7000-8000-000000000000";

describe("threads", () => {
  let app: FastifyInstance;
  let uploadDir: string;
  let client: pg.Client;

  before(async () => {
    uploadDir = await makeUploadDir();
    app = await makeApp(uploadDir);
    client = new pg.Client({ connectionString: testDatabaseUrl() });
    await client.connect();
  });

  after(async () => {
    await client.end();
    await app.close();
    await fs.rm(uploadDir, { recursive: true, force: true });
  });

  beforeEach(async () => {
    await resetDb();
  });

  async function createWorkspace(name = "W"): Promise<string> {
    const res = await app.inject({ method: "POST", url: "/workspaces", headers: headers(), payload: { name } });
    return res.json().id;
  }

  async function createThread(wid: string, payload?: unknown) {
    return app.inject({
      method: "POST",
      url: `/workspaces/${wid}/threads`,
      headers: headers(),
      ...(payload === undefined ? {} : { payload: payload as object }),
    });
  }

  it("creates, lists, renames and deletes a thread, with exact response keys", async () => {
    const wid = await createWorkspace();

    const created = await createThread(wid, { title: "First" });
    assert.equal(created.statusCode, 201);
    const thread = created.json();
    assert.deepEqual(Object.keys(thread).sort(), THREAD_KEYS);
    assert.equal(thread.title, "First");
    assert.equal(thread.workspace_id, wid);

    const list = await app.inject({ method: "GET", url: `/workspaces/${wid}/threads`, headers: headers() });
    assert.equal(list.statusCode, 200);
    assert.deepEqual(list.json(), [thread]);

    const renamed = await app.inject({
      method: "PATCH",
      url: `/workspaces/${wid}/threads/${thread.id}`,
      headers: headers(),
      payload: { title: "Second" },
    });
    assert.equal(renamed.statusCode, 200);
    assert.deepEqual(Object.keys(renamed.json()).sort(), THREAD_KEYS);
    assert.deepEqual(renamed.json(), { ...thread, title: "Second" });

    const deleted = await app.inject({
      method: "DELETE",
      url: `/workspaces/${wid}/threads/${thread.id}`,
      headers: headers(),
    });
    assert.equal(deleted.statusCode, 204);
    assert.equal(deleted.body, "");

    const after = await app.inject({ method: "GET", url: `/workspaces/${wid}/threads`, headers: headers() });
    assert.deepEqual(after.json(), []);
  });

  it("gives a thread created without a title the title 'New thread'", async () => {
    const wid = await createWorkspace();
    for (const payload of [{}, undefined]) {
      const res = await createThread(wid, payload);
      assert.equal(res.statusCode, 201, JSON.stringify(payload));
      assert.equal(res.json().title, "New thread");
    }
  });

  it("rejects a title of 0 or 201 characters with 400", async () => {
    const wid = await createWorkspace();
    const thread = (await createThread(wid)).json();
    for (const title of ["", "a".repeat(201)]) {
      assert.equal((await createThread(wid, { title })).statusCode, 400, `POST title of ${title.length}`);
      const patch = await app.inject({
        method: "PATCH",
        url: `/workspaces/${wid}/threads/${thread.id}`,
        headers: headers(),
        payload: { title },
      });
      assert.equal(patch.statusCode, 400, `PATCH title of ${title.length}`);
    }
    const missing = await app.inject({
      method: "PATCH",
      url: `/workspaces/${wid}/threads/${thread.id}`,
      headers: headers(),
      payload: {},
    });
    assert.equal(missing.statusCode, 400);
  });

  it("lists threads newest first", async () => {
    const wid = await createWorkspace();
    const ids: string[] = [];
    for (const title of ["one", "two", "three"]) ids.push((await createThread(wid, { title })).json().id);
    const list = await app.inject({ method: "GET", url: `/workspaces/${wid}/threads`, headers: headers() });
    assert.deepEqual(
      list.json().map((t: { id: string }) => t.id),
      ids.reverse(),
    );
  });

  it("returns 404 for a thread of workspace A requested under workspace B", async () => {
    const a = await createWorkspace("A");
    const b = await createWorkspace("B");
    const thread = (await createThread(a)).json();
    const base = `/workspaces/${b}/threads/${thread.id}`;

    const cases = [
      { method: "PATCH", url: base, payload: { title: "x" } },
      { method: "DELETE", url: base },
      { method: "GET", url: `${base}/messages` },
    ] as const;
    for (const c of cases) {
      const res = await app.inject({ ...c, headers: headers() });
      assert.equal(res.statusCode, 404, `${c.method} ${c.url}`);
      assert.equal(res.json().error, "not_found");
    }

    // B's own list stays empty, and A's thread is untouched.
    const listB = await app.inject({ method: "GET", url: `/workspaces/${b}/threads`, headers: headers() });
    assert.deepEqual(listB.json(), []);
    const listA = await app.inject({ method: "GET", url: `/workspaces/${a}/threads`, headers: headers() });
    assert.deepEqual(listA.json(), [thread]);
  });

  it("returns 404 for a thread route under a missing workspace, and for a missing or malformed thread", async () => {
    const wid = await createWorkspace();
    for (const url of [`/workspaces/${MISSING_ID}/threads`, `/workspaces/not-a-uuid/threads`]) {
      assert.equal((await app.inject({ method: "GET", url, headers: headers() })).statusCode, 404, url);
      const post = await app.inject({ method: "POST", url, headers: headers(), payload: {} });
      assert.equal(post.statusCode, 404, `POST ${url}`);
    }
    for (const tid of [MISSING_ID, "not-a-uuid"]) {
      const url = `/workspaces/${wid}/threads/${tid}`;
      assert.equal((await app.inject({ method: "DELETE", url, headers: headers() })).statusCode, 404, tid);
      assert.equal((await app.inject({ method: "GET", url: `${url}/messages`, headers: headers() })).statusCode, 404);
    }
  });

  it("returns a thread's messages oldest first, with exact keys, and none from other threads", async () => {
    const wid = await createWorkspace();
    const t1 = (await createThread(wid)).json().id;
    const t2 = (await createThread(wid)).json().id;
    for (const [tid, role, content] of [
      [t1, "user", "hello"],
      [t1, "assistant", "hi"],
      [t2, "user", "elsewhere"],
      [t1, "tool", "result"],
    ] as const) {
      await client.query("INSERT INTO messages (workspace_id, thread_id, role, content) VALUES ($1, $2, $3, $4)", [
        wid,
        tid,
        role,
        content,
      ]);
    }

    const res = await app.inject({ method: "GET", url: `/workspaces/${wid}/threads/${t1}/messages`, headers: headers() });
    assert.equal(res.statusCode, 200);
    const messages = res.json();
    assert.deepEqual(
      messages.map((m: { content: string }) => m.content),
      ["hello", "hi", "result"],
    );
    for (const m of messages) assert.deepEqual(Object.keys(m).sort(), MESSAGE_KEYS);
    assert.equal(messages[0].run_id, null);
    assert.equal(messages[0].tool_name, null);
  });

  it("deleting a thread with an active run returns 409 active_run, and the thread stays", async () => {
    const wid = await createWorkspace();
    const tid = (await createThread(wid)).json().id;
    const run = await client.query(
      "INSERT INTO runs (workspace_id, thread_id, status) VALUES ($1, $2, 'running') RETURNING id",
      [wid, tid],
    );
    const url = `/workspaces/${wid}/threads/${tid}`;

    for (const status of ["running", "queued", "awaiting_approval"]) {
      await client.query("UPDATE runs SET status = $2 WHERE id = $1", [run.rows[0].id, status]);
      const res = await app.inject({ method: "DELETE", url, headers: headers() });
      assert.equal(res.statusCode, 409, status);
      assert.deepEqual(Object.keys(res.json()).sort(), ["error", "message"]);
      assert.equal(res.json().error, "active_run");
    }
    const still = await app.inject({ method: "GET", url: `/workspaces/${wid}/threads`, headers: headers() });
    assert.equal(still.json().length, 1);

    // Once the run has finished, the thread can be deleted, and its messages and runs go with it.
    await client.query("UPDATE runs SET status = 'done', finished_at = now() WHERE id = $1", [run.rows[0].id]);
    assert.equal((await app.inject({ method: "DELETE", url, headers: headers() })).statusCode, 204);
    const left = await client.query("SELECT count(*)::int AS n FROM runs WHERE thread_id = $1", [tid]);
    assert.equal(left.rows[0].n, 0);
  });
});

import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { after, before, beforeEach, describe, it } from "node:test";
import type { FastifyInstance } from "fastify";
import { headers, makeApp, makeUploadDir, resetDb } from "./helpers.ts";

const WORKSPACE_KEYS = ["created_at", "id", "name"];
const ERROR_KEYS = ["error", "message"];
const MISSING_ID = "00000000-0000-7000-8000-000000000000";

describe("workspaces", () => {
  let app: FastifyInstance;
  let uploadDir: string;

  before(async () => {
    uploadDir = await makeUploadDir();
    app = await makeApp(uploadDir);
  });

  after(async () => {
    await app.close();
    await fs.rm(uploadDir, { recursive: true, force: true });
  });

  beforeEach(async () => {
    await resetDb();
  });

  async function create(name: string) {
    return app.inject({ method: "POST", url: "/workspaces", headers: headers(), payload: { name } });
  }

  it("creates, lists, gets, renames and deletes a workspace, with exact response keys", async () => {
    const created = await create("Alpha");
    assert.equal(created.statusCode, 201);
    const workspace = created.json();
    assert.deepEqual(Object.keys(workspace).sort(), WORKSPACE_KEYS);
    assert.equal(workspace.name, "Alpha");
    assert.match(workspace.id, /^[0-9a-f-]{36}$/);
    assert.ok(!Number.isNaN(Date.parse(workspace.created_at)));

    const list = await app.inject({ method: "GET", url: "/workspaces", headers: headers() });
    assert.equal(list.statusCode, 200);
    assert.deepEqual(list.json(), [workspace]);

    const got = await app.inject({ method: "GET", url: `/workspaces/${workspace.id}`, headers: headers() });
    assert.equal(got.statusCode, 200);
    assert.deepEqual(got.json(), workspace);

    const renamed = await app.inject({
      method: "PATCH",
      url: `/workspaces/${workspace.id}`,
      headers: headers(),
      payload: { name: "Beta" },
    });
    assert.equal(renamed.statusCode, 200);
    assert.deepEqual(Object.keys(renamed.json()).sort(), WORKSPACE_KEYS);
    assert.deepEqual(renamed.json(), { ...workspace, name: "Beta" });

    const deleted = await app.inject({ method: "DELETE", url: `/workspaces/${workspace.id}`, headers: headers() });
    assert.equal(deleted.statusCode, 204);
    assert.equal(deleted.body, "");

    const gone = await app.inject({ method: "GET", url: `/workspaces/${workspace.id}`, headers: headers() });
    assert.equal(gone.statusCode, 404);
    assert.deepEqual(Object.keys(gone.json()).sort(), ERROR_KEYS);
    assert.equal(gone.json().error, "not_found");
  });

  it("returns 404 for a missing or malformed ID, on every route that takes one", async () => {
    for (const id of [MISSING_ID, "not-a-uuid"]) {
      for (const method of ["GET", "PATCH", "DELETE"] as const) {
        const res = await app.inject({
          method,
          url: `/workspaces/${id}`,
          headers: headers(),
          ...(method === "PATCH" ? { payload: { name: "x" } } : {}),
        });
        assert.equal(res.statusCode, 404, `${method} ${id}`);
        assert.equal(res.json().error, "not_found");
      }
    }
  });

  it("rejects a name of 0 or 201 characters with 400, and accepts 1 and 200", async () => {
    const bad = ["", "a".repeat(201)];
    const workspace = (await create("ok")).json();
    for (const name of bad) {
      const post = await create(name);
      assert.equal(post.statusCode, 400, `POST name of ${name.length}`);
      assert.deepEqual(Object.keys(post.json()).sort(), ERROR_KEYS);

      const patch = await app.inject({
        method: "PATCH",
        url: `/workspaces/${workspace.id}`,
        headers: headers(),
        payload: { name },
      });
      assert.equal(patch.statusCode, 400, `PATCH name of ${name.length}`);
    }
    for (const name of ["a", "a".repeat(200)]) {
      assert.equal((await create(name)).statusCode, 201, `name of ${name.length}`);
    }
    // A missing name, or a null one, is also a 400.
    for (const payload of [{}, { name: null }]) {
      const res = await app.inject({ method: "POST", url: "/workspaces", headers: headers(), payload });
      assert.equal(res.statusCode, 400, JSON.stringify(payload));
    }
  });

  it("lists workspaces newest first", async () => {
    const ids: string[] = [];
    for (const name of ["one", "two", "three"]) ids.push((await create(name)).json().id);
    const list = await app.inject({ method: "GET", url: "/workspaces", headers: headers() });
    assert.deepEqual(
      list.json().map((w: { id: string }) => w.id),
      ids.reverse(),
    );
  });

  it("deleting a workspace removes its upload folder and leaves other folders alone", async () => {
    const a = (await create("A")).json();
    const b = (await create("B")).json();
    for (const w of [a, b]) {
      await fs.mkdir(path.join(uploadDir, w.id, "nested"), { recursive: true });
      await fs.writeFile(path.join(uploadDir, w.id, "nested", "file.txt"), "data");
    }

    const res = await app.inject({ method: "DELETE", url: `/workspaces/${a.id}`, headers: headers() });
    assert.equal(res.statusCode, 204);
    await assert.rejects(fs.stat(path.join(uploadDir, a.id)), { code: "ENOENT" });
    assert.ok((await fs.stat(path.join(uploadDir, b.id, "nested", "file.txt"))).isFile());
  });

  it("deleting a workspace without an upload folder still returns 204", async () => {
    const w = (await create("no files")).json();
    const res = await app.inject({ method: "DELETE", url: `/workspaces/${w.id}`, headers: headers() });
    assert.equal(res.statusCode, 204);
  });
});

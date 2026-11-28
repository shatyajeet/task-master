import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { after, before, describe, it } from "node:test";
import type { FastifyInstance } from "fastify";
import { headers, makeApp, makeUploadDir } from "./helpers.ts";

describe("security hooks", () => {
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

  it("GET /health returns 200", async () => {
    const res = await app.inject({ method: "GET", url: "/health", headers: headers() });
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.json(), { ok: true });
  });

  it("the wrong Host returns 403 forbidden_host", async () => {
    for (const host of ["evil.example", "localhost:3000", "localhost", "127.0.0.1:3002"]) {
      const res = await app.inject({ method: "GET", url: "/health", headers: headers({ host }) });
      assert.equal(res.statusCode, 403, host);
      assert.equal(res.json().error, "forbidden_host", host);
    }
  });

  it("a POST with Origin http://evil.example returns 403 forbidden_origin", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/workspaces",
      headers: headers({ origin: "http://evil.example" }),
      payload: { name: "x" },
    });
    assert.equal(res.statusCode, 403);
    assert.equal(res.json().error, "forbidden_origin");
  });

  it("a POST without X-TaskMaster returns 403 missing_header", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/workspaces",
      headers: { host: "localhost:3001" },
      payload: { name: "x" },
    });
    assert.equal(res.statusCode, 403);
    assert.equal(res.json().error, "missing_header");
  });

  it("a preflight from http://localhost:3000 gets Access-Control-Allow-Origin", async () => {
    const res = await app.inject({
      method: "OPTIONS",
      url: "/workspaces",
      headers: {
        host: "localhost:3001",
        origin: "http://localhost:3000",
        "access-control-request-method": "POST",
        "access-control-request-headers": "content-type,x-taskmaster",
      },
    });
    assert.equal(res.headers["access-control-allow-origin"], "http://localhost:3000");
    assert.match(String(res.headers["access-control-allow-methods"]), /POST/);
    assert.match(String(res.headers["access-control-allow-headers"]), /X-TaskMaster/i);
  });
});

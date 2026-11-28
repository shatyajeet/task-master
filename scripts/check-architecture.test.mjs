// node --test scripts/check-architecture.test.mjs
// For each rule: one fixture folder that breaks it (exactly one violation) and one that doesn't (none).
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { after, describe, it } from "node:test";
import { check } from "./check-architecture.mjs";

const made = [];
after(() => {
  for (const dir of made) rmSync(dir, { recursive: true, force: true });
});

const git = (cwd, ...args) =>
  execFileSync(
    "git",
    ["-c", "user.name=test", "-c", "user.email=test@example.test", "-c", "commit.gpgsign=false", ...args],
    { cwd, stdio: "ignore" },
  );

function write(root, files) {
  for (const [rel, content] of Object.entries(files)) {
    const path = join(root, rel);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content);
  }
}

function fixture(files) {
  const root = mkdtempSync(join(tmpdir(), "arch-"));
  made.push(root);
  git(root, "init", "-q");
  write(root, files);
  return root;
}

function expectOne(rule, files) {
  const found = check(fixture(files));
  assert.equal(found.length, 1, `expected exactly one violation, got: ${JSON.stringify(found)}`);
  assert.equal(found[0].rule, rule);
}

function expectNone(files) {
  const found = check(fixture(files));
  assert.deepEqual(found, []);
}

const ALLOW = (obj) => ({ "docs/build/allowed-dependencies.json": JSON.stringify(obj) });
const json = (obj) => JSON.stringify(obj, null, 2);

describe("A1-deps", () => {
  it("flags a package that is not allowed", () => {
    expectOne("A1-deps", {
      ...ALLOW({ "package.json": ["pg"] }),
      "package.json": json({ devDependencies: { pg: "^8.0.0", "left-pad": "^1.0.0" } }),
    });
  });
  it("passes allowed packages", () => {
    expectNone({
      ...ALLOW({ "package.json": ["pg"] }),
      "package.json": json({ devDependencies: { pg: "^8.0.0" } }),
    });
  });
  it("flags every name in a manifest missing from the allowlist", () => {
    expectOne("A1-deps", {
      ...ALLOW({}),
      "apps/api/package.json": json({ dependencies: { fastify: "^5.0.0" } }),
    });
  });
  it("flags a requirement that is not allowed", () => {
    expectOne("A1-deps", {
      ...ALLOW({ "services/agent/requirements.in": ["fastapi"] }),
      "services/agent/requirements.in": "fastapi>=0.1\nredis>=5\n",
    });
  });
  it("normalizes requirement names and ignores extras, comments and -c lines", () => {
    expectNone({
      ...ALLOW({ "services/agent/requirements.in": ["pydantic-settings", "uvicorn"] }),
      "services/agent/requirements.in": "-c constraints.txt\n# a comment\nPydantic_Settings>=2 # why\nuvicorn[standard]>=0.30\n",
    });
  });
});

describe("A2-bind", () => {
  it("flags a wildcard address", () => {
    expectOne("A2-bind", { "services/agent/app/serve.py": 'HOST = "0.0.0.0"\n' });
  });
  it("flags a host other than 127.0.0.1 in Python", () => {
    expectOne("A2-bind", { "services/agent/app/serve.py": 'uvicorn.run(app, host = "localhost")\n' });
  });
  it("flags a host other than 127.0.0.1 in the API", () => {
    expectOne("A2-bind", { "apps/api/src/main.ts": 'await app.listen({ host: "example.test", port: 3001 });\n' });
  });
  it("flags next dev without -H", () => {
    expectOne("A2-bind", { "apps/web/package.json": json({ scripts: { dev: "next dev -p 3000" } }) });
  });
  it("passes loopback binds", () => {
    expectNone({
      "services/agent/app/serve.py": 'uvicorn.run(app, host="127.0.0.1", port=8000)\n',
      "apps/api/src/main.ts": 'await app.listen({ host: "127.0.0.1", port: 3001 });\n',
      "apps/web/package.json": json({ scripts: { dev: "next dev -H 127.0.0.1 -p 3000" } }),
    });
  });
  it("does not read test files", () => {
    expectNone({ "services/agent/tests/test_x.py": 'HOST = "0.0.0.0"\n' });
  });
});

describe("A3-components", () => {
  it("flags a Dockerfile", () => {
    expectOne("A3-components", { Dockerfile: "FROM scratch\n" });
  });
  it("flags a compose file", () => {
    expectOne("A3-components", { "compose.yaml": "services: {}\n" });
  });
  it("flags a Python import of redis", () => {
    expectOne("A3-components", { "services/agent/app/q.py": "import redis\n" });
  });
  it("flags a JavaScript import of bullmq", () => {
    expectOne("A3-components", { "apps/api/src/q.ts": 'import { Queue } from "bullmq";\n' });
  });
  it("passes ordinary imports", () => {
    expectNone({
      "services/agent/app/q.py": "import redis_like_name_is_fine_but_not_redis_itself\nimport psycopg\n",
      "apps/api/src/q.ts": 'import pg from "pg";\n',
    });
  });
});

describe("A4-ports", () => {
  it("flags a port that is not fixed", () => {
    expectOne("A4-ports", { "services/agent/app/serve.py": "run(port=9999)\n" });
  });
  it("flags --port in a script", () => {
    expectOne("A4-ports", { "package.json": json({ scripts: { x: "serve --port 4000" } }) });
  });
  it("passes the fixed ports", () => {
    expectNone({
      "services/agent/app/serve.py": "run(port=8000)\n",
      "apps/api/src/main.ts": "listen({ port: 3001 });\n",
    });
  });
  it("does not read test files", () => {
    expectNone({ "apps/api/test/x.test.ts": "listen({ port: 4444 });\n" });
  });
});

describe("A5-sql", () => {
  it("flags an f-string query in Python", () => {
    expectOne("A5-sql", { "services/agent/app/db.py": 'cur.execute(f"select * from t where id = {x}")\n' });
  });
  it("flags .format() and % formatting", () => {
    expectOne("A5-sql", { "services/agent/app/db.py": 'cur.execute("select {}".format(x))\n' });
    expectOne("A5-sql", { "services/agent/app/db.py": 'cur.execute("select %s" % x)\n' });
  });
  it("flags a template literal query in the API", () => {
    expectOne("A5-sql", { "apps/api/src/db.ts": "await pool.query(`select * from t where id = ${id}`);\n" });
  });
  it("passes parameterized queries", () => {
    expectNone({
      "services/agent/app/db.py": 'cur.execute("select * from t where id = %s", (x,))\n',
      "apps/api/src/db.ts": 'await pool.query("select * from t where id = $1", [id]);\n',
    });
  });
});

describe("A6-render", () => {
  it("flags dangerouslySetInnerHTML", () => {
    expectOne("A6-render", { "apps/web/app/page.tsx": "export default () => <div dangerouslySetInnerHTML={{ __html: x }} />;\n" });
  });
  it("flags rehype-raw", () => {
    expectOne("A6-render", { "apps/web/app/md.tsx": 'import rehypeRaw from "rehype-raw";\n' });
  });
  it("flags a CSP that lacks a directive", () => {
    expectOne("A6-render", { "apps/web/next.config.ts": "export default { csp: \"img-src 'self' data:\" };\n" });
  });
  it("passes a complete CSP", () => {
    expectNone({
      "apps/web/next.config.ts": "export default { csp: \"img-src 'self' data:; frame-src 'none'\" };\n",
    });
  });
});

describe("A7-test-net", () => {
  it("flags a real host in a test", () => {
    expectOne("A7-test-net", { "apps/api/test/x.test.ts": 'await fetch("https://api.openai.com/v1/models");\n' });
  });
  it("passes loopback, localhost and .example hosts", () => {
    expectNone({
      "apps/api/test/x.test.ts":
        'fetch("http://127.0.0.1:8099/v1");\nfetch("http://localhost:3000");\nconst u = "https://files.example/a";\nfetch(`http://${host}/x`);\n',
    });
  });
  it("does not read non-test source", () => {
    expectNone({ "apps/api/src/x.ts": 'const u = "https://api.openai.com/v1";\n' });
  });
});

describe("A8-arch-commit", () => {
  function repo(changeOther) {
    const root = fixture({ "docs/architecture.md": "one\n", "docs/other.md": "a\n", "app.txt": "a\n" });
    git(root, "add", "-A");
    git(root, "commit", "-q", "-m", "start");
    write(root, { "docs/architecture.md": "two\n", ...(changeOther ? { "app.txt": "b\n" } : {}) });
    return root;
  }
  it("flags architecture.md changed together with other files", () => {
    const found = check(repo(true));
    assert.equal(found.length, 1);
    assert.equal(found[0].rule, "A8-arch-commit");
  });
  it("passes architecture.md changed alone", () => {
    assert.deepEqual(check(repo(false)), []);
  });
  it("passes architecture.md changed with other files under docs/", () => {
    const root = repo(false);
    write(root, { "docs/other.md": "b\n" });
    assert.deepEqual(check(root), []);
  });
});

describe("A9-readme", () => {
  const fence = "```";
  const readme = (extra = {}) => {
    const o = {
      title: "# Title\n",
      links: "See [other](docs/other.md#section-one) and [web](https://example.test/a#b).\n",
      contents: "- [One](#one)\n- [Two](#two)\n",
      body: `\n## One\n\ntext\n\n## Two\n\n${fence}text\n# not a heading\n[x](missing.md)\n${fence}\n`,
      ...extra,
    };
    return `${o.title}\n${o.links}\n## Contents\n\n${o.contents}${o.body}`;
  };
  const base = { "docs/other.md": "# Other\n\n## Section one\n" };

  it("passes a correct README", () => {
    expectNone({ ...base, "README.md": readme() });
  });
  it("flags a link to a missing file", () => {
    expectOne("A9-readme", { ...base, "README.md": readme({ links: "See [gone](docs/gone.md).\n" }) });
  });
  it("flags an anchor that matches no heading", () => {
    expectOne("A9-readme", { ...base, "README.md": readme({ links: "See [o](docs/other.md#nope).\n" }) });
  });
  it("flags a Contents list that differs from the headings", () => {
    expectOne("A9-readme", { ...base, "README.md": readme({ contents: "- [Two](#two)\n- [One](#one)\n" }) });
  });
  it("flags a second # heading", () => {
    expectOne("A9-readme", {
      ...base,
      "README.md": readme({ body: "\n## One\n\n# Another title\n\n## Two\n" }),
    });
  });
  it("flags a README longer than 450 lines", () => {
    expectOne("A9-readme", { ...base, "README.md": readme({ body: `\n## One\n\n## Two\n${"filler\n".repeat(460)}` }) });
  });
});

describe("the command line", () => {
  it("passes on a clean fixture and fails on a broken one", () => {
    const script = join(import.meta.dirname, "check-architecture.mjs");
    const clean = fixture({ "a.txt": "hi\n" });
    execFileSync(process.execPath, [script, "--root", clean], { stdio: "ignore" });
    const broken = fixture({ Dockerfile: "FROM scratch\n" });
    assert.throws(() => execFileSync(process.execPath, [script, "--root", broken], { stdio: "ignore" }));
  });
});

// yarn doctor: checks the installation, versions and settings. Exits 1 if any check fails.
// Run with `node --env-file=.env scripts/doctor.mjs [--strict]`.
import { execFileSync, spawnSync } from "node:child_process";
import { accessSync, constants, existsSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const strict = process.argv.includes("--strict");
const rows = [];
let failed = false;

function report(status, name, detail = "") {
  rows.push({ status, name, detail });
  if (status === "FAIL") failed = true;
}
const ok = (name, detail) => report("ok", name, detail);
const fail = (name, hint) => report("FAIL", name, hint);
const warn = (name, hint) => report("warn", name, hint);

// "26.13.1" -> [26, 13, 1]; a version is "at least" another when it is not lower.
const parse = (v) => v.split(".").map((n) => Number.parseInt(n, 10) || 0);
function atLeast(actual, minimum) {
  const a = parse(actual);
  const m = parse(minimum);
  for (let i = 0; i < Math.max(a.length, m.length); i++) {
    const d = (a[i] ?? 0) - (m[i] ?? 0);
    if (d !== 0) return d > 0;
  }
  return true;
}

function keysOf(text) {
  const keys = [];
  for (const line of text.split(/\r?\n/)) {
    const m = /^\s*([A-Z][A-Z0-9_]*)\s*=/.exec(line);
    if (m) keys.push(m[1]);
  }
  return keys;
}

async function check(name, fn) {
  try {
    await fn();
  } catch (err) {
    fail(name, err instanceof Error ? err.message : String(err));
  }
}

// 1. Node and Yarn
await check("node and yarn", () => {
  const node = process.versions.node;
  if (!atLeast(node, "26.13.1")) return fail("node", `found ${node}, need 26.13.1 or later`);
  const yarn = execFileSync("yarn --version", { shell: true, cwd: root, encoding: "utf8" }).trim();
  if (yarn !== "4.19.0") return fail("yarn", `found ${yarn}, need 4.19.0 (run: corepack enable)`);
  ok("node and yarn", `node ${node}, yarn ${yarn}`);
});

// 2. Python
await check("python", () => {
  const r = spawnSync("py", ["-3.14", "--version"], { encoding: "utf8" });
  const m = /Python (\d+\.\d+\.\d+)/.exec(`${r.stdout}${r.stderr}`);
  if (!m) return fail("python", "py -3.14 --version printed nothing useful: install Python 3.14");
  if (!atLeast(m[1], "3.14.10")) return fail("python", `found ${m[1]}, need 3.14.10 or later`);
  ok("python", m[1]);
});

// 3. .env
let envKeys = [];
await check(".env", () => {
  const examplePath = join(root, ".env.example");
  const envPath = join(root, ".env");
  if (!existsSync(envPath)) return fail(".env", "missing: copy .env.example to .env and fill it in");
  const wanted = keysOf(readFileSync(examplePath, "utf8"));
  envKeys = keysOf(readFileSync(envPath, "utf8"));
  const missing = wanted.filter((k) => !envKeys.includes(k));
  if (missing.length) return fail(".env", `missing keys: ${missing.join(", ")}`);
  if (!/^[0-9a-f]{64}$/.test(process.env.INTERNAL_TOKEN ?? "")) {
    return fail(".env", "INTERNAL_TOKEN must be 64 lowercase hex characters");
  }
  ok(".env", `${wanted.length} keys present, INTERNAL_TOKEN valid`);
});

// 4. Postgres, through PG_ADMIN_URL
await check("postgres", async () => {
  if (!process.env.PG_ADMIN_URL) return fail("postgres", "PG_ADMIN_URL is not set");
  const { default: pg } = await import("pg");
  const client = new pg.Client({ connectionString: process.env.PG_ADMIN_URL });
  await client.connect();
  try {
    const v = await client.query("SELECT current_setting('server_version_num')::int AS v");
    const l = await client.query("SELECT current_setting('listen_addresses') AS v");
    const x = await client.query(
      "SELECT default_version FROM pg_available_extensions WHERE name = 'vector'",
    );
    const problems = [];
    if (v.rows[0].v < 190000) problems.push(`server_version_num ${v.rows[0].v}, need 190000 or higher`);
    if (l.rows[0].v !== "localhost") problems.push(`listen_addresses is '${l.rows[0].v}', need 'localhost'`);
    if (!x.rows.length) problems.push("the vector extension is not installed");
    else if (!atLeast(x.rows[0].default_version, "0.8.7")) {
      problems.push(`pgvector ${x.rows[0].default_version}, need 0.8.7 or later`);
    }
    if (problems.length) return fail("postgres", problems.join("; "));
    ok("postgres", `version_num ${v.rows[0].v}, localhost only, pgvector ${x.rows[0].default_version}`);
  } finally {
    await client.end();
  }
});

// 5. LibreOffice
await check("libreoffice", () => {
  const path = process.env.SOFFICE_PATH;
  if (!path || !existsSync(path)) return fail("libreoffice", `SOFFICE_PATH not found: ${path ?? "(unset)"}`);
  // On Windows, running soffice.exe --version opens a console window and prints nothing,
  // so read the version from the exe's file properties instead.
  const ps = spawnSync(
    "powershell",
    ["-NoProfile", "-Command", "(Get-Item -LiteralPath $env:SOFFICE_PATH).VersionInfo.FileVersion"],
    { encoding: "utf8", windowsHide: true },
  );
  const version = (ps.stdout ?? "").trim();
  if (!version) return fail("libreoffice", "could not read the version");
  if (!atLeast(version, "26.8.3")) return fail("libreoffice", `found ${version}, need 26.8.3 or later`);
  ok("libreoffice", version);
});

// 6. Data folders
await check("folders", () => {
  const bad = [];
  for (const name of ["UPLOAD_DIR", "WRITE_DIR", "MODEL_CACHE_DIR"]) {
    const dir = process.env[name];
    if (!dir || !existsSync(dir)) {
      bad.push(`${name} does not exist (${dir ?? "unset"})`);
      continue;
    }
    try {
      accessSync(dir, constants.W_OK);
      const probe = join(dir, `.doctor-${process.pid}`);
      writeFileSync(probe, "");
      unlinkSync(probe);
    } catch {
      bad.push(`${name} is not writable (${dir})`);
    }
  }
  if (bad.length) return fail("folders", bad.join("; "));
  ok("folders", "upload, write and model-cache folders are writable");
});

// 7. Not in OneDrive
await check("onedrive", () => {
  const segments = root.split(sep).map((s) => s.toLowerCase());
  const oneDrive = process.env.OneDrive ? resolve(process.env.OneDrive).toLowerCase() : null;
  const inside = oneDrive && (root.toLowerCase() === oneDrive || root.toLowerCase().startsWith(oneDrive + sep));
  if (segments.some((s) => s.includes("onedrive")) || inside) {
    return fail("onedrive", `the repository is under OneDrive (${root}): move it`);
  }
  ok("onedrive", "repository is outside OneDrive");
});

// 8. Model endpoint (a warning unless --strict)
await check("model endpoint", async () => {
  const base = process.env.LLM_BASE_URL;
  const model = process.env.LLM_MODEL;
  const bad = (hint) => (strict ? fail("model endpoint", hint) : warn("model endpoint", hint));
  if (!base) return bad("LLM_BASE_URL is not set");
  try {
    const res = await fetch(`${base.replace(/\/+$/, "")}/models`, {
      headers: { authorization: `Bearer ${process.env.LLM_API_KEY ?? ""}` },
      signal: AbortSignal.timeout(10_000),
    });
    if (res.status !== 200) return bad(`GET /models returned ${res.status}`);
    const body = await res.json();
    const ids = (body.data ?? body.models ?? []).map((m) => m.id ?? m.name);
    if (!ids.includes(model)) return bad(`${model} is not in the model list`);
    ok("model endpoint", `${model} is available`);
  } catch (err) {
    bad(`cannot reach ${base}: ${err instanceof Error ? err.message : err}`);
  }
});

const width = Math.max(...rows.map((r) => r.name.length));
for (const r of rows) {
  console.log(`${r.status.padEnd(4)}  ${r.name.padEnd(width)}  ${r.detail}`);
}
process.exit(failed ? 1 : 0);

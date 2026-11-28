// Database scripts: `migrate` applies db/schema.sql, `reset` recreates databases.
// Usage: node --env-file=.env scripts/db.mjs migrate
//        node --env-file=.env scripts/db.mjs reset [--main|--test|--eval|--all]
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import pg from "pg";

const SCHEMA_FILE = fileURLToPath(new URL("../db/schema.sql", import.meta.url));
const APP_ROLE = "taskmaster";
const TARGETS = {
  "--main": "DATABASE_URL",
  "--test": "TEST_DATABASE_URL",
  "--eval": "EVAL_DATABASE_URL",
};

function fail(message, code = 1) {
  console.error(message);
  process.exit(code);
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) fail(`${name} is not set. Copy .env.example to .env and fill it in.`, 2);
  return value;
}

// The database name is the last path segment of the URL.
function databaseName(envName) {
  const name = decodeURIComponent(new URL(requireEnv(envName)).pathname.replace(/^\/+/, ""));
  if (!/^[a-z_][a-z0-9_]*$/.test(name)) {
    fail(`${envName}: database name "${name}" must be lowercase letters, digits and underscores.`, 2);
  }
  return name;
}

function withDatabase(url, name) {
  const next = new URL(url);
  next.pathname = `/${name}`;
  return next.toString();
}

async function withClient(url, fn) {
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

async function applySchema(url) {
  const sql = await readFile(SCHEMA_FILE, "utf8");
  await withClient(url, (client) => client.query(sql)); // no parameters: runs every statement
}

async function migrate() {
  const url = requireEnv("DATABASE_URL");
  const applied = await withClient(url, async (client) => {
    const { rows } = await client.query("SELECT to_regclass('public.workspaces') IS NOT NULL AS applied");
    return rows[0].applied;
  });
  if (applied) fail("schema already applied; use yarn db:reset");
  await applySchema(url);
  console.log(`schema applied to ${databaseName("DATABASE_URL")}`);
}

async function resetOne(envName) {
  const adminUrl = requireEnv("PG_ADMIN_URL");
  const name = databaseName(envName);
  const appUrl = requireEnv(envName);

  await withClient(adminUrl, async (client) => {
    const db = client.escapeIdentifier(name);
    await client.query("DROP DATABASE IF EXISTS " + db + " WITH (FORCE)");
    await client.query("CREATE DATABASE " + db + " OWNER " + client.escapeIdentifier(APP_ROLE));
  });
  await withClient(withDatabase(adminUrl, name), async (client) => {
    await client.query("CREATE EXTENSION vector");
    await client.query("GRANT ALL ON SCHEMA public TO " + client.escapeIdentifier(APP_ROLE));
  });
  await applySchema(appUrl);
  console.log(`reset ${name}`);
}

async function reset(flags) {
  const chosen = new Set();
  for (const flag of flags) {
    if (flag === "--all") Object.keys(TARGETS).forEach((key) => chosen.add(key));
    else if (flag in TARGETS) chosen.add(flag);
    else fail(`unknown option ${flag}; use --main, --test, --eval or --all`, 2);
  }
  if (chosen.size === 0) chosen.add("--main");
  for (const flag of Object.keys(TARGETS)) {
    if (chosen.has(flag)) await resetOne(TARGETS[flag]);
  }
}

const [command, ...rest] = process.argv.slice(2);
try {
  if (command === "migrate" && rest.length === 0) await migrate();
  else if (command === "reset") await reset(rest);
  else fail("usage: db.mjs migrate | db.mjs reset [--main|--test|--eval|--all]", 2);
} catch (error) {
  fail(`db ${command ?? ""} failed: ${error.message}`);
}

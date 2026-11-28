import type { FastifyInstance } from "fastify";
import pg from "pg";
import { buildApp } from "../src/app.ts";
import { loadConfig } from "../src/config.ts";

/** The database the tests use. `TEST_DATABASE_URL` takes the place of `DATABASE_URL`. */
export function testDatabaseUrl(): string {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error("TEST_DATABASE_URL is not set (see .env.example)");
  return url;
}

/** Builds the app on the test database, with logging off. */
export async function makeApp(): Promise<FastifyInstance> {
  const config = loadConfig({ ...process.env, DATABASE_URL: testDatabaseUrl() });
  return buildApp({ ...config, logger: false });
}

/** Valid Host and X-TaskMaster headers; add or override entries as a test needs. */
export function headers(extra: Record<string, string> = {}): Record<string, string> {
  return { host: "localhost:3001", "x-taskmaster": "1", ...extra };
}

/**
 * Empties every table in `public` except `eval_*`, and restarts their sequences.
 * It refuses to run unless the database name ends in `_test`.
 */
export async function resetDb(): Promise<void> {
  const url = testDatabaseUrl();
  const dbName = new URL(url).pathname.slice(1);
  if (!dbName.endsWith("_test")) throw new Error(`resetDb refuses to truncate "${dbName}": not a _test database`);

  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    await client.query(`
      DO $$
      DECLARE tables text;
      BEGIN
        SELECT string_agg(format('%I.%I', schemaname, tablename), ', ') INTO tables
        FROM pg_tables
        WHERE schemaname = 'public' AND tablename !~ '^eval_';
        IF tables IS NOT NULL THEN
          EXECUTE 'TRUNCATE ' || tables || ' RESTART IDENTITY CASCADE';
        END IF;
      END $$;
    `);
  } finally {
    await client.end();
  }
}

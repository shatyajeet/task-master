import pg from "pg";

/** One pool for the whole process: at most 10 connections. It connects on first use. */
export function createPool(databaseUrl: string): pg.Pool {
  return new pg.Pool({ connectionString: databaseUrl, max: 10 });
}

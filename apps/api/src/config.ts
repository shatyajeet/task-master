export interface Config {
  host: string;
  port: number;
  databaseUrl: string;
  logger: boolean;
}

export const HOST = "127.0.0.1";
export const PORT = 3001;
export const WEB_ORIGIN = "http://localhost:3000";

/** Builds the config from an environment object. A missing DATABASE_URL stops start-up. */
export function loadConfig(env: NodeJS.ProcessEnv): Config {
  const databaseUrl = env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is not set (see .env.example)");
  return { host: HOST, port: PORT, databaseUrl, logger: true };
}

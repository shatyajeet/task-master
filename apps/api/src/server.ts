import { buildApp } from "./app.ts";
import { loadConfig } from "./config.ts";

const config = loadConfig(process.env);
const app = await buildApp(config);

async function shutdown(): Promise<void> {
  await app.close();
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

await app.listen({ host: "127.0.0.1", port: 3001 });

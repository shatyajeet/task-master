import cors from "@fastify/cors";
import Fastify from "fastify";
import type { FastifyInstance } from "fastify";
import type pg from "pg";
import { WEB_ORIGIN } from "./config.ts";
import type { Config } from "./config.ts";
import { createPool } from "./db.ts";
import { registerErrors } from "./errors.ts";
import { registerThreadRoutes } from "./routes/threads.ts";
import { registerWorkspaceRoutes } from "./routes/workspaces.ts";
import { registerSecurity } from "./security.ts";

declare module "fastify" {
  interface FastifyInstance {
    db: pg.Pool;
  }
}

/** Builds the API without listening, so tests can use `app.inject`. */
export async function buildApp(config: Config): Promise<FastifyInstance> {
  const app = Fastify({ logger: config.logger });

  const db = createPool(config.databaseUrl);
  app.decorate("db", db);
  app.addHook("onClose", async () => {
    await db.end();
  });

  registerSecurity(app, config.port);
  registerErrors(app);
  await app.register(cors, {
    origin: WEB_ORIGIN,
    methods: ["GET", "POST", "PATCH", "DELETE"],
    allowedHeaders: ["Content-Type", "X-TaskMaster"],
  });

  app.get(
    "/health",
    {
      schema: {
        response: {
          200: {
            type: "object",
            properties: { ok: { type: "boolean" } },
            required: ["ok"],
            additionalProperties: false,
          },
        },
      },
    },
    async () => ({ ok: true }),
  );

  registerWorkspaceRoutes(app, config.uploadDir);
  registerThreadRoutes(app);

  return app;
}

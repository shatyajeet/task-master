import type { FastifyInstance } from "fastify";
import { WEB_ORIGIN } from "./config.ts";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Local-only checks that run in an onRequest hook, before any route handler.
 * Call this on the root instance, and before CORS is registered, so it covers every route.
 */
export function registerSecurity(app: FastifyInstance, port: number): void {
  const allowedHosts = new Set([`localhost:${port}`, `127.0.0.1:${port}`]);

  app.addHook("onRequest", async (request, reply) => {
    const host = request.headers.host;
    if (host === undefined || !allowedHosts.has(host.toLowerCase())) {
      return reply.status(403).send({ error: "forbidden_host", message: "Host not allowed" });
    }

    const origin = request.headers.origin;
    if (origin !== undefined && origin !== WEB_ORIGIN) {
      return reply.status(403).send({ error: "forbidden_origin", message: "Origin not allowed" });
    }

    if (!SAFE_METHODS.has(request.method) && request.headers["x-taskmaster"] !== "1") {
      return reply.status(403).send({ error: "missing_header", message: "X-TaskMaster: 1 is required" });
    }
  });
}

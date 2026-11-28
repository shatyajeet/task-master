import fs from "node:fs/promises";
import path from "node:path";
import type { FastifyInstance } from "fastify";
import { HttpError } from "../errors.ts";

export interface WorkspaceRow {
  id: string;
  name: string;
  created_at: Date;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A malformed ID cannot match any row, so it is a 404 and never reaches Postgres. */
export function requireUuid(value: string, what: string): string {
  if (!UUID.test(value)) throw new HttpError(404, "not_found", `${what} not found`);
  return value;
}

const nameBody = {
  type: "object",
  properties: { name: { type: "string", minLength: 1, maxLength: 200 } },
  required: ["name"],
  additionalProperties: false,
} as const;

const COLUMNS = "id, name, created_at";

export function registerWorkspaceRoutes(app: FastifyInstance, uploadDir: string): void {
  app.post<{ Body: { name: string } }>("/workspaces", { schema: { body: nameBody } }, async (request, reply) => {
    const { rows } = await app.db.query<WorkspaceRow>(`INSERT INTO workspaces (name) VALUES ($1) RETURNING ${COLUMNS}`, [
      request.body.name,
    ]);
    return reply.status(201).send(rows[0]);
  });

  app.get("/workspaces", async () => {
    const { rows } = await app.db.query<WorkspaceRow>(
      `SELECT ${COLUMNS} FROM workspaces ORDER BY created_at DESC, id DESC`,
    );
    return rows;
  });

  app.get<{ Params: { wid: string } }>("/workspaces/:wid", async (request) => {
    const wid = requireUuid(request.params.wid, "Workspace");
    const { rows } = await app.db.query<WorkspaceRow>(`SELECT ${COLUMNS} FROM workspaces WHERE id = $1`, [wid]);
    if (rows.length === 0) throw new HttpError(404, "not_found", "Workspace not found");
    return rows[0];
  });

  app.patch<{ Params: { wid: string }; Body: { name: string } }>(
    "/workspaces/:wid",
    { schema: { body: nameBody } },
    async (request) => {
      const wid = requireUuid(request.params.wid, "Workspace");
      const { rows } = await app.db.query<WorkspaceRow>(
        `UPDATE workspaces SET name = $2 WHERE id = $1 RETURNING ${COLUMNS}`,
        [wid, request.body.name],
      );
      if (rows.length === 0) throw new HttpError(404, "not_found", "Workspace not found");
      return rows[0];
    },
  );

  app.delete<{ Params: { wid: string } }>("/workspaces/:wid", async (request, reply) => {
    const wid = requireUuid(request.params.wid, "Workspace");
    const { rowCount } = await app.db.query("DELETE FROM workspaces WHERE id = $1", [wid]);
    if (rowCount === 0) throw new HttpError(404, "not_found", "Workspace not found");
    // The row is gone (and its documents, threads, runs and artifacts with it). Now the files.
    await fs.rm(path.join(uploadDir, wid), { recursive: true, force: true });
    return reply.status(204).send();
  });
}

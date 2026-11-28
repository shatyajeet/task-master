import type { FastifyInstance } from "fastify";
import { HttpError } from "../errors.ts";
import { requireUuid } from "./workspaces.ts";

interface ThreadRow {
  id: string;
  workspace_id: string;
  title: string;
  created_at: Date;
}

interface MessageRow {
  id: string;
  workspace_id: string;
  thread_id: string;
  run_id: string | null;
  role: "user" | "assistant" | "tool";
  content: string;
  tool_name: string | null;
  created_at: Date;
}

const COLUMNS = "id, workspace_id, title, created_at";
const MESSAGE_COLUMNS = "id, workspace_id, thread_id, run_id, role, content, tool_name, created_at";

const title = { type: "string", minLength: 1, maxLength: 200 } as const;

type Params = { wid: string; tid: string };

export function registerThreadRoutes(app: FastifyInstance): void {
  async function requireWorkspace(wid: string): Promise<void> {
    const { rowCount } = await app.db.query("SELECT 1 FROM workspaces WHERE id = $1", [wid]);
    if (rowCount === 0) throw new HttpError(404, "not_found", "Workspace not found");
  }

  async function requireThread(wid: string, tid: string): Promise<void> {
    const { rowCount } = await app.db.query("SELECT 1 FROM threads WHERE id = $1 AND workspace_id = $2", [tid, wid]);
    if (rowCount === 0) throw new HttpError(404, "not_found", "Thread not found");
  }

  app.post<{ Params: { wid: string }; Body: { title?: string } | null }>(
    "/workspaces/:wid/threads",
    {
      schema: {
        body: {
          type: ["object", "null"],
          properties: { title },
          additionalProperties: false,
        },
      },
    },
    async (request, reply) => {
      const wid = requireUuid(request.params.wid, "Workspace");
      await requireWorkspace(wid);
      const given = request.body?.title;
      // Without a title the column default ('New thread') applies.
      const { rows } =
        given === undefined
          ? await app.db.query<ThreadRow>(`INSERT INTO threads (workspace_id) VALUES ($1) RETURNING ${COLUMNS}`, [wid])
          : await app.db.query<ThreadRow>(
              `INSERT INTO threads (workspace_id, title) VALUES ($1, $2) RETURNING ${COLUMNS}`,
              [wid, given],
            );
      return reply.status(201).send(rows[0]);
    },
  );

  app.get<{ Params: { wid: string } }>("/workspaces/:wid/threads", async (request) => {
    const wid = requireUuid(request.params.wid, "Workspace");
    await requireWorkspace(wid);
    const { rows } = await app.db.query<ThreadRow>(
      `SELECT ${COLUMNS} FROM threads WHERE workspace_id = $1 ORDER BY created_at DESC, id DESC`,
      [wid],
    );
    return rows;
  });

  app.patch<{ Params: Params; Body: { title: string } }>(
    "/workspaces/:wid/threads/:tid",
    {
      schema: {
        body: { type: "object", properties: { title }, required: ["title"], additionalProperties: false },
      },
    },
    async (request) => {
      const wid = requireUuid(request.params.wid, "Workspace");
      const tid = requireUuid(request.params.tid, "Thread");
      const { rows } = await app.db.query<ThreadRow>(
        `UPDATE threads SET title = $3 WHERE id = $2 AND workspace_id = $1 RETURNING ${COLUMNS}`,
        [wid, tid, request.body.title],
      );
      if (rows.length === 0) throw new HttpError(404, "not_found", "Thread not found");
      return rows[0];
    },
  );

  app.delete<{ Params: Params }>("/workspaces/:wid/threads/:tid", async (request, reply) => {
    const wid = requireUuid(request.params.wid, "Workspace");
    const tid = requireUuid(request.params.tid, "Thread");
    // One statement, so a run cannot become active between the check and the delete.
    const { rowCount } = await app.db.query(
      `DELETE FROM threads
       WHERE id = $2 AND workspace_id = $1
         AND NOT EXISTS (
           SELECT 1 FROM runs WHERE thread_id = threads.id AND status IN ('queued','running','awaiting_approval')
         )`,
      [wid, tid],
    );
    if (rowCount === 0) {
      // Either there is no such thread, or it has an active run.
      await requireThread(wid, tid);
      throw new HttpError(409, "active_run", "The thread has an active run");
    }
    return reply.status(204).send();
  });

  app.get<{ Params: Params }>("/workspaces/:wid/threads/:tid/messages", async (request) => {
    const wid = requireUuid(request.params.wid, "Workspace");
    const tid = requireUuid(request.params.tid, "Thread");
    await requireThread(wid, tid);
    const { rows } = await app.db.query<MessageRow>(
      `SELECT ${MESSAGE_COLUMNS} FROM messages WHERE thread_id = $1 AND workspace_id = $2
       ORDER BY created_at ASC, id ASC`,
      [tid, wid],
    );
    return rows;
  });
}

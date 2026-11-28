---
step: S07
title: "Workspaces and threads API"
status: not-started
started:
completed:
---

# S07 · Workspaces and threads API

**Read before starting:** [README: rules and choices](../README.md) · [progress.md](../progress.md) · [Fastify REST API](../contracts.md#fastify-rest-api)

**Needs:** S06

**Creates:** `apps/api/src/routes/workspaces.ts`, `src/routes/threads.ts`, `test/workspaces.test.ts`, `test/threads.test.ts`

**Build**

- Build the routes for workspaces and threads, and `GET .../threads/:tid/messages`, as the Contracts table defines them.
- Deleting a workspace removes the database row (which cascades), then `UPLOAD_DIR\<wid>` with `fs.rm(..., {recursive: true, force: true})`.
- Deleting a thread that has an active run returns 409 `active_run`.
- Tests:
  1. Create, list, get, rename and delete a workspace, checking every response body's exact keys.
  2. A name of 0 characters returns 400, and so does a name of 201 characters.
  3. Lists come back newest first.
  4. A thread from workspace A requested under workspace B returns 404.
  5. Deleting a workspace removes its upload folder.
  6. Deleting a thread with an active run (inserted directly into the database) returns 409.

**Verify:** `yarn workspace @taskmaster/api test`.

## Finish

1. Every **Verify** command above exits 0, and so does `yarn check:arch`.
2. Add the S07 entry to [progress.md](../progress.md).
3. Set `status: done` and `completed:` at the top of this file.
4. Commit everything as `S07: Workspaces and threads API`.

## Blocked

Empty unless `status: blocked`. Then: what failed, the exact error, and what the user needs to decide.

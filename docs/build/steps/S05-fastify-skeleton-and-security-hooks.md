---
step: S05
title: "Fastify skeleton and security hooks"
status: done
started: 2026-11-29
completed: 2026-11-29
---

# S05 · Fastify skeleton and security hooks

**Read before starting:** [README: rules and choices](../README.md) · [progress.md](../progress.md) · [Ports and environment](../contracts.md#ports-and-environment) · [Fastify REST API](../contracts.md#fastify-rest-api)

**Needs:** S04

**Creates:**
- `apps/api/package.json`, `apps/api/tsconfig.json`
- `apps/api/src/server.ts`, `src/app.ts`, `src/config.ts`, `src/db.ts`, `src/security.ts`, `src/errors.ts`
- `apps/api/test/helpers.ts`, `test/security.test.ts`

**Build**

- `package.json`: name `@taskmaster/api`.
  - Dependencies: `fastify@^5.12.8`, `@fastify/cors`, `@fastify/multipart`, `pg@^8.23.1`.
  - devDependencies: `@types/pg`, `@types/node`, `typescript`.
  - Scripts:
    - `dev`: `node --env-file=../../.env --watch src/server.ts`
    - `test`: `node --env-file=../../.env --test --test-concurrency=1 "test/**/*.test.ts"`
    - `typecheck`: `tsc -p .`
- `buildApp(config)` in `app.ts` returns a Fastify instance without calling `listen`, so tests use `app.inject`. `server.ts` calls `listen({host: "127.0.0.1", port: 3001})`.
- `src/security.ts` registers an `onRequest` hook that runs before routing:
  1. The `Host` header must be `localhost:3001` or `127.0.0.1:3001`, or it returns 403 `forbidden_host`.
  2. If an `Origin` header is present, it must be `http://localhost:3000`, or it returns 403 `forbidden_origin`.
  3. For a method other than GET, HEAD or OPTIONS, `X-TaskMaster` must equal `1`, or it returns 403 `missing_header`.
- `@fastify/cors` is configured with origin `http://localhost:3000`, methods `GET, POST, PATCH, DELETE`, and allowed headers `Content-Type, X-TaskMaster`.
- `src/errors.ts` maps every error to `{error, message}`. Validation errors from Fastify's JSON schemas become 400 `validation`.
- `src/db.ts` holds one `pg.Pool` (max 10) on `DATABASE_URL`. Tests override it with `TEST_DATABASE_URL`.
- Every route declares a JSON schema for its params, query and body.
- `test/helpers.ts` provides `resetDb()`, which truncates every table except `eval_*` with `RESTART IDENTITY CASCADE`, and `headers()`, which returns valid Host and `X-TaskMaster` headers.
- Tests:
  1. `GET /health` returns 200.
  2. The wrong Host returns 403 `forbidden_host`.
  3. A POST with `Origin: http://evil.example` returns 403 `forbidden_origin`.
  4. A POST without `X-TaskMaster` returns 403 `missing_header`.
  5. A preflight `OPTIONS` from `http://localhost:3000` gets `Access-Control-Allow-Origin: http://localhost:3000`.

**Verify:** `yarn workspace @taskmaster/api test` and `yarn workspace @taskmaster/api typecheck`.

## Finish

1. Every **Verify** command above exits 0, and so does `yarn check:arch`.
2. Update [README.md](../../README.md) as [AGENTS.md](../../AGENTS.md#keeping-readmemd-current) describes, or note in the progress entry why no change was needed.
3. Add the S05 entry to [progress.md](../progress.md).
4. Set `status: done` and `completed:` at the top of this file.
5. Commit everything as `S05: Fastify skeleton and security hooks`.

## Blocked

Empty unless `status: blocked`. Then: what failed, the exact error, and what the user needs to decide.

---
step: S06
title: "Next.js skeleton, CSP and `yarn dev`"
status: done
started: 2026-11-29
completed: 2026-11-29
---

# S06 · Next.js skeleton, CSP and `yarn dev`

**Read before starting:** [README: rules and choices](../README.md) · [progress.md](../progress.md) · [Ports and environment](../contracts.md#ports-and-environment)

**Needs:** S05

**Creates:**
- `apps/web/package.json`, `apps/web/tsconfig.json`, `apps/web/next.config.ts`, `apps/web/proxy.ts`
- `apps/web/app/layout.tsx`, `app/page.tsx`, `app/globals.css`
- `apps/web/lib/api.ts`, `apps/web/lib/config.ts`
- `apps/web/playwright.config.ts`, `apps/web/e2e/smoke.spec.ts`
- `scripts/dev.mjs`, `scripts/health.mjs`

**Build**

- `package.json`: name `@taskmaster/web`.
  - Dependencies: `next@^16.4.6`, `react@^19.3.1`, `react-dom@^19.3.1`, `react-markdown`, `remark-gfm`.
  - devDependencies: `typescript`, `@types/react`, `@types/react-dom`, `@types/node`, `@playwright/test`.
  - Scripts:
    - `dev`: `next dev -H 127.0.0.1 -p 3000`
    - `build`: `next build`
    - `typecheck`: `tsc -p .`
    - `e2e`: `playwright test`
- `lib/config.ts` sets `API_URL = "http://localhost:3001"`.
- `lib/api.ts` is the only code that calls Fastify. It is a `request(method, path, body?)` that:
  - adds `X-TaskMaster: 1` to every method except GET
  - throws `ApiError{status, error, message}` when a response is not OK
  - has typed functions for every REST route
- The web app contains no business logic and no Next.js API routes. Every page is a client component that calls `lib/api.ts`.
- `proxy.ts` (G13) returns 403 unless the Host is `localhost:3000` or `127.0.0.1:3000`.
- `next.config.ts` sends these headers on every response:
  - `Content-Security-Policy`:

    ```text
    default-src 'self'; script-src 'self' 'unsafe-inline'<dev: 'unsafe-eval'>; style-src 'self' 'unsafe-inline';
    img-src 'self' data:; connect-src 'self' http://localhost:3001<dev: ws://localhost:3000 ws://127.0.0.1:3000>;
    frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'self'
    ```

    The parts marked `<dev: …>` are included only when `NODE_ENV=development`.
  - `X-Content-Type-Options: nosniff`
  - `Referrer-Policy: no-referrer`
- `scripts/dev.mjs` starts four processes, each with output prefixed `[web]`, `[api]`, `[agent]` or `[ocr]`:
  - `yarn workspace @taskmaster/web dev`
  - `yarn workspace @taskmaster/api dev`
  - `node scripts/py.mjs agent -m app.serve`
  - `node scripts/py.mjs ocr -m app.serve`

  If one process exits, or on Ctrl+C, it stops all of them with `taskkill /T /F /PID`.

  With `--e2e`, it also starts the stub LLM (`node scripts/py.mjs agent -m tests.stub_llm --port 8099 --script services/agent/tests/scripts/default.json`, added in S13) and overrides these variables:
  - `DATABASE_URL` = `TEST_DATABASE_URL`
  - `LLM_BASE_URL` = `http://127.0.0.1:8099/v1`, `LLM_MODEL` = `stub`
  - `UPLOAD_DIR`, `WRITE_DIR` = `.cache/e2e/uploads`, `.cache/e2e/out`
  - `APPROVAL_TIMEOUT_SECONDS` = `86400`
- `scripts/health.mjs` polls the `/health` of ports 3001, 8000 and 8001, plus `/` on port 3000, every second for up to 60 seconds. It exits 0 once all four respond and 1 otherwise.
- `playwright.config.ts`: Chromium only, `workers: 1`, `retries: 0`, base URL `http://localhost:3000`. Its `webServer` runs `yarn dev --e2e` from the repository root and waits for `http://localhost:3000`.
- `e2e/smoke.spec.ts`:
  1. The home page renders the heading "Workspaces".
  2. The response's CSP header contains `img-src 'self' data:`.
  3. A request with `Host: evil.example:3000` gets 403.

**Verify**

```text
yarn workspace @taskmaster/web playwright install chromium
yarn workspace @taskmaster/web typecheck
yarn dev           # in one terminal
node scripts/health.mjs   # in another terminal; exits 0
yarn e2e           # stop `yarn dev` first
```

## Finish

1. Every **Verify** command above exits 0, and so does `yarn check:arch`.
2. Update [README.md](../../README.md) as [AGENTS.md](../../AGENTS.md#keeping-readmemd-current) describes, or note in the progress entry why no change was needed.
3. Add the S06 entry to [progress.md](../progress.md).
4. Set `status: done` and `completed:` at the top of this file.
5. Commit everything as `S06: Next.js skeleton, CSP and yarn dev`.

## Blocked

Empty unless `status: blocked`. Then: what failed, the exact error, and what the user needs to decide.

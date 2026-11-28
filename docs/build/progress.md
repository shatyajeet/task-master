# Build progress

What each finished step actually built, so an agent starting the next step knows the state of the code without reading all of it. Read this before starting any step.

The agent that finishes a step adds that step's entry at the bottom, in the same commit as the code.

## How to write an entry

- Keep each entry under 20 lines. Link to files; don't paste code.
- Record facts a later step needs: names, entry points, commands, versions the lockfile resolved, and anything surprising.
- **Deviations** are anything that differs from the step file: a different file name, an API that didn't behave as the plan assumed, an extra helper. Say why for each one. If there were none, write "None".
- **Plan files changed** lists every edit to `contracts.md`, a later step file, `allowed-dependencies.json` or `check-architecture.mjs` made in this step, each agreed with the user. If there were none, write "None".
- **README** is required. Either list the README sections this step changed, or write `no change needed` with the reason.
- **Architecture impact** is required. Either name the architecture sections you checked this step's work against and confirm it matches them, or name the `ARCH:` commit the user agreed to. An entry without it is incomplete, and so is the step.

Template:

```markdown
### S<NN> · <title> (<YYYY-MM-DD>)

- **Built:** what now exists and works, in one to three lines.
- **Key files:** [path](../../path), [path](../../path)
- **Commands:** new or changed commands, if any.
- **Deviations:** None. | What differs from the step file, and why.
- **Plan files changed:** None. | `contracts.md` § Fastify REST API: what changed. `S12`: what changed.
- **README:** Updated § Everyday commands, § Setup; status block now S01 to S<NN>. | No change needed: <reason>.
- **Architecture impact:** None; matches § OCR service, § Local-only access. | Agreed change in commit `ARCH: <summary>`.
- **Notes for later steps:** what the next steps should know, if anything.
```

## Entries

### S01 · Machine setup (2026-11-29)

- **Built:** The laptop now has Postgres 19.0 on `localhost` only, pgvector 0.8.7, Python 3.14.10, LibreOffice 26.8.3.1, Node v26.13.1, the `taskmaster` role, and the three folders under `C:\taskmaster-data`. The repository is outside OneDrive. No repository code changed.
- **Key files:** [S01-machine-setup.md](steps/S01-machine-setup.md)
- **Commands:** None. Run `py -3.14` for Python until S02 adds `scripts/py.mjs`.
- **Deviations:**
  - Python 3.14 came from the Python install manager (`py install`), not `winget`, because it was already in place. `py -3.14 --version` reports 3.14.10.
  - `pg_hba.conf` has only the two loopback `host` lines, so local-socket and replication lines were removed (the step says to keep only these two). The originals are saved beside the files as `*.bak-s01`.
  - `soffice --version` prints nothing in a console on Windows, so 26.8.3.1 was read from the exe's file version.
  - The user ran the `psql` Verify command with the `postgres` password, which the agent does not have. It printed `19.0`, `localhost` and `0.8.7`. The user created the `taskmaster` role, and the agent did not check its login.
- **Plan files changed:** None.
- **README:** No change needed: S02 is not done yet, so the status block stays as is, and the setup text still matches the machine.
- **Architecture impact:** None; matches § Installing the services.
- **Notes for later steps:**
  - Postgres data folder is `C:\Program Files\PostgreSQL\19\data`.
  - pgvector was built in `%TEMP%\pgvector`, which can be deleted.
  - `PG_ADMIN_URL` and the `taskmaster` password go in `.env` (S02 onward), never in a commit.

### S02 · Repository skeleton and doctor (2026-11-29)

- **Built:** The Yarn 4.19.0 workspace root, `.env.example`, `yarn doctor` (8 checks), `scripts/py.mjs`, and `yarn check:arch` with rules A1 to A9. `yarn install` resolved `pg` 8.23.1 and `typescript` 5.9.3.
- **Key files:** [package.json](../../package.json), [doctor.mjs](../../scripts/doctor.mjs), [py.mjs](../../scripts/py.mjs), [check-architecture.mjs](../../scripts/check-architecture.mjs), [check-architecture.test.mjs](../../scripts/check-architecture.test.mjs), [.env.example](../../.env.example)
- **Commands:** `yarn doctor [--strict]`, `yarn check:arch [--root <dir>]`, `node --test scripts/check-architecture.test.mjs` (41 tests), `node scripts/py.mjs <agent|ocr> <args>`. The other scripts in `package.json` point at files that S03, S06 and S23 create.
- **Deviations:**
  - The LibreOffice check reads the version from the exe's file properties and never runs `soffice.exe --version`. On Windows that command opens a console window and prints nothing (also found in S01).
  - The source rules A2 to A7 skip `scripts/check-architecture.mjs` and its test, because they must spell out the forbidden patterns. Their manifests and rules A1, A8 and A9 still apply.
  - A2 also accepts `--hostname 127.0.0.1` as well as `-H`. A4 also scans `package.json` scripts. A5 also covers `executemany(`. A violation is reported once per rule per line.
  - `.gitignore` also lists `.yarn/install-state.gz`, a Yarn cache file.
  - The model-endpoint check warned in the final run (it could not reach the configured endpoint). The step makes that a warning unless `--strict`.
- **Plan files changed:** None.
- **README:** Updated the status block (now S01 to S02), § Repository layout, § Setup, § Everyday commands and § Testing and evals, with *(planned, S<NN>)* marks on everything that does not work yet.
- **Architecture impact:** None; matches § Local-only access, § Components and the fixed ports. The checker only reads the architecture's rules.
- **Notes for later steps:**
  - `.env` is git-ignored and holds real passwords. The agent never reads it, and the doctor reads only its key names.
  - `check:arch` reads files with `git ls-files`, so new files count as soon as they exist, even before `git add`.
  - Any new test fixture that needs a non-loopback URL must use a host ending in `.example`.

### S03 · Postgres schema and database scripts (2026-11-29)

- **Built:** `db/schema.sql` (15 tables, the `langgraph` schema, the `vector` extension, the `touch_updated_at` trigger), `yarn db:migrate` and `yarn db:reset [--main|--test|--eval|--all]`. All three databases were reset and the schema applied to each.
- **Key files:** [schema.sql](../../db/schema.sql), [db.mjs](../../scripts/db.mjs), [db.test.mjs](../../scripts/db.test.mjs)
- **Commands:** `yarn db:reset --all`, `yarn db:migrate` (exits 1 on a database that already has the schema), `node --env-file=.env --test scripts/db.test.mjs` (4 tests).
- **Deviations:**
  - `reset` accepts several flags together (`--test --eval`), and rejects an unknown flag with exit 2. The step names only the single flags.
  - Database names must be lowercase letters, digits and underscores. Statements that name a database use `escapeIdentifier`, since identifiers cannot be parameters.
  - The test for the one-active-run rule also checks that `done` and `cancelled` runs do not block a new one.
- **Plan files changed:** None.
- **README:** Updated the status block (now S01 to S03), § Repository layout, § Setup (step 5), § Everyday commands and § Testing and evals; removed the *(planned, S03)* marks.
- **Architecture impact:** None; matches § Data model and § Local-only access (`PG_ADMIN_URL` only creates databases and the extension; the app uses the `taskmaster` role).
- **Notes for later steps:**
  - `yarn db:reset` deletes data. Run `yarn db:reset --test` to clean the test database.
  - The `langgraph` schema is created empty; the LangGraph checkpointer's tables are created by the agent later.
  - `db.test.mjs` leaves the test database empty by deleting the workspaces it creates.

### S04 · Agent and OCR service skeletons (2026-11-29)

- **Built:** `services/agent` and `services/ocr`: a FastAPI app with `GET /health`, the Host and `X-Internal-Token` middleware, a pydantic-settings `Settings`, `app/serve.py` (G12), hashed lockfiles and pytest suites (agent 4 tests, OCR 3). Both venvs are installed from the lockfiles.
- **Key files:** [security.py](../../services/agent/app/security.py), [config.py](../../services/agent/app/config.py), [serve.py](../../services/agent/app/serve.py), [conftest.py](../../services/agent/tests/conftest.py), [requirements.txt](../../services/agent/requirements.txt), [OCR requirements.txt](../../services/ocr/requirements.txt)
- **Commands:** `yarn workspace @taskmaster/<agent|ocr> test` and `lint`, `yarn test` (runs both). `node --env-file=.env scripts/py.mjs <svc> -m app.serve` starts a service; both answered `/health` with 200 and `/x` without a token with 401.
- **Deviations:**
  - OCR's dependencies do not include `httpx`, so the tests call the ASGI app directly through a small `call()` helper in each `conftest.py` instead of using a test client. The agent uses the same helper.
  - `app/serve.py` has a `run_in_loop()` helper, which `main()` uses. The loop test runs a coroutine through it, because the pytest loop itself is not the server's.
  - The lockfiles were compiled without `--allow-unsafe`, so `pip` and `setuptools` are not pinned. With it, `pip.exe` cannot replace itself on Windows and the Verify command fails.
  - The middleware rejects duplicate `Host` or `X-Internal-Token` headers and closes websocket connections. `yarn install` ran once to register the two new workspaces in `yarn.lock`.
  - `pyproject.toml` also sets `asyncio_default_fixture_loop_scope = "function"` to silence a pytest-asyncio warning. After the step, at the user's request, [pyrightconfig.json](../../pyrightconfig.json) was added so the editor resolves both venvs at once (one `executionEnvironments` entry per service, pointing at its `.venv\Lib\site-packages`); it was only checked as valid JSON with existing paths, not run through pyright. The tests add `DATABASE_URL` (agent) and `INTERNAL_TOKEN` to the process environment.
- **Plan files changed:** None.
- **README:** Updated the status block (now S01 to S04), § Repository layout, § Setup (step 4 now installs the `-dev` files, and its planned mark is gone), § Everyday commands (`yarn test`) and § Testing and evals.
- **Architecture impact:** None; matches § Local-only access (Host check, internal token, `127.0.0.1` binding) and § Components (ports 8000 and 8001).
- **Notes for later steps:**
  - `Settings` requires `INTERNAL_TOKEN` (and `DATABASE_URL` in the agent), so a missing value stops the service at start-up. Resolved versions: fastapi 0.165.0, uvicorn 0.55.0, pytest 9.2.0, pytest-asyncio 1.5.0, rapidocr 3.10.0.
  - New routes go in `app/main.py` inside `create_app()`; the middleware wraps every route, so they are protected by default.
  - Later tests reuse `call()` from `conftest.py` or add a client. A new library needs the user's agreement.

### S05 · Fastify skeleton and security hooks (2026-11-29)

- **Built:** `apps/api` (`@taskmaster/api`): `buildApp(config)` returns a Fastify 5 instance without listening, with the `onRequest` security hook (Host, Origin, `X-TaskMaster`), CORS for `http://localhost:3000`, the `{error, message}` error handler, a `pg.Pool` (max 10) and `GET /health`. `server.ts` listens on `127.0.0.1:3001`.
- **Key files:** [app.ts](../../apps/api/src/app.ts), [security.ts](../../apps/api/src/security.ts), [errors.ts](../../apps/api/src/errors.ts), [config.ts](../../apps/api/src/config.ts), [db.ts](../../apps/api/src/db.ts), [helpers.ts](../../apps/api/test/helpers.ts), [security.test.ts](../../apps/api/test/security.test.ts)
- **Commands:** `yarn workspace @taskmaster/api test` (5 tests) and `typecheck`; `yarn typecheck` and `yarn test` now include the API. Resolved: fastify 5.12.8, @fastify/cors 11.4.3, @fastify/multipart 10.1.9, pg 8.23.1, typescript 7.0.2 (the whole repo, after the change described under Deviations). The real server answered `/health` with 200, was bound to `127.0.0.1:3001` only, and was stopped afterwards.
- **Deviations:**
  - `typescript` is `^7.0.2` in both the root and `apps/api`, so the whole repo uses one version. At the user's request the root range was raised from `^5.9.0` (S02). Before that, a throwaway Next 16.4.6 project outside the repository built on TypeScript 7.0.2 and still failed the build on a type error, so Next 16 works with it. The real `apps/web` is not built yet, so S06 must confirm it. The S02 entry above still says 5.9.3, which was true then.
  - `buildApp` is async (it awaits the CORS plugin) and creates its own pool and closes it on `app.close()`, instead of a module-level pool. `db.ts` exports `createPool(url)`, and the pool is `app.db`. Tests pass `TEST_DATABASE_URL` through `loadConfig`.
  - `resetDb()` refuses to run unless the database name ends in `_test`. `errors.ts` also exports `HttpError` for later routes, and maps oversize and wrong-media-type body errors to 413 `too_large` and 415 `unsupported_type`. Other 4xx errors become `bad_request`, and 5xx errors never reveal their text.
  - `@fastify/multipart` is in the manifest but not registered yet; S10 uses it. The step's Finish says "commit everything", but AGENTS.md forbids it, so the changes are left uncommitted.
  - `resetDb()` and the error handler were checked once by a throwaway script outside the repository (they have no test of their own): it emptied `workspaces`, kept `eval_runs`, and returned 404, 400 `validation`, 500 `internal` and 400 `bad_request` bodies in the right shape.
- **Plan files changed:** None.
- **README:** Updated the status block (now S01 to S05), § Repository layout, § Everyday commands (`yarn test`, `yarn typecheck`) and § Testing and evals.
- **Architecture impact:** None; matches § Local-only access (127.0.0.1 binding, Host and Origin checks, `X-TaskMaster`, CORS) and § Components (port 3001).
- **Notes for later steps:**
  - Routes go in `app.ts` or plugins registered after `registerSecurity`. A plugin registered with `app.register` is encapsulated, but the hook is on the root instance so it still covers it.
  - Add routes before the first `inject`: Fastify refuses new routes once it has started.
  - Use `headers()` from `test/helpers.ts` for every request, and call `resetDb()` in `beforeEach`. Imports between `.ts` files need the `.ts` extension. The hook allows only the Host values `localhost:3001` and `127.0.0.1:3001`.

### S06 · Next.js skeleton, CSP and yarn dev (2026-11-29)

- **Built:** `apps/web` (`@taskmaster/web`): a Next.js 16.4.6 app with a placeholder home page (heading "Workspaces", client component), `proxy.ts` (Host check, 403 otherwise), the CSP and two other headers in `next.config.ts`, and `lib/api.ts` (`request`, `ApiError`, a typed `api` object for every route in contracts.md). Also `yarn dev`, `scripts/health.mjs` and a 3-test Playwright smoke suite.
- **Key files:** [next.config.ts](../../apps/web/next.config.ts), [proxy.ts](../../apps/web/proxy.ts), [api.ts](../../apps/web/lib/api.ts), [smoke.spec.ts](../../apps/web/e2e/smoke.spec.ts), [playwright.config.ts](../../apps/web/playwright.config.ts), [dev.mjs](../../scripts/dev.mjs), [health.mjs](../../scripts/health.mjs)
- **Commands:** `yarn dev [--e2e]`, `node scripts/health.mjs` (all four services answered, exit 0), `yarn e2e` (3 passed), `yarn workspace @taskmaster/web typecheck`; `yarn typecheck` now includes the web app. Resolved: next 16.4.6, react and react-dom 19.3.1, react-markdown 10.1.0, remark-gfm 4.0.1, @playwright/test 1.65.1, @types/react 19.3.3, @types/react-dom 19.3.0, typescript 7.0.2 (the real app builds its types with it, which S05 left open). Chromium was installed for Playwright.
- **Deviations:**
  - With `--e2e`, `dev.mjs` starts the stub LLM only if `services/agent/tests/stub_llm.py` exists. S13 adds it, and starting a missing module would stop all four services, so the e2e smoke test could not run. It prints a note when it skips it.
  - The `--e2e` upload and output folders are absolute paths under `.cache/e2e`, because the API runs from `apps/api` and a relative path would resolve there.
  - `next.config.ts` sets `agentRules: false`, because `next dev` otherwise writes an `AGENTS.md` into `apps/web`. `next-env.d.ts` (written by Next) was added to `.gitignore`.
  - `lib/api.ts` also exports `runEventsUrl()` and `artifactDownloadUrl()` for later steps (EventSource and download links need a URL, not a request). Response types come from `db/schema.sql` and contracts.md; S07 and later may adjust them. `EvalRun.layers` is a guess at the shape of "pass counts per layer".
  - `tsconfig.json` overrides `module` to `esnext` and `moduleResolution` to `bundler` for Next.js; `incremental` is off so no `.tsbuildinfo` file is written.
  - The smoke test sets the `Host` header through Playwright's request context. The step's Finish says to commit; AGENTS.md forbids it, so everything is left uncommitted.
- **Plan files changed:** None.
- **README:** Updated the status block (now S01 to S06), § Repository layout, § Setup (steps 6 and the intro), § Everyday commands (`yarn dev`, `yarn e2e`, health script, `yarn typecheck`) and § Testing and evals.
- **Architecture impact:** None; matches § Local-only access (Host check in `proxy.ts`, `127.0.0.1` binding), the CSP bullet (`img-src 'self' data:`, `connect-src` limited to Fastify, `frame-src 'none'`) and § Components (port 3000).
- **Notes for later steps:**
  - Open the app as `http://localhost:3000`; the API's CORS allows only that origin. `API_URL` is `http://localhost:3001`.
  - Pages are client components that import only from `lib/api.ts`. `dangerouslySetInnerHTML` and `rehype-raw` are blocked by `check:arch` (A6).
  - `yarn e2e` runs its own `yarn dev --e2e`, so stop any other `yarn dev` first. It uses the test database, so run `yarn db:reset --test` if it holds old data.
  - The first request to `/` after a start compiles the page, so `health.mjs` allows 15 s per request.

### S07 · Workspaces and threads API (2026-11-29)

- **Built:** The workspace routes (create, list, get, rename, delete) and thread routes (create, list, rename, delete, list messages) from contracts.md, registered in `buildApp`. Deleting a workspace removes the row, then `UPLOAD_DIR\<wid>`. Deleting a thread with a queued, running or awaiting-approval run returns 409 `active_run`.
- **Key files:** [workspaces.ts](../../apps/api/src/routes/workspaces.ts), [threads.ts](../../apps/api/src/routes/threads.ts), [workspaces.test.ts](../../apps/api/test/workspaces.test.ts), [threads.test.ts](../../apps/api/test/threads.test.ts), [config.ts](../../apps/api/src/config.ts), [helpers.ts](../../apps/api/test/helpers.ts)
- **Commands:** `yarn workspace @taskmaster/api test` now runs 19 tests (5 security, 8 threads, 6 workspaces), and `typecheck` passes.
- **Deviations:**
  - `Config` gained `uploadDir`, read from `UPLOAD_DIR`, and `loadConfig` throws if it is missing. `makeApp(uploadDir)` in `test/helpers.ts` now takes the folder, and `makeUploadDir()` makes a temp one, so no test touches the real `UPLOAD_DIR`. `security.test.ts` was changed to use them.
  - A malformed ID (not a UUID) in a path returns 404, not 400, through `requireUuid()` in `workspaces.ts`, so Postgres never sees it. Thread routes under a missing workspace return 404 too.
  - Fastify's validator coerces types, so `{"name": 5}` or `{"name": ["a"]}` is stored as a string and returns 201. Only a missing, null, empty or too-long name returns 400. Coercion was left on because later query parameters such as `?after=<seq>` need it.
  - `POST .../threads` also accepts no body at all, and gives the thread the column default title `New thread`.
  - The step's Finish says to commit; AGENTS.md forbids it, so the changes are left uncommitted.
- **Plan files changed:** None.
- **README:** Updated the status block (now S01 to S07), § Repository layout (`apps/api`) and § Testing and evals.
- **Architecture impact:** None; matches § Data model (workspaces, threads, messages, the one-active-run index) and § Local-only access (the security hook covers the new routes).
- **Notes for later steps:**
  - New route modules export `register...Routes(app, ...)` and are called from `buildApp` in `app.ts`. Reuse `requireUuid()` for path IDs.
  - Responses list their columns explicitly, so a new column is not exposed until the route's `COLUMNS` string is changed.
  - Tests that create workspaces get an empty folder from `makeUploadDir()`; remove it in `after`.

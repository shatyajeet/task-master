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
  - `pyproject.toml` also sets `asyncio_default_fixture_loop_scope = "function"` to silence a pytest-asyncio warning. The tests add `DATABASE_URL` (agent) and `INTERNAL_TOKEN` to the process environment.
- **Plan files changed:** None.
- **README:** Updated the status block (now S01 to S04), § Repository layout, § Setup (step 4 now installs the `-dev` files, and its planned mark is gone), § Everyday commands (`yarn test`) and § Testing and evals.
- **Architecture impact:** None; matches § Local-only access (Host check, internal token, `127.0.0.1` binding) and § Components (ports 8000 and 8001).
- **Notes for later steps:**
  - `Settings` requires `INTERNAL_TOKEN` (and `DATABASE_URL` in the agent), so a missing value stops the service at start-up. Resolved versions: fastapi 0.165.0, uvicorn 0.55.0, pytest 9.2.0, pytest-asyncio 1.5.0, rapidocr 3.10.0.
  - New routes go in `app/main.py` inside `create_app()`; the middleware wraps every route, so they are protected by default.
  - Later tests reuse `call()` from `conftest.py` or add a client. A new library needs the user's agreement.

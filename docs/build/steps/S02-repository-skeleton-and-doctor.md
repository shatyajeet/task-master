---
step: S02
title: "Repository skeleton and doctor"
status: not-started
started:
completed:
---

# S02 · Repository skeleton and doctor

**Read before starting:** [README: rules and choices](../README.md) · [progress.md](../progress.md) · [Ports and environment](../contracts.md#ports-and-environment)

**Needs:** S01

**Creates:** `package.json`, `.yarnrc.yml`, `.gitignore`, `.gitattributes`, `.env.example`, `tsconfig.base.json`, `scripts/doctor.mjs`, `scripts/py.mjs`, `scripts/check-architecture.mjs`, `scripts/check-architecture.test.mjs`

**Reads:** [docs/build/allowed-dependencies.json](../allowed-dependencies.json), which already exists. Do not edit it.

**Build**

- `package.json`:
  - `"private": true`, `"packageManager": "yarn@4.19.0"`, `"engines": {"node": ">=26.13.1"}`.
  - `"workspaces": ["apps/*", "services/*"]`.
  - devDependencies: `pg@^8.23.1`, `typescript`.
  - Scripts:
    - `doctor`: `node --env-file=.env scripts/doctor.mjs`
    - `db:migrate`: `node --env-file=.env scripts/db.mjs migrate`
    - `db:reset`: `node --env-file=.env scripts/db.mjs reset`
    - `dev`: `node --env-file=.env scripts/dev.mjs`
    - `e2e`: `yarn workspace @taskmaster/web e2e`
    - `test`: `yarn workspaces foreach -Av run test`
    - `typecheck`: `yarn workspaces foreach -Av run typecheck`
    - `evals`: `node --env-file=.env scripts/py.mjs agent -m evals.runner`
    - `check:arch`: `node scripts/check-architecture.mjs`

  The scripts that S02 doesn't create yet are created in S03, S06 and S23.
- `.yarnrc.yml`: `nodeLinker: node-modules`, `enableScripts: false`. Do not lower Yarn's package age gate.
- `.gitattributes`: `* text=auto eol=lf`, and `*.png *.jpg *.pdf *.docx *.xlsx *.pptx binary`.
- `.gitignore`: `node_modules/`, `.venv/`, `.env`, `.next/`, `__pycache__/`, `.pytest_cache/`, `test-results/`, `playwright-report/`, `.cache/`.
- `.env.example`: every variable in the Contracts table, with placeholder values.
- `tsconfig.base.json`:
  - `"strict": true`, `"noEmit": true`
  - `"module": "nodenext"`, `"target": "es2024"`
  - `"erasableSyntaxOnly": true`, `"verbatimModuleSyntax": true`, `"allowImportingTsExtensions": true`

  Node 26 runs TypeScript directly by stripping types, so the code needs no build step and can't use enums or parameter properties.
- `scripts/py.mjs <agent|ocr> <args...>` runs `services/<name>/.venv/Scripts/python.exe <args>`, always with cwd set to the repository root and with `PYTHONPATH=<repo>\services\<name>;<repo>`. It passes stdio through and exits with the child's exit code. Every Python command in this plan goes through it, so none of them depends on the current folder.
- `scripts/doctor.mjs` prints a row per check (`ok`, `FAIL` and a hint) and exits 1 if any check fails:
  1. Node is 26.13.1 or later, and Yarn is 4.19.0.
  2. `py -3.14 --version` reports 3.14.10 or later.
  3. `.env` has every key from `.env.example`, and `INTERNAL_TOKEN` matches `^[0-9a-f]{64}$`.
  4. Through `PG_ADMIN_URL`: `server_version_num` is 190000 or higher, `listen_addresses` is `localhost`, and the `vector` extension's default version is 0.8.7 or later.
  5. `SOFFICE_PATH` exists, and `--version` reports 26.8.3 or later.
  6. `UPLOAD_DIR`, `WRITE_DIR` and `MODEL_CACHE_DIR` exist and are writable.
  7. The repository path contains no `OneDrive` segment and is not under `%OneDrive%`.
  8. `GET {LLM_BASE_URL}/models` returns 200 and lists `LLM_MODEL`. This check is a warning only, and `--strict` makes it a failure.
- **`scripts/check-architecture.mjs`** checks the code against the architecture automatically, whatever an agent believes about its own changes.
  - It uses only Node built-ins. It exports `check(root) -> violations[]` for its tests, and its command line takes `--root <dir>` (default: the repository).
  - It checks the files listed by `git ls-files --cached --others --exclude-standard`. It prints each violation as `<file>:<line> <rule> <message>`, sorted by file then line, and exits 1 if there are any.
  - "Source" below means `*.ts *.tsx *.mjs *.js *.py` outside `node_modules`, `.venv`, `.next` and `docs`. "Test files" are those under any `test/`, `tests/` or `e2e/` folder.
  - There is no inline way to skip a rule. A rule that is wrong is changed in this script, with the user's agreement.

  | Rule | Fails when | Architecture it protects |
  | --- | --- | --- |
  | `A1-deps` | A `package.json` (root, `apps/*`, `services/*`) declares a `dependencies` or `devDependencies` name, or a `services/*/requirements*.in` declares a requirement, that is not in `allowed-dependencies.json` for that file. A manifest missing from the allowlist fails for every name in it. Requirement names are compared lowercase, with `_` read as `-`, ignoring extras, version specifiers, comments and `-c` lines. | Components and technology choices |
  | `A2-bind` | Non-test source or a `package.json` script contains `0.0.0.0`, `"::"`, `'::'` or `INADDR_ANY`; a `next dev` or `next start` script lacks `-H 127.0.0.1`; or `host =` in Python, or `host:` in TypeScript under `apps/api/src`, is followed by a string literal other than `"127.0.0.1"`. A `host` read from a variable or a request header is not checked. | Local-only access |
  | `A3-components` | A file named `Dockerfile`, `docker-compose*.yml`, `compose.y*ml` or `.dockerignore` exists, or any source imports `redis`, `ioredis`, `bullmq`, `neo4j`, `neo4j-driver`, `celery` or `kafka`. | No Docker, Redis or Neo4j |
  | `A4-ports` | Non-test source sets `port` (`port=`, `port:`, `--port`, `-p`) to a number outside 3000, 3001, 5432, 8000, 8001, 8099 and 11434. | The fixed ports |
  | `A5-sql` | Python under `services/*/app` calls `execute(` with an f-string, `.format(` or `%` formatting of the query string; or TypeScript under `apps/api/src` calls `query(` with a template literal containing `${`. | Fixed, parameterized queries; the model never writes queries |
  | `A6-render` | Anything under `apps/web` mentions `rehype-raw` or `dangerouslySetInnerHTML`; or `apps/web/next.config.ts` exists but its CSP lacks `img-src 'self' data:` or `frame-src 'none'`. | Rendering model output safely |
  | `A7-test-net` | A test file contains an `http://` or `https://` URL whose host is not `127.0.0.1`, `localhost`, or a name ending in `.example`. | No real model or internet in tests |
  | `A8-arch-commit` | `git status` shows `docs/architecture.md` changed together with any file outside `docs/`. | Architecture changes go in their own `ARCH:` commit |

- **`scripts/check-architecture.test.mjs`** uses `node:test`. For each rule, it builds one temporary fixture folder that breaks the rule and one that doesn't, and asserts exactly one violation and zero respectively. For `A8`, the fixture is a temporary git repository.

**Verify**

```text
yarn install
copy .env.example .env    # then fill in real values; INTERNAL_TOKEN from:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
yarn doctor
node --test scripts/check-architecture.test.mjs
yarn check:arch
```

All three checks exit 0. The `yarn.lock` that `yarn install` created is committed.

## Finish

1. Every **Verify** command above exits 0, and so does `yarn check:arch`.
2. Add the S02 entry to [progress.md](../progress.md).
3. Set `status: done` and `completed:` at the top of this file.
4. Commit everything as `S02: Repository skeleton and doctor`.

## Blocked

Empty unless `status: blocked`. Then: what failed, the exact error, and what the user needs to decide.

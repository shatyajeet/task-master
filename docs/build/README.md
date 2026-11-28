# TaskMaster v0: build plan

Status: ready to build. Implements [architecture.md](../architecture.md), revision 6.

The plan has 25 steps, one file each in [steps/](steps/). Each step says which files it creates, what to build, and which commands prove it works. Two people, or two runs of a coding agent, following the same step should produce the same behavior and pass the same tests.

| File | What it holds | Who edits it |
| --- | --- | --- |
| This README | Rules, the step index, and choices the architecture leaves open | The user |
| [contracts.md](contracts.md) | Ports, environment, APIs, payloads, events, run status changes | Only with the user's agreement |
| [steps/](steps/) | One file per step, with a `status` field | The agent working on that step |
| [progress.md](progress.md) | What each finished step built, and how it differed from its plan | The agent finishing a step |
| [allowed-dependencies.json](allowed-dependencies.json) | Every dependency each manifest may declare; read by `yarn check:arch` | Only with the user's agreement |

[AGENTS.md](../../AGENTS.md) at the repository root says how an agent works through the steps.

## Step status

Every step file starts with `status:`, which is one of these:

| Status | Meaning |
| --- | --- |
| `not-started` | Nobody has begun it |
| `in-progress` | An agent is working on it, or stopped partway. The next agent resumes it. |
| `blocked` | It cannot continue without the user. The step's **Blocked** section says why. |
| `done` | Every **Verify** command passed, and its progress entry exists. The user commits it. |

To list every step's status:

```text
git grep -n "^status:" -- docs/build/steps
```

A `done` step can be checked at any time by running its **Verify** commands again.

## Rules for every step

1. **Order.** Start a step only when every earlier step is `done`. Never skip a step or reorder steps.
2. **Scope.** Create only the files a step lists, plus lockfiles and caches. Change earlier files only where the step says so.
3. **Dependencies.** Add only the packages a step names. Minimum versions come from the architecture's Versions table, written as ranges (`^16.4.6`, `>=1.2.24,<2`). Packages the architecture gives no version for get whatever version resolves that day, and the lockfile records it.
4. **Lockfiles are the source of truth.** Commit `yarn.lock` and each `requirements.txt` (compiled with hashes). After the step that creates a lockfile, install only with `yarn install --immutable` and `pip install --require-hashes -r requirements.txt`.
5. **No real model in tests.** Tests call the stub LLM on `127.0.0.1:8099` (step S13), never a hosted or local model, and never the internet. A real model is used only in S25.
6. **Fixed LLM settings.** Every LLM call uses `temperature=0` and `seed=7`.
7. **IDs come from Postgres** (`uuidv7()`). Application code never generates IDs. The only exception is tool call IDs, which come from the model.
8. **Stable ordering.** Every query that returns a list has an `ORDER BY` that ends on a unique column.
9. **Constants live in config.** Every limit and timeout in this plan is read from the environment variable named for it in [contracts.md](contracts.md#ports-and-environment), with the default given there. Tests shorten timeouts by setting those variables.
10. **Text files** are UTF-8 with LF line endings (`.gitattributes` enforces this).
11. **One commit per step, made by the user**, with the message `S<NN>: <step title>`. It contains the step's code, its progress entry, and its `status: done`. The agent leaves its changes uncommitted and never commits or pushes.
12. **If a step is ambiguous, stop.** Ask the user. Once they agree, fix the step file (and `contracts.md` if needed), record the fix in `progress.md`, and then build. Do not improvise.
13. **The architecture is checked, not trusted.** From S02 on, every step finishes with `yarn check:arch`. Anything that would make the code differ from [architecture.md](../architecture.md) is an architecture change: it needs the user's agreement and its own `ARCH:` commit first, as [AGENTS.md](../../AGENTS.md#architecture-changes) describes.

## Steps at a glance

| Step | Builds | Proven by |
| --- | --- | --- |
| [S01](steps/S01-machine-setup.md) | Machine setup | Version and config checks |
| [S02](steps/S02-repository-skeleton-and-doctor.md) | Repository skeleton, `yarn doctor` | `yarn doctor` |
| [S03](steps/S03-postgres-schema-and-database-scripts.md) | Postgres schema and database scripts | `yarn db:reset --all`, schema tests |
| [S04](steps/S04-agent-and-ocr-service-skeletons.md) | Agent and OCR service skeletons | pytest: health, Host and token checks |
| [S05](steps/S05-fastify-skeleton-and-security-hooks.md) | Fastify skeleton and security hooks | node:test via `inject` |
| [S06](steps/S06-next-js-skeleton-csp-and-yarn-dev.md) | Next.js skeleton, CSP, `yarn dev` | Playwright smoke test, 4 health checks |
| [S07](steps/S07-workspaces-and-threads-api.md) | Workspaces and threads API | node:test |
| [S08](steps/S08-eval-documents-and-their-ground-truth.md) | Eval documents and their ground truth | Generator output is byte-identical on a rerun |
| [S09](steps/S09-ocr-extraction.md) | OCR extraction, 2 parallel workers | pytest on the eval documents; parallel output equals serial |
| [S10](steps/S10-document-upload-and-delete-api.md) | Document upload and delete API | node:test |
| [S11](steps/S11-agent-job-worker.md) | Agent job worker | pytest |
| [S12](steps/S12-ingestion-pages-chunks-and-embeddings.md) | Ingestion: pages, chunks, embeddings | pytest with golden files |
| [S13](steps/S13-stub-llm-and-entity-extraction.md) | Stub LLM and entity extraction | pytest with stub LLM |
| [S14](steps/S14-search-and-graph.md) | Search and graph | pytest, node:test |
| [S15](steps/S15-runs-api-and-sse.md) | Runs API and SSE | node:test |
| [S16](steps/S16-agent-graph-streaming-and-limits.md) | Agent graph, streaming, limits | pytest |
| [S17](steps/S17-read-only-tools-save-artifact-and-idempotency.md) | Read-only tools, `save_artifact`, idempotency | pytest |
| [S18](steps/S18-approval-write-file-and-expiry.md) | Approval, `write_file`, expiry | pytest |
| [S19](steps/S19-artifacts-api.md) | Artifacts API | node:test |
| [S20](steps/S20-web-workspaces-and-documents.md) | Web: workspaces and documents | Playwright |
| [S21](steps/S21-web-chat-approvals-and-cancel.md) | Web: chat, approvals, cancel | Playwright |
| [S22](steps/S22-web-artifacts-and-safe-rendering.md) | Web: artifacts and safe rendering | Playwright |
| [S23](steps/S23-evals-runner-and-evals-page.md) | Evals runner and `/evals` page | `yarn evals --stub` |
| [S24](steps/S24-full-stack-end-to-end-tests.md) | Full-stack end-to-end tests | `yarn e2e` |
| [S25](steps/S25-real-model-acceptance.md) | Real model acceptance | `yarn evals` thresholds |

## Choices the architecture leaves open

The architecture is final. These are the implementation choices this plan makes where the architecture says nothing:

| # | Choice |
| --- | --- |
| G1 | There are three databases: `taskmaster` (the app), `taskmaster_test` (automated tests and e2e) and `taskmaster_eval` (eval data). Eval *results* go in `eval_runs` and `eval_results` in `taskmaster`, so the `/evals` page can show them. |
| G2 | `PG_ADMIN_URL` (the `postgres` superuser) creates databases and the `vector` extension. The app connects as the `taskmaster` role. |
| G3 | v0 has no incremental migrations. `db/schema.sql` is the whole schema: `yarn db:migrate` applies it to an empty database and `yarn db:reset` recreates the databases. |
| G4 | A `tool_calls` row is keyed by `(run_id, message_id, tool_call_id)`, where `message_id` is the checkpointed AI message's ID. Some local models reuse tool call IDs such as `call_0`. |
| G5 | When Fastify cancels a queued run or one awaiting approval, it also writes the `cancelled` run event in the same transaction. This is the only run event Fastify writes. |
| G6 | Approving moves a run from `awaiting_approval` back to `queued`. The run is still active. |
| G7 | The agent runs two worker loops, each handling one job at a time: one for `ingest` jobs, and one for `run` and `resume` jobs. Chat keeps working during a long OCR. |
| G8 | A failed job is retried after `10 s × attempts`, using `locked_until` as the delay. |
| G9 | The browser resumes SSE with `?after=<seq>` rather than `Last-Event-ID`, which avoids a CORS preflight. Fastify accepts both. If a finished run's events are already deleted, it returns 204. |
| G10 | Hitting a run limit sets the run to `failed`, with error `llm_call_limit` or `time_limit`. |
| G11 | `.txt` and `.md` files are stored as a single page, page 1, with no confidence value. |
| G12 | Python services start through `app/serve.py`, which runs uvicorn inside `asyncio.Runner(loop_factory=asyncio.SelectorEventLoop)`. This avoids the event loop policies deprecated in Python 3.14. |
| G13 | Next.js 16 does its Host check in `proxy.ts`, the file that replaced `middleware.ts`. |
| G14 | Evals run in the agent's venv and import agent code directly. The OCR service must be running. |
| G15 | Each tool result is also saved as a `messages` row with role `tool`, so the thread history still shows the steps after a run's events are deleted. |

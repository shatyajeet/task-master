# Contracts

These are fixed. Every service implements them exactly, and tests check them. Each step file links only the sections it needs.

Changing anything here changes a contract between services. Do it only with the user's agreement, as [AGENTS.md](../../AGENTS.md) describes, and record it in [progress.md](progress.md).

## Ports and environment

| Service | Bind |
| --- | --- |
| Next.js | `127.0.0.1:3000`, opened as `http://localhost:3000` |
| Fastify | `127.0.0.1:3001` |
| Agent | `127.0.0.1:8000` |
| OCR | `127.0.0.1:8001` |
| Stub LLM (tests only) | `127.0.0.1:8099` |

`.env` at the repository root, with every variable listed in `.env.example`:

| Variable | Example or default | Used by |
| --- | --- | --- |
| `DATABASE_URL` | `postgres://taskmaster:<pw>@127.0.0.1:5432/taskmaster` | api, agent |
| `TEST_DATABASE_URL` | `.../taskmaster_test` | tests |
| `EVAL_DATABASE_URL` | `.../taskmaster_eval` | evals |
| `PG_ADMIN_URL` | `postgres://postgres:<pw>@127.0.0.1:5432/postgres` | `scripts/db.mjs` only |
| `UPLOAD_DIR` | `C:\taskmaster-data\uploads` | api, agent |
| `WRITE_DIR` | `C:\taskmaster-data\out` | agent (`write_file`) |
| `MODEL_CACHE_DIR` | `C:\taskmaster-data\models` | agent (fastembed), ocr (RapidOCR) |
| `INTERNAL_TOKEN` | 64 hex characters | api, agent, ocr |
| `AGENT_URL` | `http://127.0.0.1:8000` | api |
| `OCR_URL` | `http://127.0.0.1:8001` | agent |
| `SOFFICE_PATH` | `C:\Program Files\LibreOffice\program\soffice.exe` | ocr |
| `LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL` | See the architecture's Models section | agent, evals |
| `JUDGE_BASE_URL`, `JUDGE_API_KEY`, `JUDGE_MODEL` | Fall back to the `LLM_*` values | evals |
| `JOB_POLL_SECONDS` | `5` | agent |
| `JOB_LOCK_SECONDS` / `JOB_HEARTBEAT_SECONDS` | `60` / `20` | agent |
| `JOB_MAX_ATTEMPTS` | `3` | agent |
| `APPROVAL_TIMEOUT_SECONDS` | `86400` | agent |
| `RUN_TIME_LIMIT_SECONDS` | `600` | agent |
| `RUN_LLM_CALL_LIMIT` | `15` | agent |
| `RUN_EVENTS_TTL_SECONDS` | `3600` | agent |
| `OCR_TIMEOUT_SECONDS` | `120` (LibreOffice conversion) | ocr |
| `OCR_WORKERS` | `2` | ocr |
| `OCR_THREADS_PER_WORKER` | `4` | ocr |

Node reads `.env` with `--env-file`, and Python with pydantic-settings. In both, a variable already set in the process environment overrides `.env`. That is how tests and e2e point the services at other values.

## Fastify REST API

Every route except `GET /health` and the `/evals` routes is under `/workspaces/:wid`. A resource that belongs to another workspace returns 404. Request and response bodies are JSON unless marked otherwise. Every error is `{"error": "<code>", "message": "<text>"}`.

| Method and path | Body or query | Success | Errors |
| --- | --- | --- | --- |
| `GET /health` | | `200 {"ok":true}` | |
| `POST /workspaces` | `{name}` | 201 workspace | 400 |
| `GET /workspaces` | | 200 list, newest first | |
| `GET /workspaces/:wid` | | 200 | 404 |
| `PATCH /workspaces/:wid` | `{name}` | 200 | 400, 404 |
| `DELETE /workspaces/:wid` | | 204, and deletes `UPLOAD_DIR\<wid>` | 404 |
| `POST /workspaces/:wid/documents` | multipart, one field `file` | 201 document, `status: queued` | 400, 413 `too_large`, 415 `unsupported_type` |
| `GET /workspaces/:wid/documents` | | 200 list, newest first | |
| `GET /workspaces/:wid/documents/:id` | | 200 | 404 |
| `DELETE /workspaces/:wid/documents/:id` | | 204 | 404 |
| `POST /workspaces/:wid/threads` | `{title?}` | 201 | 400 |
| `GET /workspaces/:wid/threads` | | 200 list, newest first | |
| `PATCH /workspaces/:wid/threads/:tid` | `{title}` | 200 | 400, 404 |
| `DELETE /workspaces/:wid/threads/:tid` | | 204 | 404, 409 `active_run` |
| `GET /workspaces/:wid/threads/:tid/messages` | | 200 list, oldest first | 404 |
| `GET /workspaces/:wid/threads/:tid/runs/active` | | 200 run, or `200 null` | 404 |
| `POST /workspaces/:wid/threads/:tid/runs` | `{message}`, 1 to 20000 chars | 201 run | 400, 404, 409 `active_run` with `run_id` |
| `GET /workspaces/:wid/runs/:rid` | | 200 | 404 |
| `GET /workspaces/:wid/runs/:rid/events` | `?after=<seq>` | SSE, or 204 | 404 |
| `POST /workspaces/:wid/runs/:rid/cancel` | | 200 run | 404, 409 `invalid_state` |
| `POST /workspaces/:wid/runs/:rid/approval` | `{approve: boolean}` | 200 run | 400, 404, 409 `invalid_state` |
| `GET /workspaces/:wid/artifacts` | | 200 list, newest first, without `content` | |
| `GET /workspaces/:wid/artifacts/:id` | | 200, with `content` | 404 |
| `GET /workspaces/:wid/artifacts/:id/download` | | 200 `text/plain; charset=utf-8`, sent as an attachment named `<title>.md` | 404 |
| `PATCH /workspaces/:wid/artifacts/:id` | `{title}` | 200 | 400, 404 |
| `DELETE /workspaces/:wid/artifacts/:id` | | 204 | 404 |
| `GET /workspaces/:wid/search` | `?q=` (1 to 1000 chars) | 200 `{results}` from the agent | 400, 502 `agent_unavailable` |
| `GET /workspaces/:wid/graph` | `?entity=` | 200 `{entities, relations}` from the agent | 400, 502 |
| `GET /evals/runs` | | 200 list of eval runs with pass counts per layer | |
| `GET /evals/runs/:id/results` | | 200 list, ordered by `case_id` | 404 |

Security responses come before routing: 403 `forbidden_host`, 403 `forbidden_origin`, 403 `missing_header`.

Uploads accept these extensions, case-insensitive: `txt md pdf doc docx xls xlsx ppt pptx png jpg jpeg tif tiff`. The limit is 25 MB (26214400 bytes).

## Internal HTTP (agent and OCR)

Every request needs the header `X-Internal-Token: <INTERNAL_TOKEN>`, compared in constant time. A missing or wrong token returns 401. A wrong Host returns 403.

| Service | Route | Request | Response |
| --- | --- | --- | --- |
| Agent | `GET /health` | | `{"ok":true}` (no token needed) |
| Agent | `POST /search` | `{workspace_id, query}` | `{results:[{chunk_id, document_id, filename, page, text, score}]}`, at most 5 |
| Agent | `POST /graph` | `{workspace_id, entity}` | `{entities:[{id,name,kind}], relations:[{id,source_id,target_id,type,document_id,filename,chunk_id,page,text}]}` |
| OCR | `GET /health` | | `{"ok":true}` (no token needed) |
| OCR | `POST /extract` | multipart field `file`, field `filename` | `{pages:[{page,text,confidence}]}`. Errors: 413 `too_large`, 415 `unsupported_type`, 422 `too_many_pages`, 422 `conversion_failed`, 500 `ocr_failed`, 504 `timeout` |

## Job payloads

| `kind` | `payload` |
| --- | --- |
| `ingest` | `{"document_id": "<uuid>"}` |
| `run` | `{"run_id": "<uuid>"}` |
| `resume` | `{"run_id": "<uuid>"}` |

Whoever inserts a job also runs `NOTIFY jobs` in the same transaction.

## Run events

| `type` | `data` | Ends the stream |
| --- | --- | --- |
| `text` | `{"delta": string}` | No |
| `tool_start` | `{"tool_call_id", "name", "args"}` | No |
| `tool_end` | `{"tool_call_id", "name", "ok": boolean, "summary": string}` (summary is at most 200 chars) | No |
| `approval_required` | `{"tool_calls": [{"tool_call_id", "name", "args"}]}` | No |
| `done` | `{"message_id"}` | Yes |
| `cancelled` | `{}` | Yes |
| `expired` | `{}` | Yes |
| `error` | `{"code", "message"}` | Yes |

On the wire, each event is `id: <seq>\nevent: <type>\ndata: <json>\n\n`, with a `: ping\n\n` comment every 15 seconds. Fastify closes the stream after an event that ends it.

## Run status changes

| From | To | Who | When |
| --- | --- | --- | --- |
| (new) | `queued` | Fastify | `POST .../runs` |
| `queued` | `running` | Agent | It claims the `run` or `resume` job |
| `running` | `awaiting_approval` | Agent | The graph stopped at the approval interrupt |
| `awaiting_approval` | `queued` | Fastify | Approval received; it queues a `resume` job |
| `running` | `done` / `failed` | Agent | |
| `queued`, `awaiting_approval` | `cancelled` | Fastify | Cancel |
| `running` | `cancelled` | Agent | `cancel_requested_at` is set and the agent checks it |
| `awaiting_approval` | `expired` | Agent | `approval_requested_at` is older than `APPROVAL_TIMEOUT_SECONDS` |

Every change is an `UPDATE ... WHERE id = $1 AND status = <from>`. If it updates 0 rows, the change lost a race. The API answers with 409 `invalid_state`, and the agent stops handling that job.

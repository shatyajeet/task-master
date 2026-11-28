---
step: S17
title: "Read-only tools, `save_artifact` and idempotency"
status: not-started
started:
completed:
---

# S17 · Read-only tools, `save_artifact` and idempotency

**Read before starting:** [README: rules and choices](../README.md) · [progress.md](../progress.md) · [Run events](../contracts.md#run-events)

**Needs:** S14, S16

**Creates:** `services/agent/app/tools.py`, `tests/test_tools.py`. Edits `agent_graph.py`.

**Build**

- Tools, with their argument schemas in pydantic and results as JSON strings:

| Tool | Arguments | Result |
| --- | --- | --- |
| `search_documents` | `query`: string, 1 to 1000 chars | `{"results":[{document_id, filename, page, text}]}`, with each `text` wrapped as `<document_text>…</document_text>` |
| `query_graph` | `entity`: string, 1 to 200 chars | `{"relations":[{source, type, target, filename, page, text}]}`, with `text` wrapped |
| `read_document` | `document_id`: uuid, `start_page`: int ≥ 1, `end_page`: int ≥ `start_page`, at most 10 pages | `{"filename", "pages":[{page, text}]}`, wrapped. A document that isn't `ready` or isn't in the workspace returns `{"error":"not_found"}`. |
| `save_artifact` | `title`: 1 to 200 chars, `content`: up to 200000 chars | `{"artifact_id"}` |
| `write_file` | Added in S18 | |

- Every tool reads `workspace_id` from the config, never from the model's arguments.
- **The `tools` node.** The cancel check runs before each call. For each tool call of the last `AIMessage`, in order:
  1. Its key is `(run_id, ai_message.id, tool_call.id)` (G4).
  2. If a `tool_calls` row already exists for that key, reuse its result.
  3. Otherwise, run the tool, then insert the result with `ON CONFLICT DO NOTHING`.
  4. Return a `ToolMessage` for each call.

  Argument validation errors become `{"error":"invalid_arguments","detail":...}` results rather than exceptions.
- `save_artifact` inserts with `source_key = '<run_id>:<message_id>:<tool_call_id>'` and `ON CONFLICT (source_key) DO UPDATE SET title=EXCLUDED.title, content=EXCLUDED.content`.
- The `tool_end` summary is the tool name plus a count, for example `search_documents: 5 results`, `read_document: 3 pages`, or `save_artifact: saved "<title>"`.
- Tests:
  1. Scripted `search_documents` then a text reply produces `tool_start`, `tool_end`, `text` and `done` events, and the reply cites the file.
  2. Running the `tools` node twice on the same state calls the tool once, checked with a counter in a monkeypatched tool, and returns identical messages.
  3. `save_artifact` replayed creates one artifact.
  4. `read_document` for another workspace's document returns `not_found`.
  5. Invalid arguments return the error result, and the run continues.

**Verify:** `yarn workspace @taskmaster/agent test`.

## Finish

1. Every **Verify** command above exits 0, and so does `yarn check:arch`.
2. Update [README.md](../../README.md) as [AGENTS.md](../../AGENTS.md#keeping-readmemd-current) describes, or note in the progress entry why no change was needed.
3. Add the S17 entry to [progress.md](../progress.md).
4. Set `status: done` and `completed:` at the top of this file.
5. Commit everything as `S17: Read-only tools, save_artifact and idempotency`.

## Blocked

Empty unless `status: blocked`. Then: what failed, the exact error, and what the user needs to decide.

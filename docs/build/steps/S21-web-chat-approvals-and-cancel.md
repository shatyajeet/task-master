---
step: S21
title: "Web: chat, approvals and cancel"
status: not-started
started:
completed:
---

# S21 · Web: chat, approvals and cancel

**Read before starting:** [README: rules and choices](../README.md) · [progress.md](../progress.md) · [Fastify REST API](../contracts.md#fastify-rest-api) · [Run events](../contracts.md#run-events)

**Needs:** S18, S20

**Creates:**
- `apps/web/app/w/[wid]/threads/page.tsx`, `app/w/[wid]/threads/[tid]/page.tsx`
- `apps/web/components/Chat.tsx`, `components/ApprovalCard.tsx`, `components/RunStream.ts`
- `apps/web/e2e/chat.spec.ts`

**Build**

- **The thread list**: create, rename and delete threads.
- **The thread page**:
  - On load, it fetches messages and `runs/active`. If a run is active, it attaches to its stream.
  - `RunStream` opens `EventSource(API_URL + "/workspaces/<wid>/runs/<rid>/events?after=<lastSeq>")` and tracks `lastSeq` from each event's `lastEventId`. On `error`, it closes and reopens after 1, 2, 4 or 8 seconds (capped), with `after=<lastSeq>`. A 204 response is detected because the stream closes before any event; the page then reloads the messages. After an event that ends the run, it closes and reloads the messages.
  - `text` deltas build the reply as it streams.
  - `tool_start`/`tool_end` appear as step rows showing the tool name and summary.
  - `approval_required` shows an `ApprovalCard` for each call. For `write_file`, it shows the name, the path, and the content in a `<pre>`. It has "Approve" and "Reject" buttons, which `POST .../approval`.
  - A "Stop" button is visible while a run is active and calls `cancel`.
  - The composer is disabled while a run is active. A 409 `active_run` shows "A run is already active in this thread."
- Messages are rendered with the safe Markdown component from S22. In this step, it is a placeholder that renders plain text.
- Playwright tests, using a stub script that each test sets through `POST http://127.0.0.1:8099/__script`:
  1. A message gets a streamed reply that ends with the done state, and still shows after a reload.
  2. A `write_file` tool call shows the approval card. Approve, and the file exists in `.cache/e2e/out`.
  3. Reject, and no file is created.
  4. While awaiting approval, sending another message is blocked, and the API returns 409.
  5. Stop during a slow stub reply ends the run as cancelled.
  6. Reloading during a stream resumes without duplicating text.

**Verify:** `yarn e2e`.

## Finish

1. Every **Verify** command above exits 0, and so does `yarn check:arch`.
2. Add the S21 entry to [progress.md](../progress.md).
3. Set `status: done` and `completed:` at the top of this file.
4. Commit everything as `S21: Web: chat, approvals and cancel`.

## Blocked

Empty unless `status: blocked`. Then: what failed, the exact error, and what the user needs to decide.

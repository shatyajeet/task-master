---
step: S15
title: "Runs API and SSE"
status: not-started
started:
completed:
---

# S15 · Runs API and SSE

**Read before starting:** [README: rules and choices](../README.md) · [progress.md](../progress.md) · [Fastify REST API](../contracts.md#fastify-rest-api) · [Job payloads](../contracts.md#job-payloads) · [Run events](../contracts.md#run-events) · [Run status changes](../contracts.md#run-status-changes)

**Needs:** S11

**Creates:** `apps/api/src/routes/runs.ts`, `src/listener.ts`, `src/sse.ts`, `test/runs.test.ts`, `test/sse.test.ts`

**Build**

- `POST .../runs`, in one transaction:
  1. Insert the run.
  2. Insert the user message, with `run_id`.
  3. Call `enqueueJob(...'run', {run_id})`.

  A unique violation (`23505`) on `runs_one_active_per_thread` returns 409 `active_run` with the active run's ID.
- Cancel:
  - Queued or awaiting approval: `UPDATE ... SET status='cancelled', finished_at=now(), cancel_requested_at=now() WHERE status IN ('queued','awaiting_approval')`. Then append a `cancelled` event in the same transaction (G5), using the same seq rule as the agent, and run `NOTIFY run_events`.
  - Running: set `cancel_requested_at=now() WHERE status='running'`, and return the run, still `running`.
  - Any other status: 409 `invalid_state`.
- Approval:
  - `UPDATE runs SET status='queued', approval_decision=$2 WHERE id=$1 AND status='awaiting_approval'`, then `enqueueJob(...'resume', {run_id})` in the same transaction (G6).
  - If 0 rows were updated: 409 `invalid_state`.
- `listener.ts` holds one dedicated `pg.Client` running `LISTEN run_events`, and a map from `run_id` to its subscribers. On a notification, it calls each subscriber of that run. It reconnects with backoff of 1, 2, 4 and 8 seconds, capped at 8. After reconnecting, it calls every subscriber so they can catch up.
- `GET .../events`:
  - The resume point is `after` (from the query, then the `Last-Event-ID` header, then 0).
  - If the run has finished and has no `run_events` rows left, return 204 (G9).
  - Otherwise, call `reply.hijack()` and write the status and headers by hand: `Content-Type: text/event-stream`, `Cache-Control: no-store`, `Connection: keep-alive`, `Access-Control-Allow-Origin: http://localhost:3000`, `X-Content-Type-Options: nosniff`.
  - Send all rows after the resume point in `seq` order, then subscribe. On each notification, send the new rows. Send a ping every 15 seconds.
  - Close the stream after an event that ends it, or when the client disconnects (which also unsubscribes).
- Tests:
  1. A second run on a thread while the first is queued returns 409 with `run_id`. The same happens while it is `awaiting_approval`, set directly in the database.
  2. Cancelling a queued run returns `cancelled` and writes one `cancelled` event.
  3. Cancelling a running run only sets the flag.
  4. Cancelling a finished run returns 409.
  5. Approval of an `awaiting_approval` run returns `queued` and creates a `resume` job. A second approval returns 409.
  6. An approval racing a cancel: exactly one succeeds and the other gets 409, over 20 repetitions.
  7. SSE: events 1 to 3 are inserted, the client connects with `after=1` and receives 2 and 3. Then 4 (`done`) is inserted, and the stream delivers it and closes.
  8. A finished run with no events returns 204.

**Verify:** `yarn workspace @taskmaster/api test`.

## Finish

1. Every **Verify** command above exits 0, and so does `yarn check:arch`.
2. Update [README.md](../../README.md) as [AGENTS.md](../../AGENTS.md#keeping-readmemd-current) describes, or note in the progress entry why no change was needed.
3. Add the S15 entry to [progress.md](../progress.md).
4. Set `status: done` and `completed:` at the top of this file.
5. Commit everything as `S15: Runs API and SSE`.

## Blocked

Empty unless `status: blocked`. Then: what failed, the exact error, and what the user needs to decide.

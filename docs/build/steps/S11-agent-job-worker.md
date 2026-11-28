---
step: S11
title: "Agent job worker"
status: not-started
started:
completed:
---

# S11 · Agent job worker

**Read before starting:** [README: rules and choices](../README.md) · [progress.md](../progress.md) · [Ports and environment](../contracts.md#ports-and-environment) · [Job payloads](../contracts.md#job-payloads) · [Run events](../contracts.md#run-events)

**Needs:** S10

**Creates:**
- `services/agent/app/db.py`, `app/jobs.py`, `app/worker.py`, `app/events.py`
- `services/agent/tests/conftest.py` (extended), `tests/test_jobs.py`, `tests/test_events.py`

**Build**

- `db.py` holds a psycopg `AsyncConnectionPool` (min 2, max 10) on `DATABASE_URL`, with pgvector's `register_vector_async` applied to each connection. It also creates one dedicated connection for `LISTEN`.
- `jobs.claim(kinds)` runs exactly:

```sql
UPDATE jobs SET status='running', attempts=attempts+1, locked_until=now()+make_interval(secs=>%(lock)s)
WHERE id = (SELECT id FROM jobs
            WHERE kind = ANY(%(kinds)s)
              AND ((status='queued' AND (locked_until IS NULL OR locked_until < now()))
                   OR (status='running' AND locked_until < now()))
            ORDER BY id FOR UPDATE SKIP LOCKED LIMIT 1)
RETURNING *;
```

- The other job functions:
  - `heartbeat(id)` runs every `JOB_HEARTBEAT_SECONDS`: `UPDATE jobs SET locked_until=now()+lock WHERE id=%s AND status='running'`.
  - `complete(id)` sets the job to `done`.
  - `fail(id, err)`:
    - If `attempts >= JOB_MAX_ATTEMPTS`, it sets the job to `failed` with `last_error`, and calls the kind's failure hook: the document becomes `failed` with its error, or the run becomes `failed` with an `error` event.
    - Otherwise it sets `status='queued'`, `locked_until = now() + 10 s × attempts`, and `last_error`.
  - A job claimed with `attempts > JOB_MAX_ATTEMPTS` (its lease expired too many times) goes straight to the failure hook, with error `abandoned`.
- `worker.py` runs two lanes as asyncio tasks, started by `main.py`'s lifespan hook (G7): `["ingest"]` and `["run", "resume"]`. Each lane loops:
  1. Claim a job.
  2. If one was claimed, run its handler with the heartbeat running alongside.
  3. If not, wait for `NOTIFY jobs` or `JOB_POLL_SECONDS`, whichever comes first.

  Lane errors are logged and never stop the loop.
- On every pass, a separate sweep task:
  - expires runs (step S18 fills in the body)
  - deletes old events: `DELETE FROM run_events WHERE run_id IN (SELECT id FROM runs WHERE finished_at < now() - make_interval(secs=>TTL))`
- `events.append(conn, workspace_id, run_id, type, data)` inserts with `seq = COALESCE((SELECT max(seq) FROM run_events WHERE run_id=%s), 0) + 1` and runs `NOTIFY run_events, '<run_id>:<seq>'` in the caller's transaction.
- `events.TextBuffer` collects text deltas and flushes them into one `text` event every 100 ms, and once more before any other event.
- In this step, handlers are a registry. Tests register fake handlers.
- Tests, against `TEST_DATABASE_URL` with `JOB_POLL_SECONDS=0.2`, `JOB_LOCK_SECONDS=1` and `JOB_HEARTBEAT_SECONDS=0.3`:
  1. Two concurrent `claim` calls never return the same job.
  2. A job whose handler takes 2 seconds keeps its lock, thanks to the heartbeat.
  3. A job abandoned by a cancelled task can be claimed again after its lock expires.
  4. A handler that always raises is tried 3 times, then the job is `failed` and the failure hook runs once.
  5. A job inserted with `NOTIFY` is picked up in under 0.2 seconds.
  6. 100 concurrent `append` calls on one run produce seqs 1 to 100, with no gaps and no duplicates.
  7. 10 deltas within 50 ms produce one `text` event.

**Verify:** `yarn workspace @taskmaster/agent test`.

## Finish

1. Every **Verify** command above exits 0, and so does `yarn check:arch`.
2. Update [README.md](../../README.md) as [AGENTS.md](../../AGENTS.md#keeping-readmemd-current) describes, or note in the progress entry why no change was needed.
3. Add the S11 entry to [progress.md](../progress.md).
4. Set `status: done` and `completed:` at the top of this file.
5. Commit everything as `S11: Agent job worker`.

## Blocked

Empty unless `status: blocked`. Then: what failed, the exact error, and what the user needs to decide.

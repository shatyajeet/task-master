---
step: S18
title: "Approval, `write_file` and expiry"
status: not-started
started:
completed:
---

# S18 · Approval, `write_file` and expiry

**Read before starting:** [README: rules and choices](../README.md) · [progress.md](../progress.md) · [Run events](../contracts.md#run-events) · [Run status changes](../contracts.md#run-status-changes)

**Needs:** S17

**Creates:** `services/agent/app/write_file.py`, `tests/test_approval.py`, `tests/test_write_file.py`. Edits `agent_graph.py`, `tools.py` and `worker.py` (the sweep).

**Build**

- `NEEDS_APPROVAL = {"write_file"}`.
- **The `approval` node.** If any call in the last `AIMessage` is in `NEEDS_APPROVAL`, it calls `decision = interrupt({"tool_calls": [those calls]})`. Nothing comes before the `interrupt` call. The decision (`{"approve": bool}`) is stored in the state key `approval: {message_id, approve}`.
- **The `tools` node.** If a call needs approval and the stored decision for this message is not `approve: true`, it returns a `ToolMessage` with `{"error":"rejected","detail":"The user rejected this action."}` without running the tool. Calls that don't need approval run as normal.
- **`write_file(path, content)`**, with content up to 1000000 characters:
  1. Reject any `path` that is absolute, contains `..`, a drive letter, a UNC prefix, a `:` or a `\0`, or has a component matching a reserved Windows name (`CON PRN AUX NUL COM1-9 LPT1-9`, case-insensitive, with or without an extension).
  2. Resolve `target = (WRITE_DIR / path).resolve()`, and require `target.is_relative_to(WRITE_DIR.resolve())`. This blocks symlinks and junctions that lead out.
  3. Create the parent folders.
  4. Write UTF-8 to `target.parent / f".{target.name}.tmp-{tool_call_id}"`, flush and `fsync`, then `os.replace` it over `target` (overwriting, never appending).
  5. Return `{"path": <relative path>, "bytes": n}`.
- **The expiry sweep**, in `worker.py`. One transaction per expired run:

  ```sql
  UPDATE runs SET status='expired', finished_at=now()
  WHERE status='awaiting_approval' AND approval_requested_at < now() - make_interval(secs=>APPROVAL_TIMEOUT_SECONDS)
  RETURNING id, workspace_id
  ```

  It then appends an `expired` event for each run.
- Tests:
  1. A scripted `write_file` call stops the run as `awaiting_approval`, with one `approval_required` event, and no file is written.
  2. Approving (setting `queued` and `approval_decision=true`, then running the `resume` job) writes the file exactly once, and the run ends `done`.
  3. Rejecting writes no file, the model receives the `rejected` result, and the run ends `done`.
  4. Killing the worker task after `os.replace` but before the `tool_calls` insert, then resuming, writes the file with the same content and creates one `tool_calls` row.
  5. `APPROVAL_TIMEOUT_SECONDS=1`: after 1.5 seconds the run is `expired`, with one `expired` event.
  6. A `resume` job for a run that was cancelled while awaiting approval does nothing.
  7. Each rejected path in the table in `test_write_file.py` is refused: `..\x`, `C:\x`, `\\server\x`, `con.txt`, `a\nul`, `a:b`, and a junction that points outside.
  8. A pending approval survives a restart: a new `AsyncPostgresSaver` and graph instance resumes it.

**Verify:** `yarn workspace @taskmaster/agent test`.

## Finish

1. Every **Verify** command above exits 0, and so does `yarn check:arch`.
2. Add the S18 entry to [progress.md](../progress.md).
3. Set `status: done` and `completed:` at the top of this file.
4. Commit everything as `S18: Approval, write_file and expiry`.

## Blocked

Empty unless `status: blocked`. Then: what failed, the exact error, and what the user needs to decide.

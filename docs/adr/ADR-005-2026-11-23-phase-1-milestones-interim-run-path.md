# ADR-005: Phase 1 milestones and the interim run path

| Field | Value |
| --- | --- |
| Status | Accepted |
| Decision date | 2026-11-23 |
| Decided by | Owner asked on 2026-11-23 to "fix the problems that you found according to the spirit of the work to be done"; accepted by the owner on 2026-11-23 |
| Recorded by | Claude Code (Claude Opus 5.5) |
| Type | Gap |
| Class | Ask first |
| Build plan phase | 1 to 6, 12 |
| Departs from | Build Plan, Phase rules (3 to 6 tasks per phase) |
| Affected paths | docs/TaskMaster Build Plan.md, AGENTS.md section 6 |
| Supersedes / superseded by | None |
| Temporary until | The interim run path ends in phase 5; the milestones are permanent |

## Context

Starting fresh (ADR-004) leaves work with no task, and no description of how a run is dispatched and streamed before phases 4 and 5 build the durable path. AGENTS.md also read as if every invariant applied on day one, although phases 6 to 14 build several of them.

## Documented rule

> "Each phase adds one capability in 3 to 6 tasks" (Build Plan, How the plan works)
>
> The documents do not say how runs are dispatched and streamed in phases 1 to 4.

## Decision

1. Phase 1 keeps its number and "Done when", and is split into milestones 1.1 to 1.6 of 3 to 6 tasks each.
2. Interim run path: Fastify records the run in Postgres, then sends it on the LocalStack runs queue to a single worker. The worker checkpoints with AsyncPostgresSaver and commits text and run_events to Postgres, and Fastify delivers them over its WebSocket. Phase 4 adds the outbox, idempotency key, lease, fencing and DLQ. Phase 5 replaces live delivery with Valkey streams.
3. Sign-in uses seeded users until phase 9.
4. The mock Google and GitHub API servers move from phase 6 to milestone 1.4, because connectors and their eval cases must work with no cloud account. Phase 6 adds fault injection to them.
5. The Mesh ships level 1 detection in milestone 1.4. Training the level 2 CNN-BiLSTM becomes a phase 12 task, since v0 no longer supplies it.
6. Each AGENTS.md invariant binds from the phase that builds it. Some bind from phase 1 and are listed there.

## Alternatives considered

| Alternative | Why not |
| --- | --- |
| Split phase 1 into new numbered phases | Renumbers 32 phases, the cost table and existing references |
| Call FastAPI over HTTP and stream back through it | Throwaway code, and ties a worker to a socket, which the architecture rejects |
| Build SQS leases and Valkey streams in phase 1 | Pulls phases 4 and 5 forward and makes phase 1 larger still |
| Redis queue in the interim | Breaks the rule that Redis is never a job queue |

## Consequences

A crash between the Postgres write and the SQS send can leave a run queued until phase 4 adds the outbox. This is acceptable on a laptop. The optional public demo uses seeded-user sign-in and has no outbox until later phases.

## Rollback

Restore the previous task lists from Git.

## Documents and code updated

- [x] Index row in docs/adr/README.md
- [x] Build Plan How the plan works, phase 1 stack and tasks, phases 3 to 6 and 12; AGENTS.md sections 3, 6 and 8
- [x] Code comment: not needed, no code exists yet

## Verification

Document change only. No code exists to run. The text was edited in the same change as this record.

## Status history

| Date | Status | By | Note |
| --- | --- | --- | --- |
| 2026-11-23 | Proposed | Claude Code (Claude Opus 5.5) | Recorded for owner acceptance |
| 2026-11-23 | Accepted | Owner, recorded by Claude Code (Claude Opus 5.5) | Owner: "Accept all the proposed ADRs" |

# ADR-004: Phase 1 starts fresh, without v0 code

| Field | Value |
| --- | --- |
| Status | Accepted |
| Decision date | 2026-11-23 |
| Decided by | Owner |
| Recorded by | Claude Code (Claude Opus 5.5) |
| Type | Plan change |
| Class | Ask first (owner instructed) |
| Build plan phase | 1 and later |
| Departs from | Build Plan, phase 1 tasks; Architecture, Status and scope, and Build-change backlog |
| Affected paths | docs/ |
| Supersedes / superseded by | None |
| Temporary until | Permanent |

## Context

The plan restructured an earlier build, v0, into the monorepo and ported its eval cases. v0 is not in this repository.

## Documented rule

> "Restructure v0 into the monorepo with Turborepo, the uv workspace and the justfile" (Build Plan, phase 1 tasks, before this change)
>
> "The current build (v0) changes to match it" (Architecture, Status and scope, before this change)

## Decision

Owner, 2026-11-23: "Phase 1 should start fresh."

- No v0 code, data or eval case is used. v0 remains only as history in the "Was" column of the Decision log.
- The about 300 golden and 200 adversarial cases are written fresh in phase 1; the counts do not change.
- The v0 change backlog in the architecture is retired. Each item is covered by a build plan phase.
- Tasks that replaced or removed v0 parts now describe building the target directly.

## Alternatives considered

| Alternative | Why not |
| --- | --- |
| Find and import v0 | Owner decision |
| Reduce the phase 1 case counts | Would weaken the baseline and the smoke suite |

## Consequences

Phase 1 grows, because it now builds what v0 supplied: the web app, API, orchestrator, connectors, desktop shell, the Mesh and 500 eval cases. ADR-005 covers how that work is split. The phase 1 cost and time estimates were made for a restructure and have not been revised.

## Rollback

Import v0 in a new ADR that supersedes this one.

## Documents and code updated

- [x] Index row in docs/adr/README.md
- [x] Architecture Status and scope, SLOs, Suites, Decision log, Build order, Numbers to measure; Build Plan phases 1, 3, 4, 5, 15, 20 and 31; AGENTS.md section 3
- [x] Code comment: not needed, no code exists yet

## Verification

Document change only. No code exists to run. The text was edited in the same change as this record.

## Status history

| Date | Status | By | Note |
| --- | --- | --- | --- |
| 2026-11-23 | Accepted | Claude Code (Claude Opus 5.5) | Recorded on the owner's explicit instruction, quoted in Decision |

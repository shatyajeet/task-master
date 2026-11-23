# ADR-009: Monthly restores and quarterly regional drills

| Field | Value |
| --- | --- |
| Status | Accepted |
| Decision date | 2026-11-23 |
| Decided by | Owner asked on 2026-11-23 to "fix the problems that you found according to the spirit of the work to be done"; accepted by the owner on 2026-11-23 |
| Recorded by | Claude Code (Claude Opus 5.5) |
| Type | Contradiction |
| Class | Ask first |
| Build plan phase | 24 |
| Departs from | Architecture, Backups and recovery; Pipeline |
| Affected paths | docs/, infra/terraform |
| Supersedes / superseded by | None |
| Temporary until | Permanent |

## Context

The architecture gave two cadences for restore rehearsals.

## Documented rule

> "every quarter, restore the production snapshot into a clean account" (Architecture, Backups and recovery, before this change)
>
> "Monthly | Schedule | Restore the production snapshot into the sandbox account" (Architecture, Pipeline)

## Decision

Every month, an automated job restores the production snapshot into the sandbox account and runs the recovery suite. Every quarter, a full drill rebuilds a working environment from the second region's copies and is measured against RPO 15 minutes and RTO 4 hours.

## Alternatives considered

| Alternative | Why not |
| --- | --- |
| Monthly only | Never proves the regional targets |
| Quarterly only | Weaker than the pipeline already promised |

## Consequences

Keeps the stricter reading of both sentences. The USD 9 a month in the cost table has not been re-estimated for a quarterly regional rebuild.

## Rollback

Restore the previous text and tasks.

## Documents and code updated

- [x] Index row in docs/adr/README.md
- [x] Architecture Storage introduction, Backups and recovery, Pipeline, Decision log; Build Plan phase 24
- [x] Code comment: not needed, no code exists yet

## Verification

Document change only. No code exists to run. The text was edited in the same change as this record.

## Status history

| Date | Status | By | Note |
| --- | --- | --- | --- |
| 2026-11-23 | Proposed | Claude Code (Claude Opus 5.5) | Recorded for owner acceptance |
| 2026-11-23 | Accepted | Owner, recorded by Claude Code (Claude Opus 5.5) | Owner: "Accept all the proposed ADRs" |

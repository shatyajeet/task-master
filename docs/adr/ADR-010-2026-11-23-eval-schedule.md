# ADR-010: Full eval suites run weekly and per release candidate

| Field | Value |
| --- | --- |
| Status | Accepted |
| Decision date | 2026-11-23 |
| Decided by | Owner asked on 2026-11-23 to "fix the problems that you found according to the spirit of the work to be done"; accepted by the owner on 2026-11-23 |
| Recorded by | Claude Code (Claude Opus 5.5) |
| Type | Contradiction |
| Class | Ask first |
| Build plan phase | 8, 21 |
| Departs from | Architecture, Pipeline; Feedback loop and drift |
| Affected paths | docs/, CI workflows (from phase 2) |
| Supersedes / superseded by | None |
| Temporary until | Permanent |

## Context

The architecture ran all seven suites on every main deploy. At the plan's USD 70 a run and 60 merges a month, that is about USD 4,200. The plan budgets USD 163 a month for smoke per merge and USD 712 for nightly, weekly and release-candidate runs.

## Documented rule

> "Staging | Every main deploy | ... all seven eval suites" (Architecture, Pipeline, before this change)
>
> "Eval smoke on staging for every merge" and "Nightly drift runs (USD 10 a night), weekly full runs, release-candidate runs" (Build Plan, Cost by phase)
>
> "The full suites replay on any model, prompt, tool or policy change." (Architecture, Feedback loop and drift, before this change)

## Decision

- Every merge: eval smoke, a live-model subset of the golden cases, the deterministic eval cases and the existing staging tests.
- Weekly: all seven suites on staging.
- Release candidate: all seven suites against the exact digests and configuration to be promoted. Every release gate must pass before production approval.
- Model, prompt, tool and policy changes are promoted only inside a release candidate.

## Alternatives considered

| Alternative | Why not |
| --- | --- |
| All suites on every merge | About USD 4,200 a month, and slower than the 30-minute deploy target |
| Raise the budget | Owner decision; nothing in the plan suggests it |

## Consequences

No gate is lowered and nothing reaches production without every gate. A quality regression can stay on staging for up to a week. The budget leaves room for about 1.5 candidate runs a month. Not resolved here: the nightly full red-team set (250 cases at USD 0.054, about USD 13.50) exceeds the plan's USD 10 a night.

## Rollback

Restore the Staging row and raise the cost table.

## Documents and code updated

- [x] Index row in docs/adr/README.md
- [x] Architecture Pipeline, Feedback loop and drift, Decision log; Build Plan phase 21
- [x] Code comment: not needed, no code exists yet

## Verification

Document change only. No code exists to run. The text was edited in the same change as this record.

## Status history

| Date | Status | By | Note |
| --- | --- | --- | --- |
| 2026-11-23 | Proposed | Claude Code (Claude Opus 5.5) | Recorded for owner acceptance |
| 2026-11-23 | Accepted | Owner, recorded by Claude Code (Claude Opus 5.5) | Owner: "Accept all the proposed ADRs" |

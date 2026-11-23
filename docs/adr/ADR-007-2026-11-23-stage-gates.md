# ADR-007: Definition of the four stage gates

| Field | Value |
| --- | --- |
| Status | Accepted |
| Decision date | 2026-11-23 |
| Decided by | Owner asked on 2026-11-23 to "fix the problems that you found according to the spirit of the work to be done"; accepted by the owner on 2026-11-23 |
| Recorded by | Claude Code (Claude Opus 5.5) |
| Type | Gap |
| Class | Ask first |
| Build plan phase | All |
| Departs from | None (fills a gap) |
| Affected paths | docs/TaskMaster Build Plan.md |
| Supersedes / superseded by | None |
| Temporary until | Permanent |

## Context

The plan requires four gates between its eight stages, but their names, positions and criteria were only in a diagram that was lost.

## Documented rule

> "Each of the four gates must pass before the stage below it starts." (Build Plan, Roadmap)

## Decision

Gates sit after stages A (local product), C (durable staging), E (beta) and G (production readiness). Each one collects exit criteria that the phases already define and adds none. The owner ticks a gate with its date. The launch criteria stay in phase 31.

## Alternatives considered

| Alternative | Why not |
| --- | --- |
| A gate after every stage | The plan says four |
| Only the Beta and Production release gates | Two, not four, and nothing would guard the early stages |

## Consequences

Positions are inferred: every second stage, matching the natural hand-offs (laptop, staging, beta, production). The original diagram may have differed.

## Rollback

Replace the Stage gates section.

## Documents and code updated

- [x] Index row in docs/adr/README.md
- [x] Build Plan Roadmap and Stage gates; AGENTS.md section 3
- [x] Code comment: not needed, no code exists yet

## Verification

Document change only. No code exists to run. The text was edited in the same change as this record.

## Status history

| Date | Status | By | Note |
| --- | --- | --- | --- |
| 2026-11-23 | Proposed | Claude Code (Claude Opus 5.5) | Recorded for owner acceptance |
| 2026-11-23 | Accepted | Owner, recorded by Claude Code (Claude Opus 5.5) | Owner: "Accept all the proposed ADRs" |

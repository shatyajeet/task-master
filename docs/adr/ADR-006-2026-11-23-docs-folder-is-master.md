# ADR-006: The documents in docs/ are the master copies

| Field | Value |
| --- | --- |
| Status | Accepted |
| Decision date | 2026-11-23 |
| Decided by | Owner |
| Recorded by | Claude Code (Claude Opus 5.5) |
| Type | New decision |
| Class | Ask first (owner instructed) |
| Build plan phase | All |
| Departs from | None |
| Affected paths | docs/ |
| Supersedes / superseded by | None |
| Temporary until | Permanent |

## Context

The architecture and build plan look exported from another tool, and three diagrams became "[embedded content]" placeholders.

## Documented rule

> The documents did not say which copy is the master.

## Decision

Owner, 2026-11-23: "Docs in docs/ are master copies."

Edits happen here, and an export from elsewhere must not overwrite these files. Because master copies should not hold placeholders, the recording agent replaced the three diagrams: the run-state diagram from the Run states table, the system diagram from the System overview text and table, and the roadmap from the phase headings. They are reconstructions, not the originals.

## Alternatives considered

| Alternative | Why not |
| --- | --- |
| Leave the placeholders | Agents and readers would be missing the stage gates and flows |

## Consequences

Diagrams are reviewable text. If the originals exist, the owner may want to compare the system diagram, which simplifies the component table.

## Rollback

Name a different master in a new ADR and restore the placeholders from history.

## Documents and code updated

- [x] Index row in docs/adr/README.md
- [x] Architecture Status and scope, System overview, Run states, Decision log; Build Plan How the plan works and Roadmap; AGENTS.md section 2
- [x] Code comment: not needed, no code exists yet

## Verification

Document change only. No code exists to run. The text was edited in the same change as this record.

## Status history

| Date | Status | By | Note |
| --- | --- | --- | --- |
| 2026-11-23 | Accepted | Claude Code (Claude Opus 5.5) | Recorded on the owner's explicit instruction, quoted in Decision |

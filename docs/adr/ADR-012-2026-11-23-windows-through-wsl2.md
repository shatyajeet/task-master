# ADR-012: Windows development through WSL2, with pinned toolchains

| Field | Value |
| --- | --- |
| Status | Accepted |
| Decision date | 2026-11-23 |
| Decided by | Owner asked on 2026-11-23 to "fix the problems that you found according to the spirit of the work to be done"; accepted by the owner on 2026-11-23 |
| Recorded by | Claude Code (Claude Opus 5.5) |
| Type | Gap |
| Class | Ask first |
| Build plan phase | 1 |
| Departs from | Build Plan, Machine requirements |
| Affected paths | .nvmrc, .python-version, docs/, AGENTS.md section 7 |
| Supersedes / superseded by | Superseded in part by ADR-013 (the Node 22 pin only) |
| Temporary until | Permanent |

## Context

The plan supports macOS and Ubuntu, and the owner develops on Windows 11 with Node 24 and Python 3.15 installed.

## Documented rule

> "OS | macOS 14+ (Apple Silicon) or Ubuntu 24.04" (Build Plan, Machine requirements, before this change)

## Decision

Windows 11 is supported through Ubuntu 24.04 in WSL2, which runs the same commands as Ubuntu. Clone inside the WSL file system, not under /mnt/c or a synced folder. `.nvmrc` pins Node 22 and `.python-version` pins Python 3.12 so version managers pick the planned versions. The exit criteria stay a fresh macOS and a fresh Ubuntu machine.

## Alternatives considered

| Alternative | Why not |
| --- | --- |
| Native Windows support | Every script and container path would need a second form |
| Move the pins to the installed versions | A toolchain change nobody decided |

## Consequences

The current clone sits in a OneDrive folder, so it should be cloned again inside WSL before phase 1. The desktop app runs in dev mode through WSLg until phase 28 builds on Windows runners; this is not yet tested.

## Rollback

Remove the two pin files and restore the OS row.

## Documents and code updated

- [x] Index row in docs/adr/README.md
- [x] Build Plan Machine requirements and phase 1 Done when; AGENTS.md section 7
- [x] Code comment: not needed, no code exists yet

## Verification

Document change only. No code exists to run. The text was edited in the same change as this record.

## Status history

| Date | Status | By | Note |
| --- | --- | --- | --- |
| 2026-11-23 | Proposed | Claude Code (Claude Opus 5.5) | Recorded for owner acceptance |
| 2026-11-23 | Accepted | Owner, recorded by Claude Code (Claude Opus 5.5) | Owner: "Accept all the proposed ADRs" |
| 2026-11-23 | Accepted | Claude Code (Claude Opus 5.5) | Node 22 pin superseded by ADR-013 |

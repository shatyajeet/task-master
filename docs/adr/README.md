# Decision records

Every deviation from the [target architecture](../TaskMaster%20Target%20Architecture.md), the [build plan](../TaskMaster%20Build%20Plan.md) or [AGENTS.md](../../AGENTS.md), and every costly-to-reverse decision they leave open, is recorded here as one dated file.

When a record is needed, whether you may proceed, and how to write it are defined in [AGENTS.md, section 9](../../AGENTS.md#9-deviations-and-decision-records). Start from [template.md](template.md).

File name: `ADR-NNN-YYYY-MM-DD-short-slug.md`, where the date is the day the decision was made.

| Status | Meaning |
| --- | --- |
| Proposed | Recorded, waiting for the owner |
| Accepted | In force; the body no longer changes |
| Rejected | Not adopted; code and document edits reverted, record kept |
| Superseded | Replaced by a newer ADR, linked both ways |
| Closed | A temporary deviation that has been removed |

## Index

The next unused number is one above the highest in this table.

| ADR | Decision date | Title | Type | Status |
| --- | --- | --- | --- | --- |
| ADR-001 | Not yet decided | Reserved by build plan phase 1: monorepo and local stack | New decision | Not written |
| [ADR-002](ADR-002-2026-11-23-coding-agent-guardrails.md) | 2026-11-23 | One AGENTS.md for all coding agents, with dated decision records | New decision | Accepted |
| [ADR-003](ADR-003-2026-11-23-yarn-package-manager.md) | 2026-11-23 | Yarn is the JavaScript and TypeScript package manager | Plan change | Accepted |
| [ADR-004](ADR-004-2026-11-23-phase-1-starts-fresh.md) | 2026-11-23 | Phase 1 starts fresh, without v0 code | Plan change | Accepted |
| [ADR-005](ADR-005-2026-11-23-phase-1-milestones-interim-run-path.md) | 2026-11-23 | Phase 1 milestones and the interim run path | Gap | Accepted |
| [ADR-006](ADR-006-2026-11-23-docs-folder-is-master.md) | 2026-11-23 | The documents in docs/ are the master copies | New decision | Accepted |
| [ADR-007](ADR-007-2026-11-23-stage-gates.md) | 2026-11-23 | Definition of the four stage gates | Gap | Accepted |
| [ADR-008](ADR-008-2026-11-23-four-aws-accounts.md) | 2026-11-23 | Four AWS accounts | Contradiction | Accepted |
| [ADR-009](ADR-009-2026-11-23-restore-rehearsal-cadence.md) | 2026-11-23 | Monthly restores and quarterly regional drills | Contradiction | Accepted |
| [ADR-010](ADR-010-2026-11-23-eval-schedule.md) | 2026-11-23 | Full eval suites run weekly and per release candidate | Contradiction | Accepted |
| [ADR-011](ADR-011-2026-11-23-encryption-at-creation.md) | 2026-11-23 | Encrypt every store when it is created | Discovery | Accepted |
| [ADR-012](ADR-012-2026-11-23-windows-through-wsl2.md) | 2026-11-23 | Windows development through WSL2, with pinned toolchains | Gap | Accepted |
| [ADR-013](ADR-013-2026-11-23-node-latest-lts.md) | 2026-11-23 | Node 26, the latest LTS | Plan change | Accepted |
| [ADR-014](ADR-014-2026-11-23-yarn-committed-release.md) | 2026-11-23 | Yarn runs from a release committed to the repository | Discovery | Accepted |

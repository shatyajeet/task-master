# ADR-013: Node 26, the latest LTS

| Field | Value |
| --- | --- |
| Status | Accepted |
| Decision date | 2026-11-23 |
| Decided by | Owner |
| Recorded by | Claude Code (Claude Opus 5.5) |
| Type | Plan change |
| Class | Ask first (owner instructed) |
| Build plan phase | 1, 15 |
| Departs from | Build Plan, Machine requirements; Architecture, Sandboxes |
| Affected paths | .nvmrc, docs/, AGENTS.md section 7 |
| Supersedes / superseded by | Supersedes the Node 22 pin in ADR-012; the rest of ADR-012 stands |
| Temporary until | Permanent |

## Context

The plan used Node 22, which is in maintenance, and the architecture's E2B template used Node 20. On the decision date the latest LTS line is Node 26, in Active LTS since 2026-10-28 and supported until the end of April 2029.

## Documented rule

> "Node 22 LTS (pinned in .nvmrc) with Yarn 4 through corepack" (Build Plan, Machine requirements, before this change)
>
> "E2B microVM from our template (pandas, numpy, matplotlib, openpyxl, pyarrow, Node 20)" (Architecture, Sandboxes, before this change)

## Decision

Owner, 2026-11-23: "Set Node version as the latest LTS version and modify any doc that says otherwise."

- Development, CI, service images and the E2B template all use Node 26.
- `.nvmrc` pins the major version, 26. Patch updates arrive through Renovate.
- Moving to a later LTS line needs a new ADR, so every environment moves together. The pin does not float.
- Electron ships its own Node runtime and is not affected.

## Alternatives considered

| Alternative | Why not |
| --- | --- |
| Node 22 | Owner decision; in maintenance |
| Node 24 | An LTS line, but not the latest |
| A floating `lts/*` pin | Builds would change major version without a decision |

## Consequences

One Node version everywhere, with the longest support window. Node 26 does not bundle corepack, so Yarn needs another way in (ADR-014). Native modules must support Node 26; milestone 1.1 proves this on first install.

## Rollback

Restore `.nvmrc` and the document text.

## Documents and code updated

- [x] Index row in docs/adr/README.md
- [x] Architecture Sandboxes and Decision log; Build Plan Machine requirements; AGENTS.md section 7; .nvmrc
- [x] Code comment: not needed, no code exists yet

## Verification

Found by search on 2026-11-23: [Node.js 26.13.0 (LTS)](https://nodejs.org/en/blog/release/v26.13.0), [Node.js release schedule](https://github.com/nodejs/release). No code exists to run on Node 26 yet.

## Status history

| Date | Status | By | Note |
| --- | --- | --- | --- |
| 2026-11-23 | Accepted | Claude Code (Claude Opus 5.5) | Recorded on the owner's explicit instruction, quoted in Decision |

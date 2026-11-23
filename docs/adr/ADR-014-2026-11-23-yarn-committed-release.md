# ADR-014: Yarn runs from a release committed to the repository

| Field | Value |
| --- | --- |
| Status | Accepted |
| Decision date | 2026-11-23 |
| Decided by | Recording agent; accepted by the owner on 2026-11-23 |
| Recorded by | Claude Code (Claude Opus 5.5) |
| Type | Discovery |
| Class | Record and proceed |
| Build plan phase | 1 |
| Departs from | ADR-003, the corepack detail |
| Affected paths | .yarnrc.yml and .yarn/releases (created in milestone 1.1), justfile, docs/, AGENTS.md section 7 |
| Supersedes / superseded by | Supersedes the corepack detail in ADR-003; the rest of ADR-003 stands |
| Temporary until | Permanent |

## Context

ADR-003 installs Yarn 4 through corepack. ADR-013 moves to Node 26, and Node stopped bundling corepack in version 25, so that route no longer works on a fresh machine.

## Documented rule

> "Yarn 4 through corepack, with the exact version pinned in the root package.json `packageManager` field." (ADR-003, Decision)

## Decision

Commit the Yarn 4 release file under `.yarn/releases` and point `yarnPath` in `.yarnrc.yml` at it. `just` recipes run that file with Node, so a fresh machine needs no global Yarn. The `packageManager` field in package.json states the same version. Yarn stays the package manager (ADR-003).

## Alternatives considered

| Alternative | Why not |
| --- | --- |
| Follow ADR-003: bundled corepack | Not shipped with Node 26 |
| Install corepack from npm globally | Adds a global npm step to bootstrap; one unconfirmed report says its package excludes newer Node versions |
| Stay on Node 24, which bundles corepack | Against the owner's decision in ADR-013 |

## Consequences

Every machine and CI runner uses the same Yarn file with no extra install. The repository carries one generated file of a few megabytes, excluded from lint, coverage and review. Upgrading Yarn means replacing the file and the version field together.

## Rollback

Delete `.yarn/releases` and `yarnPath`, and document another way to install Yarn.

## Documents and code updated

- [x] Index row in docs/adr/README.md
- [x] Architecture Decision log; Build Plan Machine requirements and milestone 1.1; AGENTS.md section 7
- [x] Code comment: not needed, no code exists yet

## Verification

Found by search on 2026-11-23: [Node.js corepack documentation](https://nodejs.org/download/release/v25.8.0/docs/api/corepack.html) says corepack is not distributed from Node 25. The committed-release setup has not been run; milestone 1.1 proves it.

## Status history

| Date | Status | By | Note |
| --- | --- | --- | --- |
| 2026-11-23 | Proposed | Claude Code (Claude Opus 5.5) | Recorded for owner acceptance |
| 2026-11-23 | Accepted | Owner, recorded by Claude Code (Claude Opus 5.5) | Owner: "Accept the ADR-014" |

# ADR-003: Yarn is the JavaScript and TypeScript package manager

| Field | Value |
| --- | --- |
| Status | Accepted |
| Decision date | 2026-11-23 |
| Decided by | Owner |
| Recorded by | Claude Code (Claude Opus 5.5) |
| Type | Plan change |
| Class | Ask first (owner instructed) |
| Build plan phase | 1 |
| Departs from | Build Plan, One monorepo and Machine requirements; Architecture, Repositories |
| Affected paths | Root package.json, .yarnrc.yml and yarn.lock (created in phase 1), AGENTS.md section 7 |
| Supersedes / superseded by | Superseded in part by ADR-014 (the corepack detail only) |
| Temporary until | Permanent |

## Context

The owner wants Yarn for every JavaScript and TypeScript package and app. No code exists yet, so nothing migrates.

## Documented rule

> "pnpm workspaces with Turborepo run and cache tasks across both languages" (Build Plan, One monorepo, before this change)
>
> "pnpm workspaces and Turborepo run and cache tasks across both languages" (Architecture, Repositories, before this change)

## Decision

Owner, 2026-11-23: "Change pnpm everywhere to yarn. I want to use yarn as the package manager for JS/TS related packages/apps."

Details chosen by the recording agent. Phase 1 may change them through ADR-001:

- Yarn 4 through corepack, with the exact version pinned in the root package.json `packageManager` field.
- `nodeLinker: node-modules`, not Plug'n'Play, because Electron packaging and several native modules expect a node_modules folder.
- `npmRegistryServer: https://registry.npmjs.org`, so installs use the npm host that sandbox allowlists already name.
- `yarn install --immutable` in CI.

## Alternatives considered

| Alternative | Why not |
| --- | --- |
| Keep pnpm | Owner decision |
| Yarn 1 (classic) | No longer developed |
| Yarn Plug'n'Play | Compatibility risk with Electron packaging and native modules |
| Yarn 6 | No confirmed stable release when this was decided |

## Consequences

Turborepo works with Yarn workspaces. The node-modules linker is less strict than pnpm about undeclared dependencies, so linting must catch them. The "npm" entry in the sandbox network allowlist means the npm registry and is unchanged.

## Rollback

Replace the packageManager field, lockfile and workspace configuration, and restore the document text.

## Documents and code updated

- [x] Index row in docs/adr/README.md
- [x] Architecture Repositories and Decision log; Build Plan One monorepo, Machine requirements, Commands and milestone 1.1; AGENTS.md section 7
- [x] Code comment: not needed, no code exists yet

## Verification

Document change only. No code exists to run. The text was edited in the same change as this record.

## Status history

| Date | Status | By | Note |
| --- | --- | --- | --- |
| 2026-11-23 | Accepted | Claude Code (Claude Opus 5.5) | Recorded on the owner's explicit instruction, quoted in Decision |
| 2026-11-23 | Accepted | Claude Code (Claude Opus 5.5) | Corepack detail superseded by ADR-014 |

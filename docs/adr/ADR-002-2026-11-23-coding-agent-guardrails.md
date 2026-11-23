# ADR-002: One AGENTS.md for all coding agents, with dated decision records

| Field | Value |
| --- | --- |
| Status | Accepted |
| Decision date | 2026-11-23 |
| Decided by | Owner, for the single rules file and dated records; the details marked below were accepted by the owner on 2026-11-23 |
| Recorded by | Claude Code (Claude Opus 5.5) |
| Type | New decision |
| Class | Ask first (sets the rules in AGENTS.md) |
| Build plan phase | Before phase 1 |
| Departs from | None |
| Affected paths | AGENTS.md, CLAUDE.md, .gemini/settings.json, .vscode/settings.json, .github/copilot-instructions.md, .aider.conf.yml, docs/adr/ |
| Supersedes / superseded by | None |
| Temporary until | Permanent |

## Context

Several coding agents will work in this repository, and each looks for its instructions in a different file. Copies drift apart. The owner asked on 2026-11-23 for the rules to live in one file that the others refer to, and for any agent's departure from the guardrails, architecture or plan to be kept as a decision record carrying its date.

The build plan requires ADRs and names ADR-001 for phase 1, but does not define their format, their folder within docs, or who accepts them. The architecture names AGENTS.md as the pull-request Reviewer's review rules.

## Documented rule

> "A phase that changes a decision updates the doc and adds an ADR in the same pull request." (Build Plan, Phase rules)

> "docs | Architecture doc, ADRs, runbooks" (Build Plan, One monorepo)

The documents leave open the record format, the file naming, the rules for coding agents, and the code conventions listed below.

## Decision

Decided by the owner:

1. AGENTS.md holds every rule for coding agents. Other agents' files only point to it.
2. Departures are documented as decision records that carry the decision date.
3. CI checks for these rules come later ("Add a todo to add CI checks for the ADR rules to a later point"). The task is in build plan phase 2.

Chosen by the recording agent, for owner review:

1. Records live in docs/adr as `ADR-NNN-YYYY-MM-DD-short-slug.md`, which keeps the plan's numbering. ADR-001 stays reserved for phase 1.
2. Agents write records as Proposed; only the owner accepts or rejects them. A decision the owner has explicitly made is recorded as Accepted, with the instruction quoted.
3. Two classes of departure: Ask first, and Record and proceed (AGENTS.md section 9).
4. No nested AGENTS.md files. Package guidance goes in package READMEs.
5. Conventions the documents do not set: dependency direction between services, file naming, unit-test location, branch naming, UTF-8 with LF, and an ADR for each new runtime dependency.
6. Local configuration for LiteLLM, the Collector and MCP services goes in infra/dev, inferred from the compose stack living there.
7. Review rules sit in AGENTS.md section 11, because the pull-request Reviewer reads that file.

## Alternatives considered

| Alternative | Why not |
| --- | --- |
| A full rules file per agent | Copies drift apart |
| Symlinks to AGENTS.md | Need elevated rights or Developer Mode on Windows; symlinks are off in this clone |
| A nested AGENTS.md in each package | Rules spread over many files, and tools load nested files differently |
| ADR files named by date only | Conflicts with ADR-001 in the build plan; harder to cite in code |
| Only a Decision log in the architecture doc | No room for alternatives, status or rollback |

## Consequences

- One place to change a rule. Other tools need at most a small pointer.
- AGENTS.md is loaded in every session, so it must stay under 28 KB.
- Following the rules depends on agents and reviewers; nothing in CI checks them until build plan phase 2.
- Every runtime dependency costs a short ADR.

## Rollback

Delete the pointer files and AGENTS.md. Keep docs/adr, which the build plan requires.

## Documents and code updated

- [x] Index row in docs/adr/README.md
- [x] Build Plan phase 2: decision-record checks task. Architecture: not needed, nothing in it changes
- [x] Code comment: not needed, no code exists yet

## Verification

On 2026-11-23, checked by script: relative links and heading anchors resolve, JSON files parse, every ARCH heading named in AGENTS.md section 4 exists, and AGENTS.md is under 28 KB. How each tool loads its pointer was taken from published documentation, not tested in the tools.

## Status history

| Date | Status | By | Note |
| --- | --- | --- | --- |
| 2026-11-23 | Proposed | Claude Code (Claude Opus 5.5) | Created with AGENTS.md |
| 2026-11-23 | Proposed | Claude Code (Claude Opus 5.5) | Added the CI checks task and how owner-made decisions are recorded, on owner instruction |
| 2026-11-23 | Accepted | Owner, recorded by Claude Code (Claude Opus 5.5) | Owner: "Accept all the proposed ADRs" |

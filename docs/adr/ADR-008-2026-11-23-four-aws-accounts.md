# ADR-008: Four AWS accounts

| Field | Value |
| --- | --- |
| Status | Accepted |
| Decision date | 2026-11-23 |
| Decided by | Owner asked on 2026-11-23 to "fix the problems that you found according to the spirit of the work to be done"; accepted by the owner on 2026-11-23 |
| Recorded by | Claude Code (Claude Opus 5.5) |
| Type | Contradiction |
| Class | Ask first |
| Build plan phase | 7, 24, 25 |
| Departs from | Architecture, Environments and accounts |
| Affected paths | docs/, infra/terraform (from phase 7) |
| Supersedes / superseded by | None |
| Temporary until | Permanent |

## Context

The architecture gave two different account counts, and no phase or cost line created the dev or sandbox account.

## Documented rule

> "Terraform defines every AWS resource in three separate accounts" (Architecture, CI/CD, before this change)
>
> "separate dev, staging, prod and sandbox accounts, plus a security account" (Architecture, Environments and accounts, before this change)

## Decision

Four accounts: staging and security (phase 7), sandbox (phase 24) and production (phase 25). There is no dev account, because development runs on the laptop stack.

## Alternatives considered

| Alternative | Why not |
| --- | --- |
| Five accounts, with dev | Laptop parity removes the need; no phase or budget uses it |
| Three accounts | Restores need a clean account separate from staging and production |

## Consequences

Fewer accounts to secure. If cloud-only debugging needs a place, it happens in staging or a new ADR adds an account.

## Rollback

Add a dev account in Terraform and restore the text.

## Documents and code updated

- [x] Index row in docs/adr/README.md
- [x] Architecture CI/CD introduction, Environments and accounts, Decision log; Build Plan phase 24
- [x] Code comment: not needed, no code exists yet

## Verification

Document change only. No code exists to run. The text was edited in the same change as this record.

## Status history

| Date | Status | By | Note |
| --- | --- | --- | --- |
| 2026-11-23 | Proposed | Claude Code (Claude Opus 5.5) | Recorded for owner acceptance |
| 2026-11-23 | Accepted | Owner, recorded by Claude Code (Claude Opus 5.5) | Owner: "Accept all the proposed ADRs" |

# ADR-011: Encrypt every store when it is created

| Field | Value |
| --- | --- |
| Status | Accepted |
| Decision date | 2026-11-23 |
| Decided by | Owner asked on 2026-11-23 to "fix the problems that you found according to the spirit of the work to be done"; accepted by the owner on 2026-11-23 |
| Recorded by | Claude Code (Claude Opus 5.5) |
| Type | Discovery |
| Class | Ask first |
| Build plan phase | 7, 23 |
| Departs from | Build Plan, phase 23 |
| Affected paths | docs/, infra/terraform |
| Supersedes / superseded by | None |
| Temporary until | Permanent |

## Context

Phase 7 created RDS and Valkey, and phase 23 added KMS encryption. AWS allows RDS and ElastiCache encryption at rest to be enabled only at creation, so phase 23 would have forced a rebuild of both.

## Documented rule

> "KMS encryption at rest on RDS, Valkey, S3 and SQS; envelope encryption for connector tokens" (Build Plan, phase 23, before this change)

## Decision

Phase 7 creates every AWS store encrypted with customer-managed KMS keys. Phase 23 keeps connector-token envelope encryption and adds a policy check that fails an unencrypted store. Customer-managed keys are chosen because restores cross accounts and regions, and their key policies can allow that.

## Alternatives considered

| Alternative | Why not |
| --- | --- |
| Encrypt in phase 23 through snapshot, copy and restore | Downtime and rework |
| AWS-managed keys | Key policies cannot be changed to allow the cross-account restores |

## Consequences

Stronger and earlier. Phase 7's cost line already includes KMS, so the cost table is unchanged.

## Rollback

Not advisable; encryption cannot be removed in place.

## Documents and code updated

- [x] Index row in docs/adr/README.md
- [x] Architecture Stores and Decision log; Build Plan phases 7 and 23
- [x] Code comment: not needed, no code exists yet

## Verification

AWS documentation found by search on 2026-11-23: [RDS for PostgreSQL](https://docs.aws.amazon.com/prescriptive-guidance/latest/patterns/encrypt-an-existing-amazon-rds-for-postgresql-db-instance.html), [ElastiCache](https://docs.aws.amazon.com/AmazonElastiCache/latest/dg/at-rest-encryption.html). The customer-managed key requirement for sharing snapshots was not confirmed by that search; confirm it in phase 7.

## Status history

| Date | Status | By | Note |
| --- | --- | --- | --- |
| 2026-11-23 | Proposed | Claude Code (Claude Opus 5.5) | Recorded for owner acceptance |
| 2026-11-23 | Accepted | Owner, recorded by Claude Code (Claude Opus 5.5) | Owner: "Accept all the proposed ADRs" |

---
step: S10
title: "Document upload and delete API"
status: not-started
started:
completed:
---

# S10 · Document upload and delete API

**Read before starting:** [README: rules and choices](../README.md) · [progress.md](../progress.md) · [Fastify REST API](../contracts.md#fastify-rest-api) · [Job payloads](../contracts.md#job-payloads)

**Needs:** S07

**Creates:** `apps/api/src/routes/documents.ts`, `src/jobs.ts`, `test/documents.test.ts`

**Build**

- Uploads use `@fastify/multipart` with `limits: {fileSize: 26214400, files: 1}`. A file that is truncated at the limit returns 413.
- In order:
  1. Check the extension, or return 415.
  2. Stream the file to `UPLOAD_DIR\<wid>\.incoming-<random>`, hashing it with SHA-256 along the way.
  3. Open a transaction: insert the document, then call `enqueueJob(client, wid, 'ingest', {document_id})`, which inserts the job and runs `NOTIFY jobs`.
  4. Rename the file to `UPLOAD_DIR\<wid>\<document_id>.<ext>` and commit.

  If anything fails, roll back and delete the temporary file.
- Delete, in one transaction:
  1. `DELETE FROM documents WHERE id = $1 AND workspace_id = $2`, which cascades.
  2. Delete the workspace's orphaned entities: `DELETE FROM entities e WHERE e.workspace_id = $1 AND NOT EXISTS (SELECT 1 FROM relations r WHERE r.source_entity_id = e.id OR r.target_entity_id = e.id)`.
  3. Commit, then delete the file.
- The response body has the keys `id, workspace_id, filename, extension, size_bytes, status, error, page_count, created_at, updated_at`.
- Tests:
  1. Uploading `handbook.md` creates a document with status `queued`, one `ingest` job with the right payload, and the file on disk with the matching hash.
  2. A `.exe` returns 415 and leaves nothing on disk or in the database.
  3. A 26214401-byte file returns 413 and leaves nothing behind.
  4. Deleting a document removes its row, pages, chunks, relations, orphaned entities and file. The test inserts those rows directly.
  5. A `LISTEN jobs` client receives one notification per upload.

**Verify:** `yarn workspace @taskmaster/api test`.

## Finish

1. Every **Verify** command above exits 0, and so does `yarn check:arch`.
2. Add the S10 entry to [progress.md](../progress.md).
3. Set `status: done` and `completed:` at the top of this file.
4. Commit everything as `S10: Document upload and delete API`.

## Blocked

Empty unless `status: blocked`. Then: what failed, the exact error, and what the user needs to decide.

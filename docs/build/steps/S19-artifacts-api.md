---
step: S19
title: "Artifacts API"
status: not-started
started:
completed:
---

# S19 · Artifacts API

**Read before starting:** [README: rules and choices](../README.md) · [progress.md](../progress.md) · [Fastify REST API](../contracts.md#fastify-rest-api)

**Needs:** S17

**Creates:** `apps/api/src/routes/artifacts.ts`, `test/artifacts.test.ts`

**Build**

- The artifact routes from the Contracts table.
- The list leaves out `content`. Get includes it, as JSON.
- Download sends:
  - `Content-Type: text/plain; charset=utf-8`
  - `Content-Disposition: attachment; filename="<safe>.md"; filename*=UTF-8''<encoded>`, where `<safe>` is the title with every character outside `[A-Za-z0-9 ._-]` replaced by `_` and cut to 100 characters
  - `X-Content-Type-Options: nosniff`
- No route serves artifact content as `text/html`.
- Tests:
  1. List, get, rename and delete work, scoped to the workspace.
  2. Downloading an artifact whose content is `<script>alert(1)</script>` returns `text/plain` with an attachment disposition and `nosniff`.
  3. A title with `"/\:*?` produces a safe filename.

**Verify:** `yarn workspace @taskmaster/api test`.

## Finish

1. Every **Verify** command above exits 0, and so does `yarn check:arch`.
2. Add the S19 entry to [progress.md](../progress.md).
3. Set `status: done` and `completed:` at the top of this file.
4. Commit everything as `S19: Artifacts API`.

## Blocked

Empty unless `status: blocked`. Then: what failed, the exact error, and what the user needs to decide.

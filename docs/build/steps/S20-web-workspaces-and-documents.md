---
step: S20
title: "Web: workspaces and documents"
status: not-started
started:
completed:
---

# S20 · Web: workspaces and documents

**Read before starting:** [README: rules and choices](../README.md) · [progress.md](../progress.md) · [Fastify REST API](../contracts.md#fastify-rest-api)

**Needs:** S13, S06

**Creates:**
- `apps/web/app/page.tsx` (replaced), `app/w/[wid]/layout.tsx`, `app/w/[wid]/documents/page.tsx`
- `apps/web/components/WorkspaceList.tsx`, `components/DocumentTable.tsx`, `components/UploadButton.tsx`
- `apps/web/e2e/documents.spec.ts`

**Build**

- **The home page** has the heading "Workspaces", a list of links to `/w/<id>/documents`, a create form (a name input and a "Create" button), and rename and delete actions. Deleting asks "Delete workspace <name> and all its documents?" through `window.confirm`.
- **The workspace layout** shows the workspace name and tabs: Documents, Chat (`/w/<id>/threads`), Artifacts (`/w/<id>/artifacts`). An eval link goes to `/evals`.
- **The documents page**:
  - A table of filename, status, pages, size and created time, refreshed every 2 seconds while any document is `queued` or `processing`.
  - An upload button that accepts the 14 extensions.
  - A delete action with a confirm.
  - Errors from `ApiError` appear in a single `role="alert"` region.
- Styling uses `globals.css` and CSS modules only, with no UI library.
- Playwright tests, run against `yarn dev --e2e`, with the test database reset by a `beforeAll` that runs `yarn db:reset --test`:
  1. Create a workspace and see it listed.
  2. Upload `evals/documents/handbook.md`, and see it reach `ready` within 60 seconds.
  3. Upload a `.exe`, and see the alert "unsupported_type".
  4. Delete the document, and see the row disappear.

**Verify:** `yarn e2e`.

## Finish

1. Every **Verify** command above exits 0, and so does `yarn check:arch`.
2. Add the S20 entry to [progress.md](../progress.md).
3. Set `status: done` and `completed:` at the top of this file.
4. Commit everything as `S20: Web: workspaces and documents`.

## Blocked

Empty unless `status: blocked`. Then: what failed, the exact error, and what the user needs to decide.

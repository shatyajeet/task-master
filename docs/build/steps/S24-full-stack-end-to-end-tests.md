---
step: S24
title: "Full-stack end-to-end tests"
status: not-started
started:
completed:
---

# S24 · Full-stack end-to-end tests

**Read before starting:** [README: rules and choices](../README.md) · [progress.md](../progress.md) · [Fastify REST API](../contracts.md#fastify-rest-api)

**Needs:** S23

**Creates:** `apps/web/e2e/full.spec.ts`

**Build** one Playwright test that runs this whole scenario against `yarn dev --e2e`, in order:

1. Create a workspace.
2. Upload `handbook.md`, `contract.pdf` and `budget.xlsx`, and wait for all three to be `ready`. This exercises real OCR and LibreOffice.
3. Ask a question. The stub returns `search_documents`, then an answer citing `handbook.md`. Check that the step row and the citation appear.
4. Ask for a file. Approve it, and check the file's content in `.cache/e2e/out`.
5. Save an artifact, open it, and download it.
6. Delete `contract.pdf`. The graph view and search return nothing from it.
7. Delete the workspace. Its upload folder is gone.

Also run, across the whole suite: `yarn test`, `yarn typecheck`, and the `lint` script of both Python services.

**Verify**

```text
yarn test
yarn typecheck
yarn workspace @taskmaster/agent lint
yarn workspace @taskmaster/ocr lint
yarn e2e
```

All five exit 0 on a clean checkout, after `yarn install --immutable`, the venv installs with `--require-hashes`, and `yarn db:reset --all`.

## Finish

1. Every **Verify** command above exits 0, and so does `yarn check:arch`.
2. Add the S24 entry to [progress.md](../progress.md).
3. Set `status: done` and `completed:` at the top of this file.
4. Commit everything as `S24: Full-stack end-to-end tests`.

## Blocked

Empty unless `status: blocked`. Then: what failed, the exact error, and what the user needs to decide.

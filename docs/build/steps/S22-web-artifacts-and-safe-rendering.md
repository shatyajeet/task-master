---
step: S22
title: "Web: artifacts and safe rendering"
status: not-started
started:
completed:
---

# S22 · Web: artifacts and safe rendering

**Read before starting:** [README: rules and choices](../README.md) · [progress.md](../progress.md) · [Fastify REST API](../contracts.md#fastify-rest-api)

**Needs:** S19, S21

**Creates:**
- `apps/web/components/SafeMarkdown.tsx`
- `apps/web/app/w/[wid]/artifacts/page.tsx`, `app/w/[wid]/artifacts/[aid]/page.tsx`
- `apps/web/e2e/rendering.spec.ts`

Edits `Chat.tsx` to use `SafeMarkdown`.

**Build**

- `SafeMarkdown` is `react-markdown` with `remark-gfm` and `skipHtml`, with no `rehype-raw`. It overrides these components:
  - `img` renders `<span class="remote-image">[image: {alt}] {src}</span>`, never an `<img>`.
  - `a` renders an `<a>` only for `http:`, `https:` or `mailto:` URLs, with `target="_blank"` and `rel="noopener noreferrer"`. The link text is followed by ` ({href})`. Any other scheme renders as plain text.
- **The artifacts list**: title, created time, rename and delete.
- **The artifact page**: `SafeMarkdown` with a "Download" link to the download route.
- Playwright tests:
  1. An artifact whose content has `![x](https://attacker.example/p.png)`, `<img src=https://attacker.example/q.png>` and `<script>` renders with no request to `attacker.example`. The test records every request with `page.on("request")`.
  2. A `javascript:` link renders as text.
  3. A chat reply with a remote image makes no remote request.
  4. Download returns a file attachment.

**Verify:** `yarn e2e`.

## Finish

1. Every **Verify** command above exits 0, and so does `yarn check:arch`.
2. Add the S22 entry to [progress.md](../progress.md).
3. Set `status: done` and `completed:` at the top of this file.
4. Commit everything as `S22: Web: artifacts and safe rendering`.

## Blocked

Empty unless `status: blocked`. Then: what failed, the exact error, and what the user needs to decide.

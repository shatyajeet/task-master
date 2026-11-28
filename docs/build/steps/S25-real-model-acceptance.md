---
step: S25
title: "Real model acceptance"
status: not-started
started:
completed:
---

# S25 · Real model acceptance

**Read before starting:** [README: rules and choices](../README.md) · [progress.md](../progress.md) · [architecture: Models](../../architecture.md#models)

**Needs:** S24. A model chosen as the architecture describes.

**Do**

1. Set `LLM_BASE_URL`, `LLM_API_KEY` and `LLM_MODEL` in `.env`, and optionally the `JUDGE_*` variables.
2. Run `yarn doctor --strict`.
3. Start `yarn dev`, then run `yarn evals`.
4. Open `http://localhost:3000`, upload `evals/documents/project-kestrel.docx`, and ask "Who leads Project Kestrel, and who reports to them?"

**Accept the model when:**
- every `ocr` and `retrieval` case passes
- at least 2 of 3 `graph` cases pass
- `agent` cases 3, 4 and 5 pass (safety: no write without approval, injection ignored, no remote resources)
- at least 4 of 5 `agent` cases pass in total
- at least 2 of 3 `answer` cases pass
- the manual question is answered with citations

Record the eval run ID and the model name in the step's commit message. If the model fails, change models and repeat S25. Do not change the code to fit the model. Any bug S25 finds becomes a new case in `evals/cases.json`, fixed in its own commit that follows these same rules.

## Finish

1. Every **Verify** command above exits 0, and so does `yarn check:arch`.
2. Add the S25 entry to [progress.md](../progress.md).
3. Set `status: done` and `completed:` at the top of this file.
4. Commit everything as `S25: Real model acceptance`.

## Blocked

Empty unless `status: blocked`. Then: what failed, the exact error, and what the user needs to decide.

---
step: S09
title: "OCR extraction"
status: not-started
started:
completed:
---

# S09 · OCR extraction

**Read before starting:** [README: rules and choices](../README.md) · [progress.md](../progress.md) · [Ports and environment](../contracts.md#ports-and-environment) · [Internal HTTP](../contracts.md#internal-http-agent-and-ocr)

**Needs:** S08

**Creates:**
- `services/ocr/app/extract.py`, `app/convert.py`, `app/lo_sheets.py`, `app/pool.py`, `app/warmup.py`
- `services/ocr/tests/test_extract.py`, `tests/test_limits.py`, `tests/test_parallel.py`

Edits `app/main.py` to add `POST /extract`.

**Build**

- Route by extension, lowercased:
  - `pdf` → render the pages
  - `doc docx ppt pptx` → convert to PDF with the LibreOffice CLI, then render
  - `xls xlsx` → convert to PDF with `lo_sheets.py`, then render
  - `png jpg jpeg tif tiff` → use the images as they are, one page per TIFF frame
  - anything else → 415
- Limits:
  - Files over 26214400 bytes return 413.
  - After conversion, a document with more than 200 pages returns 422 `too_many_pages`.
  - A conversion that runs longer than `OCR_TIMEOUT_SECONDS` returns 504 `timeout`, and its LibreOffice process tree is killed with `taskkill /T /F`.
- LibreOffice setup, in `convert.py`:
  - The profile lives at `MODEL_CACHE_DIR\lo-profile`. On first use, the service writes `user\registrymodifications.xcu` into it, setting `org.openoffice.Office.Common/Security/Scripting/MacroSecurityLevel` to `3` and `DisableMacrosExecution` to `true`.
  - The command line is `soffice --headless --norestore --nolockcheck --nodefault --nofirststartwizard -env:UserInstallation=file:///<profile> --convert-to pdf --outdir <tmp> <file>`.
  - Each request gets its own temporary folder, deleted afterward.
  - One `asyncio.Lock` covers each whole `/extract` request, both conversion and OCR, so only one document is processed at a time. A LibreOffice profile cannot be shared, and a second document would take workers from the first. A second request waits for the lock.
- `lo_sheets.py` runs under LibreOffice's bundled `program\python.exe` and uses UNO with the same profile. It opens the workbook hidden. For every sheet's page style, it sets `IsLandscape=True`, swaps `Width` and `Height` if they are portrait, and sets `ScaleToPagesX=1` and `ScaleToPagesY=0`. It then exports with `calc_pdf_Export` and closes.
- Rendering happens in the main process only, because pypdfium2 is not thread-safe. Each page is rendered at `scale = 200/72`, converted to RGB with PIL, and saved as `page-<n>.png` in the request's temporary folder.
- **The worker pool**, in `app/pool.py`:
  - The lifespan hook creates one `ProcessPoolExecutor(max_workers=OCR_WORKERS, mp_context=multiprocessing.get_context("spawn"), initializer=init_worker)`, and shuts it down on exit.
  - `init_worker` creates one `RapidOCR(params={"EngineConfig.onnxruntime.intra_op_num_threads": OCR_THREADS_PER_WORKER, "EngineConfig.onnxruntime.inter_op_num_threads": 1})`, with models from `MODEL_CACHE_DIR`.
  - At startup, each worker OCRs a blank image once, so the first request doesn't pay for loading the models.
  - `/health` returns 200 only after every worker is warm.
- Per request:
  1. Render page 1, submit its path to the pool, render page 2, and so on.
  2. When `OCR_WORKERS × 2` pages are rendered but not yet finished, wait for one to finish before rendering the next.
  3. Delete each page's PNG once its result arrives.
  4. Collect the results by page number, and return them sorted by page.
- The result for each page:
  - `text` is the recognized lines joined with `\n`, in the order RapidOCR returns them.
  - `confidence` is the mean line score rounded to 4 decimal places, or `0.0` if there are no lines.
- The thread count per worker is fixed, and never derived from `OCR_WORKERS`. This keeps the text identical whatever the number of workers.
- If a worker dies (`BrokenProcessPool`), the service recreates and re-warms the pool, and returns 500 `ocr_failed`. The agent's job retry then repeats the request.
- `app/warmup.py` downloads RapidOCR's models into `MODEL_CACHE_DIR` and runs OCR once on a blank image.
- Tests run in-process through FastAPI's `TestClient`. Character accuracy is `1 - Levenshtein(norm(ocr), norm(truth)) / len(norm(truth))`, where `norm` is NFKC, then casefold, then collapsing whitespace to single spaces.
  1. `contract.pdf`, `project-kestrel.docx` and `q3-review.pptx` each score at least 0.95.
  2. `invoice-scan.png` scores at least 0.90.
  3. Every value in `budget.cells.json` appears as a whitespace-separated token in the `budget.xlsx` output.
  4. A 201-page PDF, generated in the test with pypdfium2, returns 422 `too_many_pages`.
  5. A `.exe` returns 415.
  6. A 26214401-byte upload returns 413.
  7. A conversion run with the timeout set to 0.001 returns 504, and no `soffice.exe` processes are left running.
- Tests in `test_parallel.py` use a 6-page PDF that the test builds from `contract.pdf` and `invoice-scan.png`:
  1. With `OCR_WORKERS=2`, the response equals the response with `OCR_WORKERS=1` exactly, including every `text` and `confidence`, and its pages are in order 1 to 6.
  2. With `OCR_WORKERS=2`, the request's temporary folder never holds more than 4 `page-*.png` files at once. A test hook samples it after every render.
  3. Two `/extract` requests sent at the same time both succeed, and the second one starts only after the first finishes.
  4. Killing one worker process during a request returns 500 `ocr_failed`, and the next request succeeds.

**Verify**

```text
node scripts/py.mjs ocr -m app.warmup
yarn workspace @taskmaster/ocr test
```

## Finish

1. Every **Verify** command above exits 0, and so does `yarn check:arch`.
2. Update [README.md](../../README.md) as [AGENTS.md](../../AGENTS.md#keeping-readmemd-current) describes, or note in the progress entry why no change was needed.
3. Add the S09 entry to [progress.md](../progress.md).
4. Set `status: done` and `completed:` at the top of this file.
5. Commit everything as `S09: OCR extraction`.

## Blocked

Empty unless `status: blocked`. Then: what failed, the exact error, and what the user needs to decide.

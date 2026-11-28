---
step: S12
title: "Ingestion: pages, chunks and embeddings"
status: not-started
started:
completed:
---

# S12 · Ingestion: pages, chunks and embeddings

**Read before starting:** [README: rules and choices](../README.md) · [progress.md](../progress.md) · [Internal HTTP](../contracts.md#internal-http-agent-and-ocr) · [Job payloads](../contracts.md#job-payloads)

**Needs:** S09, S11

**Creates:**
- `services/agent/app/ocr_client.py`, `app/chunking.py`, `app/embeddings.py`, `app/ingest.py`, `app/warmup.py`
- `services/agent/tests/test_chunking.py`, `tests/fixtures/chunking_input.json`, `tests/fixtures/chunking_expected.json`, `tests/test_ingest.py`

**Build**

- `ingest(document_id)` is registered for `ingest` jobs. It runs these stages, committing after each one:
  1. Load the document. If it's gone, complete the job and stop. Set its status to `processing`.
  2. **Pages.** Skip this stage if the document already has pages.
     - `.txt` and `.md` are read as UTF-8, with any BOM stripped and invalid bytes replaced. The whole file becomes page 1 with confidence NULL (G11).
     - Anything else is posted to `OCR_URL/extract` with an httpx timeout of 1800 seconds, and the pages are inserted.
     - Set `page_count`.
  3. **Chunks.** `DELETE FROM chunks WHERE document_id = $1` (which cascades to relations), then insert the output of `chunk_pages()` with embeddings.
  4. **Extraction**, built in S13. In this step, a no-op.
  5. Delete orphaned entities, then set the status to `ready`.
- A foreign key violation on `document_id` at any stage means the document was deleted during ingestion. Complete the job without error.
- `chunk_pages(pages) -> list[Chunk(page, ordinal, text)]` does exactly this:
  1. Per page, normalize: `\r\n` and `\r` become `\n`; apply NFC; strip trailing spaces from each line; collapse 3 or more newlines to 2.
  2. Split into paragraphs on `\n\n`, and drop empty ones.
  3. Pack greedily: join paragraphs with `\n\n` while the total is at most 1000 characters. A paragraph over 1000 characters is split at the last whitespace at or before position 1000, or hard-split at 1000 if there is none.
  4. Each new chunk on the same page, after the first, starts with the previous chunk's last 150 characters, cut back to begin at a whitespace boundary.
  5. Chunks never cross pages. `ordinal` numbers the chunks across the document, starting at 0.
- `embeddings.py`:
  - One `fastembed.TextEmbedding("BAAI/bge-small-en-v1.5", cache_dir=MODEL_CACHE_DIR)`.
  - `embed_passages(texts)` uses `passage_embed`, in batches of 32. `embed_query(text)` uses `query_embed`.
  - Both return float32 lists of length 384, and run in a thread with `asyncio.to_thread`.
- `app/warmup.py` downloads the embedding model.
- Tests:
  1. `chunk_pages(chunking_input.json)` equals `chunking_expected.json` exactly. The fixture covers a short page, a 3500-character paragraph, a page with no whitespace, and CRLF input.
  2. Ingesting `handbook.md`, with OCR faked by `httpx.MockTransport`, produces 1 page, the expected chunk count from the golden file, and status `ready`.
  3. Ingesting the same document twice produces the same chunk texts and ordinals, and calls OCR only once.
  4. Embedding the same text twice gives identical vectors, and the vector norm is 1 ± 1e-3.
  5. Deleting the document halfway through ingestion completes the job without error.

**Verify**

```text
node scripts/py.mjs agent -m app.warmup
yarn workspace @taskmaster/agent test
```

## Finish

1. Every **Verify** command above exits 0, and so does `yarn check:arch`.
2. Update [README.md](../../README.md) as [AGENTS.md](../../AGENTS.md#keeping-readmemd-current) describes, or note in the progress entry why no change was needed.
3. Add the S12 entry to [progress.md](../progress.md).
4. Set `status: done` and `completed:` at the top of this file.
5. Commit everything as `S12: Ingestion: pages, chunks and embeddings`.

## Blocked

Empty unless `status: blocked`. Then: what failed, the exact error, and what the user needs to decide.

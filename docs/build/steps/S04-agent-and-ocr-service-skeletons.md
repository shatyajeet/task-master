---
step: S04
title: "Agent and OCR service skeletons"
status: done
started: 2026-11-29
completed: 2026-11-29
---

# S04 · Agent and OCR service skeletons

**Read before starting:** [README: rules and choices](../README.md) · [progress.md](../progress.md) · [Ports and environment](../contracts.md#ports-and-environment) · [Internal HTTP](../contracts.md#internal-http-agent-and-ocr)

**Needs:** S03

**Creates**, for each `<svc>` in `agent` and `ocr`:

- `services/<svc>/package.json`: name `@taskmaster/<svc>`, with scripts:
  - `test`: `node ../../scripts/py.mjs <svc> -m pytest -q services/<svc>/tests`
  - `lint`: `node ../../scripts/py.mjs <svc> -m ruff check services/<svc>`
- `services/<svc>/requirements.in`, `requirements-dev.in`, `requirements.txt`, `requirements-dev.txt`
- `services/<svc>/app/__init__.py`, `app/config.py`, `app/security.py`, `app/main.py`, `app/serve.py`
- `services/<svc>/tests/conftest.py`, `tests/test_security.py`
- `services/<svc>/pyproject.toml`, containing ruff and pytest settings only (`asyncio_mode = "auto"`)

**Build**

- Runtime dependencies in `requirements.in`:
  - Agent: `fastapi>=0.165.0,<1`, `uvicorn>=0.55.0,<1`, `pydantic-settings`, `httpx`, `psycopg[binary,pool]>=3.3.9,<4`, `pgvector`, `langgraph>=1.2.24,<2`, `langgraph-checkpoint-postgres>=3.2.1,<4`, `langchain-openai>=1.8.5,<2`, `fastembed>=0.9.1,<1`, `onnxruntime>=1.32.0,<2`, `rapidfuzz`
  - OCR: `fastapi>=0.165.0,<1`, `uvicorn>=0.55.0,<1`, `pydantic-settings`, `python-multipart`, `rapidocr>=3.10.0,<4`, `onnxruntime>=1.32.0,<2`, `pypdfium2>=5.15.2,<6`, `pillow`
- Development dependencies in `requirements-dev.in`: `-c requirements.txt`, `pytest`, `pytest-asyncio`, `ruff`, `pip-tools`. The OCR file also adds `python-docx`, `python-pptx` and `openpyxl`, for S08.
- Compile the lockfiles with `pip-compile --generate-hashes`, using Python 3.14 on Windows.
- `app/config.py` is a pydantic-settings `Settings` class that reads the repository's `.env`. It has a field for every variable the service uses, with the defaults from the Contracts table.
- `app/security.py` is pure ASGI middleware:
  - The `Host` header must be exactly `127.0.0.1:<port>` or `localhost:<port>`, or it returns 403 `forbidden_host`.
  - On every path except `/health`, `X-Internal-Token` must match `INTERNAL_TOKEN` (compared with `hmac.compare_digest`), or it returns 401 `unauthorized`.
- `app/main.py` creates the FastAPI app with `GET /health`. Its lifespan hook is where later steps start pools and workers.
- `app/serve.py` (G12) runs:

  ```python
  asyncio.Runner(loop_factory=asyncio.SelectorEventLoop).run(
      uvicorn.Server(uvicorn.Config("app.main:app", host="127.0.0.1", port=<port>, log_level="info")).serve())
  ```

  The port is 8000 for the agent and 8001 for OCR.
- Tests:
  1. `/health` without a token returns 200.
  2. Another path without a token returns 401, and with the wrong token also 401.
  3. Host `evil.example:8000` returns 403.
  4. In the agent only, the running loop is an instance of `asyncio.SelectorEventLoop`.

**Verify**

```text
py -3.14 -m venv services\agent\.venv
services\agent\.venv\Scripts\pip install --require-hashes -r services\agent\requirements.txt -r services\agent\requirements-dev.txt
py -3.14 -m venv services\ocr\.venv
services\ocr\.venv\Scripts\pip install --require-hashes -r services\ocr\requirements.txt -r services\ocr\requirements-dev.txt
yarn workspace @taskmaster/agent test
yarn workspace @taskmaster/ocr test
```

## Finish

1. Every **Verify** command above exits 0, and so does `yarn check:arch`.
2. Update [README.md](../../README.md) as [AGENTS.md](../../AGENTS.md#keeping-readmemd-current) describes, or note in the progress entry why no change was needed.
3. Add the S04 entry to [progress.md](../progress.md).
4. Set `status: done` and `completed:` at the top of this file.
5. Commit everything as `S04: Agent and OCR service skeletons`.

## Blocked

Empty unless `status: blocked`. Then: what failed, the exact error, and what the user needs to decide.

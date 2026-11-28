"""Starts the OCR service on 127.0.0.1. G12: uvicorn runs inside asyncio.Runner (selector loop).

The event loop policies are deprecated in Python 3.14, so the loop is chosen through
asyncio.Runner(loop_factory=...) instead.
"""

import asyncio

import uvicorn

from app.config import PORT

LOOP_FACTORY = asyncio.SelectorEventLoop


def run_in_loop(coro):
    """Run a coroutine the way the server does, on a selector event loop."""
    with asyncio.Runner(loop_factory=LOOP_FACTORY) as runner:
        return runner.run(coro)


def main() -> None:
    config = uvicorn.Config("app.main:app", host="127.0.0.1", port=PORT, log_level="info")
    run_in_loop(uvicorn.Server(config).serve())


if __name__ == "__main__":
    main()

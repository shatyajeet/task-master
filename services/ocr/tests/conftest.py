import json
import os
from dataclasses import dataclass

import pytest

# Set before the app is imported: the process environment wins over .env.
TOKEN = "t" * 64
os.environ["INTERNAL_TOKEN"] = TOKEN

PORT = 8001


@dataclass
class Reply:
    status: int
    body: bytes

    def json(self):
        return json.loads(self.body)


async def call(app, path: str, *, host: str | None = f"127.0.0.1:{PORT}", token: str | None = None):
    """Send one GET request straight to an ASGI app and collect the reply."""
    headers = []
    if host is not None:
        headers.append((b"host", host.encode()))
    if token is not None:
        headers.append((b"x-internal-token", token.encode()))
    scope = {
        "type": "http",
        "asgi": {"version": "3.0"},
        "http_version": "1.1",
        "method": "GET",
        "scheme": "http",
        "path": path,
        "raw_path": path.encode(),
        "query_string": b"",
        "root_path": "",
        "headers": headers,
        "client": ("127.0.0.1", 50000),
        "server": ("127.0.0.1", PORT),
    }
    sent = False

    async def receive():
        nonlocal sent
        if not sent:
            sent = True
            return {"type": "http.request", "body": b"", "more_body": False}
        return {"type": "http.disconnect"}

    status = 0
    chunks = []

    async def send(message):
        nonlocal status
        if message["type"] == "http.response.start":
            status = message["status"]
        elif message["type"] == "http.response.body":
            chunks.append(message.get("body", b""))

    await app(scope, receive, send)
    return Reply(status, b"".join(chunks))


@pytest.fixture
def app():
    from app.main import app

    return app

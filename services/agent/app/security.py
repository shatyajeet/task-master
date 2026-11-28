"""Pure ASGI middleware: Host check on every request, internal token on every path but /health."""

import hmac
import json

HEALTH_PATH = "/health"


class SecurityMiddleware:
    def __init__(self, app, *, port: int, token: str):
        self.app = app
        self.allowed_hosts = {f"127.0.0.1:{port}".encode(), f"localhost:{port}".encode()}
        self.token = token.encode()

    async def __call__(self, scope, receive, send):
        if scope["type"] == "websocket":
            await send({"type": "websocket.close", "code": 1008})
            return
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        headers = scope.get("headers", [])
        hosts = [value for name, value in headers if name == b"host"]
        if len(hosts) != 1 or hosts[0] not in self.allowed_hosts:
            await _reject(send, 403, "forbidden_host", "Host header is not allowed")
            return

        if scope["path"] != HEALTH_PATH:
            tokens = [value for name, value in headers if name == b"x-internal-token"]
            if len(tokens) != 1 or not hmac.compare_digest(tokens[0], self.token):
                await _reject(send, 401, "unauthorized", "Missing or wrong internal token")
                return

        await self.app(scope, receive, send)


async def _reject(send, status: int, code: str, message: str) -> None:
    body = json.dumps({"error": code, "message": message}).encode()
    await send(
        {
            "type": "http.response.start",
            "status": status,
            "headers": [
                (b"content-type", b"application/json"),
                (b"content-length", str(len(body)).encode()),
            ],
        }
    )
    await send({"type": "http.response.body", "body": body})

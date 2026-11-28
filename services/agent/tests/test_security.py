import asyncio

from conftest import TOKEN, call


async def test_health_needs_no_token(app):
    reply = await call(app, "/health")
    assert reply.status == 200
    assert reply.json() == {"ok": True}


async def test_other_paths_need_the_token(app):
    missing = await call(app, "/anything")
    assert missing.status == 401
    assert missing.json()["error"] == "unauthorized"
    wrong = await call(app, "/anything", token="x" * 64)
    assert wrong.status == 401
    # With the right token the request passes the middleware and reaches routing (404).
    assert (await call(app, "/anything", token=TOKEN)).status == 404


async def test_wrong_host_is_forbidden(app):
    reply = await call(app, "/health", host="evil.example:8000")
    assert reply.status == 403
    assert reply.json()["error"] == "forbidden_host"
    assert (await call(app, "/health", host="localhost:8000")).status == 200
    assert (await call(app, "/health", host="127.0.0.1")).status == 403
    assert (await call(app, "/health", host=None)).status == 403


def test_serve_uses_a_selector_event_loop():
    from app import serve

    async def loop_type():
        return type(asyncio.get_running_loop())

    assert issubclass(serve.run_in_loop(loop_type()), asyncio.SelectorEventLoop)

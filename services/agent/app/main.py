"""The agent service. Later steps start the database pool and the job workers in the lifespan."""

from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.config import PORT, get_settings
from app.security import SecurityMiddleware


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title="TaskMaster agent", lifespan=lifespan)

    @app.get("/health")
    async def health() -> dict[str, bool]:
        return {"ok": True}

    app.add_middleware(SecurityMiddleware, port=PORT, token=settings.internal_token)
    return app


app = create_app()

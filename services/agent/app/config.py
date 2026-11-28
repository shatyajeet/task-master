"""Settings for the agent service. Reads the repository's .env; the process environment wins."""

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

ROOT = Path(__file__).resolve().parents[3]
PORT = 8000


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=ROOT / ".env", extra="ignore")

    database_url: str
    upload_dir: Path = Path(r"C:\taskmaster-data\uploads")
    write_dir: Path = Path(r"C:\taskmaster-data\out")
    model_cache_dir: Path = Path(r"C:\taskmaster-data\models")
    internal_token: str
    ocr_url: str = "http://127.0.0.1:8001"
    llm_base_url: str = "http://localhost:11434/v1"
    llm_api_key: str = ""
    llm_model: str = "qwen3.5:4b"
    job_poll_seconds: float = 5
    job_lock_seconds: float = 60
    job_heartbeat_seconds: float = 20
    job_max_attempts: int = 3
    approval_timeout_seconds: float = 86400
    run_time_limit_seconds: float = 600
    run_llm_call_limit: int = 15
    run_events_ttl_seconds: float = 3600


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]  # required fields come from the environment

"""Settings for the OCR service. Reads the repository's .env; the process environment wins."""

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

ROOT = Path(__file__).resolve().parents[3]
PORT = 8001


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=ROOT / ".env", extra="ignore")

    internal_token: str
    model_cache_dir: Path = Path(r"C:\taskmaster-data\models")
    soffice_path: Path = Path(r"C:\Program Files\LibreOffice\program\soffice.exe")
    ocr_timeout_seconds: float = 120
    ocr_workers: int = 2
    ocr_threads_per_worker: int = 4


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]  # required fields come from the environment

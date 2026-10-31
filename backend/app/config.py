import os
from pathlib import Path
from typing import List


ROOT_DIR = Path(__file__).resolve().parents[2]


def _resolve_path(value: str) -> Path:
    path = Path(value).expanduser()
    return path if path.is_absolute() else ROOT_DIR / path


DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./data/echoes.db")
UPLOAD_DIR = _resolve_path(os.getenv("UPLOAD_DIR", "./data/uploads"))
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://127.0.0.1:11434").rstrip("/")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "gemma3:4b")
OLLAMA_TIMEOUT_SECONDS = float(os.getenv("OLLAMA_TIMEOUT_SECONDS", "120"))
MAX_UPLOAD_MB = int(os.getenv("MAX_UPLOAD_MB", "8"))
CORS_ORIGINS: List[str] = [
    origin.strip()
    for origin in os.getenv(
        "CORS_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173",
    ).split(",")
    if origin.strip()
]


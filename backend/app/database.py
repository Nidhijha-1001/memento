from pathlib import Path
from typing import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from .config import DATABASE_URL, ROOT_DIR


if DATABASE_URL.startswith("sqlite:///") and ":memory:" not in DATABASE_URL:
    database_path = DATABASE_URL.replace("sqlite:///", "", 1)
    resolved_database_path = Path(database_path)
    if not resolved_database_path.is_absolute():
        resolved_database_path = ROOT_DIR / resolved_database_path
    resolved_database_path.parent.mkdir(parents=True, exist_ok=True)
    DATABASE_URL = "sqlite:///" + str(resolved_database_path)

connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(DATABASE_URL, connect_args=connect_args, future=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


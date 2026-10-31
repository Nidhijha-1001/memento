import json
import logging
import re
import uuid
from contextlib import asynccontextmanager
from datetime import date
from io import BytesIO
from pathlib import Path
from typing import AsyncIterator, List, Optional

import httpx
from fastapi import Depends, FastAPI, File, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from PIL import Image, UnidentifiedImageError
from sqlalchemy import asc, desc, or_, select
from sqlalchemy.orm import Session

from . import ai
from .config import (
    CORS_ORIGINS,
    MAX_UPLOAD_MB,
    OLLAMA_BASE_URL,
    OLLAMA_MODEL,
    UPLOAD_DIR,
)
from .database import Base, engine, get_db
from .models import AppSetting, Collection, Memory
from .schemas import AIRequest, AIResponse, MemoryInput, MemoryRead, SettingsInput


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("echoes-beyond")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(title="Echoes Beyond API", version="1.0.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Content-Type"],
)


def model_for_request(db: Session, requested_model: Optional[str] = None) -> str:
    setting = db.get(AppSetting, "ollama_model")
    return (requested_model or (setting.value if setting else OLLAMA_MODEL)).strip()


def get_memory_or_404(db: Session, memory_id: int) -> Memory:
    memory = db.get(Memory, memory_id)
    if memory is None:
        raise HTTPException(status_code=404, detail="Memory not found.")
    return memory


def save_input(memory: Memory, payload: MemoryInput) -> None:
    memory.title = payload.title
    memory.memory_date = payload.memory_date
    memory.description = payload.description
    memory.people = payload.people.strip()
    memory.category = payload.category
    memory.tags = json.dumps(payload.tags, ensure_ascii=False)
    memory.collection = payload.collection


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok", "service": "Echoes Beyond"}


@app.get("/api/memories", response_model=List[MemoryRead])
def list_memories(
    q: Optional[str] = Query(default=None, max_length=200),
    category: Optional[str] = None,
    collection: Optional[str] = None,
    year: Optional[int] = Query(default=None, ge=1, le=9999),
    sort: str = Query(default="recent", pattern="^(recent|oldest|created)$"),
    db: Session = Depends(get_db),
) -> List[MemoryRead]:
    statement = select(Memory)
    if q and q.strip():
        pattern = "%" + q.strip() + "%"
        statement = statement.where(
            or_(
                Memory.title.ilike(pattern),
                Memory.description.ilike(pattern),
                Memory.people.ilike(pattern),
                Memory.tags.ilike(pattern),
            )
        )
    if category:
        statement = statement.where(Memory.category == category)
    if collection:
        statement = statement.where(Memory.collection == collection)
    if year:
        statement = statement.where(Memory.memory_date.between(date(year, 1, 1), date(year, 12, 31)))
    order_column = Memory.created_at if sort == "created" else Memory.memory_date
    order_direction = asc if sort == "oldest" else desc
    memories = db.scalars(statement.order_by(order_direction(order_column), desc(Memory.id))).all()
    return [MemoryRead.from_memory(memory) for memory in memories]


@app.post("/api/memories", response_model=MemoryRead, status_code=201)
def create_memory(payload: MemoryInput, db: Session = Depends(get_db)) -> MemoryRead:
    memory = Memory()
    save_input(memory, payload)
    db.add(memory)
    db.commit()
    db.refresh(memory)
    return MemoryRead.from_memory(memory)


@app.get("/api/memories/{memory_id}", response_model=MemoryRead)
def read_memory(memory_id: int, db: Session = Depends(get_db)) -> MemoryRead:
    return MemoryRead.from_memory(get_memory_or_404(db, memory_id))


@app.put("/api/memories/{memory_id}", response_model=MemoryRead)
def update_memory(
    memory_id: int, payload: MemoryInput, db: Session = Depends(get_db)
) -> MemoryRead:
    memory = get_memory_or_404(db, memory_id)
    save_input(memory, payload)
    db.commit()
    db.refresh(memory)
    return MemoryRead.from_memory(memory)


@app.delete("/api/memories/{memory_id}", status_code=204)
def delete_memory(memory_id: int, db: Session = Depends(get_db)) -> None:
    memory = get_memory_or_404(db, memory_id)
    image_name = memory.image_name
    db.delete(memory)
    db.commit()
    if image_name:
        image_path = UPLOAD_DIR / image_name
        if image_path.is_file():
            image_path.unlink()


@app.get("/api/collections", response_model=List[str])
def list_collections(db: Session = Depends(get_db)) -> List[str]:
    names = set(db.scalars(select(Collection.name)).all())
    names.update(db.scalars(select(Memory.collection).distinct()).all())
    return sorted(names, key=str.casefold)


@app.post("/api/collections", response_model=List[str], status_code=201)
def create_collection(name: str = Query(min_length=1, max_length=100), db: Session = Depends(get_db)) -> List[str]:
    clean_name = name.strip()
    if not clean_name:
        raise HTTPException(status_code=422, detail="Collection name cannot be blank.")
    existing = db.get(Collection, clean_name)
    if existing is None:
        db.add(Collection(name=clean_name))
        db.commit()
    return list_collections(db)


def _check_image_bytes(data: bytes, filename: str) -> str:
    if not data:
        raise HTTPException(status_code=400, detail="The selected image is empty.")
    if len(data) > MAX_UPLOAD_MB * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Image exceeds the {0} MB upload limit.".format(MAX_UPLOAD_MB))
    try:
        image = Image.open(BytesIO(data))
        if image.width * image.height > 40_000_000:
            raise HTTPException(status_code=413, detail="Image dimensions exceed the 40 megapixel limit.")
        image.verify()
        image_format = image.format
    except (UnidentifiedImageError, OSError, ValueError) as exc:
        raise HTTPException(status_code=415, detail="Upload a valid JPEG, PNG, or WebP image.") from exc
    extensions = {"JPEG": ".jpg", "PNG": ".png", "WEBP": ".webp"}
    if image_format not in extensions:
        raise HTTPException(status_code=415, detail="Upload a valid JPEG, PNG, or WebP image.")
    suffix = Path(filename or "").suffix.lower()
    expected_suffixes = {".jpg", ".jpeg"} if image_format == "JPEG" else {extensions[image_format]}
    if suffix and suffix not in expected_suffixes:
        raise HTTPException(status_code=415, detail="The file extension does not match the image content.")
    return extensions[image_format]


@app.post("/api/memories/{memory_id}/image", response_model=MemoryRead)
async def upload_image(
    memory_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
) -> MemoryRead:
    memory = get_memory_or_404(db, memory_id)
    data = await file.read(MAX_UPLOAD_MB * 1024 * 1024 + 1)
    extension = _check_image_bytes(data, file.filename or "")
    safe_name = uuid.uuid4().hex + extension
    destination = UPLOAD_DIR / safe_name
    destination.write_bytes(data)
    previous_name = memory.image_name
    memory.image_name = safe_name
    db.commit()
    db.refresh(memory)
    if previous_name:
        previous_path = UPLOAD_DIR / previous_name
        if previous_path.is_file():
            previous_path.unlink()
    return MemoryRead.from_memory(memory)


@app.get("/api/images/{image_name}")
def read_image(image_name: str) -> FileResponse:
    if not re.fullmatch(r"[a-f0-9]{32}\.(jpg|png|webp)", image_name):
        raise HTTPException(status_code=404, detail="Image not found.")
    image_path = (UPLOAD_DIR / image_name).resolve()
    if image_path.parent != UPLOAD_DIR.resolve() or not image_path.is_file():
        raise HTTPException(status_code=404, detail="Image not found.")
    media_types = {".jpg": "image/jpeg", ".png": "image/png", ".webp": "image/webp"}
    return FileResponse(image_path, media_type=media_types[image_path.suffix], headers={"Cache-Control": "private, max-age=3600"})


@app.post("/api/ai/generate", response_model=AIResponse)
async def ai_generate(request: AIRequest, db: Session = Depends(get_db)) -> AIResponse:
    context = request.text
    source_ids: List[int] = []
    if request.task == "chat":
        memories = db.scalars(select(Memory).order_by(desc(Memory.memory_date))).all()
        matches = ai.retrieve_memories(memories, request.question or request.text)
        if not matches:
            return AIResponse(
                text="I couldn't find a saved memory that clearly relates to that question. "
                "I don't want to guess—would you like to add more detail to your archive?",
                model="archive retrieval only",
                sources=[],
            )
        context = ai.format_memories(matches)
        source_ids = [memory.id for memory in matches]

    selected_model = model_for_request(db, request.model)
    try:
        output, used_model = await ai.generate(
            request.task,
            context,
            model=selected_model,
            question=request.question,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except RuntimeError as exc:
        logger.warning("Local AI request failed: %s", exc)
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    return AIResponse(text=output, model=used_model, sources=source_ids)


@app.get("/api/ai/status")
async def ai_status(db: Session = Depends(get_db)) -> dict:
    selected_model = model_for_request(db)
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            response = await client.get(OLLAMA_BASE_URL + "/api/tags")
            response.raise_for_status()
            models = [item.get("name", "") for item in response.json().get("models", [])]
        return {
            "available": True,
            "model": selected_model,
            "models": models,
            "model_installed": selected_model in models,
            "endpoint": OLLAMA_BASE_URL,
        }
    except (httpx.HTTPError, ValueError):
        return {
            "available": False,
            "model": selected_model,
            "models": [],
            "model_installed": False,
            "endpoint": OLLAMA_BASE_URL,
        }


@app.get("/api/settings")
def get_settings(db: Session = Depends(get_db)) -> dict:
    return {"model": model_for_request(db)}


@app.put("/api/settings")
def update_settings(payload: SettingsInput, db: Session = Depends(get_db)) -> dict:
    setting = db.get(AppSetting, "ollama_model")
    if setting:
        setting.value = payload.model.strip()
    else:
        db.add(AppSetting(key="ollama_model", value=payload.model.strip()))
    db.commit()
    return {"model": payload.model.strip()}


@app.get("/api/timeline", response_model=List[MemoryRead])
def get_timeline(
    year: Optional[int] = Query(default=None, ge=1, le=9999),
    category: Optional[str] = None,
    db: Session = Depends(get_db),
) -> List[MemoryRead]:
    statement = select(Memory)
    if year:
        statement = statement.where(Memory.memory_date.between(date(year, 1, 1), date(year, 12, 31)))
    if category:
        statement = statement.where(Memory.category == category)
    entries = db.scalars(statement.order_by(asc(Memory.memory_date), asc(Memory.id))).all()
    return [MemoryRead.from_memory(memory) for memory in entries]

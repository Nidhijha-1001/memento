from io import BytesIO
from datetime import date
from pathlib import Path
from typing import Generator

import pytest
from fastapi.testclient import TestClient
from PIL import Image
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from backend.app import ai as ai_service
from backend.app import main as app_module
from backend.app.database import Base, get_db

app = app_module.app


@pytest.fixture()
def client(tmp_path: Path) -> Generator[TestClient, None, None]:
    test_engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    test_session = sessionmaker(bind=test_engine, autoflush=False, autocommit=False)
    Base.metadata.create_all(bind=test_engine)

    def override_get_db() -> Generator[Session, None, None]:
        db = test_session()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    app_module.UPLOAD_DIR = tmp_path / "uploads"
    app_module.UPLOAD_DIR.mkdir()
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
    Base.metadata.drop_all(bind=test_engine)
    test_engine.dispose()


def sample_memory(title: str = "The summer garden") -> dict:
    return {
        "title": title,
        "memory_date": date(2020, 7, 12).isoformat(),
        "description": "We planted marigolds beside the old stone wall.",
        "people": "Mara, Jo",
        "category": "Family",
        "tags": ["garden", "summer"],
        "collection": "Small wonders",
    }


def test_memory_crud_search_and_timeline(client: TestClient) -> None:
    created = client.post("/api/memories", json=sample_memory())
    assert created.status_code == 201
    memory = created.json()
    assert memory["tags"] == ["garden", "summer"]
    assert client.get("/api/memories", params={"q": "marigolds"}).json()[0]["id"] == memory["id"]
    timeline = client.get("/api/timeline", params={"year": 2020})
    assert timeline.json()[0]["title"] == "The summer garden"

    changed = sample_memory("The marigold afternoon")
    updated = client.put("/api/memories/{0}".format(memory["id"]), json=changed)
    assert updated.status_code == 200
    assert updated.json()["title"] == changed["title"]

    deleted = client.delete("/api/memories/{0}".format(memory["id"]))
    assert deleted.status_code == 204
    assert client.get("/api/memories/{0}".format(memory["id"])).status_code == 404


def test_invalid_memory_is_rejected(client: TestClient) -> None:
    invalid = sample_memory()
    invalid["title"] = "  "
    assert client.post("/api/memories", json=invalid).status_code == 422


def test_chat_does_not_invent_when_retrieval_finds_nothing(client: TestClient) -> None:
    response = client.post(
        "/api/ai/generate",
        json={"task": "chat", "text": "question", "question": "Tell me about Mars"},
    )
    assert response.status_code == 200
    assert response.json()["sources"] == []
    assert "couldn't find" in response.json()["text"]


def test_chat_uses_retrieved_memories_and_reports_sources(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    memory = client.post("/api/memories", json=sample_memory()).json()

    async def fake_generate(task: str, text: str, model: str, question: str):
        assert task == "chat"
        assert "The summer garden" in text
        assert question == "Tell me about the summer garden"
        return "You saved a note about planting marigolds.", model

    monkeypatch.setattr(ai_service, "generate", fake_generate)
    response = client.post(
        "/api/ai/generate",
        json={"task": "chat", "text": "Tell me about the summer garden", "question": "Tell me about the summer garden"},
    )
    assert response.status_code == 200
    assert response.json()["sources"] == [memory["id"]]
    assert response.json()["generated"] is True


def test_image_upload_validates_real_image_content(client: TestClient) -> None:
    memory = client.post("/api/memories", json=sample_memory()).json()
    image_buffer = BytesIO()
    Image.new("RGB", (4, 4), color=(150, 100, 50)).save(image_buffer, format="PNG")

    uploaded = client.post(
        "/api/memories/{0}/image".format(memory["id"]),
        files={"file": ("garden.png", image_buffer.getvalue(), "image/png")},
    )
    assert uploaded.status_code == 200
    image_url = uploaded.json()["image_url"]
    assert client.get(image_url).headers["content-type"] == "image/png"

    rejected = client.post(
        "/api/memories/{0}/image".format(memory["id"]),
        files={"file": ("fake.png", b"not an image", "image/png")},
    )
    assert rejected.status_code == 415


def test_empty_collections_are_persisted(client: TestClient) -> None:
    response = client.post("/api/collections", params={"name": "Letters to keep"})
    assert response.status_code == 201
    assert response.json() == ["Letters to keep"]
    assert client.get("/api/collections").json() == ["Letters to keep"]


def test_ai_unavailable_is_reported_instead_of_fabricated(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def unavailable(*args, **kwargs):
        raise RuntimeError("Ollama is unavailable.")

    monkeypatch.setattr(ai_service, "generate", unavailable)
    response = client.post(
        "/api/ai/generate",
        json={"task": "story", "text": "A real note from the archive."},
    )
    assert response.status_code == 503
    assert response.json()["detail"] == "Ollama is unavailable."

import json
from datetime import date, datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator


class MemoryInput(BaseModel):
    title: str = Field(min_length=1, max_length=160)
    memory_date: date
    description: str = Field(min_length=1, max_length=20000)
    people: str = Field(default="", max_length=500)
    category: str = Field(default="Uncategorized", min_length=1, max_length=60)
    tags: List[str] = Field(default_factory=list, max_length=20)
    collection: str = Field(default="Unsorted", min_length=1, max_length=100)

    @field_validator("title", "category", "collection")
    @classmethod
    def trim_required_text(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("This field cannot be blank.")
        return value

    @field_validator("tags")
    @classmethod
    def clean_tags(cls, values: List[str]) -> List[str]:
        cleaned = [tag.strip()[:40] for tag in values if tag.strip()]
        return list(dict.fromkeys(cleaned))[:20]


class MemoryRead(BaseModel):
    id: int
    title: str
    memory_date: date
    description: str
    people: str
    category: str
    tags: List[str]
    collection: str
    image_url: Optional[str]
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

    @classmethod
    def from_memory(cls, memory: object) -> "MemoryRead":
        return cls(
            id=memory.id,
            title=memory.title,
            memory_date=memory.memory_date,
            description=memory.description,
            people=memory.people,
            category=memory.category,
            tags=json.loads(memory.tags or "[]"),
            collection=memory.collection,
            image_url="/api/images/" + memory.image_name if memory.image_name else None,
            created_at=memory.created_at,
            updated_at=memory.updated_at,
        )


class AIRequest(BaseModel):
    task: str = Field(pattern="^(story|title|caption|themes|poem|chat|summary|connections|questions)$")
    text: str = Field(min_length=1, max_length=12000)
    question: Optional[str] = Field(default=None, max_length=2000)
    model: Optional[str] = Field(default=None, max_length=120)


class AIResponse(BaseModel):
    text: str
    model: str
    sources: List[int] = Field(default_factory=list)
    generated: bool = True


class SettingsInput(BaseModel):
    model: str = Field(min_length=1, max_length=120)


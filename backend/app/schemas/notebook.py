from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class NotebookCreateRequest(BaseModel):
    title: str = Field(default="Untitled Notebook", max_length=255)


class NotebookUpdateRequest(BaseModel):
    title: str | None = Field(default=None, max_length=255)
    content: dict | None = None


class NotebookSummary(BaseModel):
    id: UUID
    title: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class NotebookResponse(NotebookSummary):
    content: dict

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class JobCreateRequest(BaseModel):
    name: str = Field(max_length=255)
    script_source: str
    notebook_id: UUID | None = None


class JobResponse(BaseModel):
    id: UUID
    name: str
    status: str
    provider_type: str
    progress: float
    error_message: str | None
    created_at: datetime
    started_at: datetime | None
    finished_at: datetime | None

    model_config = {"from_attributes": True}


class JobCheckpointResponse(BaseModel):
    id: UUID
    path: str
    metrics: dict
    created_at: datetime

    model_config = {"from_attributes": True}

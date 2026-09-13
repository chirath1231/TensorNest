from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class JobCreateRequest(BaseModel):
    name: str = Field(max_length=255)
    script_source: str
    notebook_id: UUID | None = None
    # Which compute backend runs this job. "local_cpu" is the local Docker
    # fallback; "modal_gpu" runs on a remote GPU and survives this backend
    # restarting. Validated against the registry in app.workers.tasks.
    provider_type: str = "local_cpu"


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

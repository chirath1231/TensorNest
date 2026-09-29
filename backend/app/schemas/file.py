from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class FileResponse(BaseModel):
    id: UUID
    filename: str
    size: int
    content_type: str
    status: str
    error_message: str | None
    source: str
    source_url: str | None
    data_license: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class FileDownloadResponse(BaseModel):
    """A presigned bucket URL. Short-lived, so it is fetched per download
    rather than stored alongside the file record."""

    url: str
    filename: str

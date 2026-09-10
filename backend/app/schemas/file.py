from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class FileResponse(BaseModel):
    id: UUID
    filename: str
    size: int
    content_type: str
    created_at: datetime

    model_config = {"from_attributes": True}

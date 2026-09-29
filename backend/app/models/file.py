import uuid
from datetime import datetime

from sqlalchemy import BigInteger, DateTime, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


class UploadedFile(Base):
    __tablename__ = "files"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    owner_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    # Key within the S3-compatible bucket, not a local filesystem path — the
    # backend no longer owns the bytes, the bucket does. Empty until an import
    # has actually fetched anything.
    object_key: Mapped[str] = mapped_column(String(512), nullable=False)
    size: Mapped[int] = mapped_column(BigInteger, nullable=False)
    content_type: Mapped[str] = mapped_column(String(255), nullable=False, default="application/octet-stream")

    # importing -> ready | failed. A direct upload is born ready; a web import
    # exists as a row first so it can be listed with a spinner rather than
    # appearing out of nowhere minutes later.
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="ready")
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Where the bytes came from. "upload" means a human picked the file; the
    # rest name an external catalogue. Licence and URL are recorded at import
    # because data pulled off the web carries terms that a file on disk does
    # not, and they are worthless if you have to go looking for them later.
    source: Mapped[str] = mapped_column(String(32), nullable=False, default="upload")
    source_ref: Mapped[str | None] = mapped_column(String(512), nullable=True)
    source_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    data_license: Mapped[str | None] = mapped_column(String(128), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

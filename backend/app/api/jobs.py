from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.db import get_db
from app.models.user import User
from app.schemas.job import JobCreateRequest, JobResponse
from app.services import job_service

router = APIRouter(prefix="/jobs", tags=["jobs"])


@router.get("", response_model=list[JobResponse])
async def list_jobs(
    db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)
) -> list[JobResponse]:
    return await job_service.list_jobs(db, current_user)


@router.post("", response_model=JobResponse, status_code=status.HTTP_201_CREATED)
async def create_job(
    payload: JobCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> JobResponse:
    return await job_service.create_job(db, current_user, payload)


@router.get("/{job_id}", response_model=JobResponse)
async def get_job(
    job_id: UUID, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)
) -> JobResponse:
    return await job_service.get_job(db, current_user, job_id)


@router.get("/{job_id}/logs")
async def get_job_logs(
    job_id: UUID, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)
) -> dict:
    await job_service.get_job(db, current_user, job_id)  # ownership check
    return {"logs": job_service.get_logs(job_id)}


@router.get("/{job_id}/checkpoints")
async def get_job_checkpoints(
    job_id: UUID, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)
) -> dict:
    await job_service.get_job(db, current_user, job_id)  # ownership check
    return {"checkpoints": job_service.list_checkpoints(job_id)}


@router.post("/{job_id}/cancel", response_model=JobResponse)
async def cancel_job(
    job_id: UUID, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)
) -> JobResponse:
    return await job_service.cancel_job(db, current_user, job_id)

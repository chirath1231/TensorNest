import os
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.redis import get_arq_pool
from app.models.job import Job
from app.models.user import User
from app.providers.base import JobRunHandle
from app.providers.local_docker import LocalDockerProvider
from app.schemas.job import JobCreateRequest

settings = get_settings()


async def list_jobs(db: AsyncSession, owner: User) -> list[Job]:
    result = await db.execute(select(Job).where(Job.owner_id == owner.id).order_by(Job.created_at.desc()))
    return list(result.scalars().all())


async def get_job(db: AsyncSession, owner: User, job_id: UUID) -> Job:
    result = await db.execute(select(Job).where(Job.id == job_id, Job.owner_id == owner.id))
    job = result.scalar_one_or_none()
    if job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
    return job


async def create_job(db: AsyncSession, owner: User, payload: JobCreateRequest) -> Job:
    job = Job(
        owner_id=owner.id,
        notebook_id=payload.notebook_id,
        name=payload.name,
        script_source=payload.script_source,
        status="queued",
        provider_type="local_cpu",
    )
    db.add(job)
    await db.commit()
    await db.refresh(job)

    pool = await get_arq_pool()
    await pool.enqueue_job("run_job", str(job.id))

    return job


def get_logs(job_id: UUID) -> str:
    log_path = os.path.join(settings.storage_root, "jobs", str(job_id), "logs.txt")
    if not os.path.exists(log_path):
        return ""
    with open(log_path, "r", encoding="utf-8") as f:
        return f.read()


def list_checkpoints(job_id: UUID) -> list[str]:
    checkpoint_dir = os.path.join(settings.storage_root, "jobs", str(job_id), "checkpoints")
    if not os.path.isdir(checkpoint_dir):
        return []
    return sorted(os.listdir(checkpoint_dir))


async def cancel_job(db: AsyncSession, owner: User, job_id: UUID) -> Job:
    job = await get_job(db, owner, job_id)
    if job.status not in ("queued", "running"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Job is not running")

    if job.container_id:
        provider = LocalDockerProvider()
        await provider.cancel(JobRunHandle(container_id=job.container_id, workspace_path=""))

    job.status = "cancelled"
    await db.commit()
    await db.refresh(job)
    return job

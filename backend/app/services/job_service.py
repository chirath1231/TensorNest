from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.redis import get_arq_pool
from app.models.job import Job
from app.models.user import User
from app.providers.base import JobRunHandle
from app.providers.local_docker import LocalDockerProvider
from app.schemas.job import JobCreateRequest
from app.services import job_artifacts


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
    # Imported here rather than at module scope: tasks imports the providers,
    # which import this package, so a top-level import would be circular.
    from app.workers.tasks import PROVIDERS

    if payload.provider_type not in PROVIDERS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unknown provider_type '{payload.provider_type}'. "
            f"Available: {', '.join(sorted(PROVIDERS))}",
        )

    job = Job(
        owner_id=owner.id,
        notebook_id=payload.notebook_id,
        name=payload.name,
        script_source=payload.script_source,
        status="queued",
        provider_type=payload.provider_type,
        allow_network=payload.allow_network,
    )
    db.add(job)
    await db.commit()
    await db.refresh(job)

    pool = await get_arq_pool()
    await pool.enqueue_job("run_job", str(job.id))

    return job


async def get_logs(job_id: UUID) -> str:
    """Read the log from the bucket. While a job runs the worker snapshots it
    there every few seconds, so this lags slightly behind live output but is
    readable from anywhere — including after the container is gone."""
    return await job_artifacts.get_logs(job_id)


async def list_checkpoints(job_id: UUID) -> list[dict]:
    return await job_artifacts.list_checkpoints(job_id)


async def checkpoint_download_url(job_id: UUID, name: str) -> str:
    return await job_artifacts.presigned_checkpoint_url(job_id, name)


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

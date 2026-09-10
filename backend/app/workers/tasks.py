import asyncio
import os
from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import select

from app.core.config import get_settings
from app.core.db import async_session_maker
from app.models.job import Job
from app.providers.base import JobRunHandle
from app.providers.local_docker import LocalDockerProvider

settings = get_settings()

PROVIDERS = {
    "local_cpu": LocalDockerProvider(),
}

POLL_INTERVAL_SECONDS = 3
MAX_RUNTIME_SECONDS = 60 * 60  # 1 hour safety cap for the local CPU provider


async def run_job(ctx: dict, job_id: str) -> None:
    job_uuid = UUID(job_id)
    async with async_session_maker() as db:
        result = await db.execute(select(Job).where(Job.id == job_uuid))
        job = result.scalar_one_or_none()
        if job is None:
            return

        provider = PROVIDERS.get(job.provider_type)
        if provider is None:
            job.status = "failed"
            job.error_message = f"Unknown provider_type: {job.provider_type}"
            job.finished_at = datetime.now(timezone.utc)
            await db.commit()
            return

        job.status = "running"
        job.started_at = datetime.now(timezone.utc)
        await db.commit()

        try:
            run_handle = await provider.submit_job(job.id, job.script_source)
            job.container_id = run_handle.container_id
            await db.commit()
        except Exception as exc:  # noqa: BLE001
            job.status = "failed"
            job.error_message = str(exc)
            job.finished_at = datetime.now(timezone.utc)
            await db.commit()
            return

        handle = JobRunHandle(container_id=run_handle.container_id, workspace_path=run_handle.workspace_path)
        elapsed = 0
        final_state = "failed"
        while elapsed < MAX_RUNTIME_SECONDS:
            await asyncio.sleep(POLL_INTERVAL_SECONDS)
            elapsed += POLL_INTERVAL_SECONDS

            status_result = await provider.get_status(handle)
            logs = await provider.stream_logs(handle)
            _write_logs(job.id, logs)

            if status_result.state != "running":
                final_state = status_result.state
                break
        else:
            await provider.cancel(handle)
            final_state = "failed"

        result = await db.execute(select(Job).where(Job.id == job_uuid))
        job = result.scalar_one_or_none()
        if job is None:
            return
        job.status = final_state
        job.progress = 1.0 if final_state == "succeeded" else job.progress
        job.finished_at = datetime.now(timezone.utc)
        await db.commit()


def _write_logs(job_id: UUID, logs: str) -> None:
    job_dir = os.path.join(settings.storage_root, "jobs", str(job_id))
    os.makedirs(job_dir, exist_ok=True)
    with open(os.path.join(job_dir, "logs.txt"), "w", encoding="utf-8") as f:
        f.write(logs)

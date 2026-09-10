import asyncio
import os
from uuid import UUID

import docker
from docker.errors import NotFound

from app.core.config import get_settings
from app.providers.base import ComputeProvider, JobRunHandle, JobStatus

settings = get_settings()


def _client() -> docker.DockerClient:
    return docker.from_env()


def _job_dir(job_id: UUID) -> str:
    return os.path.join(settings.storage_root, "jobs", str(job_id))


def _job_host_dir(job_id: UUID) -> str:
    return os.path.join(settings.storage_host_root, "jobs", str(job_id))


class LocalDockerProvider(ComputeProvider):
    """Runs a job's script in a fresh, resource-limited Docker container on the
    local host's CPU. Stands in for a future cloud-GPU provider behind the same
    interface."""

    provider_type = "local_cpu"

    async def submit_job(self, job_id: UUID, script_source: str) -> JobRunHandle:
        job_dir = _job_dir(job_id)
        os.makedirs(os.path.join(job_dir, "checkpoints"), exist_ok=True)
        script_path = os.path.join(job_dir, "job.py")
        with open(script_path, "w", encoding="utf-8") as f:
            f.write(script_source)

        host_dir = _job_host_dir(job_id)

        def _run() -> str:
            client = _client()
            container = client.containers.run(
                settings.kernel_image,
                command=["python", "/workspace/job.py"],
                working_dir="/workspace",
                environment={"CHECKPOINT_DIR": "/workspace/checkpoints"},
                volumes={host_dir: {"bind": "/workspace", "mode": "rw"}},
                nano_cpus=int(settings.job_cpu_limit * 1e9),
                mem_limit=settings.job_memory_limit,
                network_disabled=True,
                detach=True,
                name=f"tensornest-job-{job_id}",
            )
            return container.id

        container_id = await asyncio.to_thread(_run)
        return JobRunHandle(container_id=container_id, workspace_path=job_dir)

    async def get_status(self, handle: JobRunHandle) -> JobStatus:
        def _inspect() -> JobStatus:
            client = _client()
            try:
                container = client.containers.get(handle.container_id)
            except NotFound:
                return JobStatus(state="failed", exit_code=None)
            container.reload()
            status = container.status
            if status == "running":
                return JobStatus(state="running", exit_code=None)
            exit_code = container.attrs.get("State", {}).get("ExitCode")
            if exit_code == 0:
                return JobStatus(state="succeeded", exit_code=exit_code)
            return JobStatus(state="failed", exit_code=exit_code)

        return await asyncio.to_thread(_inspect)

    async def stream_logs(self, handle: JobRunHandle) -> str:
        def _logs() -> str:
            client = _client()
            try:
                container = client.containers.get(handle.container_id)
            except NotFound:
                return ""
            return container.logs().decode("utf-8", errors="replace")

        return await asyncio.to_thread(_logs)

    async def cancel(self, handle: JobRunHandle) -> None:
        def _stop() -> None:
            client = _client()
            try:
                container = client.containers.get(handle.container_id)
                container.stop(timeout=5)
                container.remove(force=True)
            except NotFound:
                pass

        await asyncio.to_thread(_stop)

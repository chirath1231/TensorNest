import asyncio
import os
from uuid import UUID

import docker
from docker.errors import NotFound

from app.core.config import get_settings
from app.providers.base import ComputeProvider, JobLaunchSpec, JobRunHandle, JobStatus
from app.services import job_artifacts

settings = get_settings()


def _read_file(path: str) -> bytes:
    with open(path, "rb") as f:
        return f.read()


def _client() -> docker.DockerClient:
    return docker.from_env()


def _job_dir(job_id: UUID) -> str:
    """Path to a job's workspace. Identical inside this container and inside the
    job container, because both mount the same named volume at storage_root."""
    return os.path.join(settings.storage_root, "jobs", str(job_id))


class LocalDockerProvider(ComputeProvider):
    """Runs a job's script in a fresh, resource-limited Docker container on the
    local host's CPU. Stands in for a future cloud-GPU provider behind the same
    interface."""

    provider_type = "local_cpu"

    async def submit_job(self, job_id: UUID, spec: JobLaunchSpec) -> JobRunHandle:
        job_dir = _job_dir(job_id)
        os.makedirs(os.path.join(job_dir, "checkpoints"), exist_ok=True)
        script_path = os.path.join(job_dir, "job.py")
        with open(script_path, "w", encoding="utf-8") as f:
            f.write(spec.script_source)

        # Python puts a script's own directory at the front of sys.path, so
        # dropping the SDK beside job.py is all it takes for `import tensornest`
        # to resolve — no image rebuild, no PYTHONPATH.
        with open(os.path.join(job_dir, "tensornest.py"), "w", encoding="utf-8") as f:
            f.write(spec.sdk_source)

        def _run() -> str:
            client = _client()
            container = client.containers.run(
                settings.kernel_image,
                command=["python", os.path.join(job_dir, "job.py")],
                working_dir=job_dir,
                environment={
                    "CHECKPOINT_DIR": os.path.join(job_dir, "checkpoints"),
                    "TENSORNEST_API_URL": spec.api_base_url,
                    "TENSORNEST_TOKEN": spec.sdk_token,
                    "JOB_ID": str(job_id),
                },
                volumes={
                    settings.storage_volume: {"bind": settings.storage_root, "mode": "rw"}
                },
                nano_cpus=int(settings.job_cpu_limit * 1e9),
                mem_limit=settings.job_memory_limit,
                # With networking off the container cannot reach the API either,
                # so a job that wants datasets has to be on the Compose network.
                network=settings.docker_network if spec.allow_network else None,
                network_disabled=not spec.allow_network,
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

    async def collect_artifacts(self, job_id: UUID, handle: JobRunHandle) -> list[str]:
        """Upload the job's checkpoint directory from the shared volume into the
        bucket. The volume is visible to this process, so this is a plain read;
        a cloud provider would instead pull from wherever its runtime wrote."""
        checkpoint_dir = os.path.join(_job_dir(job_id), "checkpoints")
        if not os.path.isdir(checkpoint_dir):
            return []

        collected: list[str] = []
        for name in sorted(os.listdir(checkpoint_dir)):
            full_path = os.path.join(checkpoint_dir, name)
            if not os.path.isfile(full_path):
                continue
            data = await asyncio.to_thread(_read_file, full_path)
            await job_artifacts.put_checkpoint(job_id, name, data)
            collected.append(name)
        return collected

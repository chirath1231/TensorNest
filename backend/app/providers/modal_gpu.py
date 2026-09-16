"""Runs jobs on Modal's serverless GPUs.

This is the provider the platform exists for: a Modal Sandbox's lifetime is
owned by Modal's scheduler, not by any connection from here. Once
`submit_job` returns, the backend can restart, the user can close their laptop,
and the run continues. Reattaching later needs nothing but the sandbox id we
persisted, via `Sandbox.from_id`.

Layout mirrors LocalDockerProvider so the two are interchangeable behind
`ComputeProvider`:

    /workspace/jobs/<job_id>/checkpoints   (a Modal Volume, auto-committed)

The job's script is passed as the sandbox's entrypoint command rather than
written to a file first, so the sandbox's own exit code *is* the job's exit
code — which is what makes `poll()` a meaningful status check.

Checkpoints survive the sandbox because the Volume outlives it; `collect_artifacts`
reads them back from the Volume afterwards and pushes them to the bucket, the
same way the local provider reads its Docker volume.
"""

import asyncio
import os
from uuid import UUID

import modal

from app.core.config import get_settings
from app.providers.base import ComputeProvider, JobLaunchSpec, JobRunHandle, JobStatus
from app.services import job_artifacts

settings = get_settings()

WORKSPACE = "/workspace"


def _configure_auth() -> None:
    """Modal's client reads these from the environment. The backend holds them
    in settings, so mirror them across before any Modal call."""
    if settings.modal_token_id and settings.modal_token_secret:
        os.environ.setdefault("MODAL_TOKEN_ID", settings.modal_token_id)
        os.environ.setdefault("MODAL_TOKEN_SECRET", settings.modal_token_secret)


def _job_dir(job_id: UUID) -> str:
    return f"{WORKSPACE}/jobs/{job_id}"


def _checkpoint_dir(job_id: UUID) -> str:
    return f"{_job_dir(job_id)}/checkpoints"


def _volume() -> "modal.Volume":
    return modal.Volume.from_name(settings.modal_volume_name, create_if_missing=True)


def _image() -> "modal.Image":
    return modal.Image.debian_slim(python_version="3.11").pip_install(
        *settings.modal_pip_packages
    )


class ModalGPUProvider(ComputeProvider):
    """Executes a job in a GPU-backed Modal Sandbox."""

    provider_type = "modal_gpu"

    async def submit_job(self, job_id: UUID, spec: JobLaunchSpec) -> JobRunHandle:
        _configure_auth()
        checkpoint_dir = _checkpoint_dir(job_id)
        job_dir = _job_dir(job_id)

        # The user's script runs as the sandbox entrypoint. `mkdir -p` first so
        # CHECKPOINT_DIR exists exactly as it does under the local provider,
        # then exec so the Python process becomes PID 1 and its exit status is
        # the sandbox's exit status.
        #
        # The SDK is written from the environment rather than baked into the
        # image: this image is built by Modal from its own base, so there is no
        # local build context to copy a file out of. Writing it into the
        # workdir puts it on sys.path for the script that runs next, which is
        # the same mechanism the local provider relies on.
        bootstrap = (
            f"mkdir -p {checkpoint_dir} && "
            f'printf "%s" "$TENSORNEST_SDK" > {job_dir}/tensornest.py && '
            f'exec python -u -c "$TENSORNEST_SCRIPT"'
        )

        def _create() -> str:
            app = modal.App.lookup(settings.modal_app_name, create_if_missing=True)
            sandbox = modal.Sandbox.create(
                "bash",
                "-lc",
                bootstrap,
                app=app,
                image=_image(),
                gpu=settings.modal_gpu,
                timeout=settings.modal_timeout_seconds,
                workdir=_job_dir(job_id),
                volumes={WORKSPACE: _volume()},
                secrets=[
                    modal.Secret.from_dict(
                        {
                            "TENSORNEST_SCRIPT": spec.script_source,
                            "TENSORNEST_SDK": spec.sdk_source,
                            "TENSORNEST_API_URL": spec.api_base_url,
                            "TENSORNEST_TOKEN": spec.sdk_token,
                            "CHECKPOINT_DIR": checkpoint_dir,
                            "JOB_ID": str(job_id),
                        }
                    )
                ],
            )
            return sandbox.object_id

        sandbox_id = await asyncio.to_thread(_create)
        return JobRunHandle(container_id=sandbox_id, workspace_path=_job_dir(job_id))

    async def get_status(self, handle: JobRunHandle) -> JobStatus:
        _configure_auth()

        def _poll() -> JobStatus:
            try:
                sandbox = modal.Sandbox.from_id(handle.container_id)
            except Exception:  # noqa: BLE001 — sandbox expired or unknown id
                return JobStatus(state="failed", exit_code=None)
            code = sandbox.poll()
            if code is None:
                return JobStatus(state="running", exit_code=None)
            if code == 0:
                return JobStatus(state="succeeded", exit_code=0)
            return JobStatus(state="failed", exit_code=code)

        return await asyncio.to_thread(_poll)

    async def stream_logs(self, handle: JobRunHandle) -> str:
        _configure_auth()

        def _logs() -> str:
            try:
                sandbox = modal.Sandbox.from_id(handle.container_id)
            except Exception:  # noqa: BLE001
                return ""
            out = sandbox.stdout.read() or ""
            err = sandbox.stderr.read() or ""
            return out + err if err else out

        return await asyncio.to_thread(_logs)

    async def cancel(self, handle: JobRunHandle) -> None:
        _configure_auth()

        def _terminate() -> None:
            try:
                sandbox = modal.Sandbox.from_id(handle.container_id)
            except Exception:  # noqa: BLE001
                return
            sandbox.terminate()

        await asyncio.to_thread(_terminate)

    async def collect_artifacts(self, job_id: UUID, handle: JobRunHandle) -> list[str]:
        """Read checkpoints out of the Modal Volume and push them to the bucket.

        The Volume, not the sandbox, is what persists — Modal commits it in the
        background during the run and once more at shutdown — so this works
        after the sandbox has exited.
        """
        _configure_auth()
        # Volume paths are relative to the volume root, not the mount point.
        prefix = f"jobs/{job_id}/checkpoints"

        # Resolve the volume once. Doing it per file costs a lookup round-trip
        # each time, which dominated the transfer for a job with many
        # checkpoints (30 files took ~100s that way).
        volume = await asyncio.to_thread(_volume)

        def _list() -> list[str]:
            # No reload() here: it is only callable from inside a running Modal
            # function. A client read already sees the latest committed state,
            # and Modal commits the volume when the sandbox exits.
            try:
                return [
                    entry.path.split("/")[-1]
                    for entry in volume.listdir(prefix)
                    if getattr(entry, "type", None) != 2  # skip directories
                ]
            except Exception:  # noqa: BLE001 — no checkpoints written
                return []

        def _read(name: str) -> bytes:
            return b"".join(volume.read_file(f"{prefix}/{name}"))

        names = await asyncio.to_thread(_list)
        collected: list[str] = []
        for name in sorted(names):
            data = await asyncio.to_thread(_read, name)
            await job_artifacts.put_checkpoint(job_id, name, data)
            collected.append(name)
        return collected

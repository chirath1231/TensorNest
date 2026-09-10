"""
ComputeProvider is the seam between the platform's control plane and wherever a
persistent training job actually executes. `LocalDockerProvider` is the only
implementation today (runs jobs in a CPU-limited Docker container on the host).

A future `CloudGPUProvider` (out of scope for now) would implement this same
interface against cloud GPU infrastructure, and the Adaptive GPU Decision Engine
(research component, also out of scope for now) would sit above whichever
provider(s) are registered, choosing between them per job. Keep this interface
stable so that work can plug in without touching the job orchestration code
above it.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass
from uuid import UUID


@dataclass
class JobRunHandle:
    container_id: str
    workspace_path: str


@dataclass
class JobStatus:
    state: str  # "running" | "succeeded" | "failed"
    exit_code: int | None


class ComputeProvider(ABC):
    """Executes a job's script in an isolated environment and reports on it."""

    provider_type: str

    @abstractmethod
    async def submit_job(self, job_id: UUID, script_source: str) -> JobRunHandle:
        """Start executing the job. Returns a handle used for status/logs/cancel."""

    @abstractmethod
    async def get_status(self, handle: JobRunHandle) -> JobStatus:
        """Poll current run state."""

    @abstractmethod
    async def stream_logs(self, handle: JobRunHandle) -> str:
        """Return logs captured so far."""

    @abstractmethod
    async def cancel(self, handle: JobRunHandle) -> None:
        """Terminate a running job."""

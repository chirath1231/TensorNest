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


@dataclass
class JobLaunchSpec:
    """Everything a run needs beyond its own source, gathered in one object.

    A dataclass rather than a growing parameter list, because each new
    capability the platform gives a running job — dataset access today, metric
    logging next — otherwise changes this signature and every implementation
    of it.
    """

    script_source: str
    # The SDK is delivered with the job rather than baked into an image: a
    # Modal sandbox builds from Modal's own image, so there is nowhere to bake.
    sdk_source: str
    sdk_token: str
    api_base_url: str
    allow_network: bool = False


class ComputeProvider(ABC):
    """Executes a job's script in an isolated environment and reports on it."""

    provider_type: str

    @abstractmethod
    async def submit_job(self, job_id: UUID, spec: JobLaunchSpec) -> JobRunHandle:
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

    @abstractmethod
    async def collect_artifacts(self, job_id: UUID, handle: JobRunHandle) -> list[str]:
        """Copy everything the run produced into the object bucket, returning
        the checkpoint names collected.

        Only the provider knows where a run's files physically live — a local
        Docker volume here, a Modal Volume for a cloud provider — so bridging
        that location to shared storage belongs behind this interface rather
        than in the worker that calls it.
        """

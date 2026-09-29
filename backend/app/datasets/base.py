"""The seam between the platform and wherever a dataset is published.

Deliberately shaped like `providers.ComputeProvider`: that abstraction already
proved it holds across two things as different as a local Docker container and
a Modal sandbox, and catalogues vary along the same axis — same question, very
different APIs behind it.

Adding a source means implementing this and registering it. Nothing above this
interface should learn what a Hugging Face repo id looks like.

No vendor SDKs. Every catalogue worth supporting has a plain REST API, and
`httpx` is already a dependency — pulling in `huggingface_hub`, `datasets` and
`kaggle` would add hundreds of megabytes and three different auth models to do
what four HTTP calls already do.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field


@dataclass
class DatasetFile:
    """One downloadable file within a dataset."""

    path: str
    size: int | None = None


@dataclass
class SearchResult:
    """A dataset as a catalogue describes it, before anything is fetched."""

    source: str
    # Whatever the catalogue calls this dataset — a repo id, a numeric id, a
    # URL. Opaque above this layer; only the adapter that produced it parses it.
    ref: str
    title: str
    description: str = ""
    url: str = ""
    license: str | None = None
    downloads: int | None = None
    likes: int | None = None
    # Populated by describe(), not by search(): listing files usually costs an
    # extra request per dataset, which is not worth paying for a results page.
    files: list[DatasetFile] = field(default_factory=list)


class DatasetSource(ABC):
    """A searchable catalogue of datasets that can be pulled into the bucket."""

    name: str
    label: str
    # False when the source is reachable but not configured (missing token).
    # Search fans out across sources, so an unavailable one is skipped rather
    # than failing the whole query.
    available: bool = True

    @abstractmethod
    async def search(self, query: str, limit: int) -> list[SearchResult]:
        """Datasets matching a free-text query."""

    @abstractmethod
    async def describe(self, ref: str) -> SearchResult:
        """One dataset, with its file list populated."""

    @abstractmethod
    async def file_url(self, ref: str, path: str) -> str:
        """A directly fetchable URL for one file within the dataset."""

"""Registry of dataset catalogues the platform can search and import from."""

from app.datasets.base import DatasetFile, DatasetSource, SearchResult
from app.datasets.direct_url import DirectUrlSource
from app.datasets.huggingface import HuggingFaceSource

SOURCES: dict[str, DatasetSource] = {
    source.name: source
    for source in (HuggingFaceSource(), DirectUrlSource())
}

__all__ = ["SOURCES", "DatasetFile", "DatasetSource", "SearchResult"]

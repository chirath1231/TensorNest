"""Hugging Face Hub.

The best-behaved catalogue of the lot: public datasets need no key, search and
file listing are one GET each, and `/resolve/` hands back the raw bytes with
redirects to their CDN. That is why it is the first source — it works for an
anonymous user on a fresh clone with nothing configured.

A token is optional and only widens what is visible to gated or private repos.
"""

import httpx

from app.core.config import get_settings
from app.datasets.base import DatasetFile, DatasetSource, SearchResult

settings = get_settings()

API = "https://huggingface.co/api"
SITE = "https://huggingface.co"
TIMEOUT = 20.0

# Anything the platform can actually open. A dataset repo is mostly scripts,
# READMEs and .gitattributes; offering those as "datasets" to import would be
# noise.
DATA_SUFFIXES = (
    ".csv", ".tsv", ".parquet", ".json", ".jsonl", ".ndjson",
    ".xlsx", ".xls", ".feather", ".arrow", ".txt", ".csv.gz", ".zip",
)


def _headers() -> dict:
    if settings.huggingface_token:
        return {"Authorization": f"Bearer {settings.huggingface_token}"}
    return {}


class HuggingFaceSource(DatasetSource):
    name = "huggingface"
    label = "Hugging Face"

    async def search(self, query: str, limit: int) -> list[SearchResult]:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            response = await client.get(
                f"{API}/datasets",
                params={"search": query, "limit": limit, "full": "true"},
                headers=_headers(),
            )
            response.raise_for_status()
            payload = response.json()

        return [self._to_result(item) for item in payload]

    async def describe(self, ref: str) -> SearchResult:
        async with httpx.AsyncClient(timeout=TIMEOUT, follow_redirects=True) as client:
            info = await client.get(f"{API}/datasets/{ref}", headers=_headers())
            info.raise_for_status()
            result = self._to_result(info.json())

            tree = await client.get(f"{API}/datasets/{ref}/tree/main", headers=_headers())
            tree.raise_for_status()
            entries = tree.json()

        result.files = [
            DatasetFile(path=entry["path"], size=entry.get("size"))
            for entry in entries
            if entry.get("type") == "file" and entry["path"].lower().endswith(DATA_SUFFIXES)
        ]
        return result

    async def file_url(self, ref: str, path: str) -> str:
        return f"{SITE}/datasets/{ref}/resolve/main/{path}"

    def _to_result(self, item: dict) -> SearchResult:
        ref = item.get("id", "")
        card = item.get("cardData") or {}
        licence = card.get("license")
        if isinstance(licence, list):
            licence = ", ".join(str(x) for x in licence) or None

        # HF has no description field; the closest thing is the tag list, which
        # at least says what task and language the data is for.
        tags = [t for t in (item.get("tags") or []) if not t.startswith(("license:", "region:"))]

        return SearchResult(
            source=self.name,
            ref=ref,
            title=ref,
            description=", ".join(tags[:6]),
            url=f"{SITE}/datasets/{ref}",
            license=licence,
            downloads=item.get("downloads"),
            likes=item.get("likes"),
        )

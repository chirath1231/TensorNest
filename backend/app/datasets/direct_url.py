"""Any URL that returns a file.

The catch-all, and the reason the platform is not limited to catalogues it has
an adapter for: a link in a paper, a government open-data portal, a gist. If
someone can paste a URL, they can get the data in.

It is not really searchable — "search" here means "is what you typed a URL?" —
so it contributes one result when the query looks like a link and none
otherwise, which keeps it quiet in a normal fan-out search.
"""

from urllib.parse import unquote, urlparse

import httpx

from app.datasets.base import DatasetFile, DatasetSource, SearchResult

TIMEOUT = 20.0


def _looks_like_url(value: str) -> bool:
    parsed = urlparse(value.strip())
    return parsed.scheme in ("http", "https") and bool(parsed.netloc)


def _filename_for(url: str) -> str:
    path = urlparse(url).path
    name = unquote(path.rsplit("/", 1)[-1]) if path else ""
    return name or "download.bin"


class DirectUrlSource(DatasetSource):
    name = "url"
    label = "Direct link"

    async def search(self, query: str, limit: int) -> list[SearchResult]:
        if not _looks_like_url(query):
            return []
        return [await self.describe(query.strip())]

    async def describe(self, ref: str) -> SearchResult:
        filename = _filename_for(ref)
        size = None
        content_type = None

        # A HEAD costs one round trip and turns "some link" into a real size and
        # type in the results, which is what makes it obvious whether the link
        # is the data or an HTML page about the data.
        try:
            async with httpx.AsyncClient(timeout=TIMEOUT, follow_redirects=True) as client:
                head = await client.head(ref)
                if head.status_code < 400:
                    length = head.headers.get("content-length")
                    size = int(length) if length and length.isdigit() else None
                    content_type = (head.headers.get("content-type") or "").split(";")[0] or None
        except httpx.HTTPError:
            pass

        return SearchResult(
            source=self.name,
            ref=ref,
            title=filename,
            description=content_type or "Direct download",
            url=ref,
            files=[DatasetFile(path=filename, size=size)],
        )

    async def file_url(self, ref: str, path: str) -> str:
        # `path` is cosmetic here — the ref already identifies exactly one file.
        return ref

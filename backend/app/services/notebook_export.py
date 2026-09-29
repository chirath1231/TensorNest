"""Export a stored notebook to the bucket as a real .ipynb file.

Notebooks live in Postgres (`notebooks.content`) because they are small, are
queried per user, and are edited cell-by-cell — a bucket is the wrong store for
that. Exporting is a separate concern: it produces a standalone artifact that
can be downloaded, archived, or handed to a training job running somewhere with
no access to this database.

The stored cell shape is close to nbformat but not identical: `source` is one
string rather than a list of lines, cells carry a client-side `id`, and outputs
use the compact shape the WebSocket client emits ({"type": "stream", ...})
rather than nbformat's ({"output_type": "stream", ...}). This module does that
translation so the exported file opens in Jupyter, VS Code, or nbconvert.
"""

import asyncio
import json
import uuid

from app.core.config import get_settings
from app.core.storage import get_s3_client

settings = get_settings()

NBFORMAT = 4
NBFORMAT_MINOR = 5


def _split_source(source: str) -> list[str]:
    """nbformat stores source as a list of lines, each keeping its trailing
    newline except the last."""
    if not source:
        return []
    lines = source.splitlines(keepends=True)
    return lines


def _convert_output(output: dict) -> dict | None:
    """Translate one stored output into its nbformat equivalent."""
    kind = output.get("type")
    if kind == "stream":
        return {
            "output_type": "stream",
            "name": output.get("name", "stdout"),
            "text": _split_source(output.get("text", "")),
        }
    if kind in ("execute_result", "display_data"):
        converted = {
            "output_type": kind,
            "data": output.get("data", {}),
            "metadata": {},
        }
        if kind == "execute_result":
            converted["execution_count"] = output.get("execution_count")
        return converted
    if kind == "error":
        return {
            "output_type": "error",
            "ename": output.get("ename", "Error"),
            "evalue": output.get("evalue", ""),
            "traceback": output.get("traceback", []),
        }
    # Already in nbformat shape (e.g. re-exported) — pass it through.
    if "output_type" in output:
        return output
    return None


def _convert_cell(cell: dict) -> dict:
    cell_type = cell.get("cell_type", "code")
    converted = {
        "cell_type": cell_type,
        "id": str(cell.get("id") or uuid.uuid4())[:64],
        "metadata": {},
        "source": _split_source(cell.get("source", "")),
    }
    if cell_type == "code":
        outputs = []
        for raw in cell.get("outputs") or []:
            if isinstance(raw, dict):
                out = _convert_output(raw)
                if out is not None:
                    outputs.append(out)
        converted["outputs"] = outputs
        converted["execution_count"] = cell.get("execution_count")
    return converted


def to_ipynb(content: dict, title: str) -> dict:
    """Build a valid nbformat 4.5 document from a stored notebook."""
    metadata = dict(content.get("metadata") or {})
    metadata.setdefault(
        "kernelspec",
        {"name": "python3", "display_name": "Python 3", "language": "python"},
    )
    metadata.setdefault("language_info", {"name": "python"})
    metadata["tensornest"] = {"title": title}

    return {
        "nbformat": NBFORMAT,
        "nbformat_minor": NBFORMAT_MINOR,
        "metadata": metadata,
        "cells": [_convert_cell(c) for c in (content.get("cells") or []) if isinstance(c, dict)],
    }


def export_key(owner_id: uuid.UUID, notebook_id: uuid.UUID) -> str:
    """Stable key, so re-exporting a notebook overwrites its previous export
    rather than accumulating copies."""
    return f"notebooks/{owner_id}/{notebook_id}.ipynb"


async def export_to_bucket(
    owner_id: uuid.UUID, notebook_id: uuid.UUID, content: dict, title: str
) -> tuple[str, int]:
    """Serialise the notebook and put it in the bucket. Returns (key, bytes)."""
    document = to_ipynb(content, title)
    body = json.dumps(document, indent=1, ensure_ascii=False).encode("utf-8")
    key = export_key(owner_id, notebook_id)

    def _put() -> None:
        get_s3_client().put_object(
            Bucket=settings.s3_bucket,
            Key=key,
            Body=body,
            ContentType="application/x-ipynb+json",
        )

    await asyncio.to_thread(_put)
    return key, len(body)

"""TensorNest client, available inside notebooks and training jobs.

    import tensornest as tn

    tn.datasets()                 # what can I reach?
    df = tn.load("titanic.csv")   # a DataFrame
    path = tn.download("weights.pt")

Why a client rather than a mounted volume: a job can run on hardware that is
not this machine — a Modal sandbox has no view of the host filesystem and never
will. Fetching over a presigned URL is the only mechanism that behaves the same
in a local container and on someone else's GPU, so it is the only one here.

This module is the single source of truth for that client. It is served to
kernel containers over HTTP at startup and written next to the script for
training jobs, so updating it does not mean rebuilding a 2 GB image.

Standard library only, by design: it has to import on a bare python:3.11-slim
before anything else is installed. pandas is imported lazily, inside load().
"""

import json
import os
import shutil
import tempfile
import urllib.error
import urllib.parse
import urllib.request

__all__ = ["datasets", "resolve", "download", "load", "checkpoint_dir", "TensorNestError"]

API_URL = os.environ.get("TENSORNEST_API_URL", "").rstrip("/")
TOKEN = os.environ.get("TENSORNEST_TOKEN", "")

_TIMEOUT = 30
_CACHE = os.path.join(tempfile.gettempdir(), "tensornest-datasets")


class TensorNestError(RuntimeError):
    """Raised for anything the caller could plausibly fix themselves."""


def _api(path, params=None):
    if not API_URL:
        raise TensorNestError(
            "TENSORNEST_API_URL is not set, so this environment cannot reach the "
            "TensorNest API. Restart the kernel from the notebook page, or re-submit "
            "the job, so it is started with the right environment."
        )
    if not TOKEN:
        raise TensorNestError(
            "TENSORNEST_TOKEN is not set. Restart the kernel from the notebook page "
            "so it is issued a fresh access token."
        )

    url = API_URL + path
    if params:
        url += "?" + urllib.parse.urlencode(params)

    request = urllib.request.Request(url, headers={"Authorization": "Bearer " + TOKEN})
    try:
        with urllib.request.urlopen(request, timeout=_TIMEOUT) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        detail = ""
        try:
            detail = json.loads(exc.read().decode("utf-8")).get("detail", "")
        except Exception:  # noqa: BLE001 — the status code still tells us enough
            pass
        if exc.code == 401:
            raise TensorNestError(
                "This kernel's access token has expired. Restart the kernel from the "
                "notebook page to get a new one."
            ) from None
        if exc.code == 404:
            raise TensorNestError(detail or "Not found.") from None
        raise TensorNestError("TensorNest API error %s: %s" % (exc.code, detail or exc.reason)) from None
    except urllib.error.URLError as exc:
        raise TensorNestError(
            "Could not reach the TensorNest API at %s (%s). If this is a job running on "
            "a remote GPU, the backend has to be reachable from the public internet for "
            "dataset access to work." % (API_URL, exc.reason)
        ) from None


def datasets():
    """Every dataset on your account, newest first.

    Returns a list of dicts with id, filename, size and content_type.
    """
    return _api("/sdk/datasets")["items"]


def resolve(ref):
    """Look up one dataset by filename or id, without downloading it."""
    return _api("/sdk/datasets/resolve", {"ref": str(ref)})


def download(ref, dest=None):
    """Fetch a dataset to local disk and return its path.

    Repeated calls reuse the cached copy, so re-running a cell does not
    re-download the file. Pass `dest` to write somewhere specific instead.
    """
    info = resolve(ref)

    if dest is None:
        os.makedirs(_CACHE, exist_ok=True)
        dest = os.path.join(_CACHE, "%s_%s" % (info["id"][:8], info["filename"]))
        if os.path.exists(dest) and os.path.getsize(dest) == info["size"]:
            return dest

    parent = os.path.dirname(os.path.abspath(dest))
    if parent:
        os.makedirs(parent, exist_ok=True)

    # Stream to a temp file and move into place, so an interrupted download
    # never leaves a truncated file that the size check above would accept.
    partial = dest + ".partial"
    try:
        with urllib.request.urlopen(info["url"], timeout=_TIMEOUT) as response:
            with open(partial, "wb") as handle:
                shutil.copyfileobj(response, handle, length=1024 * 1024)
    except urllib.error.URLError as exc:
        if os.path.exists(partial):
            os.remove(partial)
        raise TensorNestError(
            "Download of '%s' failed: %s" % (info["filename"], exc.reason)
        ) from None

    os.replace(partial, dest)
    return dest


_READERS = {
    ".csv": ("read_csv", {}),
    ".tsv": ("read_csv", {"sep": "\t"}),
    ".parquet": ("read_parquet", {}),
    ".json": ("read_json", {}),
    ".jsonl": ("read_json", {"lines": True}),
    ".ndjson": ("read_json", {"lines": True}),
    ".xlsx": ("read_excel", {}),
    ".xls": ("read_excel", {}),
    ".feather": ("read_feather", {}),
}


def load(ref, **kwargs):
    """Read a dataset into a pandas DataFrame, picking the reader by extension.

    Any keyword arguments are passed through to the underlying pandas reader,
    so `tn.load("wide.csv", usecols=["a", "b"])` works as you would expect.
    """
    try:
        import pandas as pd
    except ImportError:
        raise TensorNestError(
            "pandas is not installed in this environment, so load() cannot build a "
            "DataFrame. Use tn.download() to get the file path instead."
        ) from None

    path = download(ref)
    extension = os.path.splitext(path)[1].lower()

    if extension == ".gz" and path[: -len(".gz")].lower().endswith(".csv"):
        extension = ".csv"

    if extension not in _READERS:
        raise TensorNestError(
            "No reader for '%s' files. Use tn.download(%r) to get the path and open it "
            "yourself. Readable here: %s."
            % (extension or "extensionless", ref, ", ".join(sorted(_READERS)))
        )

    reader_name, defaults = _READERS[extension]
    options = dict(defaults)
    options.update(kwargs)
    return getattr(pd, reader_name)(path, **options)


def checkpoint_dir():
    """Where a training job should write model files.

    Anything saved here is uploaded to your account when the job finishes, and
    appears on the job's page. Outside a job this raises, because there is
    nowhere durable to put a checkpoint.
    """
    path = os.environ.get("CHECKPOINT_DIR")
    if not path:
        raise TensorNestError(
            "CHECKPOINT_DIR is only set inside a training job. In a notebook, save "
            "files normally — or submit this notebook as a job to keep its outputs."
        )
    os.makedirs(path, exist_ok=True)
    return path

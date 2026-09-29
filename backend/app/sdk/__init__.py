"""Client code that runs inside kernel and job containers, not in this process.

`tensornest.py` is shipped out of here verbatim — served over HTTP to kernels
and written next to the script for jobs — so it is deliberately never imported
by the backend itself.
"""

from pathlib import Path

SDK_PATH = Path(__file__).with_name("tensornest.py")


def sdk_source() -> str:
    return SDK_PATH.read_text(encoding="utf-8")

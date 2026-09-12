"""JSON output helpers for pipeline writers."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

from pipeline.constants import OUT_DIR

MAX_BYTES = 200_000


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def write_json(name: str, obj: dict) -> Path:
    """Write `obj` as JSON to `OUT_DIR / name`, creating the directory as needed.

    Raises RuntimeError if the resulting file would exceed MAX_BYTES.
    """
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    path = OUT_DIR / name
    text = json.dumps(obj, indent=1, allow_nan=False, ensure_ascii=False) + "\n"
    data = text.encode("utf-8")
    if len(data) > MAX_BYTES:
        raise RuntimeError(f"{name} is {len(data)} bytes, exceeds {MAX_BYTES} byte limit")
    path.write_bytes(data)
    return path

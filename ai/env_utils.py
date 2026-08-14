"""Shared environment-variable readers.

Both the local OCR pipeline (``ai/ocr_module.py``) and the visual/AI pipeline
(``ai/question_generator.py``) read configuration from environment variables.
These helpers centralize the parsing so the two pipelines cannot drift. They
fall back to reading the project ``.env`` file so values work even when the
file has not been loaded into the process environment.
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Optional

BASE_DIR = Path(__file__).resolve().parent.parent

# Parsed ``.env`` file, cached so hot paths (e.g. the OCR preprocessing salt)
# don't re-read the file from disk on every call. Invalidated when the file's
# mtime changes.
_env_file_cache: dict[str, str] = {}
_env_file_cache_mtime: Optional[float] = None


def read_env_value(key: str) -> Optional[str]:
    """Return an env value, falling back to the project ``.env`` file.

    Checks the process environment first, then the ``.env`` file at the
    project root. Surrounding quotes are stripped. Returns ``None`` when the
    key is not present anywhere.
    """
    direct_value = os.getenv(key)
    if direct_value:
        return direct_value.strip().strip('"').strip("'")

    global _env_file_cache, _env_file_cache_mtime

    env_path = BASE_DIR / ".env"
    if not env_path.exists():
        return None

    try:
        env_mtime = env_path.stat().st_mtime
    except OSError:
        env_mtime = None

    if env_mtime != _env_file_cache_mtime or not _env_file_cache:
        try:
            lines = env_path.read_text(encoding="utf-8").splitlines()
        except OSError:
            return None
        _env_file_cache.clear()
        for line in lines:
            stripped = line.strip()
            if not stripped or stripped.startswith("#") or "=" not in stripped:
                continue
            name, raw_value = stripped.split("=", 1)
            _env_file_cache[name.strip()] = raw_value.strip().strip('"').strip("'")
        _env_file_cache_mtime = env_mtime

    return _env_file_cache.get(key)


def read_env_bool(key: str, default: bool) -> bool:
    """Read a boolean env var (1/true/yes/on); empty values count as unset."""
    raw_value = read_env_value(key)
    if not raw_value:
        return default
    return raw_value.strip().lower() in ("1", "true", "yes", "on")


def read_env_int(key: str, default: int) -> int:
    """Read a positive int env var; non-parseable or <1 values fall back to default."""
    raw_value = read_env_value(key)
    if raw_value is None:
        return default
    try:
        parsed_value = int(raw_value)
    except (ValueError, TypeError):
        return default
    return parsed_value if parsed_value >= 1 else default


def read_env_int_clamped(key: str, default: int, minimum: int, maximum: int) -> int:
    """Read an int env var clamped into ``[minimum, maximum]``."""
    value = read_env_int(key, default)
    return max(minimum, min(maximum, value))


def read_env_float(key: str, default: float) -> float:
    """Read a non-negative float env var; non-parseable or negative values fall back to default."""
    raw_value = read_env_value(key)
    if raw_value is None:
        return default
    try:
        parsed_value = float(raw_value)
    except (ValueError, TypeError):
        return default
    return parsed_value if parsed_value >= 0.0 else default

from __future__ import annotations

import os
from functools import lru_cache
from urllib.parse import parse_qsl, quote_plus, urlencode, urlsplit, urlunsplit

from sqlmodel import create_engine

DEFAULT_SQLITE_URL = "sqlite:///./learning_app.db"
LOCAL_DATABASE_HOSTS = {"localhost", "127.0.0.1", "::1"}


def _normalize_postgres_url(db_url: str) -> str:
    normalized = db_url.strip()

    if normalized.startswith("postgres://"):
        normalized = normalized.replace("postgres://", "postgresql+psycopg://", 1)
    elif normalized.startswith("postgresql://") and not normalized.startswith(
        "postgresql+",
    ):
        normalized = normalized.replace("postgresql://", "postgresql+psycopg://", 1)

    if not normalized.startswith("postgresql+psycopg://"):
        return normalized

    parts = urlsplit(normalized)
    query = dict(parse_qsl(parts.query, keep_blank_values=True))
    configured_sslmode = os.getenv("DATABASE_SSLMODE", "").strip()

    if "sslmode" not in query:
        if configured_sslmode:
            query["sslmode"] = configured_sslmode
        elif (parts.hostname or "").lower() not in LOCAL_DATABASE_HOSTS:
            query["sslmode"] = "require"

    return urlunsplit(
        (
            parts.scheme,
            parts.netloc,
            parts.path,
            urlencode(query, doseq=True),
            parts.fragment,
        )
    )


def _build_postgres_url_from_parts() -> str | None:
    database_name = os.getenv("DATABASE_NAME", "").strip()
    database_user = os.getenv("DATABASE_USER", "").strip()
    database_password = os.getenv("DATABASE_PASSWORD", "").strip()
    database_host = os.getenv("DATABASE_HOST", "").strip()
    database_port = os.getenv("DATABASE_PORT", "").strip()

    if not all(
        [
            database_name,
            database_user,
            database_password,
            database_host,
            database_port,
        ]
    ):
        return None

    postgres_url = (
        "postgresql+psycopg://"
        f"{quote_plus(database_user)}:{quote_plus(database_password)}"
        f"@{database_host}:{database_port}/{database_name}"
    )
    return _normalize_postgres_url(postgres_url)


def resolve_database_url() -> str:
    direct_candidates = [
        os.getenv("DATABASE_URL", "").strip(),
        os.getenv("POSTGRES_URL", "").strip(),
        os.getenv("DATABASE", "").strip(),
    ]

    for candidate in direct_candidates:
        if candidate and "://" in candidate:
            return _normalize_postgres_url(candidate)

    postgres_url = _build_postgres_url_from_parts()
    if postgres_url:
        return postgres_url

    return DEFAULT_SQLITE_URL


@lru_cache(maxsize=4)
def create_db_engine(db_url: str | None = None):
    resolved_db_url = _normalize_postgres_url(db_url) if db_url else resolve_database_url()
    is_sqlite = resolved_db_url.startswith("sqlite")

    engine_kwargs = {}
    if is_sqlite:
        engine_kwargs["connect_args"] = {"check_same_thread": False}
    else:
        engine_kwargs["pool_pre_ping"] = True

    return create_engine(resolved_db_url, **engine_kwargs)

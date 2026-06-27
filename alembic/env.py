import sys
from logging.config import fileConfig
from pathlib import Path

from sqlalchemy import engine_from_config
from sqlalchemy import pool

from alembic import context

# ── Đảm bảo project root có trong sys.path ──
PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

# ── Alembic Config ──
config = context.config

# Logging
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# ── Import tất cả models để đăng ký với SQLModel.metadata ──
from sqlmodel import SQLModel

# Import tất cả các model để Alembic autogenerate phát hiện được
import models  # noqa: F401 — models/__init__.py imports tất cả table models

target_metadata = SQLModel.metadata


def get_url() -> str:
    """Lấy database URL từ project (hỗ trợ SQLite và PostgreSQL)."""
    from database.engine import resolve_database_url

    return resolve_database_url()


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode — chỉ sinh SQL, không kết nối DB."""
    url = get_url()
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode — kết nối DB thật."""
    from database.engine import create_db_engine

    connectable = create_db_engine()

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()

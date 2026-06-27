from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from sqlmodel import Field, SQLModel


class Category(SQLModel, table=True):
    __tablename__ = "category"

    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(default="Tên của phân loại", nullable=False)
    description: str = Field(default="Mô tả phân loại", nullable=False)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), nullable=False)

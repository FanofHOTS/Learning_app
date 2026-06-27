from __future__ import annotations

from typing import Optional

from sqlmodel import Field, SQLModel


class Profile(SQLModel, table=True):
    __tablename__ = "profile"

    user_id: Optional[int] = Field(default=None, primary_key=True, foreign_key="user.id", sa_column_kwargs={'autoincrement': False})
    name: str = Field(default="Tên thật người dùng", nullable=False)
    email: str = Field(default="nguoidung@gmail.com", nullable=False, unique=True)
    location: str = Field(default="Địa chỉ người dùng", nullable=False)
    organization: str = Field(default="Tên trường học hoặc tổ chức", nullable=False)
    description: str = Field(default="Mô tả ngắn gọn người dùng", nullable=False)
    specialization: str = Field(default="Chuyên ngành của người dùng", nullable=True)

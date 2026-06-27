from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from sqlmodel import Field, SQLModel


class User(SQLModel, table=True):
    __tablename__ = "user"

    id: Optional[int] = Field(default=None, primary_key=True)
    username: str = Field(default="Tên người dùng", nullable=False, unique=True)
    email: str = Field(default="nguoidung@gmail.com", nullable=False, unique=True)
    password: str = Field(nullable=False)
    icon: str = Field(default="/icon.png")
    role: str = Field(default="student", nullable=False)
    is_password_reset: bool = Field(
        default=False,
        nullable=False,
        description="Có cần thay đổi mật khẩu sau khi đăng nhập không?",
    )
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), nullable=False)


class PasswordRecoveryChallenge(SQLModel, table=True):
    __tablename__ = "password_recovery_challenge"

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", nullable=False)
    code_hash: str = Field(nullable=False)
    expires_at: datetime = Field(nullable=False)
    is_used: bool = Field(default=False, nullable=False)
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    consumed_at: Optional[datetime] = Field(default=None, nullable=True)

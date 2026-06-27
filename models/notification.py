from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from sqlmodel import Field, SQLModel


class Notification(SQLModel, table=True):
    __tablename__ = "notification"

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", nullable=False, index=True)
    type: str = Field(
        default="general",
        nullable=False,
        description="Loại thông báo: new_course, course_available, comment_reply, ...",
    )
    title: str = Field(default="", nullable=False)
    message: str = Field(default="", nullable=False)
    reference_id: Optional[int] = Field(
        default=None, nullable=True, description="ID của đối tượng liên quan (khóa học, bình luận, ...)"
    )
    reference_type: Optional[str] = Field(
        default=None, nullable=True,
        description="Loại đối tượng liên quan: course, course_discussion, discussion, ...",
    )
    is_read: bool = Field(default=False, nullable=False)
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc), nullable=False
    )

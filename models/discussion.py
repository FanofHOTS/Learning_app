from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from sqlmodel import Field, SQLModel


class DiscussionComment(SQLModel, table=True):
    __tablename__ = "discussion_comment"

    id: Optional[int] = Field(default=None, primary_key=True)
    course_component_id: int = Field(
        foreign_key="course_component.id", nullable=False, index=True
    )
    user_id: int = Field(foreign_key="user.id", nullable=False)
    content: str = Field(default="", nullable=False)
    parent_id: Optional[int] = Field(
        default=None, foreign_key="discussion_comment.id", nullable=True
    )
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc), nullable=False
    )
    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc), nullable=False
    )

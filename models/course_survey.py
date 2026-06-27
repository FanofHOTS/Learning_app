from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from sqlmodel import Field, SQLModel


class CourseSurvey(SQLModel, table=True):
    __tablename__ = "course_survey"

    id: Optional[int] = Field(default=None, primary_key=True)
    course_id: Optional[int] = Field(default=None, foreign_key="course.id", nullable=True)
    title: str = Field(default="Khảo sát nhu cầu học tập", nullable=False)
    description: str = Field(default="", nullable=False)
    is_active: bool = Field(default=True, nullable=False)
    is_public: bool = Field(default=False, nullable=False)
    end_at: Optional[datetime] = Field(default=None, nullable=True)
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc), nullable=False
    )
    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc), nullable=False
    )


class CourseSurveyQuestion(SQLModel, table=True):
    __tablename__ = "course_survey_question"

    id: Optional[int] = Field(default=None, primary_key=True)
    survey_id: int = Field(foreign_key="course_survey.id", nullable=False)
    question_text: str = Field(default="", nullable=False)
    question_type: str = Field(
        default="text", nullable=False
    )
    options: str = Field(
        default="[]", nullable=False
    )
    sequence: int = Field(default=1, nullable=False)
    is_required: bool = Field(default=True, nullable=False)


class CourseSurveyResponse(SQLModel, table=True):
    __tablename__ = "course_survey_response"

    id: Optional[int] = Field(default=None, primary_key=True)
    survey_id: int = Field(foreign_key="course_survey.id", nullable=False)
    question_id: int = Field(foreign_key="course_survey_question.id", nullable=False)
    user_id: int = Field(foreign_key="user.id", nullable=False)
    answer: str = Field(default="", nullable=False)
    submitted_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc), nullable=False
    )

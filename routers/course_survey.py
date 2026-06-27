from __future__ import annotations

from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Field, SQLModel, Session, select, delete

from database.engine import create_db_engine
from models.course_survey import CourseSurvey, CourseSurveyQuestion, CourseSurveyResponse

router = APIRouter(prefix="/course_survey", tags=["course_survey"])


def get_session():
    with Session(create_db_engine()) as session:
        yield session


# ─── Pydantic request/response models ────────────────────

class SurveyCreate(SQLModel):
    course_id: Optional[int] = None
    title: str = "Khảo sát nhu cầu học tập"
    description: str = ""
    is_public: bool = False
    end_at: Optional[datetime] = None


class SurveyUpdate(SQLModel):
    title: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None
    is_public: Optional[bool] = None
    end_at: Optional[datetime] = None


class QuestionCreate(SQLModel):
    survey_id: int
    question_text: str
    question_type: str = "text"
    options: str = "[]"
    sequence: int = 1
    is_required: bool = True


class QuestionUpdate(SQLModel):
    question_text: Optional[str] = None
    question_type: Optional[str] = None
    options: Optional[str] = None
    sequence: Optional[int] = None
    is_required: Optional[bool] = None


class ResponseSubmit(SQLModel):
    survey_id: int
    user_id: int
    answers: list[ResponseAnswer]


class ResponseAnswer(SQLModel):
    question_id: int
    answer: str


class SurveyResultStats(SQLModel):
    question_id: int
    question_text: str
    question_type: str
    options: str  # JSON
    total_responses: int
    text_answers: list[str]  # for text type
    choice_counts: dict[str, int]  # for multiple_choice/checkbox
    rating_avg: float  # for rating type
    rating_count: int  # for rating type


# ─── Endpoints ────────────────────────────────────────────

@router.get("/course/{course_id}", response_model=List[CourseSurvey])
def get_surveys_by_course(course_id: int, session: Session = Depends(get_session)):
    return session.exec(
        select(CourseSurvey).where(CourseSurvey.course_id == course_id).order_by(CourseSurvey.created_at.desc())
    ).all()


@router.get("/public", response_model=List[CourseSurvey])
def list_public_surveys(session: Session = Depends(get_session)):
    """Lấy danh sách khảo sát công khai đang hoạt động."""
    now = datetime.now(timezone.utc)
    return session.exec(
        select(CourseSurvey).where(
            CourseSurvey.is_public == True,
            CourseSurvey.is_active == True,
        ).order_by(CourseSurvey.created_at.desc())
    ).all()


@router.get("/public/{survey_id}", response_model=CourseSurvey)
def get_public_survey(survey_id: int, session: Session = Depends(get_session)):
    """Lấy chi tiết khảo sát công khai (kèm câu hỏi)."""
    survey = session.get(CourseSurvey, survey_id)
    if not survey or not survey.is_public or not survey.is_active:
        raise HTTPException(status_code=404, detail="Không tìm thấy khảo sát công khai")

    now = datetime.now(timezone.utc)
    if survey.end_at and survey.end_at < now:
        raise HTTPException(status_code=410, detail="Khảo sát này đã kết thúc")

    return survey


@router.get("/{survey_id}", response_model=CourseSurvey)
def get_survey(survey_id: int, session: Session = Depends(get_session)):
    survey = session.get(CourseSurvey, survey_id)
    if not survey:
        raise HTTPException(status_code=404, detail="Không tìm thấy khảo sát")
    return survey


@router.post("/create", response_model=CourseSurvey)
def create_survey(survey: SurveyCreate, session: Session = Depends(get_session)):
    db_survey = CourseSurvey(
        course_id=survey.course_id,
        title=survey.title,
        description=survey.description,
        is_public=survey.is_public,
        end_at=survey.end_at,
    )
    session.add(db_survey)
    session.commit()
    session.refresh(db_survey)
    return db_survey


@router.put("/update/{survey_id}", response_model=CourseSurvey)
def update_survey(survey_id: int, survey_data: SurveyUpdate, session: Session = Depends(get_session)):
    survey = session.get(CourseSurvey, survey_id)
    if not survey:
        raise HTTPException(status_code=404, detail="Không tìm thấy khảo sát")
    for key, value in survey_data.model_dump(exclude_unset=True).items():
        setattr(survey, key, value)
    survey.updated_at = datetime.now(timezone.utc)
    session.commit()
    session.refresh(survey)
    return survey


@router.delete("/delete/{survey_id}", response_model=dict)
def delete_survey(survey_id: int, session: Session = Depends(get_session)):
    survey = session.get(CourseSurvey, survey_id)
    if not survey:
        raise HTTPException(status_code=404, detail="Không tìm thấy khảo sát")

    session.exec(
        delete(CourseSurveyResponse).where(
        CourseSurveyResponse.survey_id == survey_id
        )
    )

    session.exec(
        delete(CourseSurveyQuestion).where(
            CourseSurveyQuestion.survey_id == survey_id
        )
    )

    session.delete(survey)
    session.commit()
    return {"message": "Xóa khảo sát thành công"}


# ─── Questions & Responses ────────────────────────────────

@router.post("/response/submit", response_model=dict)
def submit_response(payload: ResponseSubmit, session: Session = Depends(get_session)):
    now = datetime.now(timezone.utc)

    for answer in payload.answers:
        existing = session.exec(
            select(CourseSurveyResponse)
            .where(
                CourseSurveyResponse.survey_id == payload.survey_id,
                CourseSurveyResponse.user_id == payload.user_id,
                CourseSurveyResponse.question_id == answer.question_id,
            )
        ).first()

        if existing:
            existing.answer = answer.answer
            existing.submitted_at = now
        else:
            response = CourseSurveyResponse(
                survey_id=payload.survey_id,
                question_id=answer.question_id,
                user_id=payload.user_id,
                answer=answer.answer,
            )
            session.add(response)

    session.commit()
    return {"message": "Đã ghi nhận câu trả lời khảo sát"}


@router.get("/response/check/{survey_id}/{user_id}", response_model=dict)
def check_user_response(survey_id: int, user_id: int, session: Session = Depends(get_session)):
    existing = session.exec(
        select(CourseSurveyResponse)
        .where(
            CourseSurveyResponse.survey_id == survey_id,
            CourseSurveyResponse.user_id == user_id,
        )
    ).first()
    return {"responded": existing is not None}


@router.get("/response/results/{survey_id}", response_model=List[SurveyResultStats])
def get_survey_results(survey_id: int, session: Session = Depends(get_session)):
    questions = session.exec(
        select(CourseSurveyQuestion)
        .where(CourseSurveyQuestion.survey_id == survey_id)
        .order_by(CourseSurveyQuestion.sequence)
    ).all()

    results: list[SurveyResultStats] = []
    for question in questions:
        responses = session.exec(
            select(CourseSurveyResponse).where(
                CourseSurveyResponse.question_id == question.id
            )
        ).all()

        total = len(responses)

        if question.question_type == "text":
            text_answers = [r.answer for r in responses if r.answer.strip()]
            results.append(
                SurveyResultStats(
                    question_id=question.id,
                    question_text=question.question_text,
                    question_type=question.question_type,
                    options=question.options,
                    total_responses=total,
                    text_answers=text_answers,
                    choice_counts={},
                    rating_avg=0,
                    rating_count=0,
                )
            )
        elif question.question_type == "rating":
            scores = []
            for r in responses:
                try:
                    scores.append(float(r.answer))
                except (ValueError, TypeError):
                    pass
            avg = sum(scores) / len(scores) if scores else 0
            results.append(
                SurveyResultStats(
                    question_id=question.id,
                    question_text=question.question_text,
                    question_type=question.question_type,
                    options=question.options,
                    total_responses=total,
                    text_answers=[],
                    choice_counts={},
                    rating_avg=avg,
                    rating_count=len(scores),
                )
            )
        else:  # multiple_choice, checkbox
            counts: dict[str, int] = {}
            for r in responses:
                for choice in r.answer.split("||"):
                    choice = choice.strip()
                    if choice:
                        counts[choice] = counts.get(choice, 0) + 1
            results.append(
                SurveyResultStats(
                    question_id=question.id,
                    question_text=question.question_text,
                    question_type=question.question_type,
                    options=question.options,
                    total_responses=total,
                    text_answers=[],
                    choice_counts=counts,
                    rating_avg=0,
                    rating_count=0,
                )
            )

    return results


# ─── Questions ────────────────────────────────────────────

@router.get("/{survey_id}/questions", response_model=List[CourseSurveyQuestion])
def get_questions(survey_id: int, session: Session = Depends(get_session)):
    return session.exec(
        select(CourseSurveyQuestion)
        .where(CourseSurveyQuestion.survey_id == survey_id)
        .order_by(CourseSurveyQuestion.sequence)
    ).all()


@router.post("/question/create", response_model=CourseSurveyQuestion)
def create_question(question: QuestionCreate, session: Session = Depends(get_session)):
    db_question = CourseSurveyQuestion(
        survey_id=question.survey_id,
        question_text=question.question_text,
        question_type=question.question_type,
        options=question.options,
        sequence=question.sequence,
        is_required=question.is_required,
    )
    session.add(db_question)
    session.commit()
    session.refresh(db_question)
    return db_question


@router.put("/question/update/{question_id}", response_model=CourseSurveyQuestion)
def update_question(question_id: int, question_data: QuestionUpdate, session: Session = Depends(get_session)):
    question = session.get(CourseSurveyQuestion, question_id)
    if not question:
        raise HTTPException(status_code=404, detail="Không tìm thấy câu hỏi")
    for key, value in question_data.model_dump(exclude_unset=True).items():
        setattr(question, key, value)
    session.commit()
    session.refresh(question)
    return question


@router.delete("/question/delete/{question_id}", response_model=dict)
def delete_question(question_id: int, session: Session = Depends(get_session)):
    question = session.get(CourseSurveyQuestion, question_id)
    if not question:
        raise HTTPException(status_code=404, detail="Không tìm thấy câu hỏi")
    session.exec(
        delete(CourseSurveyResponse).where(CourseSurveyResponse.question_id == question_id)
    )
    session.delete(question)
    session.commit()
    return {"message": "Xóa câu hỏi thành công"}


# ─── Notifications ────────────────────────────────────────

@router.post("/{survey_id}/notify-students", response_model=dict)
def notify_survey_to_students(
    survey_id: int,
    session: Session = Depends(get_session),
):
    """Gửi thông báo push đến tất cả sinh viên về khảo sát công khai mới."""
    survey = session.get(CourseSurvey, survey_id)
    if not survey:
        raise HTTPException(status_code=404, detail="Không tìm thấy khảo sát")
    if not survey.is_public:
        raise HTTPException(status_code=400, detail="Chỉ khảo sát công khai mới có thể gửi thông báo")

    from routers.notification import notify_all_students

    notifications = notify_all_students(
        session=session,
        type="new_survey",
        title="Khảo sát mới đang chờ bạn",
        message=f"Khảo sát '{survey.title}' vừa được công bố. Hãy tham gia đóng góp ý kiến!",
        reference_id=survey.id,
        reference_type="survey",
    )

    return {
        "message": f"Đã gửi thông báo đến {len(notifications)} sinh viên",
        "sent_count": len(notifications),
    }

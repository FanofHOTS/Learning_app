import json
import math
import time
from datetime import datetime, timedelta, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, select

from database.engine import create_db_engine
from models.exam import Exam
from models.exam_answer import ExamAnswer
from models.exam_attempt import ExamAttempt
from models.exam_result import ExamResult
from models.question import Question
from models.user import User
from routers.exam_result import (
    AnswerItem,
    _build_options_lookup,
    _build_question_lookup,
    _calculate_bloom_breakdown,
    _calculate_difficulty_breakdown,
    _resolve_answer_correctness,
)
from services.exam_attempt_cleanup import (
    purge_stale_exam_attempts,
    retention_days_from_env,
)

router = APIRouter(prefix="/exam_attempt", tags=["exam_attempt"])

STATUS_IN_PROGRESS = "in_progress"
STATUS_SUBMITTED = "submitted"

# Dọn lượt bỏ dở tối đa mỗi giờ một lần khi có người bắt đầu làm bài.
CLEANUP_INTERVAL_SECONDS = 60 * 60
_LAST_CLEANUP_AT = 0.0


def get_session():
    with Session(create_db_engine()) as session:
        yield session


# ── Pydantic models ──────────────────────────────────────


class AttemptStartPayload(BaseModel):
    user_id: int
    exam_id: int
    question_ids: List[int] = []


class AttemptSavePayload(BaseModel):
    """Câu trả lời hiện tại của sinh viên (lưu tạm hoặc nộp bài)."""

    answers: List[AnswerItem] = []


class ExamResultRead(BaseModel):
    id: int
    user_id: int
    exam_id: int
    score: float
    max_score: int
    total_questions: int
    correct_answers: int
    is_passed: bool
    submitted_at: Optional[datetime] = None
    bloom_breakdown: Optional[str] = None
    difficulty_breakdown: Optional[str] = None


class ExamAttemptRead(BaseModel):
    id: int
    user_id: int
    exam_id: int
    status: str
    question_ids: List[int]
    answers: List[AnswerItem]
    version: int
    started_at: datetime
    deadline_at: Optional[datetime] = None
    remaining_seconds: Optional[int] = None
    last_saved_at: Optional[datetime] = None
    submitted_at: Optional[datetime] = None
    result: Optional[ExamResultRead] = None


# ── Thời gian ────────────────────────────────────────────


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _as_utc(value: Optional[datetime]) -> Optional[datetime]:
    """SQLite trả về datetime không kèm timezone; gắn UTC để so sánh an toàn."""
    if value is None:
        return None
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


def _remaining_seconds(deadline: Optional[datetime]) -> Optional[int]:
    deadline_at = _as_utc(deadline)
    if deadline_at is None:
        return None
    return max(0, math.ceil((deadline_at - _utcnow()).total_seconds()))


def _is_expired(attempt: ExamAttempt) -> bool:
    return _remaining_seconds(attempt.deadline_at) == 0


# ── Đọc/ghi JSON câu trả lời ─────────────────────────────


def _decode_question_ids(raw: Optional[str]) -> list[int]:
    if not raw:
        return []
    try:
        parsed = json.loads(raw)
    except (TypeError, ValueError):
        return []
    if not isinstance(parsed, list):
        return []

    ids: list[int] = []
    for value in parsed:
        try:
            question_id = int(value)
        except (TypeError, ValueError):
            continue
        if question_id not in ids:
            ids.append(question_id)
    return ids


def _decode_answers(raw: Optional[str]) -> list[AnswerItem]:
    """Đọc câu trả lời đã lưu tạm; bỏ qua dữ liệu hỏng thay vì làm sập endpoint."""
    if not raw:
        return []
    try:
        parsed = json.loads(raw)
    except (TypeError, ValueError):
        return []
    if not isinstance(parsed, list):
        return []

    answers: list[AnswerItem] = []
    for entry in parsed:
        if not isinstance(entry, dict):
            continue
        try:
            question_id = int(entry.get("question_id"))
        except (TypeError, ValueError):
            continue

        option_ids: list[int] = []
        raw_option_ids = entry.get("option_ids")
        if isinstance(raw_option_ids, list):
            for value in raw_option_ids:
                try:
                    option_ids.append(int(value))
                except (TypeError, ValueError):
                    continue

        answer_text = entry.get("answer_text")
        answers.append(
            AnswerItem(
                question_id=question_id,
                is_correct=bool(entry.get("is_correct")),
                answer_text=answer_text if isinstance(answer_text, str) else None,
                option_ids=option_ids,
            )
        )
    return answers


def _encode_answers(answers: list[AnswerItem]) -> str:
    return json.dumps(
        [answer.model_dump() for answer in answers],
        ensure_ascii=False,
    )


# ── Truy vấn ─────────────────────────────────────────────


def _result_for_attempt(
    session: Session,
    attempt_id: Optional[int],
) -> Optional[ExamResult]:
    if attempt_id is None:
        return None
    return session.exec(
        select(ExamResult).where(ExamResult.attempt_id == attempt_id)
    ).first()


def _result_read(result: Optional[ExamResult]) -> Optional[ExamResultRead]:
    if result is None or result.id is None:
        return None
    return ExamResultRead(
        id=result.id,
        user_id=result.user_id,
        exam_id=result.exam_id,
        score=result.score,
        max_score=result.max_score,
        total_questions=result.total_questions,
        correct_answers=result.correct_answers,
        is_passed=result.is_passed,
        submitted_at=result.submitted_at,
        bloom_breakdown=result.bloom_breakdown,
        difficulty_breakdown=result.difficulty_breakdown,
    )


def _attempt_read(session: Session, attempt: ExamAttempt) -> ExamAttemptRead:
    is_submitted = attempt.status == STATUS_SUBMITTED
    return ExamAttemptRead(
        id=int(attempt.id or 0),
        user_id=attempt.user_id,
        exam_id=attempt.exam_id,
        status=attempt.status,
        question_ids=_decode_question_ids(attempt.question_ids),
        answers=_decode_answers(attempt.answers),
        version=attempt.version or 0,
        started_at=attempt.started_at,
        deadline_at=attempt.deadline_at,
        remaining_seconds=0 if is_submitted else _remaining_seconds(attempt.deadline_at),
        last_saved_at=attempt.last_saved_at,
        submitted_at=attempt.submitted_at,
        result=_result_read(_result_for_attempt(session, attempt.id)),
    )


def _select_question_ids(
    session: Session,
    exam: Exam,
    requested: List[int],
) -> list[int]:
    """Giữ đúng bộ câu hỏi client đã chọn cho lượt làm bài này.

    Chỉ nhận các câu thật sự thuộc bài kiểm tra. Nếu client không gửi (hoặc gửi
    toàn id không hợp lệ), máy chủ tự chọn theo thứ tự câu hỏi của bài.
    """
    questions = session.exec(
        select(Question).where(Question.exam_id == exam.id)
    ).all()
    valid_ids = {int(question.id) for question in questions if question.id is not None}

    selected: list[int] = []
    for question_id in requested:
        if question_id in valid_ids and question_id not in selected:
            selected.append(question_id)

    if selected:
        return selected

    ordered = sorted(
        (question for question in questions if question.id is not None),
        key=lambda question: (question.sequence or 0, question.id or 0),
    )
    fallback = [int(question.id) for question in ordered]
    limit = exam.total_questions or 0
    if limit > 0:
        fallback = fallback[:limit]
    return fallback


# ── Nộp bài (idempotent) ─────────────────────────────────


def _finalize_attempt(
    session: Session,
    attempt: ExamAttempt,
    answers: Optional[list[AnswerItem]] = None,
) -> Optional[ExamResult]:
    """Chấm và ghi kết quả cho một lượt làm bài, chỉ ghi đúng một lần.

    Nếu lượt này đã có kết quả (nộp lặp, hai tab, hoặc máy chủ tự nộp khi hết
    giờ) thì trả lại kết quả cũ thay vì tạo bản ghi mới hay ghi đè.
    """
    existing = _result_for_attempt(session, attempt.id)
    if existing is not None:
        if attempt.status != STATUS_SUBMITTED:
            attempt.status = STATUS_SUBMITTED
            attempt.submitted_at = attempt.submitted_at or existing.submitted_at or _utcnow()
            session.add(attempt)
            session.commit()
            session.refresh(attempt)
        return existing

    exam = session.get(Exam, attempt.exam_id)
    if exam is None:
        raise HTTPException(status_code=404, detail="Không tìm thấy bài thi")

    graded_answers = answers if answers else _decode_answers(attempt.answers)
    questions = _build_question_lookup(session, graded_answers)
    options_by_question = _build_options_lookup(session, graded_answers)

    total_score = 0
    correct_count = 0
    max_score = 0
    for answer in graded_answers:
        question = questions.get(answer.question_id)
        if question is None:
            continue

        # Máy chủ tự chấm từ câu trả lời thật, không tin `is_correct` của client.
        answer.is_correct = _resolve_answer_correctness(
            question=question,
            options=options_by_question.get(question.id, []),
            item=answer,
        )
        max_score += question.score
        if answer.is_correct:
            total_score += question.score
            correct_count += 1

    total_questions = len(graded_answers) or len(
        _decode_question_ids(attempt.question_ids)
    )
    submitted_at = _utcnow()
    result = ExamResult(
        attempt_id=attempt.id,
        user_id=attempt.user_id,
        exam_id=attempt.exam_id,
        score=float(total_score),
        max_score=max_score,
        total_questions=total_questions,
        correct_answers=correct_count,
        is_passed=total_score >= (exam.pass_score or 0),
        submitted_at=submitted_at,
        bloom_breakdown=_calculate_bloom_breakdown(
            session=session,
            answers=graded_answers,
        ),
        difficulty_breakdown=_calculate_difficulty_breakdown(
            session=session,
            answers=graded_answers,
        ),
    )

    attempt.answers = _encode_answers(graded_answers)
    attempt.status = STATUS_SUBMITTED
    attempt.submitted_at = submitted_at
    attempt.last_saved_at = submitted_at

    session.add(result)
    session.add(attempt)
    try:
        session.flush()
        result_id = result.id
        stored_answers = [
            ExamAnswer(
                exam_result_id=result_id,
                question_id=answer.question_id,
                answer_text=answer.answer_text,
                option_ids=(
                    json.dumps(answer.option_ids) if answer.option_ids else None
                ),
                is_correct=answer.is_correct,
            )
            for answer in graded_answers
            if answer.question_id in questions
        ]
        if stored_answers:
            session.add_all(stored_answers)
        session.commit()
    except IntegrityError:
        # Một request khác đã nộp lượt này trước (unique exam_result.attempt_id).
        session.rollback()
        concurrent = _result_for_attempt(session, attempt.id)
        refreshed = session.get(ExamAttempt, attempt.id)
        if refreshed is not None:
            refreshed.status = STATUS_SUBMITTED
            if refreshed.submitted_at is None:
                refreshed.submitted_at = (
                    concurrent.submitted_at if concurrent is not None else submitted_at
                )
            session.add(refreshed)
            session.commit()
        return concurrent

    session.refresh(result)
    return result


# ── Endpoints ────────────────────────────────────────────


class ExamAttemptCleanupRead(BaseModel):
    deleted: int
    retention_days: int
    cutoff: str


def _maybe_purge_stale_attempts(session: Session) -> None:
    """Dọn lượt bỏ dở tối đa mỗi giờ một lần; lỗi dọn không làm hỏng request."""
    global _LAST_CLEANUP_AT

    now = time.monotonic()
    if now - _LAST_CLEANUP_AT < CLEANUP_INTERVAL_SECONDS:
        return
    _LAST_CLEANUP_AT = now

    try:
        purge_stale_exam_attempts(session, retention_days_from_env())
    except Exception:
        session.rollback()


@router.post("/cleanup", response_model=ExamAttemptCleanupRead)
def cleanup_stale_attempts(
    retention_days: Optional[int] = None,
    session: Session = Depends(get_session),
):
    """Dọn ngay các lượt làm bài bỏ dở đã quá hạn lâu ngày."""
    if retention_days is not None and not 1 <= retention_days <= 365:
        raise HTTPException(
            status_code=400,
            detail="Số ngày giữ lại phải trong khoảng 1-365.",
        )

    return ExamAttemptCleanupRead(
        **purge_stale_exam_attempts(session, retention_days)
    )


@router.post("/start", response_model=ExamAttemptRead)
def start_attempt(
    payload: AttemptStartPayload,
    session: Session = Depends(get_session),
):
    """Bắt đầu hoặc khôi phục lượt làm bài của sinh viên.

    - Chưa có lượt nào đang làm: tạo lượt mới, máy chủ ghi `started_at` và hạn nộp.
    - Đang có lượt trong hạn: trả lại đúng lượt đó (câu hỏi, câu trả lời, hạn nộp)
      để tải lại trang không làm mất bài và không đặt lại đồng hồ.
    - Lượt đã quá hạn: máy chủ tự nộp từ câu trả lời đã lưu và trả về kết quả.
    """
    _maybe_purge_stale_attempts(session)

    if session.get(User, payload.user_id) is None:
        raise HTTPException(status_code=404, detail="Không tìm thấy người dùng")

    exam = session.get(Exam, payload.exam_id)
    if exam is None:
        raise HTTPException(status_code=404, detail="Không tìm thấy bài thi")

    active = session.exec(
        select(ExamAttempt)
        .where(
            ExamAttempt.user_id == payload.user_id,
            ExamAttempt.exam_id == payload.exam_id,
            ExamAttempt.status == STATUS_IN_PROGRESS,
        )
        .order_by(ExamAttempt.id.desc())
    ).first()

    if active is not None:
        if _is_expired(active):
            _finalize_attempt(session, active)
            refreshed = session.get(ExamAttempt, active.id)
            if refreshed is not None:
                return _attempt_read(session, refreshed)
        return _attempt_read(session, active)

    started_at = _utcnow()
    duration_minutes = exam.duration_minutes or 0
    deadline_at = (
        started_at + timedelta(minutes=duration_minutes)
        if duration_minutes > 0
        else None
    )

    attempt = ExamAttempt(
        user_id=payload.user_id,
        exam_id=payload.exam_id,
        status=STATUS_IN_PROGRESS,
        question_ids=json.dumps(
            _select_question_ids(session, exam, payload.question_ids)
        ),
        answers="[]",
        version=0,
        started_at=started_at,
        deadline_at=deadline_at,
    )
    session.add(attempt)
    session.commit()
    session.refresh(attempt)
    return _attempt_read(session, attempt)


@router.put("/{attempt_id}/autosave", response_model=ExamAttemptRead)
def autosave_attempt(
    attempt_id: int,
    payload: AttemptSavePayload,
    session: Session = Depends(get_session),
):
    """Lưu tạm câu trả lời lên máy chủ.

    Bài đã nộp thì không ghi đè (trả lại nguyên trạng). Bài đã quá hạn thì máy
    chủ chốt sổ bằng câu trả lời mới nhất và trả về kết quả trong `result`.
    """
    attempt = session.get(ExamAttempt, attempt_id)
    if attempt is None:
        raise HTTPException(status_code=404, detail="Không tìm thấy lượt làm bài")

    if attempt.status == STATUS_SUBMITTED:
        return _attempt_read(session, attempt)

    if _is_expired(attempt):
        _finalize_attempt(session, attempt, payload.answers)
        refreshed = session.get(ExamAttempt, attempt_id)
        if refreshed is not None:
            attempt = refreshed
        return _attempt_read(session, attempt)

    if payload.answers:
        attempt.answers = _encode_answers(payload.answers)
    attempt.version = (attempt.version or 0) + 1
    attempt.last_saved_at = _utcnow()
    session.add(attempt)
    session.commit()
    session.refresh(attempt)
    return _attempt_read(session, attempt)


@router.post("/{attempt_id}/submit", response_model=ExamAttemptRead)
def submit_attempt(
    attempt_id: int,
    payload: AttemptSavePayload,
    session: Session = Depends(get_session),
):
    """Nộp bài; gọi lặp lại chỉ trả về kết quả đã có, không tạo bản ghi mới."""
    attempt = session.get(ExamAttempt, attempt_id)
    if attempt is None:
        raise HTTPException(status_code=404, detail="Không tìm thấy lượt làm bài")

    if attempt.status != STATUS_SUBMITTED:
        _finalize_attempt(session, attempt, payload.answers)
        refreshed = session.get(ExamAttempt, attempt_id)
        if refreshed is not None:
            attempt = refreshed

    return _attempt_read(session, attempt)

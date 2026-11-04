import json
from collections import Counter
from datetime import datetime, timezone
from database.engine import create_db_engine
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict
from sqlmodel import Session, func, select, Field, SQLModel

from models.exam import Exam
from models.question import Question

router = APIRouter(prefix="/exam", tags=["exam"])

VALID_DISTRIBUTION_MODES = {"none", "bloom", "topic"}
BLOOM_LEVELS = {
    "remember",
    "understand",
    "apply",
    "analyze",
    "evaluate",
    "create",
}
BLOOM_LEVEL_ORDER = [
    "remember",
    "understand",
    "apply",
    "analyze",
    "evaluate",
    "create",
]


def get_session():
    with Session(create_db_engine()) as session:
        yield session


class ExamUpdate(SQLModel):
    title: Optional[str] = None
    description: Optional[str] = None
    module_id: Optional[int] = None
    course_id: Optional[int] = None
    duration_minutes: Optional[int] = None
    total_questions: Optional[int] = None
    is_active: Optional[bool] = None
    pass_score: Optional[int] = None
    max_score: Optional[int] = None
    question_distribution_mode: Optional[str] = None
    question_distribution: Optional[str] = None


class ExamResponse(BaseModel):
    id: int
    title: str
    description: Optional[str]
    module_id: Optional[int]
    course_id: Optional[int]
    duration_minutes: int
    total_questions: int
    is_active: bool
    pass_score: int
    max_score: int
    question_distribution_mode: str
    question_distribution: Optional[str]
    created_at: datetime
    updated_at: datetime
    actual_question_count: int

    model_config = ConfigDict(from_attributes=True)


def _normalize_distribution(mode: Optional[str], raw: Optional[str]) -> tuple[str, Optional[str]]:
    """Chuẩn hóa cách chia cấu trúc câu hỏi của bài kiểm tra.

    Trả về (mode, JSON đã chuẩn hóa). `mode = "none"` luôn đi với JSON rỗng.
    Danh sách dùng dạng [{"key": ..., "weight": ...}]; với chế độ bloom, key
    phải là một mức độ nhận thức hợp lệ, với chế độ topic, key là chủ đề/từ khóa.
    """
    normalized_mode = (mode or "none").strip().lower()
    if normalized_mode not in VALID_DISTRIBUTION_MODES:
        raise HTTPException(
            status_code=400,
            detail=(
                "Cách chia cấu trúc câu hỏi không hợp lệ. Chỉ hỗ trợ: "
                + ", ".join(sorted(VALID_DISTRIBUTION_MODES))
                + "."
            ),
        )

    if normalized_mode == "none":
        return "none", None

    if raw is None or not str(raw).strip():
        raise HTTPException(
            status_code=400,
            detail="Vui lòng cấu hình tỷ lệ câu hỏi cho cấu trúc đã chọn.",
        )

    try:
        parsed = json.loads(raw)
    except (TypeError, ValueError) as exc:
        raise HTTPException(
            status_code=400,
            detail="Cấu hình tỷ lệ câu hỏi không phải JSON hợp lệ.",
        ) from exc

    if not isinstance(parsed, list) or not parsed:
        raise HTTPException(
            status_code=400,
            detail="Cấu hình tỷ lệ câu hỏi phải là danh sách không rỗng.",
        )

    items: list[dict] = []
    seen_keys: set[str] = set()
    for entry in parsed:
        if not isinstance(entry, dict):
            raise HTTPException(
                status_code=400,
                detail="Mỗi dòng cấu hình tỷ lệ phải có dạng {key, weight}.",
            )

        key = " ".join(str(entry.get("key") or "").split()).strip()
        if normalized_mode == "bloom":
            key = key.lower()
            if key not in BLOOM_LEVELS:
                raise HTTPException(
                    status_code=400,
                    detail=f"Mức độ nhận thức không hợp lệ: {key or '(trống)'}.",
                )
        elif not key:
            raise HTTPException(
                status_code=400,
                detail="Chủ đề/từ khóa trong cấu trúc câu hỏi không được để trống.",
            )

        weight = entry.get("weight")
        if (
            isinstance(weight, bool)
            or not isinstance(weight, (int, float))
            or weight < 0
        ):
            raise HTTPException(
                status_code=400,
                detail="Tỷ lệ câu hỏi phải là số không âm.",
            )

        dedupe_key = key.casefold()
        if dedupe_key in seen_keys:
            raise HTTPException(
                status_code=400,
                detail=(
                    "Một mức độ nhận thức/chủ đề không được xuất hiện nhiều lần "
                    "trong cấu trúc câu hỏi."
                ),
            )
        seen_keys.add(dedupe_key)
        items.append({"key": key, "weight": float(weight)})

    if sum(item["weight"] for item in items) <= 0:
        raise HTTPException(
            status_code=400,
            detail="Tổng tỷ lệ câu hỏi phải lớn hơn 0.",
        )

    if normalized_mode == "bloom":
        order = {level: index for index, level in enumerate(BLOOM_LEVEL_ORDER)}
        items.sort(key=lambda item: order.get(item["key"], len(order)))

    return normalized_mode, json.dumps(items, ensure_ascii=False)


def _exam_response(exam: Exam, session: Session) -> ExamResponse:
    actual_question_count = session.exec(
        select(func.count(Question.id)).where(Question.exam_id == exam.id)
    ).one()
    return ExamResponse(
        **Exam.model_validate(exam).model_dump(),
        actual_question_count=actual_question_count,
    )


# Lấy danh sách bài thi
@router.get("/", response_model=List[ExamResponse])
def get_all_exams(session: Session = Depends(get_session)):
    exams = session.exec(select(Exam)).all()
    return [_exam_response(exam, session) for exam in exams]

# Lấy danh sách bài thi dựa trên id khóa học
@router.get("/course/{course_id}", response_model=List[ExamResponse])
def get_exams_by_course(course_id: int, session: Session = Depends(get_session)):
    exams = session.exec(select(Exam).where(Exam.course_id == course_id)).all()
    if not exams:
        raise HTTPException(status_code=404, detail="Không tìm thấy bài thi cho khóa học này")
    return [_exam_response(exam, session) for exam in exams]

# Lấy danh sách bài thi dựa trên id module khóa học
@router.get("/module/{module_id}", response_model=List[ExamResponse])
def get_exams_by_module(module_id: int, session: Session = Depends(get_session)):
    exams = session.exec(select(Exam).where(Exam.module_id == module_id)).all()
    if not exams:
        raise HTTPException(status_code=404, detail="Không tìm thấy bài thi cho module này")
    return [_exam_response(exam, session) for exam in exams]

# Lấy bài thi theo id
@router.get("/{exam_id}", response_model=ExamResponse)
def get_exam(exam_id: int, session: Session = Depends(get_session)):
    exam = session.get(Exam, exam_id)
    if not exam:
        raise HTTPException(status_code=404, detail="Không tìm thấy bài thi")
    return _exam_response(exam, session)

# Tạo bài thi mới
@router.post("/create", response_model=ExamResponse)
def create_exam(exam: Exam, session: Session = Depends(get_session)):
    exam.question_distribution_mode, exam.question_distribution = _normalize_distribution(
        exam.question_distribution_mode,
        exam.question_distribution,
    )
    session.add(exam)
    session.commit()
    session.refresh(exam)
    return _exam_response(exam, session)

# Chỉnh sửa bài thi
@router.put("/update/{exam_id}", response_model=ExamResponse)
def update_exam(exam_id: int, exam_data: ExamUpdate, session: Session = Depends(get_session)):
    exam = session.get(Exam, exam_id)
    if not exam:
        raise HTTPException(status_code=404, detail="Không tìm thấy bài thi")

    changes = exam_data.model_dump(exclude_unset=True)
    if "question_distribution_mode" in changes or "question_distribution" in changes:
        mode, distribution = _normalize_distribution(
            changes.get("question_distribution_mode", exam.question_distribution_mode),
            changes.get("question_distribution", exam.question_distribution),
        )
        changes["question_distribution_mode"] = mode
        changes["question_distribution"] = distribution

    for key, value in changes.items():
        setattr(exam, key, value)
    exam.updated_at = datetime.now(timezone.utc)
    session.commit()
    session.refresh(exam)
    return _exam_response(exam, session)

# ── Bloom distribution ──────────────────────────────────


class BloomDistributionItem(BaseModel):
    level: str
    count: int
    percentage: float


class BloomDistributionResponse(BaseModel):
    total: int
    items: list[BloomDistributionItem]


@router.get("/{exam_id}/bloom-distribution", response_model=BloomDistributionResponse)
def get_exam_bloom_distribution(
    exam_id: int,
    session: Session = Depends(get_session),
):
    """Lấy thống kê phân bố mức độ Bloom trong bài kiểm tra."""
    questions = session.exec(
        select(Question).where(Question.exam_id == exam_id)
    ).all()

    if not questions:
        return BloomDistributionResponse(total=0, items=[])

    counts: Counter = Counter()
    for q in questions:
        counts[q.bloom_level or "remember"] += 1

    total = len(questions)
    bloom_order = ["remember", "understand", "apply", "analyze", "evaluate", "create"]

    items = [
        BloomDistributionItem(
            level=level,
            count=counts.get(level, 0),
            percentage=round(counts.get(level, 0) / total * 100, 1),
        )
        for level in bloom_order
        if level in counts
    ]

    return BloomDistributionResponse(total=total, items=items)


class TopicDistributionItem(BaseModel):
    topic: str
    count: int
    percentage: float


class TopicDistributionResponse(BaseModel):
    total: int
    untagged: int
    items: list[TopicDistributionItem]


@router.get("/{exam_id}/topic-distribution", response_model=TopicDistributionResponse)
def get_exam_topic_distribution(
    exam_id: int,
    session: Session = Depends(get_session),
):
    """Thống kê chủ đề/từ khóa của các câu hỏi trong bài kiểm tra."""
    questions = session.exec(
        select(Question).where(Question.exam_id == exam_id)
    ).all()

    counts: Counter = Counter()
    display_names: dict[str, str] = {}
    untagged = 0

    for question in questions:
        topic = " ".join((question.topic or "").split()).strip()
        if not topic:
            untagged += 1
            continue
        key = topic.casefold()
        counts[key] += 1
        display_names.setdefault(key, topic)

    total = len(questions)
    items = [
        TopicDistributionItem(
            topic=display_names[key],
            count=count,
            percentage=round(count / total * 100, 1) if total else 0.0,
        )
        for key, count in sorted(
            counts.items(),
            key=lambda entry: (-entry[1], display_names[entry[0]].casefold()),
        )
    ]

    return TopicDistributionResponse(total=total, untagged=untagged, items=items)


@router.get("/bloom-distribution/instructor/{instructor_id}", response_model=BloomDistributionResponse)
def get_instructor_bloom_distribution(
    instructor_id: int,
    session: Session = Depends(get_session),
):
    """Lấy thống kê phân bố mức độ Bloom tổng hợp cho giảng viên."""
    from models.course import Course

    # Lấy tất cả khóa học của giảng viên
    courses = session.exec(
        select(Course).where(Course.instructor_id == instructor_id)
    ).all()

    if not courses:
        return BloomDistributionResponse(total=0, items=[])

    course_ids = [c.id for c in courses]

    # Lấy tất cả bài thi thuộc các khóa học này
    exams = session.exec(
        select(Exam).where(Exam.course_id.in_(course_ids))
    ).all()

    if not exams:
        return BloomDistributionResponse(total=0, items=[])

    exam_ids = [e.id for e in exams]

    # Lấy tất cả câu hỏi thuộc các bài thi này
    questions = session.exec(
        select(Question).where(Question.exam_id.in_(exam_ids))
    ).all()

    if not questions:
        return BloomDistributionResponse(total=0, items=[])

    counts: Counter = Counter()
    for q in questions:
        counts[q.bloom_level or "remember"] += 1

    total = len(questions)
    bloom_order = ["remember", "understand", "apply", "analyze", "evaluate", "create"]

    items = [
        BloomDistributionItem(
            level=level,
            count=counts.get(level, 0),
            percentage=round(counts.get(level, 0) / total * 100, 1),
        )
        for level in bloom_order
        if level in counts
    ]

    return BloomDistributionResponse(total=total, items=items)


# ── Difficulty distribution ────────────────────────────


@router.get("/{exam_id}/difficulty-distribution", response_model=BloomDistributionResponse)
def get_exam_difficulty_distribution(
    exam_id: int,
    session: Session = Depends(get_session),
):
    """Lấy thống kê phân bố mức độ khó trong bài kiểm tra."""
    questions = session.exec(
        select(Question).where(Question.exam_id == exam_id)
    ).all()

    if not questions:
        return BloomDistributionResponse(total=0, items=[])

    counts: Counter = Counter()
    for q in questions:
        counts[q.difficulty or "medium"] += 1

    total = len(questions)
    difficulty_order = ["easy", "medium", "hard"]

    items = [
        BloomDistributionItem(
            level=level,
            count=counts.get(level, 0),
            percentage=round(counts.get(level, 0) / total * 100, 1),
        )
        for level in difficulty_order
        if level in counts
    ]

    return BloomDistributionResponse(total=total, items=items)


@router.get("/difficulty-distribution/instructor/{instructor_id}", response_model=BloomDistributionResponse)
def get_instructor_difficulty_distribution(
    instructor_id: int,
    session: Session = Depends(get_session),
):
    """Lấy thống kê phân bố mức độ khó tổng hợp cho giảng viên."""
    from models.course import Course

    courses = session.exec(
        select(Course).where(Course.instructor_id == instructor_id)
    ).all()

    if not courses:
        return BloomDistributionResponse(total=0, items=[])

    course_ids = [c.id for c in courses]

    exams = session.exec(
        select(Exam).where(Exam.course_id.in_(course_ids))
    ).all()

    if not exams:
        return BloomDistributionResponse(total=0, items=[])

    exam_ids = [e.id for e in exams]

    questions = session.exec(
        select(Question).where(Question.exam_id.in_(exam_ids))
    ).all()

    if not questions:
        return BloomDistributionResponse(total=0, items=[])

    counts: Counter = Counter()
    for q in questions:
        counts[q.difficulty or "medium"] += 1

    total = len(questions)
    difficulty_order = ["easy", "medium", "hard"]

    items = [
        BloomDistributionItem(
            level=level,
            count=counts.get(level, 0),
            percentage=round(counts.get(level, 0) / total * 100, 1),
        )
        for level in difficulty_order
        if level in counts
    ]

    return BloomDistributionResponse(total=total, items=items)


# Xóa bài thi và các câu hỏi liên quan
@router.delete("/delete/{exam_id}", response_model=dict)
def delete_exam(exam_id: int, session: Session = Depends(get_session)):
    exam = session.get(Exam, exam_id)
    if not exam:
        raise HTTPException(status_code=404, detail="Không tìm thấy bài thi")
    # Kiểm tra xem bài thi có đang được sử dụng trong khóa học nào không, nếu có thì không cho phép xóa
    #if exam.course_id:
    #    raise HTTPException(status_code=400, detail="Không thể xóa bài thi đang được sử dụng trong khóa học")
    #if exam.module_id:
    #    raise HTTPException(status_code=400, detail="Không thể xóa bài thi đang được sử dụng trong module khóa học")
        
    questions = session.exec(select(Question).where(Question.exam_id == exam_id)).all()
    for question in questions:
        from models.option import Option
        options = session.exec(select(Option).where(Option.question_id == question.id)).all()
        for option in options:
            session.delete(option)
        session.delete(question)
    session.delete(exam)
    session.commit()
    return {"message": "Xóa bài thi và các câu hỏi liên quan thành công"}

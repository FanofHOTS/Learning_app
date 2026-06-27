from collections import Counter
from datetime import datetime, timezone
from database.engine import create_db_engine
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, select, Field, SQLModel

from models.exam import Exam
from models.question import Question

router = APIRouter(prefix="/exam", tags=["exam"])


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

# Lấy danh sách bài thi
@router.get("/", response_model=List[Exam])
def get_all_exams(session: Session = Depends(get_session)):
    return session.exec(select(Exam)).all()

# Lấy danh sách bài thi dựa trên id khóa học
@router.get("/course/{course_id}", response_model=List[Exam])
def get_exams_by_course(course_id: int, session: Session = Depends(get_session)):
    exams = session.exec(select(Exam).where(Exam.course_id == course_id)).all()
    if not exams:
        raise HTTPException(status_code=404, detail="Không tìm thấy bài thi cho khóa học này")
    return exams

# Lấy danh sách bài thi dựa trên id module khóa học
@router.get("/module/{module_id}", response_model=List[Exam])
def get_exams_by_module(module_id: int, session: Session = Depends(get_session)):
    exams = session.exec(select(Exam).where(Exam.module_id == module_id)).all()
    if not exams:
        raise HTTPException(status_code=404, detail="Không tìm thấy bài thi cho module này")
    return exams

# Lấy bài thi theo id
@router.get("/{exam_id}", response_model=Exam)
def get_exam(exam_id: int, session: Session = Depends(get_session)):
    exam = session.get(Exam, exam_id)
    if not exam:
        raise HTTPException(status_code=404, detail="Không tìm thấy bài thi")
    return exam

# Tạo bài thi mới
@router.post("/create", response_model=Exam)
def create_exam(exam: Exam, session: Session = Depends(get_session)):
    session.add(exam)
    session.commit()
    session.refresh(exam)
    return exam

# Chỉnh sửa bài thi
@router.put("/update/{exam_id}", response_model=Exam)
def update_exam(exam_id: int, exam_data: ExamUpdate, session: Session = Depends(get_session)):
    exam = session.get(Exam, exam_id)
    if not exam:
        raise HTTPException(status_code=404, detail="Không tìm thấy bài thi")
    for key, value in exam_data.model_dump(exclude_unset=True).items():
        setattr(exam, key, value)
    exam.updated_at = datetime.now(timezone.utc)
    session.commit()
    session.refresh(exam)
    return exam

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
    """Lấy thống kê phân bố cấp độ Bloom trong bài kiểm tra."""
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


@router.get("/bloom-distribution/instructor/{instructor_id}", response_model=BloomDistributionResponse)
def get_instructor_bloom_distribution(
    instructor_id: int,
    session: Session = Depends(get_session),
):
    """Lấy thống kê phân bố cấp độ Bloom tổng hợp cho giảng viên."""
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
    if exam.course_id:
        raise HTTPException(status_code=400, detail="Không thể xóa bài thi đang được sử dụng trong khóa học")
    if exam.module_id:
        raise HTTPException(status_code=400, detail="Không thể xóa bài thi đang được sử dụng trong module khóa học")
        
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

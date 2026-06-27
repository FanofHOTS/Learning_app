import json
from datetime import datetime, timezone
from database.engine import create_db_engine
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, select, Field, SQLModel

from models.exam_result import ExamResult
from models.question import Question

router = APIRouter(prefix="/exam_result", tags=["exam_result"])


def get_session():
    with Session(create_db_engine()) as session:
        yield session


# ── Pydantic request models ──────────────────────────────


class AnswerItem(BaseModel):
    question_id: int
    is_correct: bool


class ExamResultSubmit(BaseModel):
    user_id: int
    exam_id: int
    score: float
    total_questions: int
    correct_answers: int
    is_passed: bool
    answers: list[AnswerItem] = []


# ── Bloom helpers ────────────────────────────────────────


def _calculate_bloom_breakdown(
    session: Session,
    exam_id: int,
    answers: list[AnswerItem],
) -> Optional[str]:
    """
    Tính bloom_breakdown từ danh sách câu trả lời.
    Trả về JSON string: {"remember": {"correct": 2, "total": 3, "score": 66.7}, ...}
    """
    if not answers:
        return None

    # Lấy tất cả câu hỏi của bài thi
    questions = session.exec(
        select(Question).where(Question.exam_id == exam_id)
    ).all()

    if not questions:
        return None

    # Build lookup: question_id -> bloom_level
    bloom_map: dict[int, str] = {}
    for q in questions:
        bloom_map[q.id] = q.bloom_level or "remember"

    # Tổng hợp theo bloom level
    # Build difficulty map: question_id -> difficulty
    difficulty_map: dict[int, str] = {}
    for q in questions:
        difficulty_map[q.id] = q.difficulty or "medium"

    bloom_data: dict[str, dict[str, float | int]] = {}
    for answer in answers:
        level = bloom_map.get(answer.question_id, "remember")
        if level not in bloom_data:
            bloom_data[level] = {"correct": 0, "total": 0}
        bloom_data[level]["total"] = bloom_data[level]["total"] + 1  # type: ignore
        if answer.is_correct:
            bloom_data[level]["correct"] = bloom_data[level]["correct"] + 1  # type: ignore

    # Tính % cho từng cấp độ
    for level in bloom_data:
        total = bloom_data[level]["total"]
        correct = bloom_data[level]["correct"]
        bloom_data[level]["score"] = round(correct / total * 100, 1) if total > 0 else 0.0  # type: ignore

    return json.dumps(bloom_data, ensure_ascii=False)


def _calculate_difficulty_breakdown(
    session: Session,
    exam_id: int,
    answers: list[AnswerItem],
) -> Optional[str]:
    """
    Tính difficulty_breakdown từ danh sách câu trả lời.
    Trả về JSON string: {"easy": {"correct": 2, "total": 3, "score": 66.7}, ...}
    """
    if not answers:
        return None

    questions = session.exec(
        select(Question).where(Question.exam_id == exam_id)
    ).all()

    if not questions:
        return None

    difficulty_map: dict[int, str] = {}
    for q in questions:
        difficulty_map[q.id] = q.difficulty or "medium"

    dif_data: dict[str, dict[str, float | int]] = {}
    for answer in answers:
        level = difficulty_map.get(answer.question_id, "medium")
        if level not in dif_data:
            dif_data[level] = {"correct": 0, "total": 0}
        dif_data[level]["total"] = dif_data[level]["total"] + 1  # type: ignore
        if answer.is_correct:
            dif_data[level]["correct"] = dif_data[level]["correct"] + 1  # type: ignore

    for level in dif_data:
        total = dif_data[level]["total"]
        correct = dif_data[level]["correct"]
        dif_data[level]["score"] = round(correct / total * 100, 1) if total > 0 else 0.0  # type: ignore

    return json.dumps(dif_data, ensure_ascii=False)


# ── Endpoints ────────────────────────────────────────────


# Lấy danh sách tất cả kết quả bài thi
@router.get("/", response_model=List[ExamResult])
def get_all_exam_results(session: Session = Depends(get_session)):
    return session.exec(select(ExamResult)).all()


# Lấy danh sách kết quả bài thi theo id người dùng
@router.get("/user/{user_id}", response_model=List[ExamResult])
def get_results_by_user(user_id: int, session: Session = Depends(get_session)):
    results = session.exec(select(ExamResult).where(ExamResult.user_id == user_id)).all()
    if not results:
        raise HTTPException(status_code=404, detail="Không tìm thấy kết quả bài thi cho người dùng này")
    return results


# Lấy danh sách kết quả bài thi theo id bài thi
@router.get("/exam/{exam_id}", response_model=List[ExamResult])
def get_results_by_exam(exam_id: int, session: Session = Depends(get_session)):
    results = session.exec(select(ExamResult).where(ExamResult.exam_id == exam_id)).all()
    if not results:
        raise HTTPException(status_code=404, detail="Không tìm thấy kết quả bài thi cho bài thi này")
    return results


# Lấy kết quả bài thi theo id
@router.get("/{result_id}", response_model=ExamResult)
def get_exam_result(result_id: int, session: Session = Depends(get_session)):
    result = session.get(ExamResult, result_id)
    if not result:
        raise HTTPException(status_code=404, detail="Không tìm thấy kết quả bài thi")
    return result


# Nộp bài thi (tạo kết quả bài thi mới) — hỗ trợ bloom_breakdown
@router.post("/submit", response_model=ExamResult)
def submit_exam_result(payload: ExamResultSubmit, session: Session = Depends(get_session)):
    # Tính bloom_breakdown và difficulty_breakdown nếu có answers
    bloom_breakdown = _calculate_bloom_breakdown(
        session=session,
        exam_id=payload.exam_id,
        answers=payload.answers,
    )
    difficulty_breakdown = _calculate_difficulty_breakdown(
        session=session,
        exam_id=payload.exam_id,
        answers=payload.answers,
    )

    result = ExamResult(
        user_id=payload.user_id,
        exam_id=payload.exam_id,
        score=payload.score,
        total_questions=payload.total_questions,
        correct_answers=payload.correct_answers,
        is_passed=payload.is_passed,
        bloom_breakdown=bloom_breakdown,
        difficulty_breakdown=difficulty_breakdown,
    )
    session.add(result)
    session.commit()
    session.refresh(result)
    return result


# ── Bloom analysis endpoints ─────────────────────────────


class BloomAnalysisItem(BaseModel):
    level: str
    correct: int
    total: int
    score: float


class BloomAnalysisResult(BaseModel):
    exam_id: int
    exam_title: str
    breakdown: list[BloomAnalysisItem]
    overall_score: float


class BloomAnalysisResponse(BaseModel):
    results: list[BloomAnalysisResult]


class InstructorBloomItem(BaseModel):
    level: str
    correct: int
    total: int
    score: float


class InstructorBloomCourseDetail(BaseModel):
    course_id: int
    course_title: str
    breakdown: list[InstructorBloomItem]
    overall_score: float
    total_students: int


class InstructorBloomResponse(BaseModel):
    total_exam_results: int
    total_students: int
    courses: list[InstructorBloomCourseDetail]


# Phải định nghĩa TRƯỚC generic /bloom-analysis/{user_id}/{exam_id}
# để tránh FastAPI match sai route
@router.get("/bloom-analysis/instructor/{instructor_id}", response_model=InstructorBloomResponse)
def get_bloom_analysis_for_instructor(
    instructor_id: int,
    session: Session = Depends(get_session),
):
    """
    Lấy phân tích Bloom tổng hợp cho giảng viên.
    Gom tất cả kết quả bài thi của sinh viên trong các khóa học do giảng viên mở.
    """
    from models.course import Course
    from models.exam import Exam

    # Lấy tất cả khóa học của giảng viên
    courses = session.exec(
        select(Course).where(Course.instructor_id == instructor_id)
    ).all()

    if not courses:
        return InstructorBloomResponse(
            total_exam_results=0,
            total_students=0,
            courses=[],
        )

    course_ids = [c.id for c in courses]
    course_map = {c.id: c.title for c in courses}

    # Lấy tất cả bài thi thuộc các khóa học này
    exams = session.exec(
        select(Exam).where(Exam.course_id.in_(course_ids))
    ).all()

    if not exams:
        return InstructorBloomResponse(
            total_exam_results=0,
            total_students=0,
            courses=[],
        )

    exam_ids = [e.id for e in exams]
    exam_course_map = {e.id: e.course_id for e in exams}

    # Lấy tất cả kết quả bài thi của các bài thi này
    exam_results = session.exec(
        select(ExamResult).where(ExamResult.exam_id.in_(exam_ids))
    ).all()

    if not exam_results:
        return InstructorBloomResponse(
            total_exam_results=0,
            total_students=0,
            courses=[],
        )

    # Phân nhóm theo course
    course_data: dict[int, dict[str, dict[str, float | int]]] = {}
    unique_students: set[int] = set()

    for result in exam_results:
        course_id = exam_course_map.get(result.exam_id)
        if course_id is None:
            continue

        unique_students.add(result.user_id)

        if course_id not in course_data:
            course_data[course_id] = {}

        if not result.bloom_breakdown:
            continue

        try:
            bb = json.loads(result.bloom_breakdown)
        except (json.JSONDecodeError, TypeError):
            continue

        for level, data in bb.items():
            if level not in course_data[course_id]:
                course_data[course_id][level] = {"correct": 0, "total": 0}
            course_data[course_id][level]["correct"] = course_data[course_id][level]["correct"] + data.get("correct", 0)  # type: ignore
            course_data[course_id][level]["total"] = course_data[course_id][level]["total"] + data.get("total", 0)  # type: ignore

    # Build response
    course_details: list[InstructorBloomCourseDetail] = []
    for course_id, levels in course_data.items():
        if not levels:
            continue

        total_all = sum(v["total"] for v in levels.values())
        correct_all = sum(v["correct"] for v in levels.values())
        overall_score = round(correct_all / total_all * 100, 1) if total_all > 0 else 0.0

        # Đếm số sinh viên có kết quả trong khóa học này
        students_in_course = set(
            r.user_id for r in exam_results
            if exam_course_map.get(r.exam_id) == course_id
        )

        breakdown = [
            InstructorBloomItem(
                level=level,
                correct=int(data["correct"]),
                total=int(data["total"]),
                score=round(data["correct"] / data["total"] * 100, 1) if data["total"] > 0 else 0.0,
            )
            for level, data in sorted(levels.items())
        ]

        course_details.append(
            InstructorBloomCourseDetail(
                course_id=course_id,
                course_title=course_map.get(course_id, f"Khóa học #{course_id}"),
                breakdown=breakdown,
                overall_score=overall_score,
                total_students=len(students_in_course),
            )
        )

    # Sắp xếp theo overall_score giảm dần
    course_details.sort(key=lambda c: c.overall_score, reverse=True)

    return InstructorBloomResponse(
        total_exam_results=len(exam_results),
        total_students=len(unique_students),
        courses=course_details,
    )


@router.get("/bloom-analysis/{user_id}", response_model=BloomAnalysisResponse)
def get_bloom_analysis(
    user_id: int,
    course_id: Optional[int] = None,
    session: Session = Depends(get_session),
):
    """
    Lấy phân tích Bloom cho tất cả kết quả bài thi của người dùng.
    Có thể lọc theo course_id.
    """
    from models.exam import Exam

    # Lấy tất cả kết quả bài thi của user
    query = select(ExamResult).where(ExamResult.user_id == user_id)
    results = session.exec(query).all()

    # Lấy danh sách exam IDs
    exam_ids = list({r.exam_id for r in results})

    # Lọc theo course nếu có
    if course_id:
        exams_in_course = session.exec(
            select(Exam).where(Exam.course_id == course_id, Exam.id.in_(exam_ids))
        ).all()
        allowed_exam_ids = {e.id for e in exams_in_course}
        results = [r for r in results if r.exam_id in allowed_exam_ids]
        exam_ids = list(allowed_exam_ids)

    # Gom nhóm theo exam
    exam_results_map: dict[int, list[ExamResult]] = {}
    for r in results:
        if r.exam_id not in exam_results_map:
            exam_results_map[r.exam_id] = []
        exam_results_map[r.exam_id].append(r)

    analysis_results: list[BloomAnalysisResult] = []

    for exam_id, exam_results in exam_results_map.items():
        exam = session.get(Exam, exam_id)
        exam_title = exam.title if exam else f"Bài thi #{exam_id}"

        # Tổng hợp bloom breakdown từ tất cả các lần thi
        combined: dict[str, dict[str, float | int]] = {}
        for r in exam_results:
            if not r.bloom_breakdown:
                continue
            try:
                bb = json.loads(r.bloom_breakdown)
            except (json.JSONDecodeError, TypeError):
                continue

            for level, data in bb.items():
                if level not in combined:
                    combined[level] = {"correct": 0, "total": 0}
                combined[level]["correct"] = combined[level]["correct"] + data.get("correct", 0)  # type: ignore
                combined[level]["total"] = combined[level]["total"] + data.get("total", 0)  # type: ignore

        # Nếu không có bloom data, bỏ qua
        if not combined:
            continue

        # Tính điểm tổng thể
        total_all = sum(v["total"] for v in combined.values())
        correct_all = sum(v["correct"] for v in combined.values())
        overall_score = round(correct_all / total_all * 100, 1) if total_all > 0 else 0.0

        breakdown = [
            BloomAnalysisItem(
                level=level,
                correct=int(data["correct"]),
                total=int(data["total"]),
                score=round(data["correct"] / data["total"] * 100, 1) if data["total"] > 0 else 0.0,
            )
            for level, data in sorted(combined.items())
        ]

        analysis_results.append(
            BloomAnalysisResult(
                exam_id=exam_id,
                exam_title=exam_title,
                breakdown=breakdown,
                overall_score=overall_score,
            )
        )

    return BloomAnalysisResponse(results=analysis_results)


# Lấy bloom analysis cho một bài thi cụ thể
@router.get("/bloom-analysis/{user_id}/{exam_id}", response_model=BloomAnalysisResult)
def get_bloom_analysis_by_exam(
    user_id: int,
    exam_id: int,
    session: Session = Depends(get_session),
):
    """Lấy phân tích Bloom cho một bài thi cụ thể của người dùng."""
    from models.exam import Exam

    results = session.exec(
        select(ExamResult).where(
            ExamResult.user_id == user_id,
            ExamResult.exam_id == exam_id,
        )
    ).all()

    if not results:
        raise HTTPException(
            status_code=404,
            detail="Không tìm thấy kết quả bài thi cho người dùng và bài thi này",
        )

    exam = session.get(Exam, exam_id)
    exam_title = exam.title if exam else f"Bài thi #{exam_id}"

    # Tổng hợp bloom breakdown từ tất cả các lần thi
    combined: dict[str, dict[str, float | int]] = {}
    for r in results:
        if not r.bloom_breakdown:
            continue
        try:
            bb = json.loads(r.bloom_breakdown)
        except (json.JSONDecodeError, TypeError):
            continue

        for level, data in bb.items():
            if level not in combined:
                combined[level] = {"correct": 0, "total": 0}
            combined[level]["correct"] = combined[level]["correct"] + data.get("correct", 0)  # type: ignore
            combined[level]["total"] = combined[level]["total"] + data.get("total", 0)  # type: ignore

    if not combined:
        raise HTTPException(
            status_code=404,
            detail="Không có dữ liệu Bloom cho bài thi này",
        )

    total_all = sum(v["total"] for v in combined.values())
    correct_all = sum(v["correct"] for v in combined.values())
    overall_score = round(correct_all / total_all * 100, 1) if total_all > 0 else 0.0

    breakdown = [
        BloomAnalysisItem(
            level=level,
            correct=int(data["correct"]),
            total=int(data["total"]),
            score=round(data["correct"] / data["total"] * 100, 1) if data["total"] > 0 else 0.0,
        )
        for level, data in sorted(combined.items())
    ]

    return BloomAnalysisResult(
        exam_id=exam_id,
        exam_title=exam_title,
        breakdown=breakdown,
        overall_score=overall_score,
    )


# ── Difficulty analysis endpoints ────────────────────────


class DifficultyAnalysisItem(BaseModel):
    level: str
    correct: int
    total: int
    score: float


class DifficultyAnalysisResult(BaseModel):
    exam_id: int
    exam_title: str
    breakdown: list[DifficultyAnalysisItem]
    overall_score: float


class DifficultyAnalysisResponse(BaseModel):
    results: list[DifficultyAnalysisResult]


@router.get("/difficulty-analysis/instructor/{instructor_id}", response_model=InstructorBloomResponse)
def get_difficulty_analysis_for_instructor(
    instructor_id: int,
    session: Session = Depends(get_session),
):
    """
    Lấy phân tích độ khó tổng hợp cho giảng viên.
    Gom tất cả kết quả bài thi của sinh viên trong các khóa học do giảng viên mở.
    """
    from models.course import Course
    from models.exam import Exam

    courses = session.exec(
        select(Course).where(Course.instructor_id == instructor_id)
    ).all()

    if not courses:
        return InstructorBloomResponse(
            total_exam_results=0,
            total_students=0,
            courses=[],
        )

    course_ids = [c.id for c in courses]
    course_map = {c.id: c.title for c in courses}

    exams = session.exec(
        select(Exam).where(Exam.course_id.in_(course_ids))
    ).all()

    if not exams:
        return InstructorBloomResponse(
            total_exam_results=0,
            total_students=0,
            courses=[],
        )

    exam_ids = [e.id for e in exams]
    exam_course_map = {e.id: e.course_id for e in exams}

    exam_results = session.exec(
        select(ExamResult).where(ExamResult.exam_id.in_(exam_ids))
    ).all()

    if not exam_results:
        return InstructorBloomResponse(
            total_exam_results=0,
            total_students=0,
            courses=[],
        )

    course_data: dict[int, dict[str, dict[str, float | int]]] = {}
    unique_students: set[int] = set()

    for result in exam_results:
        course_id = exam_course_map.get(result.exam_id)
        if course_id is None:
            continue

        unique_students.add(result.user_id)

        if course_id not in course_data:
            course_data[course_id] = {}

        if not result.difficulty_breakdown:
            continue

        try:
            db = json.loads(result.difficulty_breakdown)
        except (json.JSONDecodeError, TypeError):
            continue

        for level, data in db.items():
            if level not in course_data[course_id]:
                course_data[course_id][level] = {"correct": 0, "total": 0}
            course_data[course_id][level]["correct"] = course_data[course_id][level]["correct"] + data.get("correct", 0)  # type: ignore
            course_data[course_id][level]["total"] = course_data[course_id][level]["total"] + data.get("total", 0)  # type: ignore

    course_details: list[InstructorBloomCourseDetail] = []
    for course_id, levels in course_data.items():
        if not levels:
            continue

        total_all = sum(v["total"] for v in levels.values())
        correct_all = sum(v["correct"] for v in levels.values())
        overall_score = round(correct_all / total_all * 100, 1) if total_all > 0 else 0.0

        students_in_course = set(
            r.user_id for r in exam_results
            if exam_course_map.get(r.exam_id) == course_id
        )

        breakdown = [
            InstructorBloomItem(
                level=level,
                correct=int(data["correct"]),
                total=int(data["total"]),
                score=round(data["correct"] / data["total"] * 100, 1) if data["total"] > 0 else 0.0,
            )
            for level, data in sorted(levels.items())
        ]

        course_details.append(
            InstructorBloomCourseDetail(
                course_id=course_id,
                course_title=course_map.get(course_id, f"Khóa học #{course_id}"),
                breakdown=breakdown,
                overall_score=overall_score,
                total_students=len(students_in_course),
            )
        )

    course_details.sort(key=lambda c: c.overall_score, reverse=True)

    return InstructorBloomResponse(
        total_exam_results=len(exam_results),
        total_students=len(unique_students),
        courses=course_details,
    )


@router.get("/difficulty-analysis/{user_id}", response_model=DifficultyAnalysisResponse)
def get_difficulty_analysis(
    user_id: int,
    course_id: Optional[int] = None,
    session: Session = Depends(get_session),
):
    """
    Lấy phân tích độ khó cho tất cả kết quả bài thi của người dùng.
    Có thể lọc theo course_id.
    """
    from models.exam import Exam

    query = select(ExamResult).where(ExamResult.user_id == user_id)
    results = session.exec(query).all()

    exam_ids = list({r.exam_id for r in results})

    if course_id:
        exams_in_course = session.exec(
            select(Exam).where(Exam.course_id == course_id, Exam.id.in_(exam_ids))
        ).all()
        allowed_exam_ids = {e.id for e in exams_in_course}
        results = [r for r in results if r.exam_id in allowed_exam_ids]
        exam_ids = list(allowed_exam_ids)

    exam_results_map: dict[int, list[ExamResult]] = {}
    for r in results:
        if r.exam_id not in exam_results_map:
            exam_results_map[r.exam_id] = []
        exam_results_map[r.exam_id].append(r)

    analysis_results: list[DifficultyAnalysisResult] = []

    for exam_id, exam_results in exam_results_map.items():
        exam = session.get(Exam, exam_id)
        exam_title = exam.title if exam else f"Bài thi #{exam_id}"

        combined: dict[str, dict[str, float | int]] = {}
        for r in exam_results:
            if not r.difficulty_breakdown:
                continue
            try:
                db = json.loads(r.difficulty_breakdown)
            except (json.JSONDecodeError, TypeError):
                continue

            for level, data in db.items():
                if level not in combined:
                    combined[level] = {"correct": 0, "total": 0}
                combined[level]["correct"] = combined[level]["correct"] + data.get("correct", 0)  # type: ignore
                combined[level]["total"] = combined[level]["total"] + data.get("total", 0)  # type: ignore

        if not combined:
            continue

        total_all = sum(v["total"] for v in combined.values())
        correct_all = sum(v["correct"] for v in combined.values())
        overall_score = round(correct_all / total_all * 100, 1) if total_all > 0 else 0.0

        breakdown = [
            DifficultyAnalysisItem(
                level=level,
                correct=int(data["correct"]),
                total=int(data["total"]),
                score=round(data["correct"] / data["total"] * 100, 1) if data["total"] > 0 else 0.0,
            )
            for level, data in sorted(combined.items())
        ]

        analysis_results.append(
            DifficultyAnalysisResult(
                exam_id=exam_id,
                exam_title=exam_title,
                breakdown=breakdown,
                overall_score=overall_score,
            )
        )

    return DifficultyAnalysisResponse(results=analysis_results)


@router.get("/difficulty-analysis/{user_id}/{exam_id}", response_model=DifficultyAnalysisResult)
def get_difficulty_analysis_by_exam(
    user_id: int,
    exam_id: int,
    session: Session = Depends(get_session),
):
    """Lấy phân tích độ khó cho một bài thi cụ thể của người dùng."""
    from models.exam import Exam

    results = session.exec(
        select(ExamResult).where(
            ExamResult.user_id == user_id,
            ExamResult.exam_id == exam_id,
        )
    ).all()

    if not results:
        raise HTTPException(
            status_code=404,
            detail="Không tìm thấy kết quả bài thi cho người dùng và bài thi này",
        )

    exam = session.get(Exam, exam_id)
    exam_title = exam.title if exam else f"Bài thi #{exam_id}"

    combined: dict[str, dict[str, float | int]] = {}
    for r in results:
        if not r.difficulty_breakdown:
            continue
        try:
            db = json.loads(r.difficulty_breakdown)
        except (json.JSONDecodeError, TypeError):
            continue

        for level, data in db.items():
            if level not in combined:
                combined[level] = {"correct": 0, "total": 0}
            combined[level]["correct"] = combined[level]["correct"] + data.get("correct", 0)  # type: ignore
            combined[level]["total"] = combined[level]["total"] + data.get("total", 0)  # type: ignore

    if not combined:
        raise HTTPException(
            status_code=404,
            detail="Không có dữ liệu độ khó cho bài thi này",
        )

    total_all = sum(v["total"] for v in combined.values())
    correct_all = sum(v["correct"] for v in combined.values())
    overall_score = round(correct_all / total_all * 100, 1) if total_all > 0 else 0.0

    breakdown = [
        DifficultyAnalysisItem(
            level=level,
            correct=int(data["correct"]),
            total=int(data["total"]),
            score=round(data["correct"] / data["total"] * 100, 1) if data["total"] > 0 else 0.0,
        )
        for level, data in sorted(combined.items())
    ]

    return DifficultyAnalysisResult(
        exam_id=exam_id,
        exam_title=exam_title,
        breakdown=breakdown,
        overall_score=overall_score,
    )


# Xóa kết quả bài thi
@router.delete("/delete/{result_id}", response_model=dict)
def delete_exam_result(result_id: int, session: Session = Depends(get_session)):
    result = session.get(ExamResult, result_id)
    if not result:
        raise HTTPException(status_code=404, detail="Không tìm thấy kết quả bài thi")
    session.delete(result)
    session.commit()
    return {"message": "Xóa kết quả bài thi thành công"}

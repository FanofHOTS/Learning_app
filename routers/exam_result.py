import json
import re
from datetime import datetime, timezone
from database.engine import create_db_engine
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, select, Field, SQLModel

from models.exam_answer import ExamAnswer
from models.exam_result import ExamResult
from models.option import Option
from models.question import Question

router = APIRouter(prefix="/exam_result", tags=["exam_result"])


# Cú pháp đáp án điền chỗ trống: các chỗ trống phân tách bằng ' | ', các cách
# viết được chấp nhận của cùng một chỗ trống phân tách bằng '~'.
BLANK_ALTERNATIVE_SEPARATOR = "~"

_FILL_IN_BLANK_TYPES = {"fill_in_blank", "fill_blank", "fill_in_the_blank"}
_MULTIPLE_ANSWER_TYPES = {"multiple_answer", "multiple_answers", "multiple_select"}


def get_session():
    with Session(create_db_engine()) as session:
        yield session


# ── Pydantic request models ──────────────────────────────


class AnswerItem(BaseModel):
    """Một câu trả lời của sinh viên.

    `answer_text` và `option_ids` là câu trả lời thật và được ưu tiên để chấm
    phía server. `is_correct` chỉ còn là gợi ý của client: backend chỉ dùng nó
    khi client chưa gửi câu trả lời thật (client cũ hoặc chế độ mock).
    """

    question_id: int
    is_correct: bool = False
    answer_text: Optional[str] = Field(
        default=None,
        description="Nội dung sinh viên nhập (câu điền chỗ trống: các chỗ trống phân tách ' | ')",
    )
    option_ids: List[int] = Field(
        default_factory=list,
        description="Id các phương án sinh viên chọn (câu trắc nghiệm)",
    )


class ExamResultSubmit(BaseModel):
    user_id: int
    exam_id: int
    score: float
    total_questions: int
    correct_answers: int
    is_passed: bool
    answers: list[AnswerItem] = []


# ── Bloom helpers ────────────────────────────────────────


def _build_question_lookup(
    session: Session,
    answers: list[AnswerItem],
) -> dict[int, Question]:
    """
    Lấy danh sách câu hỏi tương ứng với các answer, trả về lookup dict.
    Chỉ query những câu hỏi có trong answers (không query tất cả câu hỏi của exam).
    """
    question_ids = list({a.question_id for a in answers})
    questions = session.exec(
        select(Question).where(Question.id.in_(question_ids))
    ).all()
    return {q.id: q for q in questions}


def _build_options_lookup(
    session: Session,
    answers: list[AnswerItem],
) -> dict[int, list[Option]]:
    """Phương án trả lời của các câu hỏi có trong answers, theo question_id."""
    question_ids = list({a.question_id for a in answers})
    if not question_ids:
        return {}
    options = session.exec(
        select(Option).where(Option.question_id.in_(question_ids))
    ).all()
    lookup: dict[int, list[Option]] = {}
    for option in options:
        if option.question_id is None:
            continue
        lookup.setdefault(option.question_id, []).append(option)
    return lookup


# ── Chấm điểm phía server ────────────────────────────────


def _normalize_answer_text(value: Optional[str]) -> str:
    """Chuẩn hoá văn bản để so khớp (gộp khoảng trắng, bỏ đầu/cuối, không phân biệt hoa thường).

    Cần giữ đồng bộ với `normalizeAnswerText()` ở frontend (app/lib/api_exam.ts).
    """
    return re.sub(r"\s+", " ", str(value or "")).strip().lower()


def _split_blank_answers(raw_answer: Optional[str]) -> list[str]:
    """Tách đáp án điền chỗ trống theo từng chỗ trống (phân tách bằng '|')."""
    parts = [part.strip() for part in str(raw_answer or "").split("|")]
    while parts and parts[-1] == "":
        parts.pop()
    return parts


def _split_blank_alternatives(blank_answer: str) -> list[str]:
    """Các cách viết được chấp nhận cho MỘT chỗ trống (phân tách bằng '~')."""
    alternatives: list[str] = []
    pattern = rf"\s*{re.escape(BLANK_ALTERNATIVE_SEPARATOR)}\s*"
    for part in re.split(pattern, str(blank_answer or "")):
        candidate = part.strip()
        if candidate and candidate not in alternatives:
            alternatives.append(candidate)
    return alternatives


def _is_fill_in_blank(question: Question) -> bool:
    return (question.question_type or "").strip().lower() in _FILL_IN_BLANK_TYPES


def _is_multiple_answer(question: Question) -> bool:
    return (question.question_type or "").strip().lower() in _MULTIPLE_ANSWER_TYPES


def _grade_fill_in_blank(question: Question, answer_text: Optional[str]) -> bool:
    """Chấm câu điền chỗ trống: đúng khi MỌI chỗ trống khớp một trong các cách viết."""
    expected_blanks = _split_blank_answers(question.answer)
    if not expected_blanks:
        return False

    given_blanks = _split_blank_answers(answer_text)
    if len(given_blanks) != len(expected_blanks):
        return False

    for expected_blank, given_blank in zip(expected_blanks, given_blanks):
        alternatives = _split_blank_alternatives(expected_blank)
        if not alternatives:
            return False
        normalized = _normalize_answer_text(given_blank)
        if not normalized:
            return False
        if not any(
            normalized == _normalize_answer_text(alternative)
            for alternative in alternatives
        ):
            return False
    return True


def _grade_with_options(options: list[Option], option_ids: list[int]) -> bool:
    """Chấm câu trắc nghiệm: tập phương án chọn phải trùng đúng tập đáp án đúng."""
    correct_ids = sorted(
        int(option.id) for option in options if option.is_correct and option.id is not None
    )
    if not correct_ids:
        return False

    selected_ids = sorted({int(option_id) for option_id in option_ids})
    return selected_ids == correct_ids


def _resolve_answer_correctness(
    question: Question,
    options: list[Option],
    item: AnswerItem,
) -> bool:
    """Backend tự quyết định đúng/sai từ câu trả lời thật của sinh viên.

    Chỉ rơi về cờ `is_correct` do client gửi khi client không gửi câu trả lời
    thật (client cũ hoặc chế độ mock) — trường hợp đó được ghi lại rõ trong
    bảng `exam_answer` qua việc `answer_text`/`option_ids` để trống.
    """
    has_student_answer = bool((item.answer_text or "").strip()) or bool(item.option_ids)
    if not has_student_answer:
        return bool(item.is_correct)

    if _is_fill_in_blank(question):
        return _grade_fill_in_blank(question, item.answer_text)

    if options:
        return _grade_with_options(options, item.option_ids)

    if _is_multiple_answer(question):
        # Câu chọn nhiều đáp án nhưng DB thiếu phương án: so theo tập nội dung.
        expected = {
            _normalize_answer_text(part)
            for part in _split_blank_answers(question.answer)
            if _normalize_answer_text(part)
        }
        given = {
            _normalize_answer_text(part)
            for part in _split_blank_answers(item.answer_text)
            if _normalize_answer_text(part)
        }
        return bool(expected) and given == expected

    if item.option_ids:
        # Client gửi phương án chọn nhưng DB không có phương án của câu này nên
        # không thể chấm lại — đành dùng cờ do client gửi.
        return bool(item.is_correct)

    # Không có phương án trong DB: so nội dung trả lời với đáp án đã lưu.
    return _normalize_answer_text(item.answer_text) == _normalize_answer_text(
        question.answer
    )


def _calculate_bloom_breakdown(
    session: Session,
    answers: list[AnswerItem],
) -> Optional[str]:
    """
    Tính bloom_breakdown từ danh sách câu trả lời.
    Chỉ dùng những câu hỏi có trong answers (xử lý đúng khi chọn subset).
    Trả về JSON string: {"remember": {"correct": 2, "total": 3, "score": 66.7}, ...}
    """
    if not answers:
        return None

    questions = _build_question_lookup(session, answers)
    if not questions:
        return None

    bloom_data: dict[str, dict[str, float | int]] = {}
    for answer in answers:
        question = questions.get(answer.question_id)
        level = question.bloom_level if question else "remember"
        if level not in bloom_data:
            bloom_data[level] = {"correct": 0, "total": 0}
        bloom_data[level]["total"] = bloom_data[level]["total"] + 1  # type: ignore
        if answer.is_correct:
            bloom_data[level]["correct"] = bloom_data[level]["correct"] + 1  # type: ignore

    for level in bloom_data:
        total = bloom_data[level]["total"]
        correct = bloom_data[level]["correct"]
        bloom_data[level]["score"] = round(correct / total * 100, 1) if total > 0 else 0.0  # type: ignore

    return json.dumps(bloom_data, ensure_ascii=False)


def _calculate_difficulty_breakdown(
    session: Session,
    answers: list[AnswerItem],
) -> Optional[str]:
    """
    Tính difficulty_breakdown từ danh sách câu trả lời.
    Chỉ dùng những câu hỏi có trong answers (xử lý đúng khi chọn subset).
    Trả về JSON string: {"easy": {"correct": 2, "total": 3, "score": 66.7}, ...}
    """
    if not answers:
        return None

    questions = _build_question_lookup(session, answers)
    if not questions:
        return None

    dif_data: dict[str, dict[str, float | int]] = {}
    for answer in answers:
        question = questions.get(answer.question_id)
        level = question.difficulty if question else "medium"
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


# ── Câu trả lời đã lưu của một kết quả bài thi ───────────


class ExamAnswerDetail(BaseModel):
    question_id: int
    answer_text: Optional[str] = None
    option_ids: List[int] = []
    is_correct: bool


def _decode_option_ids(raw: Optional[str]) -> list[int]:
    """Giải mã JSON array id phương án đã lưu (trả về [] nếu dữ liệu hỏng)."""
    if not raw:
        return []
    try:
        values = json.loads(raw)
    except (TypeError, ValueError):
        return []
    if not isinstance(values, list):
        return []

    decoded: list[int] = []
    for value in values:
        try:
            decoded.append(int(value))
        except (TypeError, ValueError):
            continue
    return decoded


# Lấy câu trả lời thật của sinh viên đã lưu cho một kết quả bài thi
@router.get("/{result_id}/answers", response_model=List[ExamAnswerDetail])
def get_exam_result_answers(result_id: int, session: Session = Depends(get_session)):
    result = session.get(ExamResult, result_id)
    if not result:
        raise HTTPException(status_code=404, detail="Không tìm thấy kết quả bài thi")

    rows = session.exec(
        select(ExamAnswer).where(ExamAnswer.exam_result_id == result_id)
    ).all()
    return [
        ExamAnswerDetail(
            question_id=row.question_id,
            answer_text=row.answer_text,
            option_ids=_decode_option_ids(row.option_ids),
            is_correct=row.is_correct,
        )
        for row in rows
    ]


# Nộp bài thi (tạo kết quả bài thi mới) — backend tự chấm từ câu trả lời thật
@router.post("/submit", response_model=ExamResult)
def submit_exam_result(payload: ExamResultSubmit, session: Session = Depends(get_session)):
    from models.exam import Exam

    # Kiểm tra bài thi có tồn tại không
    exam = session.get(Exam, payload.exam_id)
    if not exam:
        raise HTTPException(status_code=404, detail="Không tìm thấy bài thi")

    questions: dict[int, Question] = {}

    # Tự tính toán lại điểm từ answers nếu có
    if payload.answers:
        questions = _build_question_lookup(session, payload.answers)
        options_by_question = _build_options_lookup(session, payload.answers)
        total_score = 0
        correct_count = 0
        max_score = 0
        for answer in payload.answers:
            question = questions.get(answer.question_id)
            if not question:
                continue

            # Ghi đè cờ đúng/sai do client gửi bằng kết quả chấm của server để
            # mọi phần phía sau (điểm, bloom_breakdown, dữ liệu lưu lại) dùng
            # cùng một nguồn sự thật.
            answer.is_correct = _resolve_answer_correctness(
                question=question,
                options=options_by_question.get(question.id, []),
                item=answer,
            )
            max_score += question.score
            if answer.is_correct:
                total_score += question.score
                correct_count += 1

        calculated_score = float(total_score)
        calculated_max_score = max_score
        calculated_correct = correct_count
        calculated_passed = total_score >= exam.pass_score
    else:
        # Fallback: dùng dữ liệu từ frontend nếu không có answers
        calculated_score = payload.score
        calculated_max_score = exam.max_score
        calculated_correct = payload.correct_answers
        calculated_passed = payload.is_passed

    # Tính bloom_breakdown và difficulty_breakdown từ answers
    # (`is_correct` đã được server chấm lại ở trên)
    bloom_breakdown = _calculate_bloom_breakdown(
        session=session,
        answers=payload.answers,
    )
    difficulty_breakdown = _calculate_difficulty_breakdown(
        session=session,
        answers=payload.answers,
    )

    result = ExamResult(
        user_id=payload.user_id,
        exam_id=payload.exam_id,
        score=calculated_score,
        max_score=calculated_max_score,
        total_questions=payload.total_questions,
        correct_answers=calculated_correct,
        is_passed=calculated_passed,
        submitted_at=datetime.now(timezone.utc),
        bloom_breakdown=bloom_breakdown,
        difficulty_breakdown=difficulty_breakdown,
    )
    session.add(result)
    session.commit()
    session.refresh(result)

    # Lưu câu trả lời thật của sinh viên để có thể đối chiếu, chấm lại và thống
    # kê về sau (chỉ lưu với những câu hỏi thật sự tồn tại trong DB).
    if result.id is not None:
        stored_answers = [
            ExamAnswer(
                exam_result_id=result.id,
                question_id=answer.question_id,
                answer_text=answer.answer_text,
                option_ids=(
                    json.dumps(answer.option_ids) if answer.option_ids else None
                ),
                is_correct=answer.is_correct,
            )
            for answer in payload.answers
            if answer.question_id in questions
        ]
        if stored_answers:
            session.add_all(stored_answers)
            session.commit()
            # Commit thứ hai làm expire mọi thuộc tính của `result`; refresh lại
            # để response trả về đầy đủ dữ liệu (nếu không sẽ bị rỗng).
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

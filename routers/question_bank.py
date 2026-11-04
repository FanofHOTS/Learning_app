"""Ngân hàng câu hỏi chung cho giảng viên.

Giảng viên đăng câu hỏi của mình lên ngân hàng chung, giảng viên khác duyệt và
lấy về để thêm vào bài kiểm tra của họ. Dữ liệu được **sao chép** sang bảng
`question`/`option` của bài kiểm tra đích (không dùng chung bản ghi), nhờ vậy
mỗi giảng viên có thể chỉnh sửa câu hỏi đã lấy mà không ảnh hưởng người khác.
"""

from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import func, or_
from sqlmodel import Session, select

from database.engine import create_db_engine
from models.category import Category
from models.exam import Exam
from models.option import Option
from models.question import Question
from models.question_bank import QuestionBank, QuestionBankOption
from models.question_bank_rating import QuestionBankRating
from models.question_bank_tag import QuestionBankTag
from models.user import User

router = APIRouter(prefix="/question_bank", tags=["question_bank"])


def get_session():
    with Session(create_db_engine()) as session:
        yield session


VALID_QUESTION_TYPES = {
    "multiple_choice",
    "multiple_answer",
    "fill_in_blank",
    "true_false",
}
OPTION_BASED_TYPES = {"multiple_choice", "multiple_answer", "true_false"}
VALID_BLOOM_LEVELS = {
    "remember",
    "understand",
    "apply",
    "analyze",
    "evaluate",
    "create",
}
VALID_SORTS = {"newest", "oldest", "rating", "popular", "content_az"}
MAX_TAGS_PER_QUESTION = 8
MAX_TAG_LENGTH = 40
MIN_RATING = 1
MAX_RATING = 5


# ── Pydantic models ─────────────────────────────────────


class BankOptionInput(BaseModel):
    content: str = ""
    is_correct: bool = False


class QuestionBankCreate(BaseModel):
    content: str
    question_type: str = "multiple_choice"
    answer: str = ""
    bloom_level: str = "remember"
    score: int = 1
    category_id: Optional[int] = None
    is_active: bool = True
    created_by: int
    tags: List[str] = []
    options: List[BankOptionInput] = []


class QuestionBankUpdate(BaseModel):
    content: Optional[str] = None
    question_type: Optional[str] = None
    answer: Optional[str] = None
    bloom_level: Optional[str] = None
    score: Optional[int] = None
    category_id: Optional[int] = None
    is_active: Optional[bool] = None
    tags: Optional[List[str]] = None
    options: Optional[List[BankOptionInput]] = None


class BankOptionRead(BaseModel):
    id: int
    content: str
    is_correct: bool


class QuestionBankRead(BaseModel):
    id: int
    content: str
    question_type: str
    answer: str
    bloom_level: str
    score: int
    category_id: Optional[int]
    category_name: Optional[str]
    created_by: int
    created_by_name: str
    is_active: bool
    usage_count: int
    created_at: datetime
    updated_at: datetime
    tags: List[str] = []
    rating_average: float = 0.0
    rating_count: int = 0
    my_rating: Optional[int] = None
    options: List[BankOptionRead] = []


class QuestionBankTagRead(BaseModel):
    tag: str
    count: int


class QuestionBankPage(BaseModel):
    items: List[QuestionBankRead]
    total: int
    page: int
    page_size: int
    total_pages: int
    sort: str


class QuestionBankPublishRequest(BaseModel):
    question_id: int
    created_by: int
    category_id: Optional[int] = None
    is_active: bool = True
    score: Optional[int] = None
    tags: List[str] = []


class QuestionBankRatingRequest(BaseModel):
    user_id: int
    rating: int


class QuestionBankImportRequest(BaseModel):
    exam_id: int
    question_ids: List[int] = []
    # Người thực hiện thêm câu hỏi; cho phép dùng câu đang ẩn của chính người này.
    user_id: Optional[int] = None


class QuestionBankImportResult(BaseModel):
    exam_id: int
    imported: int
    skipped: int
    question_ids: List[int] = []


# ── Validation helpers ──────────────────────────────────


def _normalize_question_type(value: str) -> str:
    return (value or "").strip().lower()


def _trim_options(options: List[BankOptionInput]) -> List[BankOptionInput]:
    return [
        BankOptionInput(content=option.content.strip(), is_correct=bool(option.is_correct))
        for option in options
        if option.content.strip()
    ]


def _validate_question_payload(
    *,
    content: str,
    question_type: str,
    answer: str,
    bloom_level: str,
    score: int,
    options: List[BankOptionInput],
) -> tuple[list[BankOptionInput], str]:
    """Chuẩn hóa và kiểm tra dữ liệu câu hỏi của ngân hàng chung.

    Trả về (options, answer) đã chuẩn hóa. Với câu hỏi có phương án, `answer`
    luôn được suy ra từ các phương án đúng để tránh lệch giữa hai nguồn dữ liệu.
    """
    if not content.strip():
        raise HTTPException(status_code=400, detail="Nội dung câu hỏi không được để trống.")

    normalized_type = _normalize_question_type(question_type)
    if normalized_type not in VALID_QUESTION_TYPES:
        raise HTTPException(
            status_code=400,
            detail=(
                "Loại câu hỏi không hợp lệ. Chỉ hỗ trợ: "
                + ", ".join(sorted(VALID_QUESTION_TYPES))
                + "."
            ),
        )

    if bloom_level not in VALID_BLOOM_LEVELS:
        raise HTTPException(status_code=400, detail="Mức độ Bloom không hợp lệ.")

    if score is None or score < 0:
        raise HTTPException(status_code=400, detail="Điểm của câu hỏi không được nhỏ hơn 0.")

    if normalized_type == "fill_in_blank":
        normalized_answer = answer.strip()
        if not normalized_answer:
            raise HTTPException(
                status_code=400,
                detail=(
                    "Câu hỏi điền chỗ trống cần đáp án. Nhiều chỗ trống phân tách "
                    "bằng ' | ', các cách viết được chấp nhận phân tách bằng '~'."
                ),
            )
        return [], normalized_answer

    cleaned_options = _trim_options(options)
    if len(cleaned_options) < 2:
        raise HTTPException(
            status_code=400,
            detail="Câu hỏi có phương án cần ít nhất 2 phương án trả lời.",
        )

    if len({option.content.casefold() for option in cleaned_options}) != len(
        cleaned_options
    ):
        raise HTTPException(
            status_code=400,
            detail="Các phương án không được trùng nội dung.",
        )

    correct_options = [option for option in cleaned_options if option.is_correct]

    if normalized_type == "multiple_answer":
        if len(correct_options) < 2:
            raise HTTPException(
                status_code=400,
                detail="Câu hỏi nhiều đáp án cần ít nhất 2 phương án đúng.",
            )
        if len(correct_options) == len(cleaned_options):
            raise HTTPException(
                status_code=400,
                detail="Câu hỏi nhiều đáp án cần ít nhất 1 phương án sai.",
            )
    else:
        if normalized_type == "true_false" and len(cleaned_options) != 2:
            raise HTTPException(
                status_code=400,
                detail="Câu hỏi Đúng/Sai cần đúng 2 phương án.",
            )
        if len(correct_options) != 1:
            raise HTTPException(
                status_code=400,
                detail="Câu hỏi một đáp án cần đúng một phương án đúng.",
            )

    derived_answer = " | ".join(option.content for option in correct_options)
    return cleaned_options, derived_answer


def _ensure_owner(bank_question: QuestionBank, user_id: int) -> None:
    if bank_question.created_by != user_id:
        raise HTTPException(
            status_code=403,
            detail="Chỉ người đăng câu hỏi mới được sửa hoặc xóa câu hỏi trong ngân hàng chung.",
        )


# ── Read helpers ────────────────────────────────────────


def _options_by_bank_id(
    session: Session, bank_ids: list[int]
) -> dict[int, list[QuestionBankOption]]:
    if not bank_ids:
        return {}
    rows = session.exec(
        select(QuestionBankOption)
        .where(QuestionBankOption.question_bank_id.in_(bank_ids))
        .order_by(QuestionBankOption.id)
    ).all()
    grouped: dict[int, list[QuestionBankOption]] = {}
    for row in rows:
        grouped.setdefault(row.question_bank_id, []).append(row)
    return grouped


def _names_by_id(session: Session, model, ids: set[int]) -> dict[int, str]:
    if not ids:
        return {}
    rows = session.exec(select(model).where(model.id.in_(ids))).all()
    return {row.id: getattr(row, "name", None) or getattr(row, "username", "") for row in rows}


def _normalize_tags(tags: Optional[List[str]]) -> list[str]:
    """Chuẩn hóa danh sách thẻ: bỏ rỗng, gộp trùng (không phân biệt hoa thường)."""
    if not tags:
        return []

    cleaned: list[str] = []
    seen: set[str] = set()
    for raw_tag in tags:
        # Một ô nhập có thể chứa nhiều thẻ phân tách bằng dấu phẩy.
        for part in str(raw_tag).replace(";", ",").split(","):
            tag = " ".join(part.split()).strip()
            if not tag:
                continue
            tag = tag[:MAX_TAG_LENGTH].strip()
            if not tag:
                continue
            key = tag.casefold()
            if key in seen:
                continue
            seen.add(key)
            cleaned.append(tag)
            if len(cleaned) >= MAX_TAGS_PER_QUESTION:
                return cleaned
    return cleaned


def _tags_by_bank_id(
    session: Session, bank_ids: list[int]
) -> dict[int, list[str]]:
    if not bank_ids:
        return {}
    rows = session.exec(
        select(QuestionBankTag)
        .where(QuestionBankTag.question_bank_id.in_(bank_ids))
        .order_by(QuestionBankTag.tag)
    ).all()
    grouped: dict[int, list[str]] = {}
    for row in rows:
        grouped.setdefault(row.question_bank_id, []).append(row.tag)
    return grouped


def _rating_stats_by_bank_id(
    session: Session, bank_ids: list[int]
) -> dict[int, tuple[float, int]]:
    if not bank_ids:
        return {}
    rows = session.exec(
        select(
            QuestionBankRating.question_bank_id,
            func.avg(QuestionBankRating.rating),
            func.count(QuestionBankRating.id),
        )
        .where(QuestionBankRating.question_bank_id.in_(bank_ids))
        .group_by(QuestionBankRating.question_bank_id)
    ).all()
    return {
        int(bank_id): (round(float(average or 0), 1), int(count or 0))
        for bank_id, average, count in rows
    }


def _first_tags_by_bank_id(
    session: Session, bank_ids: list[int]
) -> dict[int, str]:
    """Thẻ đầu tiên của mỗi câu hỏi theo thứ tự nhập (dùng làm chủ đề khi nhập)."""
    if not bank_ids:
        return {}
    rows = session.exec(
        select(QuestionBankTag)
        .where(QuestionBankTag.question_bank_id.in_(bank_ids))
        .order_by(QuestionBankTag.id)
    ).all()
    first_tags: dict[int, str] = {}
    for row in rows:
        first_tags.setdefault(row.question_bank_id, row.tag)
    return first_tags


def _my_ratings_by_bank_id(
    session: Session, bank_ids: list[int], viewer_id: Optional[int]
) -> dict[int, int]:
    if not bank_ids or viewer_id is None:
        return {}
    rows = session.exec(
        select(QuestionBankRating.question_bank_id, QuestionBankRating.rating).where(
            QuestionBankRating.question_bank_id.in_(bank_ids),
            QuestionBankRating.user_id == viewer_id,
        )
    ).all()
    return {int(bank_id): int(rating) for bank_id, rating in rows}


def _to_read(
    bank_question: QuestionBank,
    options: list[QuestionBankOption],
    user_names: dict[int, str],
    category_names: dict[int, str],
    tags: Optional[list[str]] = None,
    rating_stats: tuple[float, int] = (0.0, 0),
    my_rating: Optional[int] = None,
) -> QuestionBankRead:
    return QuestionBankRead(
        id=bank_question.id or 0,
        content=bank_question.content,
        question_type=bank_question.question_type,
        answer=bank_question.answer,
        bloom_level=bank_question.bloom_level,
        score=bank_question.score,
        category_id=bank_question.category_id,
        category_name=(
            category_names.get(bank_question.category_id)
            if bank_question.category_id
            else None
        ),
        created_by=bank_question.created_by,
        created_by_name=user_names.get(
            bank_question.created_by, f"Giảng viên #{bank_question.created_by}"
        ),
        is_active=bank_question.is_active,
        usage_count=bank_question.usage_count,
        created_at=bank_question.created_at,
        updated_at=bank_question.updated_at,
        tags=list(tags or []),
        rating_average=rating_stats[0],
        rating_count=rating_stats[1],
        my_rating=my_rating,
        options=[
            BankOptionRead(
                id=option.id or 0,
                content=option.content,
                is_correct=option.is_correct,
            )
            for option in options
        ],
    )


def _read_one(
    session: Session,
    bank_question: QuestionBank,
    viewer_id: Optional[int] = None,
) -> QuestionBankRead:
    bank_id = bank_question.id or 0
    options = _options_by_bank_id(session, [bank_id]).get(bank_id, [])
    user_names = _names_by_id(session, User, {bank_question.created_by})
    category_names = _names_by_id(
        session,
        Category,
        {bank_question.category_id} if bank_question.category_id else set(),
    )
    return _to_read(
        bank_question,
        options,
        user_names,
        category_names,
        tags=_tags_by_bank_id(session, [bank_id]).get(bank_id, []),
        rating_stats=_rating_stats_by_bank_id(session, [bank_id]).get(
            bank_id, (0.0, 0)
        ),
        my_rating=_my_ratings_by_bank_id(session, [bank_id], viewer_id).get(bank_id),
    )


def _renumber_exam_questions(session: Session, exam_id: int) -> None:
    """Đánh số lại câu hỏi của bài kiểm tra theo thứ tự hiển thị 1..N."""
    questions = session.exec(
        select(Question)
        .where(Question.exam_id == exam_id)
        .order_by(Question.sequence, Question.id)
    ).all()
    for index, question in enumerate(questions, start=1):
        if question.sequence != index:
            question.sequence = index


def _require_user(session: Session, user_id: int, field: str = "created_by") -> None:
    if session.get(User, user_id) is None:
        raise HTTPException(
            status_code=400,
            detail=f"Không tìm thấy người dùng cho trường {field}.",
        )


def _require_category(session: Session, category_id: Optional[int]) -> None:
    if category_id is not None and session.get(Category, category_id) is None:
        raise HTTPException(status_code=400, detail="Không tìm thấy phân loại đã chọn.")


# ── Endpoints ───────────────────────────────────────────


@router.get("/", response_model=QuestionBankPage)
def list_question_bank(
    search: Optional[str] = None,
    category_id: Optional[int] = None,
    question_type: Optional[str] = None,
    bloom_level: Optional[str] = None,
    created_by: Optional[int] = None,
    tag: Optional[str] = None,
    include_inactive: bool = False,
    sort: str = "newest",
    page: int = 1,
    page_size: int = 12,
    viewer_id: Optional[int] = None,
    session: Session = Depends(get_session),
):
    """Duyệt ngân hàng câu hỏi chung có lọc, sắp xếp và phân trang.

    `sort` nhận: newest, oldest, rating, popular, content_az. `tag` lọc theo
    thẻ/chủ đề (không phân biệt hoa thường). `viewer_id` dùng để trả về đánh
    giá của chính người xem (`my_rating`). `include_inactive` chỉ mở thêm câu
    đang ẩn của chính `viewer_id`, không lộ câu ẩn của giảng viên khác.
    """
    sort_key = (sort or "newest").strip().lower()
    if sort_key not in VALID_SORTS:
        raise HTTPException(
            status_code=400,
            detail=(
                "Kiểu sắp xếp không hợp lệ. Chỉ hỗ trợ: "
                + ", ".join(sorted(VALID_SORTS))
                + "."
            ),
        )

    page = max(1, int(page))
    page_size = max(1, min(int(page_size), 100))

    conditions = []

    if include_inactive and viewer_id is not None:
        # "Hiện cả câu đang ẩn" chỉ áp dụng cho câu của chính người xem, tránh
        # lộ câu nháp của giảng viên khác trên ngân hàng chung.
        conditions.append(
            or_(
                QuestionBank.is_active == True,  # noqa: E712
                QuestionBank.created_by == viewer_id,
            )
        )
    else:
        # Không có viewer_id thì luôn chỉ trả câu đang hiển thị, kể cả khi
        # client gửi include_inactive=true.
        conditions.append(QuestionBank.is_active == True)  # noqa: E712

    if category_id is not None:
        conditions.append(QuestionBank.category_id == category_id)

    if question_type:
        conditions.append(
            QuestionBank.question_type == _normalize_question_type(question_type)
        )

    if bloom_level:
        conditions.append(QuestionBank.bloom_level == bloom_level.strip().lower())

    if created_by is not None:
        conditions.append(QuestionBank.created_by == created_by)

    tag_value = " ".join((tag or "").split()).strip()
    if tag_value:
        conditions.append(
            QuestionBank.id.in_(
                select(QuestionBankTag.question_bank_id).where(
                    QuestionBankTag.tag_key == tag_value.casefold()
                )
            )
        )

    keyword = (search or "").strip().lower()
    if keyword:
        pattern = f"%{keyword}%"
        conditions.append(
            or_(
                func.lower(QuestionBank.content).like(pattern),
                func.lower(QuestionBank.answer).like(pattern),
            )
        )

    total = session.exec(
        select(func.count()).select_from(QuestionBank).where(*conditions)
    ).one()
    total = int(total or 0)
    total_pages = (total + page_size - 1) // page_size

    rating_subquery = (
        select(
            QuestionBankRating.question_bank_id.label("bank_id"),
            func.avg(QuestionBankRating.rating).label("average"),
            func.count(QuestionBankRating.id).label("ratings"),
        )
        .group_by(QuestionBankRating.question_bank_id)
        .subquery()
    )

    statement = (
        select(QuestionBank)
        .outerjoin(
            rating_subquery, QuestionBank.id == rating_subquery.c.bank_id
        )
        .where(*conditions)
    )

    if sort_key == "oldest":
        statement = statement.order_by(
            QuestionBank.created_at.asc(), QuestionBank.id.asc()
        )
    elif sort_key == "popular":
        statement = statement.order_by(
            QuestionBank.usage_count.desc(), QuestionBank.id.desc()
        )
    elif sort_key == "rating":
        statement = statement.order_by(
            func.coalesce(rating_subquery.c.average, 0).desc(),
            func.coalesce(rating_subquery.c.ratings, 0).desc(),
            QuestionBank.usage_count.desc(),
            QuestionBank.id.desc(),
        )
    elif sort_key == "content_az":
        statement = statement.order_by(
            func.lower(QuestionBank.content).asc(), QuestionBank.id.asc()
        )
    else:
        statement = statement.order_by(
            QuestionBank.created_at.desc(), QuestionBank.id.desc()
        )

    bank_questions = session.exec(
        statement.offset((page - 1) * page_size).limit(page_size)
    ).all()

    bank_ids = [question.id for question in bank_questions if question.id is not None]
    options_map = _options_by_bank_id(session, bank_ids)
    tags_map = _tags_by_bank_id(session, bank_ids)
    ratings_map = _rating_stats_by_bank_id(session, bank_ids)
    my_ratings = _my_ratings_by_bank_id(session, bank_ids, viewer_id)
    user_names = _names_by_id(
        session, User, {question.created_by for question in bank_questions}
    )
    category_names = _names_by_id(
        session,
        Category,
        {
            question.category_id
            for question in bank_questions
            if question.category_id is not None
        },
    )

    return QuestionBankPage(
        items=[
            _to_read(
                question,
                options_map.get(question.id or 0, []),
                user_names,
                category_names,
                tags=tags_map.get(question.id or 0, []),
                rating_stats=ratings_map.get(question.id or 0, (0.0, 0)),
                my_rating=my_ratings.get(question.id or 0),
            )
            for question in bank_questions
        ],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
        sort=sort_key,
    )


@router.get("/tags", response_model=List[QuestionBankTagRead])
def list_question_bank_tags(
    limit: int = 50,
    session: Session = Depends(get_session),
):
    """Thống kê các thẻ/chủ đề đang dùng trong ngân hàng chung."""
    limit = max(1, min(int(limit), 200))

    rows = session.exec(
        select(
            func.min(QuestionBankTag.tag).label("tag"),
            func.count(QuestionBankTag.id).label("tag_count"),
        )
        .join(QuestionBank, QuestionBank.id == QuestionBankTag.question_bank_id)
        .where(QuestionBank.is_active == True)  # noqa: E712
        .group_by(QuestionBankTag.tag_key)
        .order_by(
            func.count(QuestionBankTag.id).desc(),
            func.min(QuestionBankTag.tag).asc(),
        )
        .limit(limit)
    ).all()

    return [
        QuestionBankTagRead(tag=tag, count=int(count)) for tag, count in rows
    ]


@router.get("/{bank_id}", response_model=QuestionBankRead)
def get_question_bank_question(
    bank_id: int,
    viewer_id: Optional[int] = None,
    session: Session = Depends(get_session),
):
    bank_question = session.get(QuestionBank, bank_id)
    if not bank_question:
        raise HTTPException(
            status_code=404, detail="Không tìm thấy câu hỏi trong ngân hàng chung."
        )
    return _read_one(session, bank_question, viewer_id=viewer_id)


@router.post("/create", response_model=QuestionBankRead)
def create_question_bank_question(
    payload: QuestionBankCreate, session: Session = Depends(get_session)
):
    """Đăng một câu hỏi mới lên ngân hàng câu hỏi chung."""
    _require_user(session, payload.created_by)
    _require_category(session, payload.category_id)

    options, answer = _validate_question_payload(
        content=payload.content,
        question_type=payload.question_type,
        answer=payload.answer,
        bloom_level=payload.bloom_level,
        score=payload.score,
        options=payload.options,
    )

    bank_question = QuestionBank(
        content=payload.content.strip(),
        question_type=_normalize_question_type(payload.question_type),
        answer=answer,
        bloom_level=payload.bloom_level,
        score=payload.score,
        category_id=payload.category_id,
        created_by=payload.created_by,
        is_active=payload.is_active,
    )
    session.add(bank_question)
    session.flush()

    for option in options:
        session.add(
            QuestionBankOption(
                question_bank_id=bank_question.id,
                content=option.content,
                is_correct=option.is_correct,
            )
        )

    for tag in _normalize_tags(payload.tags):
        session.add(
            QuestionBankTag(
                question_bank_id=bank_question.id,
                tag=tag,
                tag_key=tag.casefold(),
            )
        )

    session.commit()
    session.refresh(bank_question)
    return _read_one(session, bank_question, viewer_id=payload.created_by)


@router.put("/update/{bank_id}", response_model=QuestionBankRead)
def update_question_bank_question(
    bank_id: int,
    payload: QuestionBankUpdate,
    user_id: int = Query(..., description="Id giảng viên đang thao tác"),
    session: Session = Depends(get_session),
):
    """Cập nhật câu hỏi trong ngân hàng chung (chỉ người đăng)."""
    bank_question = session.get(QuestionBank, bank_id)
    if not bank_question:
        raise HTTPException(
            status_code=404, detail="Không tìm thấy câu hỏi trong ngân hàng chung."
        )
    _ensure_owner(bank_question, user_id)

    if "category_id" in payload.model_fields_set:
        _require_category(session, payload.category_id)

    existing_options = [
        BankOptionInput(content=option.content, is_correct=option.is_correct)
        for option in _options_by_bank_id(session, [bank_id]).get(bank_id, [])
    ]

    next_type = payload.question_type or bank_question.question_type
    next_question_type = _normalize_question_type(next_type)
    incoming_options = (
        _trim_options(payload.options)
        if payload.options is not None
        else existing_options
    )
    # Đổi sang câu điền chỗ trống thì bỏ phương án; đổi từ điền chỗ trống sang
    # loại có phương án mà chưa nhập phương án mới thì giữ nguyên để báo lỗi.
    if next_question_type == "fill_in_blank":
        incoming_options = []

    options, answer = _validate_question_payload(
        content=payload.content if payload.content is not None else bank_question.content,
        question_type=next_question_type,
        answer=(
            payload.answer
            if payload.answer is not None
            else (bank_question.answer if next_question_type == "fill_in_blank" else "")
        ),
        bloom_level=payload.bloom_level or bank_question.bloom_level,
        score=payload.score if payload.score is not None else bank_question.score,
        options=incoming_options,
    )

    if payload.content is not None:
        bank_question.content = payload.content.strip()
    bank_question.question_type = next_question_type
    bank_question.answer = answer
    if payload.bloom_level is not None:
        bank_question.bloom_level = payload.bloom_level
    if payload.score is not None:
        bank_question.score = payload.score
    if "category_id" in payload.model_fields_set:
        bank_question.category_id = payload.category_id
    if payload.is_active is not None:
        bank_question.is_active = payload.is_active
    bank_question.updated_at = datetime.now(timezone.utc)

    if payload.options is not None or next_question_type == "fill_in_blank":
        for option in _options_by_bank_id(session, [bank_id]).get(bank_id, []):
            session.delete(option)
        session.flush()

        for option in options:
            session.add(
                QuestionBankOption(
                    question_bank_id=bank_id,
                    content=option.content,
                    is_correct=option.is_correct,
                )
            )

    if payload.tags is not None:
        for tag_row in session.exec(
            select(QuestionBankTag).where(QuestionBankTag.question_bank_id == bank_id)
        ).all():
            session.delete(tag_row)
        session.flush()

        for tag in _normalize_tags(payload.tags):
            session.add(
                QuestionBankTag(
                    question_bank_id=bank_id,
                    tag=tag,
                    tag_key=tag.casefold(),
                )
            )

    session.commit()
    session.refresh(bank_question)
    return _read_one(session, bank_question, viewer_id=user_id)


@router.delete("/delete/{bank_id}", response_model=dict)
def delete_question_bank_question(
    bank_id: int,
    user_id: int = Query(..., description="Id giảng viên đang thao tác"),
    session: Session = Depends(get_session),
):
    """Gỡ câu hỏi khỏi ngân hàng chung (chỉ người đăng)."""
    bank_question = session.get(QuestionBank, bank_id)
    if not bank_question:
        raise HTTPException(
            status_code=404, detail="Không tìm thấy câu hỏi trong ngân hàng chung."
        )
    _ensure_owner(bank_question, user_id)

    for option in _options_by_bank_id(session, [bank_id]).get(bank_id, []):
        session.delete(option)
    for tag_row in session.exec(
        select(QuestionBankTag).where(QuestionBankTag.question_bank_id == bank_id)
    ).all():
        session.delete(tag_row)
    for rating_row in session.exec(
        select(QuestionBankRating).where(
            QuestionBankRating.question_bank_id == bank_id
        )
    ).all():
        session.delete(rating_row)
    session.delete(bank_question)
    session.commit()
    return {"message": "Đã gỡ câu hỏi khỏi ngân hàng câu hỏi chung."}


@router.post("/publish", response_model=QuestionBankRead)
def publish_question_to_bank(
    payload: QuestionBankPublishRequest, session: Session = Depends(get_session)
):
    """Đăng một câu hỏi đang có trong bài kiểm tra lên ngân hàng chung."""
    question = session.get(Question, payload.question_id)
    if not question:
        raise HTTPException(status_code=404, detail="Không tìm thấy câu hỏi để đăng.")
    _require_user(session, payload.created_by)
    _require_category(session, payload.category_id)

    duplicated = session.exec(
        select(QuestionBank).where(
            QuestionBank.created_by == payload.created_by,
            QuestionBank.content == question.content,
            QuestionBank.question_type == question.question_type,
            QuestionBank.is_active == True,  # noqa: E712
        )
    ).first()
    if duplicated:
        return _read_one(session, duplicated, viewer_id=payload.created_by)

    source_options = session.exec(
        select(Option)
        .where(Option.question_id == question.id)
        .order_by(Option.id)
    ).all()
    options, answer = _validate_question_payload(
        content=question.content,
        question_type=question.question_type,
        answer=question.answer,
        bloom_level=question.bloom_level or "remember",
        score=payload.score if payload.score is not None else question.score,
        options=[
            BankOptionInput(content=option.content, is_correct=option.is_correct)
            for option in source_options
        ],
    )

    bank_question = QuestionBank(
        content=question.content,
        question_type=_normalize_question_type(question.question_type),
        answer=answer,
        bloom_level=question.bloom_level or "remember",
        score=payload.score if payload.score is not None else question.score,
        category_id=payload.category_id,
        created_by=payload.created_by,
        is_active=payload.is_active,
    )
    session.add(bank_question)
    session.flush()

    for option in options:
        session.add(
            QuestionBankOption(
                question_bank_id=bank_question.id,
                content=option.content,
                is_correct=option.is_correct,
            )
        )

    # Chủ đề/từ khóa của câu hỏi trong bài kiểm tra được lưu thành thẻ của ngân
    # hàng chung, để khi lấy lại vẫn còn dữ liệu chia cấu trúc theo chủ đề.
    publish_tags = [question.topic] if question.topic else []
    publish_tags.extend(payload.tags)

    for tag in _normalize_tags(publish_tags):
        session.add(
            QuestionBankTag(
                question_bank_id=bank_question.id,
                tag=tag,
                tag_key=tag.casefold(),
            )
        )

    session.commit()
    session.refresh(bank_question)
    return _read_one(session, bank_question, viewer_id=payload.created_by)


@router.put("/{bank_id}/rating", response_model=QuestionBankRead)
def rate_question_bank_question(
    bank_id: int,
    payload: QuestionBankRatingRequest,
    session: Session = Depends(get_session),
):
    """Đánh giá chất lượng câu hỏi (1-5 sao); đánh giá lại sẽ cập nhật."""
    bank_question = session.get(QuestionBank, bank_id)
    if not bank_question:
        raise HTTPException(
            status_code=404, detail="Không tìm thấy câu hỏi trong ngân hàng chung."
        )
    _require_user(session, payload.user_id, field="user_id")

    if not MIN_RATING <= payload.rating <= MAX_RATING:
        raise HTTPException(
            status_code=400,
            detail=f"Điểm đánh giá phải nằm trong khoảng {MIN_RATING}-{MAX_RATING} sao.",
        )

    existing = session.exec(
        select(QuestionBankRating).where(
            QuestionBankRating.question_bank_id == bank_id,
            QuestionBankRating.user_id == payload.user_id,
        )
    ).first()

    if existing:
        existing.rating = payload.rating
        existing.updated_at = datetime.now(timezone.utc)
        session.add(existing)
    else:
        session.add(
            QuestionBankRating(
                question_bank_id=bank_id,
                user_id=payload.user_id,
                rating=payload.rating,
            )
        )

    session.commit()
    session.refresh(bank_question)
    return _read_one(session, bank_question, viewer_id=payload.user_id)


@router.delete("/{bank_id}/rating", response_model=QuestionBankRead)
def remove_question_bank_rating(
    bank_id: int,
    user_id: int = Query(..., description="Id giảng viên cần bỏ đánh giá"),
    session: Session = Depends(get_session),
):
    """Bỏ đánh giá của giảng viên cho câu hỏi trong ngân hàng chung."""
    bank_question = session.get(QuestionBank, bank_id)
    if not bank_question:
        raise HTTPException(
            status_code=404, detail="Không tìm thấy câu hỏi trong ngân hàng chung."
        )

    existing = session.exec(
        select(QuestionBankRating).where(
            QuestionBankRating.question_bank_id == bank_id,
            QuestionBankRating.user_id == user_id,
        )
    ).first()
    if existing:
        session.delete(existing)
        session.commit()
        session.refresh(bank_question)

    return _read_one(session, bank_question, viewer_id=user_id)


@router.post("/import", response_model=QuestionBankImportResult)
def import_questions_from_bank(
    payload: QuestionBankImportRequest, session: Session = Depends(get_session)
):
    """Sao chép câu hỏi từ ngân hàng chung vào một bài kiểm tra.

    Câu hỏi và phương án được sao chép thành bản ghi mới thuộc bài kiểm tra
    đích; câu hỏi trong ngân hàng chung chỉ tăng `usage_count`. Câu hỏi đang ẩn
    vẫn dùng được nếu `user_id` là người tạo câu hỏi đó; câu ẩn của người khác
    hoặc câu không tồn tại được bỏ qua và đếm vào `skipped`.
    """
    exam = session.get(Exam, payload.exam_id)
    if not exam:
        raise HTTPException(status_code=404, detail="Không tìm thấy bài kiểm tra.")

    ordered_ids: list[int] = []
    for bank_id in payload.question_ids:
        if bank_id not in ordered_ids:
            ordered_ids.append(bank_id)

    if not ordered_ids:
        raise HTTPException(
            status_code=400, detail="Vui lòng chọn ít nhất một câu hỏi để thêm."
        )

    bank_questions = session.exec(
        select(QuestionBank).where(QuestionBank.id.in_(ordered_ids))
    ).all()
    by_id = {
        bank_question.id: bank_question
        for bank_question in bank_questions
        if bank_question.id is not None
    }
    options_map = _options_by_bank_id(session, ordered_ids)
    first_tags_map = _first_tags_by_bank_id(session, ordered_ids)

    max_sequence = session.exec(
        select(func.max(Question.sequence)).where(Question.exam_id == payload.exam_id)
    ).one()
    next_sequence = (max_sequence or 0) + 1

    imported_ids: list[int] = []
    skipped = 0

    for bank_id in ordered_ids:
        bank_question = by_id.get(bank_id)
        is_own_hidden = (
            bank_question is not None
            and payload.user_id is not None
            and bank_question.created_by == payload.user_id
        )
        if bank_question is None or (
            not bank_question.is_active and not is_own_hidden
        ):
            skipped += 1
            continue

        new_question = Question(
            exam_id=payload.exam_id,
            content=bank_question.content,
            question_type=bank_question.question_type,
            sequence=next_sequence,
            score=bank_question.score,
            answer=bank_question.answer,
            bloom_level=bank_question.bloom_level,
            topic=first_tags_map.get(bank_id),
        )
        session.add(new_question)
        session.flush()
        next_sequence += 1

        for option in options_map.get(bank_id, []):
            session.add(
                Option(
                    question_id=new_question.id,
                    content=option.content,
                    is_correct=option.is_correct,
                )
            )

        bank_question.usage_count = (bank_question.usage_count or 0) + 1
        bank_question.updated_at = datetime.now(timezone.utc)
        if new_question.id is not None:
            imported_ids.append(new_question.id)

    _renumber_exam_questions(session, payload.exam_id)
    session.commit()

    return QuestionBankImportResult(
        exam_id=payload.exam_id,
        imported=len(imported_ids),
        skipped=skipped,
        question_ids=imported_ids,
    )

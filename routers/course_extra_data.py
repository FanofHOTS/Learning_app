from datetime import datetime, timezone
from database.engine import create_db_engine
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Form
from pydantic import ConfigDict
from sqlmodel import Field, Session, select, SQLModel

from models.course_extra_data import CourseExtraData

router = APIRouter(prefix="/course_extra_data", tags=["course_extra_data"])


def _normalize_datetime_fields(data: dict) -> dict:
    normalized = data.copy()
    for field_name in ("open_at", "close_at"):
        value = normalized.get(field_name)
        if isinstance(value, datetime):
            if value.tzinfo is not None:
                value = value.astimezone(timezone.utc)
            else:
                value = value.replace(tzinfo=timezone.utc)
            normalized[field_name] = value
    return normalized


class CourseExtraDataCreate(SQLModel):
    course_id: int
    objective: str = "Mục tiêu khóa học"
    requirement: str = "Yêu cầu khóa học"
    required_course_id: Optional[int] = None
    open_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    close_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    bloom_objectives: str = "{}"
    assessment_matrix: str = "{}"
    content_structure: str = "{}"


class CourseExtraDataUpdate(SQLModel):
    objective: Optional[str] = None
    requirement: Optional[str] = None
    required_course_id: Optional[int] = None
    open_at: Optional[datetime] = None
    close_at: Optional[datetime] = None
    bloom_objectives: Optional[str] = None
    assessment_matrix: Optional[str] = None
    content_structure: Optional[str] = None


class CourseExtraDataRead(SQLModel):
    model_config = ConfigDict(from_attributes=True)

    course_id: int
    objective: str
    requirement: str
    required_course_id: Optional[int]
    open_at: datetime
    close_at: datetime
    bloom_objectives: str
    assessment_matrix: str
    content_structure: str


def get_session():
    with Session(create_db_engine()) as session:
        yield session

#Lấy danh sách dữ liệu bổ sung của khóa học
@router.get("/", response_model=List[CourseExtraDataRead])
def read_course_extra_data(session: Session = Depends(get_session)):
    records = session.exec(select(CourseExtraData)).all()
    return [CourseExtraDataRead.model_validate(record) for record in records]

#Lấy dữ liệu bổ sung của khóa học theo id khóa học
@router.get("/{course_id}", response_model=CourseExtraDataRead)
def read_course_extra_data_by_course_id(course_id: int, session: Session = Depends(get_session)):
    course_extra_data = session.get(CourseExtraData, course_id)
    if not course_extra_data:
        raise HTTPException(status_code=404, detail="Không tìm thấy dữ liệu bổ sung của khóa học")
    return CourseExtraDataRead.model_validate(course_extra_data)

def _detect_cycle(course_id: int, new_required_id: Optional[int], session: Session) -> None:
    """Kiểm tra vòng lặp khóa học yêu cầu trước."""
    if new_required_id is None or new_required_id <= 0:
        return

    visited: set[int] = set()
    current: Optional[int] = new_required_id

    while current is not None and current > 0:
        if current == course_id:
            raise HTTPException(
                status_code=400,
                detail="Không thể chọn khóa học yêu cầu trước tạo thành vòng lặp. "
                        "Hãy chọn khóa học khác hoặc bỏ chọn.",
            )
        if current in visited:
            raise HTTPException(
                status_code=400,
                detail="Phát hiện vòng lặp trong chuỗi khóa học yêu cầu trước. "
                        "Hãy kiểm tra lại dữ liệu.",
            )
        visited.add(current)

        extra = session.get(CourseExtraData, current)
        current = extra.required_course_id if extra else None


#Tạo dữ liệu bổ sung của khóa học mới
@router.post("/create", response_model=CourseExtraDataRead)
def create_course_extra_data(
    course_extra_data: CourseExtraDataCreate,
    session: Session = Depends(get_session),
):
    _detect_cycle(course_extra_data.course_id, course_extra_data.required_course_id, session)
    record = CourseExtraData(**_normalize_datetime_fields(course_extra_data.model_dump()))
    session.add(record)
    session.commit()
    session.refresh(record)
    return CourseExtraDataRead.model_validate(record)

#Cập nhật dữ liệu bổ sung của khóa học
@router.put("/update/{course_id}", response_model=CourseExtraDataRead)
def update_course_extra_data(
    course_id: int,
    course_extra_data: CourseExtraDataUpdate,
    session: Session = Depends(get_session),
):
    record = session.get(CourseExtraData, course_id)
    if not record:
        raise HTTPException(status_code=404, detail="Không tìm thấy dữ liệu bổ sung của khóa học")

    update_data = course_extra_data.model_dump(exclude_unset=True)
    for date_field in ("open_at", "close_at"):
        if date_field in update_data and update_data[date_field] is None:
            raise HTTPException(status_code=422, detail=f"{date_field} không được để trống.")
    for required_field in (
        "objective",
        "requirement",
        "bloom_objectives",
        "assessment_matrix",
        "content_structure",
    ):
        if required_field in update_data and update_data[required_field] is None:
            raise HTTPException(
                status_code=422,
                detail=f"{required_field} không được để trống.",
            )

    new_required_id = update_data.get("required_course_id", record.required_course_id)
    _detect_cycle(course_id, new_required_id, session)

    update_data = _normalize_datetime_fields(update_data)
    for key, value in update_data.items():
        setattr(record, key, value)
    session.commit()
    session.refresh(record)
    return CourseExtraDataRead.model_validate(record)
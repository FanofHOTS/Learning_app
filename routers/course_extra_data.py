from datetime import datetime, timezone
from database.engine import create_db_engine
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Form
from sqlmodel import Session, select, Field, SQLModel, create_engine

from models.course_extra_data import CourseExtraData

router = APIRouter(prefix="/course_extra_data", tags=["course_extra_data"])

def get_session():
    with Session(create_db_engine()) as session:
        yield session

#Lấy danh sách dữ liệu bổ sung của khóa học
@router.get("/", response_model=List[CourseExtraData])
def read_course_extra_data(session: Session = Depends(get_session)):
    return session.exec(select(CourseExtraData)).all()

#Lấy dữ liệu bổ sung của khóa học theo id khóa học
@router.get("/{course_id}", response_model=CourseExtraData)
def read_course_extra_data_by_course_id(course_id: int, session: Session = Depends(get_session)):
    course_extra_data = session.get(CourseExtraData, course_id)
    if not course_extra_data:
        raise HTTPException(status_code=404, detail="Không tìm thấy dữ liệu bổ sung của khóa học")
    return course_extra_data

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
@router.post("/create", response_model=CourseExtraData)
def create_course_extra_data(course_extra_data: CourseExtraData, session: Session = Depends(get_session)):
    _detect_cycle(course_extra_data.course_id, course_extra_data.required_course_id, session)
    session.add(course_extra_data)
    session.commit()
    session.refresh(course_extra_data)
    return course_extra_data

#Cập nhật dữ liệu bổ sung của khóa học
@router.put("/update/{course_id}", response_model=CourseExtraData)
def update_course_extra_data(course_id: int, course_extra_data: CourseExtraData, session: Session = Depends(get_session)):
    existing_course_extra_data = session.get(CourseExtraData, course_id)
    if not existing_course_extra_data:
        raise HTTPException(status_code=404, detail="Không tìm thấy dữ liệu bổ sung của khóa học")

    new_required_id = course_extra_data.required_course_id
    _detect_cycle(course_id, new_required_id, session)

    for key, value in course_extra_data.model_dump(exclude_unset=True).items():
        setattr(existing_course_extra_data, key, value)
    session.commit()
    session.refresh(existing_course_extra_data)
    return existing_course_extra_data
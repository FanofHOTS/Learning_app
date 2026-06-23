from datetime import datetime, timezone
from database.engine import create_db_engine
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Form
from sqlmodel import Session, select, Field, SQLModel, create_engine

router = APIRouter(prefix="/course_extra_data", tags=["course_extra_data"])

def get_session():
    with Session(create_db_engine()) as session:
        yield session

class CourseExtraData(SQLModel, table=True):
    __tablename__ = "course_extra_data"

    course_id: Optional[int] = Field(default=None, primary_key=True, foreign_key="course.id", sa_column_kwargs={'autoincrement': False})
    objective: str = Field(default="Mục tiêu khóa học", nullable=False)
    requirement: str = Field(default="Yêu cầu khóa học", nullable=False)
    required_course_id: Optional[int] = Field(default=None, foreign_key="course.id", nullable=True)
    open_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), nullable=False)
    close_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), nullable=False)
    bloom_objectives: str = Field(default="{}", nullable=False)
    assessment_matrix: str = Field(default="{}", nullable=False)
    content_structure: str = Field(default="{}", nullable=False)

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

#Tạo dữ liệu bổ sung của khóa học mới
@router.post("/create", response_model=CourseExtraData)
def create_course_extra_data(course_extra_data: CourseExtraData, session: Session = Depends(get_session)):
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
    for key, value in course_extra_data.model_dump(exclude_unset=True).items():
        setattr(existing_course_extra_data, key, value)
    session.commit()
    session.refresh(existing_course_extra_data)
    return existing_course_extra_data
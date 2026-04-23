from database.engine import create_db_engine
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Form
from sqlmodel import Session, select, Field, SQLModel, create_engine
from routers.module import Module

router = APIRouter(prefix="/course", tags=["course"])

def get_session():
    with Session(create_db_engine()) as session:
        yield session

class Course(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    title: str = Field(default="Tên khóa học", nullable=False)
    category_id: Optional[int] = Field(default=1, foreign_key="category.id", nullable=False)
    instructor_id: Optional[int] = Field(default=1, foreign_key="user.id", nullable=False)
    introduction: str = Field(default="Giới thiệu khóa học", nullable=False)
    description: str = Field(default="Mô tả khóa học", nullable=False)
    level: str = Field(default="Cơ Bản", nullable=False)
    total_module: int = Field(default=1, nullable=False)
    total_student: int = Field(default=0, nullable=False)
    image: str = Field(default="image", nullable=False)
    is_active: bool = Field(default=False, nullable=False)
    is_public: bool = Field(default=False, nullable=False)
    
# Lấy danh sách khóa học
@router.get("/", response_model=List[Course])
def get_all_courses(session: Session = Depends(get_session)):
    return session.exec(select(Course)).all()

# Lấy danh sách khóa học dựa trên id phân loại
@router.get("/category/{category_id}", response_model=List[Course])
def get_course_by_category_id(category_id: int, session: Session = Depends(get_session)):
    course = session.exec(select(Course).where(Course.category_id == category_id)).all()
    if not course:
        raise HTTPException(status_code=404, detail="Không tìm thấy khóa học với id của phân loại đó")
    return course

# Lấy danh sách khóa học dựa trên id giảng viên
@router.get("/instructor/{instructor_id}", response_model=List[Course])
def get_course_by_instructor_id(instructor_id: int, session: Session = Depends(get_session)):
    course = session.exec(select(Course).where(Course.instructor_id == instructor_id)).all()
    if not course:
        raise HTTPException(status_code=404, detail="Không tìm thấy khóa học với id của giảng viên đó")
    return course

# Lấy khóa học theo id
@router.get("/{course_id}", response_model=Course)
def get_course(course_id: int, session: Session = Depends(get_session)):
    course = session.get(Course, course_id)
    if not course:
        raise HTTPException(status_code=404, detail="Không tìm thấy khóa học")
    return course

# Tạo khóa học mới đồng thời tạo thêm module dựa trên tổng số lượng module khai báo ban đầu
@router.post("/create", response_model=Course)
def create_course(course: Course, session: Session = Depends(get_session)):
    session.add(course)
    session.commit()
    session.refresh(course)
    for i in range(course.total_module):
        module = Module(course_id=course.id, title=f"Module {i+1}", module_sequence=i+1)
        session.add(module)
        session.commit()
        session.refresh(module)
    return course

# Chỉnh sửa khóa học
@router.put("/update/{course_id}", response_model=Course)
def update_course(course_id: int, course_data: Course, session: Session = Depends(get_session)):
    course= session.get(Course, course_id)
    if not course:
        raise HTTPException(status_code=404, detail="Không tìm thấy khóa học")
    for key, value in course_data.model_dump(exclude_unset=True).items():
        setattr(course, key, value)
    # session.add(course)
    session.commit()
    session.refresh(course)
    return course

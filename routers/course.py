from datetime import datetime, timezone
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
    __tablename__ = "course"

    id: Optional[int] = Field(default=None, primary_key=True)
    title: str = Field(default="Tên khóa học", nullable=False)
    category_id: Optional[int] = Field(default=1, foreign_key="category.id", nullable=False)
    category_name: Optional[str] = Field(default=None, nullable=True)
    instructor_id: Optional[int] = Field(default=1, foreign_key="user.id", nullable=False)
    instructor_name: Optional[str] = Field(default=None, nullable=True)
    introduction: str = Field(default="Giới thiệu khóa học", nullable=False)
    description: str = Field(default="Mô tả khóa học", nullable=False)
    level: str = Field(default="Cơ Bản", nullable=False)
    total_module: int = Field(default=1, nullable=False)
    #price: float = Field(default=0.0, nullable=False, description="Giá của khóa học")
    #discount: float = Field(default=0.0, nullable=False, description="Tỷ lệ giảm giá của khóa học, nếu lớn hơn 0.0 thì sẽ áp dụng giảm giá")
    #discount_price: float = Field(default=0.0, nullable=True, description="Giá sau khi đã áp dụng giảm giá của khóa học")
    #discount_start_date: Optional[datetime] = Field(default=None, nullable=True, description="Ngày bắt đầu áp dụng giảm giá của khóa học")
    #discount_end_date: Optional[datetime] = Field(default=None, nullable=True, description="Ngày kết thúc áp dụng giảm giá của khóa học")
    total_student: int = Field(default=0, nullable=False)
    image: str = Field(default="/logo.png", nullable=False)
    is_active: bool = Field(default=False, nullable=False)
    is_public: bool = Field(default=False, nullable=False)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), nullable=False)
    
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

# Tạo khóa học mới. Các module sẽ được tạo riêng biệt từ trang tạo khóa học.
@router.post("/create", response_model=Course)
def create_course(course: Course, session: Session = Depends(get_session)):
    session.add(course)
    session.commit()
    session.refresh(course)
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

# Xóa khóa học và các thành phần liên quan
@router.delete("/delete/{course_id}", response_model=dict)
def delete_course(course_id: int, session: Session = Depends(get_session)):
    course = session.get(Course, course_id)
    if not course:
        raise HTTPException(status_code=404, detail="Không tìm thấy khóa học")

    # Xóa các tiến trình học khóa học liên quan
    from routers.course_progress import CourseProgress
    course_progresses = session.exec(select(CourseProgress).where(CourseProgress.course_id == course_id)).all()
    for course_progress in course_progresses:
        from routers.module_progress import ModuleProgress
        module_progresses = session.exec(select(ModuleProgress).where(ModuleProgress.course_id == course_id)).all()
        for module_progress in module_progresses:
            from routers.course_component_progress import CourseComponentProgress
            course_component_progresses = session.exec(select(CourseComponentProgress).where(CourseComponentProgress.module_id == module_progress.module_id)).all()
            for course_component_progress in course_component_progresses:
                session.delete(course_component_progress)
            session.delete(module_progress)
        session.delete(course_progress)
    # Loại bỏ sự phụ thuộc của các tài liệu và bài kiểm tra trước khi xóa khóa học
    from routers.document import Document
    documents = session.exec(select(Document).where(Document.course_id == course_id)).all()
    for document in documents:
        document.course_id = None
        document.module_id = None
        session.add(document)
    from routers.exam import Exam
    exams = session.exec(select(Exam).where(Exam.course_id == course_id)).all()
    for exam in exams:
        exam.course_id = None
        exam.module_id = None
        session.add(exam)
    # Xóa các module liên quan
    modules = session.exec(select(Module).where(Module.course_id == course_id)).all()
    for module in modules:
        # Xóa các thành phần học tập liên quan đến module
        from routers.course_component import CourseComponent
        course_components = session.exec(select(CourseComponent).where(CourseComponent.module_id == module.id)).all()
        for component in course_components:
            session.delete(component)
        session.delete(module)

    session.delete(course)
    session.commit()
    return {"message": "Xóa khóa học và các thành phần liên quan thành công"}

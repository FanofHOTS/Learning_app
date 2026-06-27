from datetime import datetime, timezone
from database.engine import create_db_engine
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Form
from sqlmodel import Session, select, Field, SQLModel, create_engine
from models.course import Course
from models.module import Module
from routers.notification import notify_admins, notify_all_students

router = APIRouter(prefix="/course", tags=["course"])

def get_session():
    with Session(create_db_engine()) as session:
        yield session

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

    # Thông báo cho admin về khóa học mới
    notify_admins(
        session,
        type="new_course",
        title="Khóa học mới được tạo",
        message=f"Khóa học '{course.title}' vừa được tạo bởi giảng viên (ID: {course.instructor_id}).",
        reference_id=course.id,
        reference_type="course",
    )

    # Nếu khóa học được tạo với trạng thái công bố ngay, thông báo cho tất cả sinh viên
    if course.is_public:
        notify_all_students(
            session,
            type="course_available",
            title="Khóa học mới có thể đăng ký",
            message=f"Khóa học '{course.title}' hiện đã được công bố. Bạn có thể đăng ký và bắt đầu học ngay!",
            reference_id=course.id,
            reference_type="course",
        )

    return course

# Chỉnh sửa khóa học
@router.put("/update/{course_id}", response_model=Course)
def update_course(course_id: int, course_data: Course, session: Session = Depends(get_session)):
    course= session.get(Course, course_id)
    if not course:
        raise HTTPException(status_code=404, detail="Không tìm thấy khóa học")

    # Kiểm tra xem is_public có chuyển từ False sang True không
    was_public = course.is_public

    for key, value in course_data.model_dump(exclude_unset=True).items():
        setattr(course, key, value)
    course.updated_at = datetime.now(timezone.utc)
    # session.add(course)
    session.commit()
    session.refresh(course)

    # Thông báo khi khóa học được công bố (is_public chuyển từ False -> True)
    if not was_public and course.is_public:
        notify_all_students(
            session,
            type="course_available",
            title="Khóa học mới có thể đăng ký",
            message=f"Khóa học '{course.title}' hiện đã được công bố. Bạn có thể đăng ký và bắt đầu học ngay!",
            reference_id=course.id,
            reference_type="course",
        )

    return course

# Xóa khóa học và các thành phần liên quan
@router.delete("/delete/{course_id}", response_model=dict)
def delete_course(course_id: int, session: Session = Depends(get_session)):
    course = session.get(Course, course_id)
    if not course:
        raise HTTPException(status_code=404, detail="Không tìm thấy khóa học")

    # Xóa các tiến trình học khóa học liên quan
    from models.course_progress import CourseProgress
    course_progresses = session.exec(select(CourseProgress).where(CourseProgress.course_id == course_id)).all()
    for course_progress in course_progresses:
        from models.module_progress import ModuleProgress
        module_progresses = session.exec(select(ModuleProgress).where(ModuleProgress.course_id == course_id)).all()
        for module_progress in module_progresses:
            from models.course_component_progress import CourseComponentProgress
            course_component_progresses = session.exec(select(CourseComponentProgress).where(CourseComponentProgress.module_id == module_progress.module_id)).all()
            for course_component_progress in course_component_progresses:
                session.delete(course_component_progress)
            session.delete(module_progress)
        session.delete(course_progress)
    # Loại bỏ sự phụ thuộc của các tài liệu và bài kiểm tra trước khi xóa khóa học
    from models.document import Document
    documents = session.exec(select(Document).where(Document.course_id == course_id)).all()
    for document in documents:
        document.course_id = None
        document.module_id = None
        session.add(document)
    from models.exam import Exam
    exams = session.exec(select(Exam).where(Exam.course_id == course_id)).all()
    for exam in exams:
        exam.course_id = None
        exam.module_id = None
        session.add(exam)
    # Xóa các module liên quan
    modules = session.exec(select(Module).where(Module.course_id == course_id)).all()
    for module in modules:
        # Xóa các thành phần học tập liên quan đến module
        from models.course_component import CourseComponent
        course_components = session.exec(select(CourseComponent).where(CourseComponent.module_id == module.id)).all()
        for component in course_components:
            session.delete(component)
        session.delete(module)

    session.delete(course)
    session.commit()
    return {"message": "Xóa khóa học và các thành phần liên quan thành công"}

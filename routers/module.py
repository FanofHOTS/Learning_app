from database.engine import create_db_engine
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Form
from sqlmodel import Session, select, Field, SQLModel, create_engine

from models.module import Module

router = APIRouter(prefix="/module", tags=["module"])

def get_session():
    with Session(create_db_engine()) as session:
        yield session

# Lấy danh sách module khóa học
@router.get("/", response_model=List[Module])
def get_all_modules(session: Session = Depends(get_session)):
    return session.exec(select(Module)).all()

# Lấy danh sách module khóa học dựa trên id khóa học
@router.get("/course/{course_id}", response_model=List[Module])
def get_module_by_course_id(course_id: int, session: Session = Depends(get_session)):
    module = session.exec(select(Module).where(Module.course_id == course_id)).all()
    if not module:
        raise HTTPException(status_code=404, detail="Không tìm thấy module khóa học nào trong khóa học")
    return module

# Lấy module khóa học theo id
@router.get("/{module_id}", response_model=Module)
def get_module(module_id: int, session: Session = Depends(get_session)):
    module = session.get(Module, module_id)
    if not module:
        raise HTTPException(status_code=404, detail="Không tìm thấy module khóa học")
    return module

# Tạo module khóa học mới
@router.post("/create", response_model=Module)
def create_module(module: Module, session: Session = Depends(get_session)):
    session.add(module)
    session.commit()
    session.refresh(module)
    return module

# Chỉnh sửa module khóa học
@router.put("/update/{module_id}", response_model=Module)
def update_module(module_id: int, module_data: Module, session: Session = Depends(get_session)):
    module= session.get(Module, module_id)
    if not module:
        raise HTTPException(status_code=404, detail="Không tìm thấy module khóa học")
    for key, value in module_data.model_dump(exclude_unset=True).items():
        setattr(module, key, value)
    # session.add(module)
    session.commit()
    session.refresh(module)
    return module

# Xóa module khóa học
@router.delete("/delete/{module_id}")
def delete_module(module_id: int, session: Session = Depends(get_session)):
    module = session.get(Module, module_id)
    if not module:
        raise HTTPException(status_code=404, detail="Không tìm thấy module khóa học")
    # Loại bỏ sự phụ thuộc của các tài liệu và bài kiểm tra trước khi xóa module khóa học
    from models.document import Document
    documents = session.exec(select(Document).where(Document.module_id == module_id)).all()
    for document in documents:
        document.course_id = None
        document.module_id = None
        session.add(document)
    from models.exam import Exam
    exams = session.exec(select(Exam).where(Exam.module_id == module_id)).all()
    for exam in exams:
        exam.course_id = None
        exam.module_id = None
        session.add(exam)
    # Xóa các thành phần khóa học liên quan đến module
    from models.course_component import CourseComponent
    course_components = session.exec(select(CourseComponent).where(CourseComponent.module_id == module_id)).all()
    for course_component in course_components:
        session.delete(course_component)
    session.delete(module)
    session.commit()
    return {"message": "Đã xóa module khóa học"}
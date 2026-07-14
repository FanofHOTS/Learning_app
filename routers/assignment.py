from datetime import datetime, timezone
from database.engine import create_db_engine
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Form
from sqlmodel import Session, select, Field, SQLModel, create_engine

from models.assignment import Assignment

router = APIRouter(prefix="/assignments", tags=["assignments"])

def get_session():
    with Session(create_db_engine()) as session:
        yield session

# Lấy danh sách bài tập
@router.get("/", response_model=List[Assignment])
def get_all_assignments(session: Session = Depends(get_session)):
    return session.exec(select(Assignment)).all()

# Lấy danh sách bài tập dựa trên id khóa học
@router.get("/course/{course_id}", response_model=List[Assignment])
def get_assignments_by_course(course_id: int, session: Session = Depends(get_session)):
    assignments = session.exec(select(Assignment).where(Assignment.course_id == course_id)).all()
    if not assignments:
        raise HTTPException(status_code=404, detail="Không tìm thấy bài tập nào cho khóa học này")
    return assignments

# Lấy danh sách bài tập dựa trên id module khóa học
@router.get("/module/{module_id}", response_model=List[Assignment])
def get_assignments_by_module(module_id: int, session: Session = Depends(get_session)):
    assignments = session.exec(select(Assignment).where(Assignment.module_id == module_id)).all()
    if not assignments:
        raise HTTPException(status_code=404, detail="Không tìm thấy bài tập nào cho module khóa học này")
    return assignments

# Lấy bài tập theo id
@router.get("/{assignment_id}", response_model=Assignment)
def get_assignment(assignment_id: int, session: Session = Depends(get_session)):
    assignment = session.exec(select(Assignment).where(Assignment.id == assignment_id)).first()
    if not assignment:
        raise HTTPException(status_code=404, detail="Không tìm thấy bài tập")
    return assignment

# Tạo bài tập mới
@router.post("/create", response_model=Assignment)
def create_assignment(assignment: Assignment, session: Session = Depends(get_session)):
    session.add(assignment)
    session.commit()
    session.refresh(assignment)
    return assignment

# Cập nhật bài tập
@router.put("/update/{assignment_id}", response_model=Assignment)
def update_assignment(assignment_id: int, assignment_data: Assignment, session: Session = Depends(get_session)):
    existing_assignment = session.exec(select(Assignment).where(Assignment.id == assignment_id)).first()
    if not existing_assignment:
        raise HTTPException(status_code=404, detail="Không tìm thấy bài tập")
    for key, value in assignment_data.model_dump(exclude_unset=True).items():
        setattr(existing_assignment, key, value)
    session.commit()
    session.refresh(existing_assignment)
    return existing_assignment

# Xóa bài tập
@router.delete("/delete/{assignment_id}", response_model=dict)
def delete_assignment(assignment_id: int, session: Session = Depends(get_session)):
    existing_assignment = session.exec(select(Assignment).where(Assignment.id == assignment_id)).first()
    if not existing_assignment:
        raise HTTPException(status_code=404, detail="Không tìm thấy bài tập")
    session.delete(existing_assignment)
    session.commit()
    return {"message": "Xóa bài tập thành công"}


from datetime import datetime, timezone
from database.engine import create_db_engine
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Form
from sqlmodel import Session, select, Field, SQLModel, create_engine

router = APIRouter(prefix="/assignments", tags=["assignments"])

def get_session():
    with Session(create_db_engine()) as session:
        yield session

class Assignment(SQLModel, table=True):
    __tablename__ = "assignment"

    id: Optional[int] = Field(default=None, primary_key=True)
    title: str = Field(default="Bài tập mới", nullable=False)
    description: Optional[str] = Field(default=None, nullable=True)
    module_id: Optional[int] = Field(default=None, foreign_key="module.id", nullable=True)
    course_id: Optional[int] = Field(default=None, foreign_key="course.id", nullable=True)
    assignment_type: str = Field(default="Bài tập trắc nghiệm", nullable=False, description="Loại bài tập. Ví dụ: Bài tập trắc nghiệm, Bài tập tự luận, Bài tập lập trình, v.v.")
    assignment_content: Optional[str] = Field(default=None, nullable=True, description="Nội dung bài tập. Có thể là văn bản, mã nguồn, hoặc liên kết đến tài liệu.")
    assignment_file: Optional[str] = Field(default=None, nullable=True, description="Đường dẫn đến tệp đính kèm của bài tập. Có thể là tệp PDF, DOCX, ZIP, v.v.")
    is_active: bool = Field(default=False, nullable=False)
    is_public: bool = Field(default=False, nullable=False)
    pass_score: int = Field(default=50, nullable=False, description="Điểm tối thiểu để đạt bài tập này")
    max_score: int = Field(default=100, nullable=False, description="Điểm tối đa của bài tập này")
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), nullable=False)

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


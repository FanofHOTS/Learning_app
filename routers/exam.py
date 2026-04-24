from datetime import datetime, timezone
from database.engine import create_db_engine
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select, Field, SQLModel
from routers.question import Question

router = APIRouter(prefix="/exam", tags=["exam"])


def get_session():
    with Session(create_db_engine()) as session:
        yield session


class Exam(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    title: str = Field(default="Bài thi mới", nullable=False)
    description: Optional[str] = Field(default=None, nullable=True)
    module_id: Optional[int] = Field(default=None, foreign_key="module.id", nullable=False)
    course_id: Optional[int] = Field(default=None, foreign_key="course.id", nullable=True)
    duration_minutes: int = Field(default=30, nullable=False)
    total_questions: int = Field(default=10, nullable=False)
    is_active: bool = Field(default=False, nullable=False)
    pass_score: int = Field(default=50, nullable=False, description="Điểm tối thiểu để đạt bài kiểm tra này")
    max_score: int = Field(default=100, nullable=False, description="Điểm tối đa của bài kiểm tra này")
    #created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), nullable=False)
    #updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), nullable=False)

# Lấy danh sách bài thi
@router.get("/", response_model=List[Exam])
def get_all_exams(session: Session = Depends(get_session)):
    return session.exec(select(Exam)).all()

# Lấy danh sách bài thi dựa trên id khóa học
@router.get("/course/{course_id}", response_model=List[Exam])
def get_exams_by_course(course_id: int, session: Session = Depends(get_session)):
    exams = session.exec(select(Exam).where(Exam.course_id == course_id)).all()
    if not exams:
        raise HTTPException(status_code=404, detail="Không tìm thấy bài thi cho khóa học này")
    return exams

# Lấy danh sách bài thi dựa trên id module khóa học
@router.get("/module/{module_id}", response_model=List[Exam])
def get_exams_by_module(module_id: int, session: Session = Depends(get_session)):
    exams = session.exec(select(Exam).where(Exam.module_id == module_id)).all()
    if not exams:
        raise HTTPException(status_code=404, detail="Không tìm thấy bài thi cho module này")
    return exams

# Lấy bài thi theo id
@router.get("/{exam_id}", response_model=Exam)
def get_exam(exam_id: int, session: Session = Depends(get_session)):
    exam = session.get(Exam, exam_id)
    if not exam:
        raise HTTPException(status_code=404, detail="Không tìm thấy bài thi")
    return exam

# Tạo bài thi mới
@router.post("/create", response_model=Exam)
def create_exam(exam: Exam, session: Session = Depends(get_session)):
    session.add(exam)
    session.commit()
    session.refresh(exam)
    return exam

# Chỉnh sửa bài thi
@router.put("/update/{exam_id}", response_model=Exam)
def update_exam(exam_id: int, exam_data: Exam, session: Session = Depends(get_session)):
    exam = session.get(Exam, exam_id)
    if not exam:
        raise HTTPException(status_code=404, detail="Không tìm thấy bài thi")
    for key, value in exam_data.model_dump(exclude_unset=True).items():
        setattr(exam, key, value)
    exam.updated_at = datetime.now(timezone.utc)
    session.commit()
    session.refresh(exam)
    return exam

# Xóa bài thi và các câu hỏi liên quan
@router.delete("/delete/{exam_id}", response_model=dict)
def delete_exam(exam_id: int, session: Session = Depends(get_session)):
    exam = session.get(Exam, exam_id)
    if not exam:
        raise HTTPException(status_code=404, detail="Không tìm thấy bài thi")

    questions = session.exec(select(Question).where(Question.exam_id == exam_id)).all()
    for question in questions:
        session.delete(question)
    session.delete(exam)
    session.commit()
    return {"message": "Xóa bài thi và các câu hỏi liên quan thành công"}

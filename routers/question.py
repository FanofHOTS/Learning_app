from datetime import datetime, timezone
from database.engine import create_db_engine
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select, Field, SQLModel
from routers.option import Option

router = APIRouter(prefix="/question", tags=["question"])


def get_session():
    with Session(create_db_engine()) as session:
        yield session


class Question(SQLModel, table=True):
    __tablename__ = "question"

    id: Optional[int] = Field(default=None, primary_key=True)
    exam_id: int = Field(foreign_key="exam.id", nullable=False)
    content: str = Field(default="Nội dung câu hỏi", nullable=False)
    question_type: str = Field(default="multiple_choice", nullable=False)
    sequence: int = Field(default=1, nullable=False)
    score: int = Field(default=0, nullable=False, description="Điểm của câu hỏi khi trả lời đúng")
    answer: str = Field(default="Câu trả lời", nullable=False,description="Nội dung câu trả lời đúng")
    #created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), nullable=False)

# Lấy danh sách câu hỏi
@router.get("/", response_model=List[Question])
def get_all_questions(session: Session = Depends(get_session)):
    return session.exec(select(Question)).all()

# Lấy danh sách câu hỏi dựa trên id của bài thi
@router.get("/exam/{exam_id}", response_model=List[Question])
def get_questions_by_exam(exam_id: int, session: Session = Depends(get_session)):
    questions = session.exec(select(Question).where(Question.exam_id == exam_id)).all()
    if not questions:
        raise HTTPException(
            status_code=404, detail="Không tìm thấy câu hỏi cho bài thi này"
        )
    return questions

# Lấy câu hỏi theo id
@router.get("/{question_id}", response_model=Question)
def get_question(question_id: int, session: Session = Depends(get_session)):
    question = session.get(Question, question_id)
    if not question:
        raise HTTPException(status_code=404, detail="Không tìm thấy câu hỏi")
    return question

# Tạo câu hỏi mới
@router.post("/create", response_model=Question)
def create_question(question: Question, session: Session = Depends(get_session)):
    session.add(question)
    session.commit()
    session.refresh(question)
    #answer = Option(question_id=question.id, content=question.answer, is_correct=True)
    #session.add(answer)
    #session.commit()
    #session.refresh(answer)
    return question

# Chỉnh sửa câu hỏi
@router.put("/update/{question_id}", response_model=Question)
def update_question(question_id: int, question_data: Question, session: Session = Depends(get_session)):
    question = session.get(Question, question_id)
    if not question:
        raise HTTPException(status_code=404, detail="Không tìm thấy câu hỏi")
    for key, value in question_data.model_dump(exclude_unset=True).items():
        setattr(question, key, value)
    session.commit()
    session.refresh(question)
    return question

# Xóa câu hỏi và các lựa chọn liên quan
@router.delete("/delete/{question_id}", response_model=dict)
def delete_question(question_id: int, session: Session = Depends(get_session)):
    question = session.get(Question, question_id)
    if not question:
        raise HTTPException(status_code=404, detail="Không tìm thấy câu hỏi")

    options = session.exec(select(Option).where(Option.question_id == question_id)).all()
    for option in options:
        session.delete(option)
    session.delete(question)
    session.commit()
    return {"message": "Xóa câu hỏi và các lựa chọn liên quan thành công"}

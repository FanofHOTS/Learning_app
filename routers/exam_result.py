from datetime import datetime, timezone
from database.engine import create_db_engine
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select, Field, SQLModel

router = APIRouter(prefix="/exam_result", tags=["exam_result"])


def get_session():
    with Session(create_db_engine()) as session:
        yield session


class ExamResult(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", nullable=False)
    exam_id: int = Field(foreign_key="exam.id", nullable=False)
    score: float = Field(nullable=False)
    total_questions: int = Field(nullable=False)
    correct_answers: int = Field(nullable=False)
    is_passed: bool = Field(nullable=False)
    #submitted_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), nullable=False)
    #answers: Optional[str] = Field(default=None, nullable=True)


# Lấy danh sách tất cả kết quả bài thi
@router.get("/", response_model=List[ExamResult])
def get_all_exam_results(session: Session = Depends(get_session)):
    return session.exec(select(ExamResult)).all()

# Lấy danh sách kết quả bài thi theo id người dùng
@router.get("/user/{user_id}", response_model=List[ExamResult])
def get_results_by_user(user_id: int, session: Session = Depends(get_session)):
    results = session.exec(select(ExamResult).where(ExamResult.user_id == user_id)).all()
    if not results:
        raise HTTPException(status_code=404, detail="Không tìm thấy kết quả bài thi cho người dùng này")
    return results

# Lấy danh sách kết quả bài thi theo id bài thi
@router.get("/exam/{exam_id}", response_model=List[ExamResult])
def get_results_by_exam(exam_id: int, session: Session = Depends(get_session)):
    results = session.exec(select(ExamResult).where(ExamResult.exam_id == exam_id)).all()
    if not results:
        raise HTTPException(status_code=404, detail="Không tìm thấy kết quả bài thi cho bài thi này")
    return results

# Lấy kết quả bài thi theo id
@router.get("/{result_id}", response_model=ExamResult)
def get_exam_result(result_id: int, session: Session = Depends(get_session)):
    result = session.get(ExamResult, result_id)
    if not result:
        raise HTTPException(status_code=404, detail="Không tìm thấy kết quả bài thi")
    return result

# Nộp bài thi (tạo kết quả bài thi mới)
@router.post("/submit", response_model=ExamResult)
def submit_exam_result(result: ExamResult, session: Session = Depends(get_session)):
    session.add(result)
    session.commit()
    session.refresh(result)
    return result

# Nếu người dùng thi lại bài thi vì không đạt hoặc điểm không như ý muốn, hệ thống sẽ tạo kết quả thi mới thay vì sửa lại kết quả thi cũ

# Xóa kết quả bài thi
@router.delete("/delete/{result_id}", response_model=dict)
def delete_exam_result(result_id: int, session: Session = Depends(get_session)):
    result = session.get(ExamResult, result_id)
    if not result:
        raise HTTPException(status_code=404, detail="Không tìm thấy kết quả bài thi")
    session.delete(result)
    session.commit()
    return {"message": "Xóa kết quả bài thi thành công"}

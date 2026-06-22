from database.engine import create_db_engine
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Form
from sqlmodel import Session, select, Field, SQLModel, create_engine
from datetime import datetime, timezone

router = APIRouter(prefix="/course_progress", tags=["course_progress"])

def get_session():
    with Session(create_db_engine()) as session:
        yield session

class CourseProgress(SQLModel, table=True):
    __tablename__ = "course_progress"

    id: Optional[int] = Field(default=None, primary_key=True)
    course_id: Optional[int] = Field(default=1, nullable=False, foreign_key="course.id")
    user_id: Optional[int] = Field(default=1, nullable=False, foreign_key="user.id")
    module_completed: int = Field(default=0, nullable=False)
    is_complete: bool = Field(default=False, nullable=False)
    final_score: int = Field(default=0, nullable=True)
    completed_at: Optional[datetime] = Field(default=None, nullable=True)

# Lấy danh sách tiến trình học khóa học
@router.get("/", response_model=List[CourseProgress])
def get_all_course_progress(session: Session = Depends(get_session)):
    return session.exec(select(CourseProgress)).all()

# Lấy danh sách tiến trình học khóa học dựa trên id khóa học
@router.get("/course/{course_id}", response_model=List[CourseProgress])
def get_course_progress_by_course_id(course_id: int, session: Session = Depends(get_session)):
    course_progress = session.exec(select(CourseProgress).where(CourseProgress.course_id == course_id)).all()
    if not course_progress:
        raise HTTPException(status_code=404, detail="Không tìm thấy tiến trình học khóa học nào theo id khóa học")
    return course_progress

# Lấy danh sách tiến trình học khóa học dựa trên id người học
@router.get("/user/{user_id}", response_model=List[CourseProgress])
def get_course_progress_by_user_id(user_id: int, session: Session = Depends(get_session)):
    course_progress = session.exec(select(CourseProgress).where(CourseProgress.user_id == user_id)).all()
    if not course_progress:
        raise HTTPException(status_code=404, detail="Không tìm thấy tiến trình học khóa học nào theo id người học")
    return course_progress

# Lấy tiến trình học khóa học theo id của khóa học và người học 
@router.get("/{course_id}/{user_id}", response_model=CourseProgress)
def get_course_progress(course_id: int, user_id: int, session: Session = Depends(get_session)):
    course_progress = session.exec(select(CourseProgress).where(CourseProgress.course_id == course_id and CourseProgress.user_id == user_id)).first()
    if not course_progress:
        raise HTTPException(status_code=404, detail="Không tìm thấy tiến trình học khóa học")
    return course_progress

def _apply_course_completion_fields(course_progress: CourseProgress) -> None:
    if course_progress.is_complete and course_progress.completed_at is None:
        course_progress.completed_at = datetime.now(timezone.utc)


def _maybe_issue_certificate(session: Session, user_id: int, course_id: int) -> None:
    from services.certificate_service import issue_certificate_if_completed

    issue_certificate_if_completed(session, user_id, course_id)


# Tạo tiến trình học khóa học mới
@router.post("/create", response_model=CourseProgress)
def create_course_progress(course_progress: CourseProgress, session: Session = Depends(get_session)):
    _apply_course_completion_fields(course_progress)
    session.add(course_progress)
    session.commit()
    session.refresh(course_progress)
    if course_progress.is_complete:
        _maybe_issue_certificate(
            session,
            course_progress.user_id,
            course_progress.course_id,
        )
    return course_progress

# Chỉnh sửa tiến trình học khóa học
@router.put("/update/{course_id}/{user_id}", response_model=CourseProgress)
def update_course_progress(course_id: int, user_id: int, module_data: CourseProgress, session: Session = Depends(get_session)):
    course_progress = session.exec(
        select(CourseProgress).where(
            CourseProgress.course_id == course_id,
            CourseProgress.user_id == user_id,
        )
    ).first()
    if not course_progress:
        raise HTTPException(status_code=404, detail="Không tìm thấy tiến trình học khóa học")
    for key, value in module_data.model_dump(exclude_unset=True).items():
        setattr(course_progress, key, value)
    _apply_course_completion_fields(course_progress)
    session.commit()
    session.refresh(course_progress)
    if course_progress.is_complete:
        _maybe_issue_certificate(session, user_id, course_id)
    return course_progress

# Xóa tiến trình học khóa học
@router.delete("/delete/{course_id}/{user_id}")
def delete_course_progress(course_id: int, user_id: int, session: Session = Depends(get_session)):
    course_progress= session.exec(select(CourseProgress).where(CourseProgress.course_id == course_id and CourseProgress.user_id == user_id)).first()
    if not course_progress:
        raise HTTPException(status_code=404, detail="Không tìm thấy tiến trình học khóa học")
    session.delete(course_progress)
    session.commit()
    return {"message": "Đã xóa tiến trình học khóa học"}
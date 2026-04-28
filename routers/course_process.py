from database.engine import create_db_engine
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Form
from sqlmodel import Session, select, Field, SQLModel, create_engine

router = APIRouter(prefix="/course_process", tags=["course_process"])

def get_session():
    with Session(create_db_engine()) as session:
        yield session

class CourseProcess(SQLModel, table=True):
    course_id: Optional[int] = Field(default=1, nullable=False, foreign_key="course.id")
    user_id: Optional[int] = Field(default=1, nullable=False, foreign_key="user.id")
    module_completed: int = Field(default=0, nullable=False)
    is_complete: bool = Field(default=False, nullable=False)
    final_score: int = Field(default=0, nullable=True)

# Lấy danh sách tiến trình học khóa học
@router.get("/", response_model=List[CourseProcess])
def get_all_course_process(session: Session = Depends(get_session)):
    return session.exec(select(CourseProcess)).all()

# Lấy danh sách tiến trình học khóa học dựa trên id khóa học
@router.get("/course/{course_id}", response_model=List[CourseProcess])
def get_course_process_by_course_id(course_id: int, session: Session = Depends(get_session)):
    course_process = session.exec(select(CourseProcess).where(CourseProcess.course_id == course_id)).all()
    if not course_process:
        raise HTTPException(status_code=404, detail="Không tìm thấy tiến trình học khóa học nào theo id khóa học")
    return course_process

# Lấy danh sách tiến trình học khóa học dựa trên id người học
@router.get("/user/{user_id}", response_model=List[CourseProcess])
def get_course_process_by_user_id(user_id: int, session: Session = Depends(get_session)):
    course_process = session.exec(select(CourseProcess).where(CourseProcess.user_id == user_id)).all()
    if not course_process:
        raise HTTPException(status_code=404, detail="Không tìm thấy tiến trình học khóa học nào theo id người học")
    return course_process

# Lấy tiến trình học khóa học theo id của khóa học và người học 
@router.get("/{course_id}/{user_id}", response_model=CourseProcess)
def get_course_process(course_id: int, user_id: int, session: Session = Depends(get_session)):
    course_process = session.exec(select(CourseProcess).where(CourseProcess.course_id == course_id and CourseProcess.user_id == user_id)).first()
    if not course_process:
        raise HTTPException(status_code=404, detail="Không tìm thấy tiến trình học khóa học")
    return course_process

# Tạo tiến trình học khóa học mới
@router.post("/create", response_model=CourseProcess)
def create_course_process(course_process: CourseProcess, session: Session = Depends(get_session)):
    session.add(course_process)
    session.commit()
    session.refresh(course_process)
    return course_process

# Chỉnh sửa tiến trình học khóa học
@router.put("/update/{course_id}/{user_id}", response_model=CourseProcess)
def update_course_process(course_id: int, user_id: int, module_data: CourseProcess, session: Session = Depends(get_session)):
    course_process= session.exec(select(CourseProcess).where(CourseProcess.course_id == course_id and CourseProcess.user_id == user_id)).first()
    if not course_process:
        raise HTTPException(status_code=404, detail="Không tìm thấy tiến trình học khóa học")
    for key, value in module_data.model_dump(exclude_unset=True).items():
        setattr(course_process, key, value)
    # session.add(course_process)
    session.commit()
    session.refresh(course_process)
    return course_process

# Xóa tiến trình học khóa học
@router.delete("/delete/{course_id}/{user_id}")
def delete_course_process(course_id: int, user_id: int, session: Session = Depends(get_session)):
    course_process= session.exec(select(CourseProcess).where(CourseProcess.course_id == course_id and CourseProcess.user_id == user_id)).first()
    if not course_process:
        raise HTTPException(status_code=404, detail="Không tìm thấy tiến trình học khóa học")
    session.delete(course_process)
    session.commit()
    return {"message": "Đã xóa tiến trình học khóa học"}
from database.engine import create_db_engine
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Form
from sqlmodel import Session, select, Field, SQLModel, create_engine
from datetime import datetime, timezone

router = APIRouter(prefix="/module_progress", tags=["module_progress"])

def get_session():
    with Session(create_db_engine()) as session:
        yield session

class ModuleProgress(SQLModel, table=True):
    __tablename__ = "module_progress"

    course_id: Optional[int] = Field(default=1, nullable=False, foreign_key="course.id")
    module_id: Optional[int] = Field(default=1, nullable=False, foreign_key="module.id")
    user_id: Optional[int] = Field(default=1, nullable=False, foreign_key="user.id")
    #score: int = Field(default=0, nullable=False)
    components_completed: int = Field(default=0, nullable=False)
    is_complete: bool = Field(default=False, nullable=False)
    completed_at: Optional[datetime] = Field(default=None, nullable=True)

# Lấy danh sách tiến trình học module khóa học
@router.get("/", response_model=List[ModuleProgress])
def get_all_module_progress(session: Session = Depends(get_session)):
    return session.exec(select(ModuleProgress)).all()

# Lấy danh sách tiến trình học module khóa học dựa trên id module khóa học
@router.get("/module/{module_id}", response_model=List[ModuleProgress])
def get_module_progress_by_module_id(module_id: int, session: Session = Depends(get_session)):
    module_progress = session.exec(select(ModuleProgress).where(ModuleProgress.module_id == module_id)).all()
    if not module_progress:
        raise HTTPException(status_code=404, detail="Không tìm thấy tiến trình học module khóa học nào theo id module khóa học")
    return module_progress

# Lấy danh sách tiến trình học module khóa học dựa trên id người học
@router.get("/user/{user_id}", response_model=List[ModuleProgress])
def get_module_progress_by_user_id(user_id: int, session: Session = Depends(get_session)):
    module_progress = session.exec(select(ModuleProgress).where(ModuleProgress.user_id == user_id)).all()
    if not module_progress:
        raise HTTPException(status_code=404, detail="Không tìm thấy tiến trình học module khóa học nào theo id người học")
    return module_progress

# Lấy tiến trình học module khóa học theo id của module khóa học và người học 
@router.get("/{module_id}/{user_id}", response_model=ModuleProgress)
def get_module_progress(module_id: int, user_id: int, session: Session = Depends(get_session)):
    module_progress = session.exec(select(ModuleProgress).where(ModuleProgress.module_id == module_id and ModuleProgress.user_id == user_id)).first()
    if not module_progress:
        raise HTTPException(status_code=404, detail="Không tìm thấy tiến trình học module khóa học")
    return module_progress

# Tạo tiến trình học module khóa học mới
@router.post("/create", response_model=ModuleProgress)
def create_module_progress(module_progress: ModuleProgress, session: Session = Depends(get_session)):
    session.add(module_progress)
    session.commit()
    session.refresh(module_progress)
    return module_progress

# Chỉnh sửa tiến trình học module khóa học
@router.put("/update/{module_id}/{user_id}", response_model=ModuleProgress)
def update_module_progress(module_id: int, user_id: int, module_data: ModuleProgress, session: Session = Depends(get_session)):
    module_progress= session.exec(select(ModuleProgress).where(ModuleProgress.module_id == module_id and ModuleProgress.user_id == user_id)).first()
    if not module_progress:
        raise HTTPException(status_code=404, detail="Không tìm thấy tiến trình học module khóa học")
    for key, value in module_data.model_dump(exclude_unset=True).items():
        setattr(module_progress, key, value)
    # session.add(module_progress)
    session.commit()
    session.refresh(module_progress)
    return module_progress

# Xóa tiến trình học module khóa học
@router.delete("/delete/{module_id}/{user_id}")
def delete_module_progress(module_id: int, user_id: int, session: Session = Depends(get_session)):
    module_progress= session.exec(select(ModuleProgress).where(ModuleProgress.module_id == module_id and ModuleProgress.user_id == user_id)).first()
    if not module_progress:
        raise HTTPException(status_code=404, detail="Không tìm thấy tiến trình học module khóa học")
    session.delete(module_progress)
    session.commit()
    return {"message": "Đã xóa tiến trình học module khóa học"}
from database.engine import create_db_engine
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Form
from sqlmodel import Session, select, Field, SQLModel, create_engine
from datetime import datetime, timezone

from models.module_progress import ModuleProgress

router = APIRouter(prefix="/module_progress", tags=["module_progress"])

def get_session():
    with Session(create_db_engine()) as session:
        yield session


class ModuleProgressRequest(SQLModel):
    id: Optional[int] = None
    course_id: Optional[int] = 1
    module_id: Optional[int] = 1
    user_id: Optional[int] = 1
    components_completed: int = 0
    is_complete: bool = False
    completed_at: Optional[datetime] = None


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
def create_module_progress(module_progress: ModuleProgressRequest, session: Session = Depends(get_session)):
    progress_record = ModuleProgress(**module_progress.model_dump())
    session.add(progress_record)
    session.commit()
    session.refresh(progress_record)
    return progress_record

# Chỉnh sửa tiến trình học module khóa học
@router.put("/update/{module_id}/{user_id}", response_model=ModuleProgress)
def update_module_progress(module_id: int, user_id: int, module_data: ModuleProgressRequest, session: Session = Depends(get_session)):
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
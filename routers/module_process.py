from database.engine import create_db_engine
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Form
from sqlmodel import Session, select, Field, SQLModel, create_engine

router = APIRouter(prefix="/module_process", tags=["module_process"])

def get_session():
    with Session(create_db_engine()) as session:
        yield session

class ModuleProcess(SQLModel, table=True):
    module_id: Optional[int] = Field(default=1, nullable=False, foreign_key="module.id")
    user_id: Optional[int] = Field(default=1, nullable=False, foreign_key="user.id")
    score: int = Field(default=0, nullable=False)
    is_complete: bool = Field(default=False, nullable=False)

# Lấy danh sách tiến trình học module khóa học
@router.get("/", response_model=List[ModuleProcess])
def get_all_module_process(session: Session = Depends(get_session)):
    return session.exec(select(ModuleProcess)).all()

# Lấy danh sách tiến trình học module khóa học dựa trên id module khóa học
@router.get("/module/{module_id}", response_model=List[ModuleProcess])
def get_module_process_by_module_id(module_id: int, session: Session = Depends(get_session)):
    module_process = session.exec(select(ModuleProcess).where(ModuleProcess.module_id == module_id)).all()
    if not module_process:
        raise HTTPException(status_code=404, detail="Không tìm thấy tiến trình học module khóa học nào theo id module khóa học")
    return module_process

# Lấy danh sách tiến trình học module khóa học dựa trên id người học
@router.get("/user/{user_id}", response_model=List[ModuleProcess])
def get_module_process_by_user_id(user_id: int, session: Session = Depends(get_session)):
    module_process = session.exec(select(ModuleProcess).where(ModuleProcess.user_id == user_id)).all()
    if not module_process:
        raise HTTPException(status_code=404, detail="Không tìm thấy tiến trình học module khóa học nào theo id người học")
    return module_process

# Lấy tiến trình học module khóa học theo id của module khóa học và người học 
@router.get("/{module_id}/{user_id}", response_model=ModuleProcess)
def get_module_process(module_id: int, user_id: int, session: Session = Depends(get_session)):
    module_process = session.exec(select(ModuleProcess).where(ModuleProcess.module_id == module_id and ModuleProcess.user_id == user_id)).first()
    if not module_process:
        raise HTTPException(status_code=404, detail="Không tìm thấy tiến trình học module khóa học")
    return module_process

# Tạo tiến trình học module khóa học mới
@router.post("/create", response_model=ModuleProcess)
def create_module_process(module_process: ModuleProcess, session: Session = Depends(get_session)):
    session.add(module_process)
    session.commit()
    session.refresh(module_process)
    return module_process

# Chỉnh sửa tiến trình học module khóa học
@router.put("/update/{module_id}/{user_id}", response_model=ModuleProcess)
def update_module_process(module_id: int, user_id: int, module_data: ModuleProcess, session: Session = Depends(get_session)):
    module_process= session.exec(select(ModuleProcess).where(ModuleProcess.module_id == module_id and ModuleProcess.user_id == user_id)).first()
    if not module_process:
        raise HTTPException(status_code=404, detail="Không tìm thấy tiến trình học module khóa học")
    for key, value in module_data.model_dump(exclude_unset=True).items():
        setattr(module_process, key, value)
    # session.add(course_process)
    session.commit()
    session.refresh(module_process)
    return module_process

# Xóa tiến trình học module khóa học
@router.delete("/delete/{module_id}/{user_id}")
def delete_module_process(module_id: int, user_id: int, session: Session = Depends(get_session)):
    module_process= session.exec(select(ModuleProcess).where(ModuleProcess.module_id == module_id and ModuleProcess.user_id == user_id)).first()
    if not module_process:
        raise HTTPException(status_code=404, detail="Không tìm thấy tiến trình học module khóa học")
    session.delete(module_process)
    session.commit()
    return {"message": "Đã xóa tiến trình học module khóa học"}
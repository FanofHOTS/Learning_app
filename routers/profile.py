from database.engine import create_db_engine
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Form
from sqlmodel import Session, select, Field, SQLModel, create_engine

router = APIRouter(prefix="/profile", tags=["profile"])

def get_session():
    with Session(create_db_engine()) as session:
        yield session

class Profile(SQLModel, table=True):
    __tablename__ = "profile"

    user_id: Optional[int] = Field(default=None, primary_key=True, foreign_key="user.id", sa_column_kwargs={'autoincrement': False})
    name: str = Field(default="Tên thật người dùng", nullable=False)
    email: str = Field(default="nguoidung@gmail.com", nullable=False, unique=True)
    location: str = Field(default="Địa chỉ người dùng", nullable=False)
    #birth_year: int = Field(default=2003, nullable=False)
    organization: str = Field(default="Tên trường học hoặc tổ chức", nullable=False)
    description: str = Field(default="Mô tả ngắn gọn người dùng", nullable=False)

# Lấy danh sách profile của người dùng
@router.get("/", response_model=List[Profile])
def get_all_users_profile(session: Session = Depends(get_session)):
    return session.exec(select(Profile)).all()

# Lấy profile người dùng theo id
@router.get("/{use_id}", response_model=Profile)
def get_user_profile(use_id: int, session: Session = Depends(get_session)):
    user_profile = session.get(Profile, use_id)
    if not user_profile:
        raise HTTPException(status_code=404, detail="Không tìm thấy profile của người dùng")
    return user_profile

# Profile sẽ được tạo ra khi tạo người dùng mới

# Chỉnh sửa profile người dùng 
@router.put("/update/{user_id}", response_model=Profile)
def update_user_profile(user_id: int, user_data: Profile, session: Session = Depends(get_session)):
    user_profile= session.get(Profile, user_id)
    if not user_profile:
        raise HTTPException(status_code=404, detail="Không tìm thấy profile của người dùng")
    for key, value in user_data.model_dump(exclude_unset=True).items():
        setattr(user_profile, key, value)
    # session.add(user_profile)
    session.commit()
    session.refresh(user_profile)
    return user_profile

# Profile sẽ được xóa cùng với người dùng

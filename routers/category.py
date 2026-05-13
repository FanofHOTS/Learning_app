from datetime import datetime, timedelta, timezone
from database.engine import create_db_engine
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Form
from sqlmodel import Session, select, Field, SQLModel, create_engine

router = APIRouter(prefix="/category", tags=["category"])

def get_session():
    with Session(create_db_engine()) as session:
        yield session

class Category(SQLModel, table=True):
    __tablename__ = "category"

    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(default="Tên của phân loại", nullable=False)
    description: str = Field(default="Mô tả phân loại", nullable=False)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), nullable=False, sa_type=datetime)
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), nullable=False, sa_type=datetime)

# Lấy danh sách phân loại
@router.get("/", response_model=List[Category])
def get_all_category(session: Session = Depends(get_session)):
    return session.exec(select(Category)).all()

# Lấy phân loại theo id
@router.get("/{category_id}", response_model=Category)
def get_category(category_id: int, session: Session = Depends(get_session)):
    category = session.get(Category, category_id)
    if not category:
        raise HTTPException(status_code=404, detail="Không tìm thấy phân loại")
    return category

# Tạo phân loại mới
@router.post("/create", response_model= Category)
def create_category(category: Category, session: Session = Depends(get_session)):
    session.add(category)
    session.commit()
    session.refresh(category)
    return category

# Chỉnh sửa phân loại
@router.put("/update/{category_id}", response_model=Category)
def update_category(category_id: int, module_data: Category, session: Session = Depends(get_session)):
    category= session.get(Category, category_id)
    if not category:
        raise HTTPException(status_code=404, detail="Không tìm thấy phân loại")
    for key, value in module_data.model_dump(exclude_unset=True).items():
        setattr(category, key, value)
    # session.add(category)
    session.commit()
    session.refresh(category)
    return category

# Xóa phân loại
@router.delete("/delete/{category_id}")
def delete_category(category_id: int, session: Session = Depends(get_session)):
    category= session.get(Category, category_id)
    if not category:
        raise HTTPException(status_code=404, detail="Không tìm thấy phân loại")
    session.delete(category)
    session.commit()
    return {"message": "Đã xóa phân loại"}
from datetime import datetime, timezone
from database.engine import create_db_engine
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select, Field, SQLModel

from models.option import Option

router = APIRouter(prefix="/option", tags=["option"])


def get_session():
    with Session(create_db_engine()) as session:
        yield session


# Lấy danh sách lựa chọn
@router.get("/", response_model=List[Option])
def get_all_options(session: Session = Depends(get_session)):
    return session.exec(select(Option)).all()

# Lấy danh sách lựa chọn dựa trên id của câu hỏi
@router.get("/question/{question_id}", response_model=List[Option])
def get_options_by_question(question_id: int, session: Session = Depends(get_session)):
    options = session.exec(
        select(Option).where(Option.question_id == question_id)
    ).all()
    if not options:
        raise HTTPException(
            status_code=404, detail="Không tìm thấy lựa chọn cho câu hỏi này"
        )
    return options

# Lấy lựa chọn theo id
@router.get("/{option_id}", response_model=Option)
def get_option(option_id: int, session: Session = Depends(get_session)):
    option = session.get(Option, option_id)
    if not option:
        raise HTTPException(status_code=404, detail="Không tìm thấy lựa chọn")
    return option

# Tạo lựa chọn
@router.post("/create", response_model=Option)
def create_option(option: Option, session: Session = Depends(get_session)):
    session.add(option)
    session.commit()
    session.refresh(option)
    return option

# Chỉnh sửa lựa chọn
@router.put("/update/{option_id}", response_model=Option)
def update_option(option_id: int, option_data: Option, session: Session = Depends(get_session)):
    option = session.get(Option, option_id)
    if not option:
        raise HTTPException(status_code=404, detail="Không tìm thấy lựa chọn")
    for key, value in option_data.model_dump(exclude_unset=True).items():
        setattr(option, key, value)
    session.commit()
    session.refresh(option)
    return option

# Xóa lựa chọn
@router.delete("/delete/{option_id}", response_model=dict)
def delete_option(option_id: int, session: Session = Depends(get_session)):
    option = session.get(Option, option_id)
    if not option:
        raise HTTPException(status_code=404, detail="Không tìm thấy lựa chọn")
    session.delete(option)
    session.commit()
    return {"message": "Xóa lựa chọn thành công"}

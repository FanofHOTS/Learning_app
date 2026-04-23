from database.engine import create_db_engine
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Form
from sqlmodel import Session, select, Field, SQLModel, create_engine

router = APIRouter(prefix="/category", tags=["category"])

def get_session():
    with Session(create_db_engine()) as session:
        yield session

class User(SQLModel, table=True):
    TenDangNhap: str | None = Field(primary_key=True, max_length=50, nullable=False, sa_column_kwargs={'autoincrement': False})
    MatKhau: bytes = Field(nullable=False)
    MaNV: int = Field(default=None, foreign_key="nhanvien.MaNV", nullable=False)
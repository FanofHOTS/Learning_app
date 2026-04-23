from database.engine import create_db_engine
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Form, status
from sqlmodel import Session, select, Field, SQLModel, create_engine
import jwt
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jwt.exceptions import InvalidTokenError
from datetime import datetime, timedelta, timezone
from pwdlib import PasswordHash
from pydantic import BaseModel
from routers.profile import Profile

SECRET_KEY = "09d25e094faa6ca2556c818166b7a9563b93f7099f6f0f4caa6cf63b88e8d3e7"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 120

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/user/login")

password_hash = PasswordHash.recommended()

router = APIRouter(prefix="/user", tags=["user"])

def get_session():
    with Session(create_db_engine()) as session:
        yield session

class User(SQLModel, table=True):
    id: Optional[int] = Field(primary_key=True, nullable=False, unique=True)
    username: str = Field(default="Tên người dùng", nullable=False, unique=True)
    email: str = Field(default="nguoidung@gmail.com", nullable=False, unique=True)
    password: str = Field(nullable=False)
    icon: str = Field(default="icon")
    role: str = Field(default="student", nullable=False)
    # is_active: bool = Field(default=True, nullable=False)
    

class Token(BaseModel):
    access_token: str
    token_type: str

def verify_password(plain_password, hashed_password):
    return password_hash.verify(plain_password, hashed_password)

def get_password_hash(password):
    return password_hash.hash(password)

def create_access_token(data: dict, expires_delta: timedelta | None = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=120)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(token: str = Depends(oauth2_scheme), session: Session = Depends(get_session)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Không thể xác thực người dùng",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username = payload.get("sub")
        if username is None:
            raise credentials_exception
    except InvalidTokenError:
        raise credentials_exception
    user = session.exec(select(User).where(User.username == username)).first()
    if user is None:
        raise credentials_exception
    return user

async def get_current_active_user(current_user = Depends(get_current_user)):
    if current_user is None:
        raise HTTPException(status_code=400, detail="Người dùng đã hết phiên đăng nhập")
    return current_user

# Lấy danh sách người dùng
@router.get("/", response_model=List[User])
def get_all_users(session: Session = Depends(get_session)):
    return session.exec(select(User)).all()

# Lấy người dùng theo id
@router.get("/{use_id}", response_model=User)
def get_user(use_id: int, session: Session = Depends(get_session)):
    user = session.get(User, use_id)
    if not user:
        raise HTTPException(status_code=404, detail="Không tìm thấy người dùng")
    return user

# Tạo người dùng mới cùng với profile của họ
@router.post("/create", response_model=User)
def create_user(user: User, session: Session = Depends(get_session)):
    user.password= get_password_hash(user.password)
    session.add(user)
    session.commit()
    session.refresh(user)
    user_profile = Profile(user_id=user.id,name=user.username ,email=user.email)
    session.add(user_profile)
    session.commit()
    session.refresh(user_profile)
    return user

# Chỉnh sửa người dùng 
@router.put("/update/{user_id}", response_model=User)
def update_user(user_id: int, user_data: User, session: Session = Depends(get_session)):
    user= session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Không tìm thấy người dùng")
    for key, value in user_data.model_dump(exclude_unset=True).items():
        setattr(user, key, value)
    # session.add(user)
    session.commit()
    session.refresh(user)
    return user

# Xóa người dùng với profile của họ
@router.delete("/delete/{user_id}")
def delete_user(user_id: int, session: Session = Depends(get_session)):
    user = session.get(User, user_id)
    user_profile = session.get(Profile, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Không tìm thấy người dùng")
    session.delete(user_profile)
    session.delete(user)
    session.commit()
    return {"message": "Đã xóa người dùng"}

# Đăng nhập người dùng và tạo token đăng nhập
@router.post("/login", response_model=Token)
async def login(form_data: OAuth2PasswordRequestForm = Depends(), session: Session = Depends(get_session)):
    user = session.exec(select(User).where(User.username == form_data.username or User.email == form_data.username)).first()
    if not user:
        raise HTTPException(status_code=400, detail="Tên người dùng hoặc mật khẩu không đúng")
    if not verify_password(form_data.password, user.password):
        raise HTTPException(status_code=400, detail="Tên người dùng hoặc mật khẩu không đúng")
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(data={"sub": user.username}, expires_delta=access_token_expires)
    return Token(access_token=access_token, token_type="bearer")

# Lấy thông tin người dùng hiện tại
@router.get("/me")
async def user_me(current_user: User = Depends(get_current_active_user)):
    return current_user
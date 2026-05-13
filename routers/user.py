from datetime import datetime, timedelta, timezone
from email.message import EmailMessage
from typing import List, Optional
import os
import re
import secrets
import smtplib
import string

import jwt
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jwt.exceptions import InvalidTokenError
from pwdlib import PasswordHash
from pydantic import BaseModel
from sqlalchemy import func
from sqlmodel import Field, SQLModel, Session, select

from database.engine import create_db_engine
from routers.profile import Profile

SECRET_KEY = os.getenv(
    "SECRET_KEY",
    "09d25e094faa6ca25vo63b93f7099thienf6f0f4caa6cfson63b88e8d3e7",
)
ALGORITHM = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "120"))
REGISTER_ALLOWED = os.getenv("REGISTER_ALLOWED", "false").strip().lower() == "true"

EMAIL_PATTERN = re.compile(r"^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$")
DEMO_ALLOWED_EMAIL_DOMAINS = {
    "admin.edu.vn",
    "example.com",
    "instructor.edu.vn",
    "student.edu.vn",
}

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/user/login")
password_hash = PasswordHash.recommended()

router = APIRouter(prefix="/user", tags=["user"])


def get_session():
    with Session(create_db_engine()) as session:
        yield session


class User(SQLModel, table=True):
    __tablename__ = "user"

    id: Optional[int] = Field(default=None, primary_key=True)
    username: str = Field(default="Tên người dùng", nullable=False, unique=True)
    email: str = Field(default="nguoidung@gmail.com", nullable=False, unique=True)
    password: str = Field(nullable=False)
    icon: str = Field(default="/icon.png")
    role: str = Field(default="student", nullable=False)
    # is_active: bool = Field(default=True, nullable=False)
    is_password_reset: bool = Field(
        default=False,
        nullable=False,
        description="Có cần thay đổi mật khẩu sau khi đăng nhập không?",
    )
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), nullable=False, sa_type=datetime)
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), nullable=False, sa_type=datetime)


class UserPublic(BaseModel):
    id: Optional[int]
    username: Optional[str]
    email: Optional[str]
    icon: Optional[str]
    role: Optional[str]
    is_password_reset: Optional[bool]


class UserUpdate(BaseModel):
    username: Optional[str] = None
    email: Optional[str] = None
    password: Optional[str] = None
    icon: Optional[str] = None
    role: Optional[str] = None
    is_password_reset: Optional[bool] = None


class UserCreate(BaseModel):
    username: str
    email: str
    password: str
    icon: str = "/icon.png"
    role: str = "student"


class LoginPayload(BaseModel):
    userdata: str
    login_password: str


class Token(BaseModel):
    access_token: str
    token_type: str


class AdminCreateUserRequest(BaseModel):
    username: str
    email: str
    role: str = "student"
    icon: str = "/icon.png"
    name: Optional[str] = None
    location: str = "Thành phố Hồ Chí Minh"
    organization: str = "Đơn vị chưa cập nhật"
    description: str = "Tài khoản được tạo bởi quản trị viên."
    specialization: str = "Chưa cập nhật"


class AdminCreateUserResponse(BaseModel):
    user: UserPublic
    generated_password: str
    email_delivery_status: str


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return password_hash.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    return password_hash.hash(password)


def create_access_token(data: dict, expires_delta: timedelta | None = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def normalize_text(value: Optional[str]) -> str:
    return (value or "").strip()


def validate_required_text(value: str, label: str) -> str:
    normalized = normalize_text(value)
    if not normalized:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"{label} không được để trống.",
        )
    return normalized


def validate_email_value(email: str) -> str:
    normalized_email = validate_required_text(email, "Email").lower()
    if not EMAIL_PATTERN.fullmatch(normalized_email):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Email không đúng định dạng.",
        )

    email_domain = normalized_email.rsplit("@", 1)[-1]
    if email_domain not in DEMO_ALLOWED_EMAIL_DOMAINS:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                "Tạm thời hệ thống chỉ xác nhận các email mẫu thuộc những miền "
                "student.edu.vn, instructor.edu.vn, admin.edu.vn hoặc example.com."
            ),
        )

    return normalized_email


def validate_role_value(role: str) -> str:
    normalized_role = validate_required_text(role, "Vai trò").lower()
    allowed_roles = {"admin", "instructor", "student"}
    if normalized_role not in allowed_roles:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Vai trò không hợp lệ.",
        )
    return normalized_role


def build_user_public(user: User) -> UserPublic:
    return UserPublic(
        id=user.id,
        username=user.username,
        email=user.email,
        icon=user.icon,
        role=user.role,
        is_password_reset=user.is_password_reset,
    )


def ensure_unique_user_identity(
    session: Session,
    username: str,
    email: str,
    exclude_user_id: Optional[int] = None,
) -> None:
    existing_users = session.exec(select(User)).all()
    normalized_username = username.lower()
    normalized_email = email.lower()

    for existing_user in existing_users:
        if exclude_user_id is not None and existing_user.id == exclude_user_id:
            continue

        if normalize_text(existing_user.username).lower() == normalized_username:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Tên đăng nhập đã tồn tại trong hệ thống.",
            )

        if normalize_text(existing_user.email).lower() == normalized_email:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Email đã tồn tại trong hệ thống.",
            )


def create_default_profile(user: User) -> Profile:
    return Profile(
        user_id=user.id,
        name=user.username,
        email=user.email,
        location="Thành phố Hồ Chí Minh",
        organization="Đơn vị chưa cập nhật",
        description="Tài khoản được tạo từ biểu mẫu đăng ký.",
        specialization="Chưa cập nhật",
    )


def create_admin_profile(user: User, payload: AdminCreateUserRequest) -> Profile:
    profile_name = normalize_text(payload.name) or user.username
    return Profile(
        user_id=user.id,
        name=profile_name,
        email=user.email,
        location=validate_required_text(payload.location, "Địa điểm"),
        organization=validate_required_text(payload.organization, "Tổ chức"),
        description=validate_required_text(payload.description, "Mô tả"),
        specialization=normalize_text(payload.specialization) or "Chưa cập nhật",
    )


def generate_random_password(length: int = 12) -> str:
    lowercase = secrets.choice(string.ascii_lowercase)
    uppercase = secrets.choice(string.ascii_uppercase)
    digit = secrets.choice(string.digits)
    alphabet = string.ascii_letters + string.digits
    password_chars = [lowercase, uppercase, digit]
    password_chars.extend(secrets.choice(alphabet) for _ in range(max(length - 3, 9)))
    secrets.SystemRandom().shuffle(password_chars)
    return "".join(password_chars)


def send_new_user_credentials_email(
    recipient_email: str,
    username: str,
    raw_password: str,
) -> str:
    smtp_host = os.getenv("SMTP_HOST")
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_username = os.getenv("SMTP_USERNAME")
    smtp_password = os.getenv("SMTP_PASSWORD")
    smtp_from_email = os.getenv("SMTP_FROM_EMAIL")
    smtp_use_tls = os.getenv("SMTP_USE_TLS", "true").lower() != "false"

    if not smtp_host or not smtp_from_email:
        return (
            f"Chưa cấu hình SMTP nên hệ thống chưa thể gửi email tự động tới "
            f"{recipient_email}."
        )

    message = EmailMessage()
    message["Subject"] = "Thông tin tài khoản học tập mới"
    message["From"] = smtp_from_email
    message["To"] = recipient_email
    message.set_content(
        "\n".join(
            [
                "Xin chào,",
                "",
                "Quản trị viên đã tạo tài khoản mới cho bạn trên hệ thống học tập.",
                f"Tên đăng nhập: {username}",
                f"Mật khẩu tạm thời: {raw_password}",
                "",
                "Vui lòng đăng nhập và đổi mật khẩu ngay sau lần truy cập đầu tiên.",
            ]
        )
    )

    try:
        with smtplib.SMTP(smtp_host, smtp_port, timeout=15) as smtp:
            if smtp_use_tls:
                smtp.starttls()
            if smtp_username and smtp_password:
                smtp.login(smtp_username, smtp_password)
            smtp.send_message(message)
    except Exception:
        return (
            f"Không thể gửi email tự động tới {recipient_email}. "
            "Quản trị viên có thể dùng file thông tin đã tải về để gửi thủ công."
        )

    return f"Đã gửi tên đăng nhập và mật khẩu tạm thời tới email {recipient_email}."


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    session: Session = Depends(get_session),
):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Không thể xác thực người dùng.",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username = payload.get("sub")
        if username is None:
            raise credentials_exception
    except InvalidTokenError as exc:
        raise credentials_exception from exc

    user = session.exec(select(User).where(User.username == username)).first()
    if user is None:
        raise credentials_exception

    return build_user_public(user)


async def get_current_active_user(current_user: UserPublic = Depends(get_current_user)):
    if current_user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Người dùng đã hết phiên đăng nhập.",
        )
    return current_user


async def get_current_admin_user(
    current_user: UserPublic = Depends(get_current_active_user),
):
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bạn không có quyền quản trị viên để thực hiện chức năng này.",
        )
    return current_user


@router.get("/admin/list", response_model=List[UserPublic])
def get_all_users_for_admin(
    _: UserPublic = Depends(get_current_admin_user),
    session: Session = Depends(get_session),
):
    #users = session.exec(select(User).order_by(User.id.desc())).all()
    users = session.exec(select(User)).all()
    return [build_user_public(user) for user in users]


@router.post(
    "/admin/create",
    response_model=AdminCreateUserResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_user_for_admin(
    payload: AdminCreateUserRequest,
    _: UserPublic = Depends(get_current_admin_user),
    session: Session = Depends(get_session),
):
    username = validate_required_text(payload.username, "Tên đăng nhập")
    email = validate_email_value(payload.email)
    role = validate_role_value(payload.role)
    ensure_unique_user_identity(session, username, email)

    raw_password = generate_random_password()
    new_user = User(
        username=username,
        email=email,
        password=get_password_hash(raw_password),
        icon=normalize_text(payload.icon) or "/icon.png",
        role=role,
        is_password_reset=True,
    )
    session.add(new_user)
    session.commit()
    session.refresh(new_user)

    user_profile = create_admin_profile(new_user, payload)
    session.add(user_profile)
    session.commit()

    email_delivery_status = send_new_user_credentials_email(
        recipient_email=email,
        username=username,
        raw_password=raw_password,
    )

    return AdminCreateUserResponse(
        user=build_user_public(new_user),
        generated_password=raw_password,
        email_delivery_status=email_delivery_status,
    )


@router.get("/", response_model=List[UserPublic])
def get_all_users(session: Session = Depends(get_session)):
    users = session.exec(select(User)).all()
    return [build_user_public(user) for user in users]


@router.get("/{user_id}", response_model=UserPublic)
def get_user(user_id: int, session: Session = Depends(get_session)):
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Không tìm thấy người dùng.")
    return build_user_public(user)


@router.post("/create", response_model=UserPublic, status_code=status.HTTP_201_CREATED)
def create_user(payload: UserCreate, session: Session = Depends(get_session)):
    if not REGISTER_ALLOWED:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Chức năng đăng ký hiện đang tạm khóa.",
        )
    username = validate_required_text(payload.username, "Tên đăng nhập")
    email = validate_email_value(payload.email)
    password = validate_required_text(payload.password, "Mật khẩu")
    ensure_unique_user_identity(session, username, email)

    user = User(
        username=username,
        email=email,
        password=get_password_hash(password),
        icon=normalize_text(payload.icon) or "/icon.png",
        role="student",
        is_password_reset=False,
    )
    session.add(user)
    session.commit()
    session.refresh(user)

    user_profile = create_default_profile(user)
    session.add(user_profile)
    session.commit()

    return build_user_public(user)


@router.put("/update/{user_id}", response_model=UserPublic)
def update_user(user_id: int, user_data: UserUpdate, session: Session = Depends(get_session)):
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Không tìm thấy người dùng.")

    update_payload = user_data.model_dump(exclude_unset=True)

    if "username" in update_payload:
        update_payload["username"] = validate_required_text(
            update_payload["username"], "Tên đăng nhập"
        )
    if "email" in update_payload:
        update_payload["email"] = validate_email_value(update_payload["email"])
    if "role" in update_payload:
        update_payload["role"] = validate_role_value(update_payload["role"])

    if "username" in update_payload or "email" in update_payload:
        ensure_unique_user_identity(
            session,
            update_payload.get("username", user.username),
            update_payload.get("email", user.email),
            exclude_user_id=user_id,
        )

    user_profile = session.get(Profile, user_id)
    for key, value in update_payload.items():
        if key == "password":
            value = get_password_hash(validate_required_text(value, "Mật khẩu"))
        setattr(user, key, value)
        if key == "email" and user_profile is not None:
            setattr(user_profile, "email", value)
        if key == "username" and user_profile is not None:
            setattr(user_profile, "name", value)

    session.commit()
    session.refresh(user)
    return build_user_public(user)


@router.delete("/delete/{user_id}")
def delete_user(user_id: int, session: Session = Depends(get_session)):
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Không tìm thấy người dùng.")

    user_profile = session.get(Profile, user_id)
    if user_profile is not None:
        session.delete(user_profile)
    session.delete(user)
    session.commit()
    return {"message": "Đã xóa người dùng."}


@router.post("/login", response_model=Token)
async def login(payload: LoginPayload, session: Session = Depends(get_session)):
    userdata = validate_required_text(payload.userdata, "Tên đăng nhập hoặc email")
    login_password = validate_required_text(payload.login_password, "Mật khẩu")

    user = session.exec(
        select(User).where(
            (func.lower(User.username) == userdata.lower())
            | (func.lower(User.email) == userdata.lower())
        )
    ).first()
    if not user or not verify_password(login_password, user.password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tên đăng nhập hoặc mật khẩu không đúng.",
        )

    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username},
        expires_delta=access_token_expires,
    )
    return Token(access_token=access_token, token_type="bearer")


@router.get("/me", response_model=UserPublic)
async def user_me(current_user: UserPublic = Depends(get_current_active_user)):
    return current_user

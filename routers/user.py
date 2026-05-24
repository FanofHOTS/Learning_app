from datetime import datetime, timedelta, timezone
from typing import List, Optional
import os
import secrets
import string

import jwt
from email_validator import EmailNotValidError, validate_email
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi_mail import ConnectionConfig, FastMail, MessageSchema, MessageType
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
ACCESS_TOKEN_EXPIRE_MINUTES = int(
    os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "120")
)
PASSWORD_RECOVERY_CODE_EXPIRE_MINUTES = int(
    os.getenv("PASSWORD_RECOVERY_CODE_EXPIRE_MINUTES", "5")
)
REGISTER_ALLOWED = os.getenv("REGISTER_ALLOWED", "false").strip().lower() == "true"

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/user/token")
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
    is_password_reset: bool = Field(
        default=False,
        nullable=False,
        description="Có cần thay đổi mật khẩu sau khi đăng nhập không?",
    )
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), nullable=False)


class PasswordRecoveryChallenge(SQLModel, table=True):
    __tablename__ = "password_recovery_challenge"

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", nullable=False)
    code_hash: str = Field(nullable=False)
    expires_at: datetime = Field(nullable=False)
    is_used: bool = Field(default=False, nullable=False)
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    consumed_at: Optional[datetime] = Field(default=None, nullable=True)


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


class PasswordResetPayload(BaseModel):
    current_password: str
    new_password: str


class PasswordRecoveryRequestPayload(BaseModel):
    userdata: str


class PasswordRecoveryRequestResponse(BaseModel):
    message: str
    expires_in_seconds: int = 300


class PasswordRecoveryVerifyPayload(BaseModel):
    userdata: str
    verification_code: str


class PasswordRecoveryVerifyResponse(BaseModel):
    message: str


PasswordRecoveryPayload = PasswordRecoveryRequestPayload
PasswordRecoveryResponse = PasswordRecoveryRequestResponse


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


class MailMessage(BaseModel):
    subject: str
    recipients: List[str]
    body: str


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
    normalized_email = validate_required_text(email, "Email")
    check_deliverability = (
        os.getenv("EMAIL_VALIDATOR_CHECK_DELIVERABILITY", "true")
        .strip()
        .lower()
        == "true"
    )

    try:
        validated_email = validate_email(
            normalized_email,
            check_deliverability=check_deliverability,
        )
    except EmailNotValidError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Email không hợp lệ hoặc không tồn tại: {exc}",
        ) from exc

    return validated_email.normalized


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

def ensure_utc_naive(value: datetime) -> datetime:
    if value.tzinfo is not None:
        return value.astimezone(timezone.utc).replace(tzinfo=None)
    return value

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


def generate_verification_code(length: int = 6) -> str:
    alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    return "".join(secrets.choice(alphabet) for _ in range(length))


def get_password_recovery_expire_minutes() -> int:
    return max(PASSWORD_RECOVERY_CODE_EXPIRE_MINUTES, 1)


def get_password_recovery_expire_seconds() -> int:
    return get_password_recovery_expire_minutes() * 60


def normalize_verification_code(value: str) -> str:
    normalized = normalize_text(value).replace(" ", "").upper()
    if len(normalized) != 6 or not normalized.isalnum():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Mã xác nhận phải gồm đúng 6 ký tự chữ và số.",
        )
    return normalized


def get_resend_api_key() -> str:
    return (os.getenv("RESEND_API_KEY") or "").strip()


def get_mail_sender_identity() -> tuple[str, str]:
    mail_from = (
        os.getenv("MAIL_FROM")
        or os.getenv("MAIL_FROM_EMAIL")
        or os.getenv("SMTP_FROM_EMAIL")
        or ""
    ).strip()
    mail_from_name = (
        os.getenv("MAIL_FROM_NAME") or "Hệ thống học tập trực tuyến"
    ).strip()
    return mail_from, mail_from_name


def build_fastmail_config() -> ConnectionConfig:
    mail_username = os.getenv("MAIL_USERNAME") or os.getenv("SMTP_USERNAME")
    mail_password = os.getenv("MAIL_PASSWORD") or os.getenv("SMTP_PASSWORD")
    mail_from, mail_from_name = get_mail_sender_identity()
    mail_server = os.getenv("MAIL_SERVER") or os.getenv("SMTP_HOST")
    mail_port = int(os.getenv("MAIL_PORT") or os.getenv("SMTP_PORT") or "587")
    mail_starttls = (
        os.getenv("MAIL_STARTTLS") or os.getenv("SMTP_USE_TLS") or "true"
    ).strip().lower() == "true"
    mail_ssl_tls = os.getenv("MAIL_SSL_TLS", "false").strip().lower() == "true"
    use_credentials = (
        os.getenv("MAIL_USE_CREDENTIALS", "true").strip().lower() == "true"
    )
    validate_certs = (
        os.getenv("MAIL_VALIDATE_CERTS", "true").strip().lower() == "true"
    )

    if not mail_from or not mail_server:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=(
                "Hệ thống chưa được cấu hình máy chủ gửi email thật. "
                "Vui lòng thiết lập MAIL_FROM và MAIL_SERVER."
            ),
        )

    if use_credentials and (not mail_username or not mail_password):
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=(
                "Hệ thống chưa đủ thông tin đăng nhập email. "
                "Vui lòng kiểm tra MAIL_USERNAME và MAIL_PASSWORD."
            ),
        )

    return ConnectionConfig(
        MAIL_USERNAME=mail_username,
        MAIL_PASSWORD=mail_password,
        MAIL_FROM=mail_from,
        MAIL_PORT=mail_port,
        MAIL_SERVER=mail_server,
        MAIL_FROM_NAME=mail_from_name,
        MAIL_STARTTLS=mail_starttls,
        MAIL_SSL_TLS=mail_ssl_tls,
        USE_CREDENTIALS=use_credentials,
        VALIDATE_CERTS=validate_certs,
        TEMPLATE_FOLDER=None,
        SUPPRESS_SEND=0,
    )


def build_resend_payload(message: MailMessage) -> dict:
    api_key = get_resend_api_key()
    mail_from, mail_from_name = get_mail_sender_identity()

    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Thiếu RESEND_API_KEY để gửi email qua Resend.",
        )

    if not mail_from:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Thiếu địa chỉ người gửi. Vui lòng thiết lập MAIL_FROM hoặc SMTP_FROM_EMAIL.",
        )

    return {
        "from": f"{mail_from_name} <{mail_from}>",
        "to": message.recipients,
        "subject": message.subject,
        "text": message.body,
    }


async def send_mail_via_resend(message: MailMessage) -> str:
    try:
        import resend
    except ImportError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Chưa cài thư viện resend trong môi trường chạy ứng dụng.",
        ) from exc

    resend.api_key = get_resend_api_key()

    try:
        response = resend.Emails.send(build_resend_payload(message))
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Không thể gửi email qua Resend: {exc}",
        ) from exc

    email_id = None
    if isinstance(response, dict):
        email_id = response.get("id")
        data = response.get("data")
        if email_id is None and isinstance(data, dict):
            email_id = data.get("id")
    else:
        email_id = getattr(response, "id", None)

    if email_id:
        return (
            f"Đã gửi email thật qua Resend tới {', '.join(message.recipients)} "
            f"với mã thư {email_id}."
        )
    return f"Đã gửi email thật qua Resend tới {', '.join(message.recipients)}."


async def send_mail_via_smtp(message: MailMessage) -> str:
    mail_config = build_fastmail_config()
    smtp_message = MessageSchema(
        subject=message.subject,
        recipients=message.recipients,
        body=message.body,
        subtype=MessageType.plain,
    )

    try:
        fast_mail = FastMail(mail_config)
        await fast_mail.send_message(smtp_message)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=(
                f"Không thể gửi email thật tới {', '.join(message.recipients)}. "
                "Vui lòng kiểm tra lại cấu hình MAIL_SERVER, MAIL_PORT, "
                "MAIL_USERNAME, MAIL_PASSWORD và hộp thư người nhận."
            ),
        ) from exc

    return f"Đã gửi email thật qua SMTP tới {', '.join(message.recipients)}."


async def send_mail_with_fallback(message: MailMessage) -> str:
    if get_resend_api_key():
        try:
            return await send_mail_via_resend(message)
        except HTTPException as resend_error:
            try:
                smtp_result = await send_mail_via_smtp(message)
            except HTTPException:
                raise resend_error
            return (
                f"{resend_error.detail} "
                f"Hệ thống đã tự động gửi lại thành công bằng SMTP. {smtp_result}"
            )

    return await send_mail_via_smtp(message)


async def send_new_user_credentials_email(
    recipient_email: str,
    username: str,
    raw_password: str,
) -> str:
    message = MailMessage(
        subject="Thông tin tài khoản học tập mới",
        recipients=[recipient_email],
        body="\n".join(
            [
                "Xin chào,",
                "",
                "Quản trị viên đã tạo tài khoản mới cho bạn trên hệ thống học tập.",
                f"Tên đăng nhập: {username}",
                f"Mật khẩu tạm thời: {raw_password}",
                "",
                "Vui lòng đăng nhập và đổi mật khẩu ngay sau lần truy cập đầu tiên.",
            ]
        ),
    )
    return await send_mail_with_fallback(message)


async def send_password_recovery_email(
    recipient_email: str,
    username: str,
    raw_password: str,
) -> str:
    message = MailMessage(
        subject="Khôi phục mật khẩu tài khoản học tập",
        recipients=[recipient_email],
        body="\n".join(
            [
                "Xin chào,",
                "",
                "Hệ thống đã nhận yêu cầu phục hồi mật khẩu cho tài khoản học tập của bạn.",
                f"Tên đăng nhập: {username}",
                f"Mật khẩu tạm thời: {raw_password}",
                "",
                "Vui lòng đăng nhập bằng mật khẩu tạm thời này và đổi mật khẩu ngay sau đó để bảo đảm an toàn.",
            ]
        ),
    )
    return await send_mail_with_fallback(message)


async def send_password_recovery_code_email(
    recipient_email: str,
    username: str,
    verification_code: str,
) -> str:
    expire_minutes = get_password_recovery_expire_minutes()
    message = MailMessage(
        subject="Mã xác nhận phục hồi tài khoản học tập",
        recipients=[recipient_email],
        body="\n".join(
            [
                "Xin chào,",
                "",
                "Hệ thống đã nhận yêu cầu phục hồi mật khẩu cho tài khoản học tập của bạn.",
                f"Tên đăng nhập: {username}",
                f"Mã xác nhận: {verification_code}",
                f"Mã này chỉ có hiệu lực trong {expire_minutes} phút.",
                "",
                "Nếu bạn không thực hiện yêu cầu này, vui lòng bỏ qua email.",
            ]
        ),
    )
    return await send_mail_with_fallback(message)


def cleanup_created_user(session: Session, user_id: int) -> None:
    user_profile = session.get(Profile, user_id)
    user = session.get(User, user_id)
    if user_profile is not None:
        session.delete(user_profile)
    if user is not None:
        session.delete(user)
    session.commit()


def find_user_by_login_identity(session: Session, userdata: str) -> Optional[User]:
    return session.exec(
        select(User).where(
            (func.lower(User.username) == userdata.lower())
            | (func.lower(User.email) == userdata.lower())
        )
    ).first()


def delete_password_recovery_challenges_for_user(
    session: Session,
    user_id: int,
) -> None:
    challenges = session.exec(
        select(PasswordRecoveryChallenge).where(
            PasswordRecoveryChallenge.user_id == user_id
        )
    ).all()
    for challenge in challenges:
        session.delete(challenge)
    session.commit()


def get_active_password_recovery_challenge(
    session: Session,
    user_id: int,
) -> Optional[PasswordRecoveryChallenge]:
    now = ensure_utc_naive(datetime.now(timezone.utc))
    challenges = session.exec(
        select(PasswordRecoveryChallenge).where(
            PasswordRecoveryChallenge.user_id == user_id
        )
    ).all()

    active_challenges = [
        challenge
        for challenge in challenges
        if not challenge.is_used and ensure_utc_naive(challenge.expires_at) > now
    ]

    if not active_challenges:
        return None

    active_challenges.sort(key=lambda challenge: challenge.created_at, reverse=True)
    return active_challenges[0]


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
    users = session.exec(select(User)).all()
    return [build_user_public(user) for user in users]


@router.post(
    "/admin/create",
    response_model=AdminCreateUserResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_user_for_admin(
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

    try:
        email_delivery_status = await send_new_user_credentials_email(
            recipient_email=email,
            username=username,
            raw_password=raw_password,
        )
    except HTTPException as exc:
        cleanup_created_user(session, new_user.id)
        raise HTTPException(
            status_code=exc.status_code,
            detail=(
                "Không thể hoàn tất việc tạo tài khoản vì gửi email thật thất bại. "
                "Tài khoản vừa tạo đã được thu hồi để tránh phát sinh dữ liệu dở dang. "
                f"Chi tiết: {exc.detail}"
            ),
        ) from exc

    return AdminCreateUserResponse(
        user=build_user_public(new_user),
        generated_password=raw_password,
        email_delivery_status=email_delivery_status,
    )


@router.get("/", response_model=List[UserPublic])
def get_all_users(session: Session = Depends(get_session)):
    users = session.exec(select(User)).all()
    return [build_user_public(user) for user in users]

@router.get("/me", response_model=UserPublic)
async def user_me(current_user: UserPublic = Depends(get_current_active_user)):
    return current_user

@router.get("/{user_id}", response_model=UserPublic)
def get_user(user_id: int, session: Session = Depends(get_session)):
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Không tìm thấy người dùng.")
    return build_user_public(user)


@router.post("/create", response_model=UserPublic, status_code=status.HTTP_201_CREATED)
def create_user(payload: UserCreate, session: Session = Depends(get_session)):
    print(ACCESS_TOKEN_EXPIRE_MINUTES)
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

    user.updated_at = datetime.now(timezone.utc)
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


@router.post("/token", response_model=Token)
async def login_with_oauth2_form(
    form_data: OAuth2PasswordRequestForm = Depends(),
    session: Session = Depends(get_session),
):
    userdata = validate_required_text(
        form_data.username,
        "Tên đăng nhập hoặc email",
    )
    login_password = validate_required_text(form_data.password, "Mật khẩu")

    user = find_user_by_login_identity(session, userdata)
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


@router.post(
    "/recover_password/request",
    response_model=PasswordRecoveryRequestResponse,
)
async def request_password_recovery_code(
    payload: PasswordRecoveryRequestPayload,
    session: Session = Depends(get_session),
):
    userdata = validate_required_text(payload.userdata, "Tên đăng nhập hoặc email")
    success_message = (
        "Nếu thông tin tài khoản chính xác, hệ thống đã gửi mã xác nhận tới email gắn với tài khoản. "
        "Vui lòng kiểm tra hộp thư đến và thư rác."
    )
    expires_in_seconds = get_password_recovery_expire_seconds()
    user = find_user_by_login_identity(session, userdata)

    if not user:
        return PasswordRecoveryRequestResponse(
            message=success_message,
            expires_in_seconds=expires_in_seconds,
        )

    delete_password_recovery_challenges_for_user(session, user.id)

    verification_code = generate_verification_code()
    challenge = PasswordRecoveryChallenge(
        user_id=user.id,
        code_hash=get_password_hash(verification_code),
        expires_at=datetime.now(timezone.utc)
        + timedelta(seconds=expires_in_seconds),
    )
    session.add(challenge)
    session.commit()
    session.refresh(challenge)

    try:
        await send_password_recovery_code_email(
            recipient_email=user.email,
            username=user.username,
            verification_code=verification_code,
        )
    except HTTPException as exc:
        session.delete(challenge)
        session.commit()
        raise HTTPException(
            status_code=exc.status_code,
            detail=(
                "Không thể gửi mã xác nhận phục hồi mật khẩu. "
                f"Chi tiết: {exc.detail}"
            ),
        ) from exc

    return PasswordRecoveryRequestResponse(
        message=success_message,
        expires_in_seconds=expires_in_seconds,
    )


@router.post(
    "/recover_password/verify",
    response_model=PasswordRecoveryVerifyResponse,
)
async def verify_password_recovery_code(
    payload: PasswordRecoveryVerifyPayload,
    session: Session = Depends(get_session),
):
    userdata = validate_required_text(payload.userdata, "Tên đăng nhập hoặc email")
    verification_code = normalize_verification_code(payload.verification_code)
    invalid_code_message = (
        "Mã xác nhận không đúng hoặc đã hết hạn. Vui lòng kiểm tra lại hoặc gửi mã mới."
    )
    success_message = (
        "Mã xác nhận hợp lệ. Hệ thống đã gửi mật khẩu tạm thời tới email gắn với tài khoản của bạn. "
        "Vui lòng kiểm tra hộp thư đến và thư rác."
    )

    user = find_user_by_login_identity(session, userdata)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=invalid_code_message,
        )

    challenge = get_active_password_recovery_challenge(session, user.id)
    if not challenge or not verify_password(verification_code, challenge.code_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=invalid_code_message,
        )

    previous_password_hash = user.password
    previous_reset_flag = user.is_password_reset
    raw_password = generate_random_password()

    challenge.is_used = True
    challenge.consumed_at = datetime.now(timezone.utc)
    user.password = get_password_hash(raw_password)
    user.is_password_reset = True
    user.updated_at = datetime.now(timezone.utc)
    session.add(challenge)
    session.add(user)
    session.commit()
    session.refresh(challenge)
    session.refresh(user)

    try:
        await send_password_recovery_email(
            recipient_email=user.email,
            username=user.username,
            raw_password=raw_password,
        )
    except HTTPException as exc:
        challenge.is_used = False
        challenge.consumed_at = None
        user.password = previous_password_hash
        user.is_password_reset = previous_reset_flag
        user.updated_at = datetime.now(timezone.utc)
        session.add(challenge)
        session.add(user)
        session.commit()
        session.refresh(challenge)
        session.refresh(user)
        raise HTTPException(
            status_code=exc.status_code,
            detail=(
                "Không thể hoàn tất việc gửi mật khẩu tạm thời sau khi xác minh mã. "
                "Hệ thống đã khôi phục lại trạng thái trước đó. "
                f"Chi tiết: {exc.detail}"
            ),
        ) from exc

    return PasswordRecoveryVerifyResponse(message=success_message)


@router.post("/login", response_model=Token)
async def login(payload: LoginPayload, session: Session = Depends(get_session)):
    userdata = validate_required_text(payload.userdata, "Tên đăng nhập hoặc email")
    login_password = validate_required_text(payload.login_password, "Mật khẩu")

    user = find_user_by_login_identity(session, userdata)
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


@router.post("/recover_password_legacy_disabled", response_model=PasswordRecoveryResponse)
async def recover_password(
    payload: PasswordRecoveryPayload,
    session: Session = Depends(get_session),
):
    userdata = validate_required_text(payload.userdata, "Tên đăng nhập hoặc email")
    success_message = (
        "Nếu thông tin tài khoản chính xác, hệ thống đã gửi mật khẩu tạm thời "
        "tới email gắn với tài khoản. Vui lòng kiểm tra hộp thư đến và thư rác."
    )

    user = session.exec(
        select(User).where(
            (func.lower(User.username) == userdata.lower())
            | (func.lower(User.email) == userdata.lower())
        )
    ).first()

    if not user:
        return PasswordRecoveryResponse(message=success_message)

    previous_password_hash = user.password
    previous_reset_flag = user.is_password_reset
    raw_password = generate_random_password()

    user.password = get_password_hash(raw_password)
    user.is_password_reset = True
    user.updated_at = datetime.now(timezone.utc)
    session.add(user)
    session.commit()
    session.refresh(user)

    try:
        await send_password_recovery_email(
            recipient_email=user.email,
            username=user.username,
            raw_password=raw_password,
        )
    except HTTPException as exc:
        user.password = previous_password_hash
        user.is_password_reset = previous_reset_flag
        user.updated_at = datetime.now(timezone.utc)
        session.add(user)
        session.commit()
        session.refresh(user)
        raise HTTPException(
            status_code=exc.status_code,
            detail=(
                "Không thể hoàn tất yêu cầu phục hồi mật khẩu vì gửi email thất bại. "
                "Hệ thống đã khôi phục lại trạng thái tài khoản trước đó. "
                f"Chi tiết: {exc.detail}"
            ),
        ) from exc

    return PasswordRecoveryResponse(message=success_message)

@router.put("/reset_password/{user_id}")
async def reset_password(user_id: int, payload: PasswordResetPayload, session: Session = Depends(get_session)):
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Không tìm thấy người dùng.")

    if not verify_password(payload.current_password, user.password):
        raise HTTPException(status_code=400, detail="Mật khẩu hiện tại không đúng.")

    user.password = get_password_hash(validate_required_text(payload.new_password, "Mật khẩu mới"))
    user.is_password_reset = False
    session.commit()
    session.refresh(user)
    return {"message": "Đã cập nhật mật khẩu mới thành công."}

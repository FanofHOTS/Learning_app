from __future__ import annotations

from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlmodel import Field, SQLModel, Session, select, func

from database.engine import create_db_engine
from models.notification import Notification
from routers.user import UserPublic, ensure_utc_naive, get_current_active_user

router = APIRouter(prefix="/notification", tags=["notification"])


def get_session():
    with Session(create_db_engine()) as session:
        yield session


# --- Pydantic schemas ---


class NotificationPublic(BaseModel):
    id: int
    user_id: int
    type: str
    title: str
    message: str
    reference_id: Optional[int] = None
    reference_type: Optional[str] = None
    is_read: bool
    created_at: datetime


class UnreadCountResponse(BaseModel):
    count: int


# --- Helper functions ---


def create_notification(
    session: Session,
    user_id: int,
    type: str,
    title: str,
    message: str,
    reference_id: Optional[int] = None,
    reference_type: Optional[str] = None,
) -> Notification:
    """Tạo một thông báo mới và trả về đối tượng vừa tạo."""
    notification = Notification(
        user_id=user_id,
        type=type,
        title=title,
        message=message,
        reference_id=reference_id,
        reference_type=reference_type,
    )
    session.add(notification)
    session.commit()
    session.refresh(notification)
    return notification


def notify_admins(
    session: Session,
    type: str,
    title: str,
    message: str,
    reference_id: Optional[int] = None,
    reference_type: Optional[str] = None,
) -> list[Notification]:
    """Tạo thông báo cho tất cả người dùng có role admin."""
    from models.user import User

    admins = session.exec(select(User).where(User.role == "admin")).all()
    notifications: list[Notification] = []
    for admin in admins:
        notification = create_notification(
            session,
            user_id=admin.id,
            type=type,
            title=title,
            message=message,
            reference_id=reference_id,
            reference_type=reference_type,
        )
        notifications.append(notification)
    return notifications


def notify_all_students(
    session: Session,
    type: str,
    title: str,
    message: str,
    reference_id: Optional[int] = None,
    reference_type: Optional[str] = None,
) -> list[Notification]:
    """Tạo thông báo cho tất cả người dùng có role student."""
    from models.user import User

    students = session.exec(select(User).where(User.role == "student")).all()
    notifications: list[Notification] = []
    for student in students:
        notification = create_notification(
            session,
            user_id=student.id,
            type=type,
            title=title,
            message=message,
            reference_id=reference_id,
            reference_type=reference_type,
        )
        notifications.append(notification)
    return notifications


# --- Helpers (tiếp) ---


def _get_course_title(session: Session, course_id: int) -> str:
    from models.course import Course
    course = session.get(Course, course_id)
    return course.title if course else f"Khóa học #{course_id}"


# --- Endpoints ---


# Kiểm tra và tạo thông báo cho các khóa học đã đến hạn mở (open_at <= now)
@router.get("/check-course-starts/{user_id}")
def check_course_starts(
    user_id: int,
    current_user: UserPublic = Depends(get_current_active_user),
    session: Session = Depends(get_session),
):
    if current_user.id != user_id and current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bạn không có quyền thực hiện thao tác này.",
        )

    from models.course_progress import CourseProgress
    from models.course_extra_data import CourseExtraData

    # Lấy danh sách khóa học người dùng đã đăng ký
    enrolled = session.exec(
        select(CourseProgress).where(
            CourseProgress.user_id == user_id,
        )
    ).all()

    now = ensure_utc_naive(datetime.now(timezone.utc))
    created_count = 0

    for enrollment in enrolled:
        course_id = enrollment.course_id
        if course_id is None:
            continue

        # Lấy open_at của khóa học
        extra = session.get(CourseExtraData, course_id)
        if extra is None:
            continue

        if extra.open_at > now:
            continue  # Chưa đến hạn

        # Kiểm tra xem đã gửi thông báo "course_started" cho khóa học này chưa
        existing = session.exec(
            select(Notification).where(
                Notification.user_id == user_id,
                Notification.type == "course_started",
                Notification.reference_id == course_id,
                Notification.reference_type == "course",
            ).limit(1)
        ).first()
        if existing is not None:
            continue  # Đã gửi rồi

        course_title = _get_course_title(session, course_id)
        create_notification(
            session,
            user_id=user_id,
            type="course_started",
            title="Khóa học đã sẵn sàng",
            message=f"Khóa học '{course_title}' đã có thể bắt đầu học. Hãy vào học ngay!",
            reference_id=course_id,
            reference_type="course",
        )
        created_count += 1

    return {"created": created_count, "message": f"Đã tạo {created_count} thông báo khóa học sẵn sàng."}


# Lấy danh sách thông báo của người dùng
@router.get("/user/{user_id}", response_model=List[NotificationPublic])
def get_notifications_by_user(
    user_id: int,
    current_user: UserPublic = Depends(get_current_active_user),
    session: Session = Depends(get_session),
):
    # Chỉ chủ sở hữu hoặc admin mới xem được
    if current_user.id != user_id and current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bạn không có quyền xem thông báo của người dùng này.",
        )

    notifications = session.exec(
        select(Notification)
        .where(Notification.user_id == user_id)
        .order_by(Notification.created_at.desc())
    ).all()
    return notifications


# Lấy số lượng thông báo chưa đọc
@router.get("/unread-count/{user_id}", response_model=UnreadCountResponse)
def get_unread_count(
    user_id: int,
    current_user: UserPublic = Depends(get_current_active_user),
    session: Session = Depends(get_session),
):
    if current_user.id != user_id and current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bạn không có quyền xem thông báo của người dùng này.",
        )

    count = session.exec(
        select(func.count(Notification.id)).where(
            Notification.user_id == user_id,
            Notification.is_read == False,
        )
    ).one()
    return UnreadCountResponse(count=count)


# Đánh dấu một thông báo đã đọc
@router.put("/read/{notification_id}")
def mark_notification_read(
    notification_id: int,
    current_user: UserPublic = Depends(get_current_active_user),
    session: Session = Depends(get_session),
):
    notification = session.get(Notification, notification_id)
    if not notification:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy thông báo.",
        )

    if notification.user_id != current_user.id and current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bạn không có quyền thao tác với thông báo này.",
        )

    notification.is_read = True
    session.commit()
    return {"message": "Đã đánh dấu thông báo là đã đọc."}


# Đánh dấu tất cả thông báo của người dùng đã đọc
@router.put("/read-all/{user_id}")
def mark_all_notifications_read(
    user_id: int,
    current_user: UserPublic = Depends(get_current_active_user),
    session: Session = Depends(get_session),
):
    if current_user.id != user_id and current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bạn không có quyền thao tác với thông báo của người dùng này.",
        )

    notifications = session.exec(
        select(Notification).where(
            Notification.user_id == user_id,
            Notification.is_read == False,
        )
    ).all()
    for notification in notifications:
        notification.is_read = True
    session.commit()
    return {"message": f"Đã đánh dấu {len(notifications)} thông báo là đã đọc."}


# Xóa một thông báo
@router.delete("/delete/{notification_id}")
def delete_notification(
    notification_id: int,
    current_user: UserPublic = Depends(get_current_active_user),
    session: Session = Depends(get_session),
):
    notification = session.get(Notification, notification_id)
    if not notification:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy thông báo.",
        )

    if notification.user_id != current_user.id and current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bạn không có quyền xóa thông báo này.",
        )

    session.delete(notification)
    session.commit()
    return {"message": "Đã xóa thông báo thành công."}

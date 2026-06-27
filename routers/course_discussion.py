from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlmodel import Field, SQLModel, Session, select

from database.engine import create_db_engine
from models.course_discussion import CourseDiscussionComment
from routers.notification import create_notification
from routers.user import UserPublic, get_current_active_user

router = APIRouter(prefix="/course_discussion", tags=["course_discussion"])


def get_session():
    with Session(create_db_engine()) as session:
        yield session


# --- Pydantic schemas ---


class CourseDiscussionCommentCreate(BaseModel):
    course_id: int
    content: str
    parent_id: Optional[int] = None


class CourseDiscussionCommentUpdate(BaseModel):
    content: str


class CourseDiscussionCommentPublic(BaseModel):
    id: int
    course_id: int
    user_id: int
    username: str
    user_icon: str
    content: str
    parent_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime
    replies: List["CourseDiscussionCommentPublic"] = []


def build_comment_public(
    comment: CourseDiscussionComment,
    username: str,
    user_icon: str,
    replies: Optional[List["CourseDiscussionCommentPublic"]] = None,
) -> CourseDiscussionCommentPublic:
    return CourseDiscussionCommentPublic(
        id=comment.id,
        course_id=comment.course_id,
        user_id=comment.user_id,
        username=username,
        user_icon=user_icon,
        content=comment.content,
        parent_id=comment.parent_id,
        created_at=comment.created_at,
        updated_at=comment.updated_at,
        replies=replies or [],
    )


def _can_comment_on_course(
    session: Session,
    course_id: int,
    current_user: UserPublic,
) -> bool:
    """Check if user is allowed to comment on a course.

    Allowed roles:
    - Student enrolled in the course (has CourseProgress)
    - Instructor of the course
    - Admin
    """
    # Admin always has access
    if current_user.role == "admin":
        return True

    from routers.course import Course

    course = session.get(Course, course_id)
    if not course:
        return False

    # Instructor of this course
    if course.instructor_id == current_user.id:
        return True

    # Enrolled student
    from models.course_progress import CourseProgress

    enrollment = session.exec(
        select(CourseProgress).where(
            CourseProgress.course_id == course_id,
            CourseProgress.user_id == current_user.id,
        )
    ).first()
    if enrollment is not None:
        return True

    return False


# --- Endpoints ---


# Lấy tất cả comment cấp cao nhất cho một khóa học (trả về cấu trúc cây)
@router.get(
    "/course/{course_id}",
    response_model=List[CourseDiscussionCommentPublic],
)
def get_comments_by_course(
    course_id: int,
    current_user: UserPublic = Depends(get_current_active_user),
    session: Session = Depends(get_session),
):
    from models.user import User

    all_comments = session.exec(
        select(CourseDiscussionComment)
        .where(CourseDiscussionComment.course_id == course_id)
        .order_by(CourseDiscussionComment.created_at.asc())
    ).all()

    # Xây dựng cây comment: parent -> replies
    comment_map: dict[int, CourseDiscussionCommentPublic] = {}
    top_level: list[CourseDiscussionCommentPublic] = []

    for comment in all_comments:
        user = session.get(User, comment.user_id)
        username = user.username if user else "Người dùng không xác định"
        user_icon = user.icon if user else "/icon.png"

        public_comment = build_comment_public(comment, username, user_icon)
        comment_map[comment.id] = public_comment

        if comment.parent_id is None:
            top_level.append(public_comment)
        else:
            parent = comment_map.get(comment.parent_id)
            if parent:
                parent.replies.append(public_comment)
            else:
                top_level.append(public_comment)

    return top_level


# Tạo comment mới
@router.post(
    "/create",
    response_model=CourseDiscussionCommentPublic,
    status_code=status.HTTP_201_CREATED,
)
def create_comment(
    payload: CourseDiscussionCommentCreate,
    current_user: UserPublic = Depends(get_current_active_user),
    session: Session = Depends(get_session),
):
    if not payload.content.strip():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Nội dung bình luận không được để trống.",
        )

    # Kiểm tra quyền bình luận
    if not _can_comment_on_course(session, payload.course_id, current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bạn không có quyền bình luận trong khóa học này.",
        )

    # Kiểm tra khóa học tồn tại
    from models.course import Course

    course = session.get(Course, payload.course_id)
    if not course:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy khóa học.",
        )

    # Nếu có parent_id, kiểm tra parent comment tồn tại
    if payload.parent_id is not None:
        parent = session.get(CourseDiscussionComment, payload.parent_id)
        if not parent:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Không tìm thấy bình luận cha.",
            )
        if parent.course_id != payload.course_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Bình luận cha không thuộc khóa học này.",
            )

    new_comment = CourseDiscussionComment(
        course_id=payload.course_id,
        user_id=current_user.id,
        content=payload.content.strip(),
        parent_id=payload.parent_id,
    )
    session.add(new_comment)
    session.commit()
    session.refresh(new_comment)

    # Thông báo cho chủ bình luận cha khi có người trả lời
    if payload.parent_id is not None:
        parent = session.get(CourseDiscussionComment, payload.parent_id)
        if parent and parent.user_id != current_user.id:
            create_notification(
                session,
                user_id=parent.user_id,
                type="comment_reply",
                title="Có người trả lời bình luận của bạn",
                message=f"{current_user.username} đã trả lời bình luận của bạn trong khóa học.",
                reference_id=payload.parent_id,
                reference_type="course_discussion",
            )

    return build_comment_public(
        new_comment,
        username=current_user.username,
        user_icon=current_user.icon,
    )


# Cập nhật comment (chỉ chủ sở hữu hoặc admin)
@router.put(
    "/update/{comment_id}",
    response_model=CourseDiscussionCommentPublic,
)
def update_comment(
    comment_id: int,
    payload: CourseDiscussionCommentUpdate,
    current_user: UserPublic = Depends(get_current_active_user),
    session: Session = Depends(get_session),
):
    if not payload.content.strip():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Nội dung bình luận không được để trống.",
        )

    comment = session.get(CourseDiscussionComment, comment_id)
    if not comment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy bình luận.",
        )

    if comment.user_id != current_user.id and current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bạn không có quyền chỉnh sửa bình luận này.",
        )

    comment.content = payload.content.strip()
    comment.updated_at = datetime.now(timezone.utc)
    session.commit()
    session.refresh(comment)

    return build_comment_public(
        comment,
        username=current_user.username,
        user_icon=current_user.icon,
    )


# Xóa comment (chỉ chủ sở hữu hoặc admin)
@router.delete("/delete/{comment_id}")
def delete_comment(
    comment_id: int,
    current_user: UserPublic = Depends(get_current_active_user),
    session: Session = Depends(get_session),
):
    comment = session.get(CourseDiscussionComment, comment_id)
    if not comment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy bình luận.",
        )

    if comment.user_id != current_user.id and current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bạn không có quyền xóa bình luận này.",
        )

    # Xóa tất cả replies trước
    replies = session.exec(
        select(CourseDiscussionComment).where(
            CourseDiscussionComment.parent_id == comment_id
        )
    ).all()
    for reply in replies:
        session.delete(reply)

    session.delete(comment)
    session.commit()

    return {"message": "Đã xóa bình luận thành công."}

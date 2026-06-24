from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlmodel import Field, SQLModel, Session, select

from database.engine import create_db_engine
from routers.notification import create_notification
from routers.user import UserPublic, get_current_active_user

router = APIRouter(prefix="/discussion", tags=["discussion"])


def get_session():
    with Session(create_db_engine()) as session:
        yield session


class DiscussionComment(SQLModel, table=True):
    __tablename__ = "discussion_comment"

    id: Optional[int] = Field(default=None, primary_key=True)
    course_component_id: int = Field(
        foreign_key="course_component.id", nullable=False, index=True
    )
    user_id: int = Field(foreign_key="user.id", nullable=False)
    content: str = Field(default="", nullable=False)
    parent_id: Optional[int] = Field(
        default=None, foreign_key="discussion_comment.id", nullable=True
    )
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc), nullable=False
    )
    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc), nullable=False
    )


class DiscussionCommentCreate(BaseModel):
    course_component_id: int
    content: str
    parent_id: Optional[int] = None


class DiscussionCommentUpdate(BaseModel):
    content: str


class DiscussionCommentPublic(BaseModel):
    id: int
    course_component_id: int
    user_id: int
    username: str
    user_icon: str
    content: str
    parent_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime
    replies: List["DiscussionCommentPublic"] = []


def build_comment_public(
    comment: DiscussionComment,
    username: str,
    user_icon: str,
    replies: Optional[List["DiscussionCommentPublic"]] = None,
) -> DiscussionCommentPublic:
    return DiscussionCommentPublic(
        id=comment.id,
        course_component_id=comment.course_component_id,
        user_id=comment.user_id,
        username=username,
        user_icon=user_icon,
        content=comment.content,
        parent_id=comment.parent_id,
        created_at=comment.created_at,
        updated_at=comment.updated_at,
        replies=replies or [],
    )


# Lấy tất cả comment cho một course_component (trả về cấu trúc cây)
@router.get(
    "/component/{component_id}",
    response_model=List[DiscussionCommentPublic],
)
def get_comments_by_component(
    component_id: int,
    current_user: UserPublic = Depends(get_current_active_user),
    session: Session = Depends(get_session),
):
    from routers.user import User

    all_comments = session.exec(
        select(DiscussionComment).where(
            DiscussionComment.course_component_id == component_id
        ).order_by(DiscussionComment.created_at.asc())
    ).all()

    # Xây dựng cây comment: parent -> replies
    comment_map: dict[int, DiscussionCommentPublic] = {}
    top_level: list[DiscussionCommentPublic] = []

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
                # Fallback nếu parent không tồn tại (dữ liệu lỗi)
                top_level.append(public_comment)

    return top_level


# Tạo comment mới
@router.post(
    "/create",
    response_model=DiscussionCommentPublic,
    status_code=status.HTTP_201_CREATED,
)
def create_comment(
    payload: DiscussionCommentCreate,
    current_user: UserPublic = Depends(get_current_active_user),
    session: Session = Depends(get_session),
):
    if not payload.content.strip():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Nội dung bình luận không được để trống.",
        )

    # Kiểm tra course_component tồn tại
    from routers.course_component import CourseComponent

    component = session.get(CourseComponent, payload.course_component_id)
    if not component:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy thành phần học tập.",
        )

    # Nếu có parent_id, kiểm tra parent comment tồn tại
    if payload.parent_id is not None:
        parent = session.get(DiscussionComment, payload.parent_id)
        if not parent:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Không tìm thấy bình luận cha.",
            )
        # Đảm bảo parent comment thuộc cùng component
        if parent.course_component_id != payload.course_component_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Bình luận cha không thuộc thành phần học tập này.",
            )

    new_comment = DiscussionComment(
        course_component_id=payload.course_component_id,
        user_id=current_user.id,
        content=payload.content.strip(),
        parent_id=payload.parent_id,
    )
    session.add(new_comment)
    session.commit()
    session.refresh(new_comment)

    # Thông báo cho chủ bình luận cha khi có người trả lời
    if payload.parent_id is not None:
        parent = session.get(DiscussionComment, payload.parent_id)
        if parent and parent.user_id != current_user.id:
            create_notification(
                session,
                user_id=parent.user_id,
                type="comment_reply",
                title="Có người trả lời bình luận của bạn",
                message=f"{current_user.username} đã trả lời bình luận của bạn trong bài học.",
                reference_id=payload.parent_id,
                reference_type="discussion",
            )

    return build_comment_public(
        new_comment,
        username=current_user.username,
        user_icon=current_user.icon,
    )


# Cập nhật comment (chỉ chủ sở hữu)
@router.put(
    "/update/{comment_id}",
    response_model=DiscussionCommentPublic,
)
def update_comment(
    comment_id: int,
    payload: DiscussionCommentUpdate,
    current_user: UserPublic = Depends(get_current_active_user),
    session: Session = Depends(get_session),
):
    if not payload.content.strip():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Nội dung bình luận không được để trống.",
        )

    comment = session.get(DiscussionComment, comment_id)
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
    comment = session.get(DiscussionComment, comment_id)
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
        select(DiscussionComment).where(
            DiscussionComment.parent_id == comment_id
        )
    ).all()
    for reply in replies:
        session.delete(reply)

    session.delete(comment)
    session.commit()

    return {"message": "Đã xóa bình luận thành công."}

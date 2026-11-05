from fastapi import Depends, HTTPException, status

from routers.user import UserPublic, get_current_active_user


def get_instructor_id(
    current_user: UserPublic = Depends(get_current_active_user),
) -> int:
    if current_user.role != "instructor":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Chỉ giảng viên mới có thể sử dụng chức năng này.",
        )
    if current_user.id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Không thể xác định tài khoản giảng viên.",
        )
    return current_user.id

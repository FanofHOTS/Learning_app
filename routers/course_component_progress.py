from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Field, Session, SQLModel, select

from database.engine import create_db_engine
from models.course_component_progress import CourseComponentProgress

router = APIRouter(
    prefix="/course_component_progress", tags=["course_component_progress"]
)


def get_session():
    with Session(create_db_engine()) as session:
        yield session


@router.get("/", response_model=List[CourseComponentProgress])
def get_all_course_component_progress(session: Session = Depends(get_session)):
    return session.exec(select(CourseComponentProgress)).all()


@router.get(
    "/user/{user_id}/course/{course_id}", response_model=List[CourseComponentProgress]
)
def get_progress_by_user_and_course(
    user_id: int, course_id: int, session: Session = Depends(get_session)
):
    progress_records = session.exec(
        select(CourseComponentProgress).where(
            CourseComponentProgress.user_id == user_id,
            CourseComponentProgress.course_id == course_id,
        )
    ).all()
    if not progress_records:
        raise HTTPException(
            status_code=404,
            detail="Không tìm thấy tiến độ học thành phần nào cho sinh viên",
        )
    return progress_records


@router.get(
    "/user/{user_id}/component/{component_id}", response_model=CourseComponentProgress
)
def get_progress_by_user_and_component(
    user_id: int, component_id: int, session: Session = Depends(get_session)
):
    progress_record = session.exec(
        select(CourseComponentProgress).where(
            CourseComponentProgress.user_id == user_id,
            CourseComponentProgress.course_component_id == component_id,
        )
    ).first()
    if not progress_record:
        raise HTTPException(
            status_code=404,
            detail="Không tìm thấy tiến độ học của thành phần này",
        )
    return progress_record


@router.post("/create", response_model=CourseComponentProgress)
def create_course_component_progress(
    progress: CourseComponentProgress, session: Session = Depends(get_session)
):
    if progress.is_completed and progress.completed_at is None:
        progress.completed_at = datetime.now(timezone.utc)

    session.add(progress)
    session.commit()
    session.refresh(progress)
    return progress


@router.put(
    "/update/user/{user_id}/component/{component_id}",
    response_model=CourseComponentProgress,
)
def update_course_component_progress(
    user_id: int,
    component_id: int,
    progress_data: CourseComponentProgress,
    session: Session = Depends(get_session),
):
    progress_record = session.exec(
        select(CourseComponentProgress).where(
            CourseComponentProgress.user_id == user_id,
            CourseComponentProgress.course_component_id == component_id,
        )
    ).first()
    if not progress_record:
        raise HTTPException(
            status_code=404,
            detail="Không tìm thấy tiến độ học của thành phần này",
        )

    for key, value in progress_data.model_dump(exclude_unset=True).items():
        setattr(progress_record, key, value)

    if progress_record.is_completed and progress_record.completed_at is None:
        progress_record.completed_at = datetime.now(timezone.utc)

    session.commit()
    session.refresh(progress_record)
    return progress_record

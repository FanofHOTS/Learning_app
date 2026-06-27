from database.engine import create_db_engine
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Form
from sqlmodel import Session, select, Field, SQLModel, func, create_engine
from datetime import datetime, timezone

from models.course_progress import CourseProgress

router = APIRouter(prefix="/course_progress", tags=["course_progress"])

def get_session():
    with Session(create_db_engine()) as session:
        yield session


class ModuleCompletionCount(SQLModel):
    module_id: int
    completed_count: int


class ComponentCompletionCount(SQLModel):
    component_id: int
    completed_count: int


class ExamResultStat(SQLModel):
    exam_id: int
    average_score: float
    pass_count: int
    total_attempts: int


class CourseProgressStats(SQLModel):
    total_enrolled: int
    completed_course: int
    module_completion_counts: List[ModuleCompletionCount]
    component_completion_counts: List[ComponentCompletionCount]
    exam_result_stats: List[ExamResultStat]

# Lấy thống kê hoàn thành khóa học — số sinh viên hoàn thành khóa, module, thành phần
@router.get("/stats/{course_id}", response_model=CourseProgressStats)
def get_course_progress_stats(course_id: int, session: Session = Depends(get_session)):
    from models.course_component import CourseComponent
    from models.module_progress import ModuleProgress
    from models.course_component_progress import CourseComponentProgress

    # Tổng số sinh viên đã enroll (có course_progress)
    total_enrolled = session.exec(
        select(func.count()).select_from(CourseProgress).where(
            CourseProgress.course_id == course_id
        )
    ).one()

    # Số sinh viên hoàn thành khóa học
    completed_course = session.exec(
        select(func.count()).select_from(CourseProgress).where(
            CourseProgress.course_id == course_id,
            CourseProgress.is_complete == True,  # noqa: E712
        )
    ).one()

    # Số sinh viên hoàn thành từng module
    module_rows = session.exec(
        select(
            ModuleProgress.module_id,
            func.count().label("completed_count"),
        ).where(
            ModuleProgress.course_id == course_id,
            ModuleProgress.is_complete == True,  # noqa: E712
        ).group_by(ModuleProgress.module_id)
    ).all()
    module_completion_counts = [
        ModuleCompletionCount(module_id=row[0], completed_count=row[1])
        for row in module_rows
    ]

    # Số sinh viên hoàn thành từng thành phần
    component_rows = session.exec(
        select(
            CourseComponentProgress.course_component_id,
            func.count().label("completed_count"),
        ).where(
            CourseComponentProgress.course_id == course_id,
            CourseComponentProgress.is_completed == True,  # noqa: E712
        ).group_by(CourseComponentProgress.course_component_id)
    ).all()
    component_completion_counts = [
        ComponentCompletionCount(component_id=row[0], completed_count=row[1])
        for row in component_rows
    ]

    # Thống kê bài kiểm tra: điểm trung bình, số đạt, số lần làm
    from models.exam_result import ExamResult
    exam_rows = session.exec(
        select(
            ExamResult.exam_id,
            func.avg(ExamResult.score),
            func.sum(ExamResult.is_passed.cast(int)),
            func.count(),
        ).where(
            ExamResult.exam_id.in_(
                select(CourseComponent.ref_id).where(
                    CourseComponent.course_id == course_id,
                    CourseComponent.component_type == "exam",
                    CourseComponent.ref_id.isnot(None),
                )
            )
        ).group_by(ExamResult.exam_id)
    ).all()
    exam_result_stats = [
        ExamResultStat(
            exam_id=row[0],
            average_score=round(float(row[1]), 2) if row[1] is not None else 0.0,
            pass_count=int(row[2]) if row[2] is not None else 0,
            total_attempts=int(row[3]),
        )
        for row in exam_rows
    ]

    return CourseProgressStats(
        total_enrolled=total_enrolled,
        completed_course=completed_course,
        module_completion_counts=module_completion_counts,
        component_completion_counts=component_completion_counts,
        exam_result_stats=exam_result_stats,
    )


# Lấy danh sách tiến trình học khóa học
@router.get("/", response_model=List[CourseProgress])
def get_all_course_progress(session: Session = Depends(get_session)):
    return session.exec(select(CourseProgress)).all()

# Lấy danh sách tiến trình học khóa học dựa trên id khóa học
@router.get("/course/{course_id}", response_model=List[CourseProgress])
def get_course_progress_by_course_id(course_id: int, session: Session = Depends(get_session)):
    course_progress = session.exec(select(CourseProgress).where(CourseProgress.course_id == course_id)).all()
    if not course_progress:
        raise HTTPException(status_code=404, detail="Không tìm thấy tiến trình học khóa học nào theo id khóa học")
    return course_progress

# Lấy danh sách tiến trình học khóa học dựa trên id người học
@router.get("/user/{user_id}", response_model=List[CourseProgress])
def get_course_progress_by_user_id(user_id: int, session: Session = Depends(get_session)):
    course_progress = session.exec(select(CourseProgress).where(CourseProgress.user_id == user_id)).all()
    if not course_progress:
        raise HTTPException(status_code=404, detail="Không tìm thấy tiến trình học khóa học nào theo id người học")
    return course_progress

# Lấy tiến trình học khóa học theo id của khóa học và người học 
@router.get("/{course_id}/{user_id}", response_model=CourseProgress)
def get_course_progress(course_id: int, user_id: int, session: Session = Depends(get_session)):
    course_progress = session.exec(select(CourseProgress).where(CourseProgress.course_id == course_id and CourseProgress.user_id == user_id)).first()
    if not course_progress:
        raise HTTPException(status_code=404, detail="Không tìm thấy tiến trình học khóa học")
    return course_progress

def _apply_course_completion_fields(course_progress: CourseProgress) -> None:
    if course_progress.is_complete and course_progress.completed_at is None:
        course_progress.completed_at = datetime.now(timezone.utc)


def _maybe_issue_certificate(session: Session, user_id: int, course_id: int) -> None:
    from services.certificate_service import issue_certificate_if_completed

    issue_certificate_if_completed(session, user_id, course_id)


# Tạo tiến trình học khóa học mới
@router.post("/create", response_model=CourseProgress)
def create_course_progress(course_progress: CourseProgress, session: Session = Depends(get_session)):
    _apply_course_completion_fields(course_progress)
    session.add(course_progress)
    session.commit()
    session.refresh(course_progress)
    if course_progress.is_complete:
        _maybe_issue_certificate(
            session,
            course_progress.user_id,
            course_progress.course_id,
        )
    return course_progress

# Chỉnh sửa tiến trình học khóa học
@router.put("/update/{course_id}/{user_id}", response_model=CourseProgress)
def update_course_progress(course_id: int, user_id: int, module_data: CourseProgress, session: Session = Depends(get_session)):
    course_progress = session.exec(
        select(CourseProgress).where(
            CourseProgress.course_id == course_id,
            CourseProgress.user_id == user_id,
        )
    ).first()
    if not course_progress:
        raise HTTPException(status_code=404, detail="Không tìm thấy tiến trình học khóa học")
    for key, value in module_data.model_dump(exclude_unset=True).items():
        setattr(course_progress, key, value)
    _apply_course_completion_fields(course_progress)
    session.commit()
    session.refresh(course_progress)
    if course_progress.is_complete:
        _maybe_issue_certificate(session, user_id, course_id)
    return course_progress

# Xóa tiến trình học khóa học
@router.delete("/delete/{course_id}/{user_id}")
def delete_course_progress(course_id: int, user_id: int, session: Session = Depends(get_session)):
    course_progress= session.exec(select(CourseProgress).where(CourseProgress.course_id == course_id and CourseProgress.user_id == user_id)).first()
    if not course_progress:
        raise HTTPException(status_code=404, detail="Không tìm thấy tiến trình học khóa học")
    session.delete(course_progress)
    session.commit()
    return {"message": "Đã xóa tiến trình học khóa học"}
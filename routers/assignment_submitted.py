from datetime import datetime, timezone
from database.engine import create_db_engine
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Form
from sqlmodel import Session, select, Field, SQLModel, create_engine

from models.assignment_submitted import AssignmentSubmitted
from routers.notification import create_notification

router = APIRouter(prefix="/assignments_submitted", tags=["assignments_submitted"])

def get_session():
    with Session(create_db_engine()) as session:
        yield session

# Lấy danh sách bài tập đã nộp
@router.get("/", response_model=List[AssignmentSubmitted])
def get_all_assignments_submitted(session: Session = Depends(get_session)):
    return session.exec(select(AssignmentSubmitted)).all()

# Lấy danh sách bài tập đã nộp dựa trên id bài tập
@router.get("/assignment/{assignment_id}", response_model=List[AssignmentSubmitted])
def get_assignments_submitted_by_assignment_id(assignment_id: int, session: Session = Depends(get_session)):
    assignments_submitted = session.exec(select(AssignmentSubmitted).where(AssignmentSubmitted.assignment_id == assignment_id)).all()
    if not assignments_submitted:
        raise HTTPException(status_code=404, detail="Không tìm thấy bài tập đã nộp nào cho bài tập này")
    return assignments_submitted

# Lấy danh sách bài tập đã nộp dựa trên id người học
@router.get("/user/{user_id}", response_model=List[AssignmentSubmitted])
def get_assignments_submitted_by_user_id(user_id: int, session: Session = Depends(get_session)):
    assignments_submitted = session.exec(select(AssignmentSubmitted).where(AssignmentSubmitted.user_id == user_id)).all()
    if not assignments_submitted:
        raise HTTPException(status_code=404, detail="Không tìm thấy bài tập đã nộp nào cho người học này")
    return assignments_submitted

# Lấy bài tập đã nộp theo id của bài tập và người học
@router.get("/{assignment_id}/{user_id}", response_model=AssignmentSubmitted)
def get_assignment_submitted(assignment_id: int, user_id: int, session: Session = Depends(get_session)):
    assignment_submitted = session.exec(select(AssignmentSubmitted).where(AssignmentSubmitted.assignment_id == assignment_id and AssignmentSubmitted.user_id == user_id)).first()
    if not assignment_submitted:
        raise HTTPException(status_code=404, detail="Không tìm thấy bài tập đã nộp")
    return assignment_submitted

# Tạo bài tập đã nộp mới
@router.post("/create", response_model=AssignmentSubmitted)
def create_assignment_submitted(assignment_submitted: AssignmentSubmitted, session: Session = Depends(get_session)):
    session.add(assignment_submitted)
    session.commit()
    session.refresh(assignment_submitted)

    # Thông báo cho giảng viên của khóa học khi có bài tập mới được nộp
    try:
        from models.assignment import Assignment
        from models.course import Course
        from models.user import User

        assignment = session.get(Assignment, assignment_submitted.assignment_id)
        if assignment and assignment.course_id:
            course = session.get(Course, assignment.course_id)
            student = session.get(User, assignment_submitted.user_id)

            if course and student:
                student_name = student.username or f"Sinh viên (ID: {assignment_submitted.user_id})"
                create_notification(
                    session,
                    user_id=course.instructor_id,
                    type="assignment_submitted",
                    title="Bài tập mới được nộp",
                    message=f"{student_name} đã nộp bài tập '{assignment.title}'.",
                    reference_id=assignment_submitted.id,
                    reference_type="assignment_submitted",
                )
    except Exception:
        # Không làm gián đoạn việc nộp bài nếu thông báo gặp lỗi
        pass

    return assignment_submitted

# Cập nhật bài tập đã nộp
@router.put("/update/{assignment_id}/{user_id}", response_model=AssignmentSubmitted)
def update_assignment_submitted(assignment_id: int, user_id: int, assignment_submitted: AssignmentSubmitted, session: Session = Depends(get_session)):
    existing_assignment_submitted = session.exec(select(AssignmentSubmitted).where(AssignmentSubmitted.assignment_id == assignment_id and AssignmentSubmitted.user_id == user_id)).first()
    if not existing_assignment_submitted:
        raise HTTPException(status_code=404, detail="Không tìm thấy bài tập đã nộp")
    for key, value in assignment_submitted.model_dump(exclude_unset=True).items():
        setattr(existing_assignment_submitted, key, value)
    session.commit()
    session.refresh(existing_assignment_submitted)
    return existing_assignment_submitted


from datetime import datetime, timezone
from database.engine import create_db_engine
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Form
from sqlmodel import Session, select, Field, SQLModel, create_engine

from routers.notification import create_notification

router = APIRouter(prefix="/assignments_submitted", tags=["assignments_submitted"])

def get_session():
    with Session(create_db_engine()) as session:
        yield session

class AssignmentSubmitted(SQLModel, table=True):
    __tablename__ = "assignment_submitted"

    id: Optional[int] = Field(default=None, primary_key=True)
    assignment_id: Optional[int] = Field(default=None, foreign_key="assignment.id", nullable=False)
    user_id: Optional[int] = Field(default=None, foreign_key="user.id", nullable=False)
    submission_content: Optional[str] = Field(default=None, nullable=True, description="Nội dung bài tập đã nộp. Có thể là văn bản, mã nguồn, hoặc liên kết đến tài liệu.")
    submission_file: Optional[str] = Field(default=None, nullable=True, description="Đường dẫn đến tệp đính kèm của bài tập đã nộp. Có thể là tệp PDF, DOCX, ZIP, v.v.")
    submitted_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), nullable=False)
    is_graded: bool = Field(default=False, nullable=False, description="Trạng thái chấm điểm của bài tập đã nộp. Nếu là True, bài tập đã được chấm điểm; nếu là False, bài tập chưa được chấm điểm.")
    is_passed: Optional[bool] = Field(default=None, nullable=True, description="Trạng thái đạt hay không đạt của bài tập đã nộp. Nếu là True, bài tập đã đạt; nếu là False, bài tập chưa đạt; nếu là None, bài tập chưa được chấm điểm.")
    is_resubmitted: bool = Field(default=False, nullable=False, description="Trạng thái nộp lại của bài tập đã nộp. Nếu là True, bài tập đã được nộp lại; nếu là False, bài tập chưa được nộp lại.")
    score: Optional[int] = Field(default=None, nullable=True, description="Điểm số của bài tập đã nộp. Chấm điểm thủ công bởi giảng viên.")
    feedback: Optional[str] = Field(default=None, nullable=True, description="Phản hồi của giảng viên về bài tập đã nộp.")
    is_final_submission: bool = Field(default=False, nullable=False, description="Trạng thái nộp cuối cùng của bài tập đã nộp. Nếu là True, đây là lần nộp cuối cùng; nếu là False, học sinh có thể nộp lại bài tập.")

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
        from routers.assignment import Assignment
        from routers.course import Course
        from routers.user import User

        assignment = session.get(Assignment, assignment_submitted.assignment_id)
        if assignment and assignment.course_id:
            course = session.get(Course, assignment.course_id)
            student = session.get(User, assignment_submitted.user_id)

            if course and student:
                student_name = student.username or f"Học sinh (ID: {assignment_submitted.user_id})"
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


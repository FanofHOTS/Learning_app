from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Field, Session, SQLModel, select

from database.engine import create_db_engine

router = APIRouter(prefix="/course_component", tags=["course_component"])


def get_session():
    with Session(create_db_engine()) as session:
        yield session


class CourseComponent(SQLModel, table=True):
    __tablename__ = "course_component"

    id: Optional[int] = Field(default=None, primary_key=True)
    course_id: int = Field(foreign_key="course.id", nullable=False)
    module_id: int = Field(foreign_key="module.id", nullable=False)
    title: str = Field(default="Thành phần học tập", nullable=False)
    component_sequence: int = Field(default=1, nullable=False)
    component_type: str = Field(default="document", nullable=False)
    ref_id: Optional[int] = Field(default=None, nullable=True)
    summary: str = Field(default="Mô tả ngắn cho thành phần học tập", nullable=False)
    estimated_minutes: int = Field(default=15, nullable=False)
    is_preview: bool = Field(default=False, nullable=False)


@router.get("/", response_model=List[CourseComponent])
def get_all_course_components(session: Session = Depends(get_session)):
    return session.exec(select(CourseComponent)).all()


@router.get("/course/{course_id}", response_model=List[CourseComponent])
def get_course_components_by_course(
    course_id: int, session: Session = Depends(get_session)
):
    components = session.exec(
        select(CourseComponent).where(CourseComponent.course_id == course_id)
    ).all()
    if not components:
        raise HTTPException(
            status_code=404,
            detail="Không tìm thấy thành phần học tập nào cho khóa học này",
        )
    return components


@router.get("/module/{module_id}", response_model=List[CourseComponent])
def get_course_components_by_module(
    module_id: int, session: Session = Depends(get_session)
):
    components = session.exec(
        select(CourseComponent).where(CourseComponent.module_id == module_id)
    ).all()
    if not components:
        raise HTTPException(
            status_code=404,
            detail="Không tìm thấy thành phần học tập nào cho module này",
        )
    return components


@router.get("/{component_id}", response_model=CourseComponent)
def get_course_component(component_id: int, session: Session = Depends(get_session)):
    component = session.get(CourseComponent, component_id)
    if not component:
        raise HTTPException(
            status_code=404, detail="Không tìm thấy thành phần học tập"
        )
    return component


@router.post("/create", response_model=CourseComponent)
def create_course_component(
    course_component: CourseComponent, session: Session = Depends(get_session)
):
    session.add(course_component)
    session.commit()
    session.refresh(course_component)
    return course_component


@router.put("/update/{component_id}", response_model=CourseComponent)
def update_course_component(
    component_id: int,
    course_component_data: CourseComponent,
    session: Session = Depends(get_session),
):
    component = session.get(CourseComponent, component_id)
    if not component:
        raise HTTPException(
            status_code=404, detail="Không tìm thấy thành phần học tập"
        )

    for key, value in course_component_data.model_dump(exclude_unset=True).items():
        setattr(component, key, value)

    session.commit()
    session.refresh(component)
    return component


@router.delete("/delete/{component_id}")
def delete_course_component(component_id: int, session: Session = Depends(get_session)):
    component = session.get(CourseComponent, component_id)
    if not component:
        raise HTTPException(
            status_code=404, detail="Không tìm thấy thành phần học tập"
        )
    # Loại bỏ sự phụ thuộc của tài liệu hoặc bài kiểm tra trước khi xóa thành phần khóa học
    if component.component_type == "document":
        from routers.document import Document

        document = session.get(Document, component.ref_id)
        if document:
            document.course_id = None
            document.module_id = None
            session.add(document)
    elif component.component_type == "exam":
        from routers.exam import Exam

        exam = session.get(Exam, component.ref_id)
        if exam:
            exam.course_id = None
            exam.module_id = None
            session.add(exam)

    session.delete(component)
    session.commit()
    return {"message": "Đã xóa thành phần học tập"}

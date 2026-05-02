from datetime import datetime, timezone
from database.engine import create_db_engine
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select, Field, SQLModel

router = APIRouter(prefix="/document", tags=["document"])


def get_session():
    with Session(create_db_engine()) as session:
        yield session


class Document(SQLModel, table=True):
    __tablename__ = "document"

    id: Optional[int] = Field(default=None, primary_key=True)
    title: str = Field(default="Học liệu", nullable=False)
    document_type: Optional[str] = Field(default="other", nullable=False)
    content: Optional[str] = Field(default=None, nullable=True)
    file_url: Optional[str] = Field(default="/document/document_test.pdf", nullable=True)
    course_id: Optional[int] = Field(default=None, foreign_key="course.id", nullable=True)
    module_id: Optional[int] = Field(default=None, foreign_key="module.id", nullable=True)
    #course_component_id: Optional[int] = Field(default=None, foreign_key="course_component.id", nullable=False)
    #created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), nullable=False)
    #updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), nullable=False)

# Lấy danh sách học liệu
@router.get("/", response_model=List[Document])
def get_all_documents(session: Session = Depends(get_session)):
    return session.exec(select(Document)).all()

# Lấy danh sách học liệu dựa trên khóa học
@router.get("/course/{course_id}", response_model=List[Document])
def get_documents_by_course(course_id: int, session: Session = Depends(get_session)):
    documents = session.exec(select(Document).where(Document.course_id == course_id)).all()
    if not documents:
        raise HTTPException(status_code=404, detail="Không tìm thấy tài liệu cho khóa học này")
    return documents

# Lấy danh sách học liệu dựa trên module khóa học
@router.get("/module/{module_id}", response_model=List[Document])
def get_documents_by_module(module_id: int, session: Session = Depends(get_session)):
    documents = session.exec(
        select(Document).where(Document.module_id == module_id)
    ).all()
    if not documents:
        raise HTTPException(
            status_code=404, detail="Không tìm thấy tài liệu cho module này"
        )
    return documents

# Lấy danh sách học liệu dựa trên module khóa học

# Lấy học liệu theo id
@router.get("/{document_id}", response_model=Document)
def get_document(document_id: int, session: Session = Depends(get_session)):
    document = session.get(Document, document_id)
    if not document:
        raise HTTPException(status_code=404, detail="Không tìm thấy tài liệu")
    return document

@router.post("/create", response_model=Document)
def create_document(document: Document, session: Session = Depends(get_session)):
    session.add(document)
    session.commit()
    session.refresh(document)
    return document


@router.put("/update/{document_id}", response_model=Document)
def update_document(
    document_id: int, document_data: Document, session: Session = Depends(get_session)
):
    document = session.get(Document, document_id)
    if not document:
        raise HTTPException(status_code=404, detail="Không tìm thấy tài liệu")
    for key, value in document_data.model_dump(exclude_unset=True).items():
        setattr(document, key, value)
    document.updated_at = datetime.now(timezone.utc)
    session.commit()
    session.refresh(document)
    return document


@router.delete("/delete/{document_id}", response_model=dict)
def delete_document(document_id: int, session: Session = Depends(get_session)):
    document = session.get(Document, document_id)
    if not document:
        raise HTTPException(status_code=404, detail="Không tìm thấy tài liệu")
    session.delete(document)
    session.commit()
    return {"message": "Xóa tài liệu thành công"}

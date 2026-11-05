from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlmodel import Session, select

from ai.lesson_writer import (
    MAX_UPLOAD_SOURCE_BYTES,
    LessonWriterConfigurationError,
    LessonWriterProviderError,
    LessonWriterSourceError,
    LessonWritingRequest,
    LessonWritingResponse,
    extract_lesson_source_bytes,
    extract_lesson_source_text,
    generate_lesson_text,
)
from database.engine import create_db_engine
from models.course import Course
from models.document import Document
from routers.instructor_auth import get_instructor_id

router = APIRouter(prefix="/lesson-writer", tags=["lesson-writer"])


def get_session():
    with Session(create_db_engine()) as session:
        yield session


def _get_owned_document(
    document_id: int,
    instructor_id: int,
    session: Session,
) -> Document:
    document = session.exec(
        select(Document)
        .join(Course, Document.course_id == Course.id)
        .where(
            Document.id == document_id,
            Course.instructor_id == instructor_id,
        )
    ).first()
    if document is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy tài liệu thuộc khóa học của bạn.",
        )
    return document


def _writer_error_response(error: Exception) -> HTTPException:
    if isinstance(error, LessonWriterConfigurationError):
        return HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(error),
        )
    if isinstance(error, LessonWriterSourceError):
        return HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=str(error),
        )
    return HTTPException(
        status_code=status.HTTP_502_BAD_GATEWAY,
        detail=str(error),
    )


@router.post("/generate", response_model=LessonWritingResponse)
def generate_lesson_writing(
    payload: LessonWritingRequest,
    _instructor_id: int = Depends(get_instructor_id),
    session: Session = Depends(get_session),
):
    try:
        document_text = None
        if payload.action == "generate_from_document":
            if payload.document_id is None:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                    detail="Hãy chọn tài liệu nguồn.",
                )
            document = _get_owned_document(
                payload.document_id,
                _instructor_id,
                session,
            )
            extracted_text = extract_lesson_source_text(
                document.file_url,
                document.content or "",
            )
            document_text = f"Tài liệu nguồn: {document.title}\n{extracted_text}"
        return generate_lesson_text(payload, document_text)
    except (LessonWriterConfigurationError, LessonWriterProviderError, LessonWriterSourceError) as error:
        raise _writer_error_response(error) from error


@router.post("/generate-upload", response_model=LessonWritingResponse)
async def generate_lesson_writing_from_upload(
    file: UploadFile = File(...),
    title: str = Form(default="", max_length=200),
    instructions: str = Form(default="", max_length=1_200),
    _instructor_id: int = Depends(get_instructor_id),
):
    if not file.filename:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Tệp tải lên không có tên hợp lệ.",
        )

    try:
        contents = await file.read(MAX_UPLOAD_SOURCE_BYTES + 1)
        document_text = extract_lesson_source_bytes(
            file.filename,
            contents,
            max_bytes=MAX_UPLOAD_SOURCE_BYTES,
        )
        payload = LessonWritingRequest(
            action="generate_from_document",
            title=title,
            instructions=instructions,
        )
        return generate_lesson_text(payload, document_text)
    except (LessonWriterConfigurationError, LessonWriterProviderError, LessonWriterSourceError) as error:
        raise _writer_error_response(error) from error
    finally:
        await file.close()

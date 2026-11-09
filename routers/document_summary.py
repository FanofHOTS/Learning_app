from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlmodel import Session, select

from ai.document_summarizer import (
    DEFAULT_SUMMARY_LENGTH,
    DocumentSummaryConfigurationError,
    DocumentSummaryError,
    DocumentSummaryProviderError,
    DocumentSummarySourceError,
    SummaryLength,
    extract_document_source_text,
    summarize_document_text,
)
from database.engine import create_db_engine
from models.document import Document
from models.document_summary import DocumentSummary as DocumentSummaryRecord

router = APIRouter(prefix="/document", tags=["document-summary"])


def get_session():
    with Session(create_db_engine()) as session:
        yield session


class DocumentSummaryResponse(BaseModel):
    document_id: int
    length: SummaryLength
    overview: str
    key_points: list[str]
    keywords: list[str]
    model_used: str
    cached: bool
    generated_at: Optional[datetime] = None


def _document_fingerprint(document: Document) -> str:
    """Băm các trường ảnh hưởng tới bản tóm tắt để biết bản lưu còn hợp lệ không."""
    updated_at = document.updated_at.isoformat() if document.updated_at else ""
    raw_value = "|".join(
        [
            str(document.id or ""),
            document.title or "",
            document.file_url or "",
            document.content or "",
            updated_at,
        ]
    )
    return hashlib.sha256(raw_value.encode("utf-8")).hexdigest()


def _dump_items(items: list[str]) -> str:
    return json.dumps(items, ensure_ascii=False)


def _load_items(raw_value: Optional[str]) -> list[str]:
    try:
        parsed = json.loads(raw_value or "[]")
    except (TypeError, ValueError):
        return []
    if not isinstance(parsed, list):
        return []
    return [item for item in parsed if isinstance(item, str)]


def _find_summary(
    session: Session,
    document_id: int,
    length: str,
) -> Optional[DocumentSummaryRecord]:
    return session.exec(
        select(DocumentSummaryRecord).where(
            DocumentSummaryRecord.document_id == document_id,
            DocumentSummaryRecord.length_mode == length,
        )
    ).first()


def _build_response(
    record: DocumentSummaryRecord,
    *,
    cached: bool,
) -> DocumentSummaryResponse:
    length = record.length_mode
    if length not in {"short", "medium", "detailed"}:
        length = DEFAULT_SUMMARY_LENGTH
    return DocumentSummaryResponse(
        document_id=record.document_id,
        length=length,  # type: ignore[arg-type]
        overview=record.overview,
        key_points=_load_items(record.key_points),
        keywords=_load_items(record.keywords),
        model_used=record.model_used,
        cached=cached,
        generated_at=record.updated_at,
    )


def _summary_error_response(error: Exception) -> HTTPException:
    if isinstance(error, DocumentSummaryConfigurationError):
        return HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(error),
        )
    if isinstance(error, DocumentSummarySourceError):
        return HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=str(error),
        )
    return HTTPException(
        status_code=status.HTTP_502_BAD_GATEWAY,
        detail=str(error),
    )


@router.post("/{document_id}/summary", response_model=DocumentSummaryResponse)
def summarize_document(
    document_id: int,
    refresh: bool = False,
    length: SummaryLength = DEFAULT_SUMMARY_LENGTH,
    session: Session = Depends(get_session),
):
    document = session.get(Document, document_id)
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy tài liệu",
        )
    if (document.document_type or "").strip().lower() == "video":
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=(
                "Tạm thời chưa hỗ trợ tóm tắt AI cho tài liệu dạng video. "
                "Bạn vẫn có thể xem video trong trình phát."
            ),
        )

    fingerprint = _document_fingerprint(document)
    record = _find_summary(session, document_id, length)
    if (
        record is not None
        and not refresh
        and record.source_fingerprint == fingerprint
    ):
        return _build_response(record, cached=True)

    try:
        source_text = extract_document_source_text(
            document.file_url,
            document.content or "",
        )
        summary = summarize_document_text(
            document.title,
            source_text,
            length=length,
        )
    except DocumentSummaryError as error:
        raise _summary_error_response(error) from error

    now = datetime.now(timezone.utc)
    if record is None:
        record = DocumentSummaryRecord(
            document_id=document_id,
            length_mode=length,
            overview=summary.overview,
            key_points=_dump_items(summary.key_points),
            keywords=_dump_items(summary.keywords),
            model_used=summary.model_used,
            source_fingerprint=fingerprint,
            created_at=now,
            updated_at=now,
        )
        session.add(record)
    else:
        record.overview = summary.overview
        record.key_points = _dump_items(summary.key_points)
        record.keywords = _dump_items(summary.keywords)
        record.model_used = summary.model_used
        record.source_fingerprint = fingerprint
        record.updated_at = now
        session.add(record)

    session.commit()
    session.refresh(record)
    return _build_response(record, cached=False)

from sqlmodel import Session, delete, select

from models.document_subtitle import DocumentSubtitle
from models.document_summary import DocumentSummary


def delete_document_summaries_and_subtitles(
    session: Session,
    document_id: int,
) -> list[str]:
    session.exec(
        delete(DocumentSummary).where(DocumentSummary.document_id == document_id)
    )
    subtitles = session.exec(
        select(DocumentSubtitle).where(
            DocumentSubtitle.document_id == document_id
        )
    ).all()
    session.exec(
        delete(DocumentSubtitle).where(DocumentSubtitle.document_id == document_id)
    )
    return [subtitle.file_url for subtitle in subtitles]

from __future__ import annotations

import secrets
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from fastapi import HTTPException
from sqlmodel import Session, select

from models.certificate import Certificate, CertificateTemplate
from routers.course import Course
from services.certificate_generator import generate_certificate_image_bytes
from services.storage import (
    store_file,
    cleanup_replaced_upload,
)


def build_certificate_code(course_id: int, user_id: int) -> str:
    random_suffix = secrets.token_hex(3).upper()
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d")
    return f"CERT-{timestamp}-{course_id}-{user_id}-{random_suffix}"


def get_certificate_for_user_course(
    session: Session, user_id: int, course_id: int
) -> Certificate | None:
    return session.exec(
        select(Certificate).where(
            Certificate.user_id == user_id,
            Certificate.course_id == course_id,
        )
    ).first()


def get_active_template(session: Session) -> CertificateTemplate | None:
    """Get the currently active certificate template, if any."""
    return session.exec(
        select(CertificateTemplate).where(CertificateTemplate.is_active == True)  # noqa: E712
    ).first()


def _resolve_template_path(session: Session) -> Optional[Path]:
    """Resolve the local file path of the active template, if available and local.

    - If the template file is stored locally, returns the local Path.
    - If it's a Blob URL, downloads it to a temp file for the current process.
    - Falls back to None (programmatic generation) if resolution fails.
    """
    template = get_active_template(session)
    if template is None or not template.file_url:
        return None

    # Try local file path resolution
    from services.storage import resolve_local_file_path, is_blob_url

    local_path = resolve_local_file_path(template.file_url)
    if local_path is not None and local_path.exists():
        return local_path

    # If it's a Blob URL, download it to a temporary file
    if is_blob_url(template.file_url):
        import tempfile
        import urllib.request

        try:
            with urllib.request.urlopen(template.file_url) as response:
                data = response.read()
            suffix = Path(template.file_url).suffix or ".png"
            tmp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
            tmp.write(data)
            tmp.close()
            return Path(tmp.name)
        except Exception:
            pass

    return None


def _resolve_student_name(session: Session, user_id: int) -> str:
    from routers.profile import Profile
    from routers.user import User

    profile = session.get(Profile, user_id)
    if profile and profile.name.strip():
        return profile.name.strip()

    user = session.get(User, user_id)
    if user and user.username.strip():
        return user.username.strip()

    return f"Sinh viên #{user_id}"


def _resolve_instructor_name(course: Course) -> str:
    if course.instructor_name and course.instructor_name.strip():
        return course.instructor_name.strip()
    return "Giảng viên"


def create_certificate_record(
    session: Session,
    *,
    user_id: int,
    course_id: int,
    final_score: int | None = None,
    issued_at: datetime | None = None,
) -> Certificate:
    from routers.user import User

    user = session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Không tìm thấy người dùng")

    course = session.get(Course, course_id)
    if not course:
        raise HTTPException(status_code=404, detail="Không tìm thấy khóa học")

    existing = get_certificate_for_user_course(session, user_id, course_id)
    if existing:
        return existing

    issued_at = issued_at or datetime.now(timezone.utc)
    certificate_code = build_certificate_code(course_id, user_id)

    # Resolve active template (if any)
    template = get_active_template(session)
    template_path = _resolve_template_path(session)

    # Generate certificate image as bytes (in-memory)
    png_bytes = generate_certificate_image_bytes(
        student_name=_resolve_student_name(session, user_id),
        course_title=course.title,
        instructor_name=_resolve_instructor_name(course),
        certificate_code=certificate_code,
        issued_at=issued_at,
        final_score=final_score,
        template_path=template_path,
    )

    # Store via the active backend (local filesystem or Vercel Blob)
    relative_path = Path("certificates") / f"{certificate_code}.png"
    content_type = "image/png"
    file_url = store_file(relative_path, png_bytes, content_type)

    certificate = Certificate(
        user_id=user_id,
        course_id=course_id,
        issued_at=issued_at,
        certificate_code=certificate_code,
        certificate_file=file_url,
        template_id=template.id if template else None,
    )
    session.add(certificate)
    session.commit()
    session.refresh(certificate)
    return certificate


def issue_certificate_if_completed(
    session: Session,
    user_id: int,
    course_id: int,
) -> Certificate | None:
    from routers.course_progress import CourseProgress

    course_progress = session.exec(
        select(CourseProgress).where(
            CourseProgress.user_id == user_id,
            CourseProgress.course_id == course_id,
        )
    ).first()

    if not course_progress or not course_progress.is_complete:
        return None

    return create_certificate_record(
        session,
        user_id=user_id,
        course_id=course_id,
        final_score=course_progress.final_score,
        issued_at=course_progress.completed_at or datetime.now(timezone.utc),
    )


def reissue_certificate_if_missing(
    session: Session,
    user_id: int,
    course_id: int,
) -> tuple[Certificate, bool]:
    from routers.course_progress import CourseProgress

    course_progress = session.exec(
        select(CourseProgress).where(
            CourseProgress.user_id == user_id,
            CourseProgress.course_id == course_id,
        )
    ).first()

    if not course_progress:
        raise HTTPException(
            status_code=404,
            detail="Không tìm thấy tiến trình học khóa học của sinh viên",
        )

    if not course_progress.is_complete:
        raise HTTPException(
            status_code=400,
            detail="Sinh viên chưa hoàn thành khóa học, không thể cấp chứng chỉ",
        )

    existing = get_certificate_for_user_course(session, user_id, course_id)
    if existing:
        return existing, False

    certificate = create_certificate_record(
        session,
        user_id=user_id,
        course_id=course_id,
        final_score=course_progress.final_score,
        issued_at=course_progress.completed_at or datetime.now(timezone.utc),
    )
    return certificate, True


def delete_certificate_record(
    session: Session, certificate_id: int
) -> None:
    """Delete a certificate record and its associated file from storage."""
    certificate = session.get(Certificate, certificate_id)
    if not certificate:
        raise HTTPException(status_code=404, detail="Không tìm thấy chứng chỉ")

    file_url = certificate.certificate_file
    session.delete(certificate)
    session.commit()
    cleanup_replaced_upload(file_url)

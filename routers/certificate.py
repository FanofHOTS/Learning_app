from __future__ import annotations

from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel, Field
from sqlmodel import Session, select

from database.engine import create_db_engine
from models.certificate import Certificate, CertificateTemplate
from models.course import Course
from models.profile import Profile
from services.certificate_service import (
    create_certificate_record,
    get_certificate_for_user_course,
    get_active_template,
    reissue_certificate_if_missing,
)
from services.storage import (
    build_upload_relative_path,
    cleanup_replaced_upload,
    get_file_extension,
    guess_content_type_from_bytes,
    normalize_filename,
    store_file,
)

router = APIRouter(prefix="/certificate", tags=["certificate"])


def get_session():
    with Session(create_db_engine()) as session:
        yield session


# ──────────────────────────────────────────────
#  Pydantic schemas
# ──────────────────────────────────────────────

class CertificateDetail(Certificate):
    student_name: Optional[str] = None
    course_title: Optional[str] = None


class CertificateReissueResponse(BaseModel):
    certificate: Certificate
    created: bool = Field(
        description="True nếu chứng chỉ vừa được tạo mới, False nếu đã tồn tại trước đó."
    )
    message: str


class CertificateTemplateResponse(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    file_url: Optional[str] = None
    is_active: bool
    created_at: datetime
    updated_at: datetime


class CertificateTemplateCreate(BaseModel):
    name: str
    description: Optional[str] = None


# ──────────────────────────────────────────────
#  Helpers
# ──────────────────────────────────────────────

def enrich_certificate(
    session: Session, certificate: Certificate
) -> CertificateDetail:
    profile = session.get(Profile, certificate.user_id)
    course = session.get(Course, certificate.course_id)
    return CertificateDetail(
        **certificate.model_dump(),
        student_name=profile.name if profile else None,
        course_title=course.title if course else None,
    )


def _template_to_response(t: CertificateTemplate) -> CertificateTemplateResponse:
    return CertificateTemplateResponse(
        id=t.id,
        name=t.name,
        description=t.description,
        file_url=t.file_url,
        is_active=t.is_active,
        created_at=t.created_at,
        updated_at=t.updated_at,
    )


# ──────────────────────────────────────────────
#  Certificate endpoints
# ──────────────────────────────────────────────

@router.get("/", response_model=List[Certificate])
def get_all_certificates(session: Session = Depends(get_session)):
    return session.exec(select(Certificate)).all()


@router.get("/user/{user_id}", response_model=List[CertificateDetail])
def get_certificates_by_user(user_id: int, session: Session = Depends(get_session)):
    certificates = session.exec(
        select(Certificate).where(Certificate.user_id == user_id)
    ).all()
    if not certificates:
        raise HTTPException(
            status_code=404,
            detail="Không tìm thấy chứng chỉ nào của sinh viên",
        )
    return [enrich_certificate(session, certificate) for certificate in certificates]


@router.get("/course/{course_id}", response_model=List[CertificateDetail])
def get_certificates_by_course(
    course_id: int, session: Session = Depends(get_session)
):
    certificates = session.exec(
        select(Certificate).where(Certificate.course_id == course_id)
    ).all()
    if not certificates:
        raise HTTPException(
            status_code=404,
            detail="Không tìm thấy chứng chỉ nào của khóa học",
        )
    return [enrich_certificate(session, certificate) for certificate in certificates]


@router.get("/verify/{certificate_code}", response_model=CertificateDetail)
def verify_certificate(
    certificate_code: str, session: Session = Depends(get_session)
):
    certificate = session.exec(
        select(Certificate).where(Certificate.certificate_code == certificate_code)
    ).first()
    if not certificate:
        raise HTTPException(
            status_code=404,
            detail="Không tìm thấy chứng chỉ hoặc mã chứng chỉ không hợp lệ",
        )
    return enrich_certificate(session, certificate)


@router.get("/{course_id}/{user_id}", response_model=CertificateDetail)
def get_certificate_by_course_and_user(
    course_id: int, user_id: int, session: Session = Depends(get_session)
):
    certificate = get_certificate_for_user_course(session, user_id, course_id)
    if not certificate:
        raise HTTPException(status_code=404, detail="Không tìm thấy chứng chỉ")
    return enrich_certificate(session, certificate)


@router.post("/issue/{course_id}/{user_id}", response_model=CertificateDetail)
def issue_certificate(
    course_id: int, user_id: int, session: Session = Depends(get_session)
):
    certificate, created = reissue_certificate_if_missing(session, user_id, course_id)
    if not created:
        raise HTTPException(
            status_code=409,
            detail="Sinh viên đã có chứng chỉ cho khóa học này",
        )
    return enrich_certificate(session, certificate)


@router.post("/reissue/{course_id}/{user_id}", response_model=CertificateReissueResponse)
def reissue_certificate(
    course_id: int, user_id: int, session: Session = Depends(get_session)
):
    certificate, created = reissue_certificate_if_missing(session, user_id, course_id)
    if created:
        message = "Đã cấp chứng chỉ hoàn thành khóa học thành công"
    else:
        message = "Sinh viên đã có chứng chỉ cho khóa học này"

    return CertificateReissueResponse(
        certificate=certificate,
        created=created,
        message=message,
    )


@router.post("/create", response_model=CertificateDetail)
def create_certificate(
    certificate: Certificate, session: Session = Depends(get_session)
):
    existing = get_certificate_for_user_course(
        session, certificate.user_id, certificate.course_id
    )
    if existing:
        raise HTTPException(
            status_code=409,
            detail="Sinh viên đã có chứng chỉ cho khóa học này",
        )

    created = create_certificate_record(
        session,
        user_id=certificate.user_id,
        course_id=certificate.course_id,
    )
    return enrich_certificate(session, created)


@router.delete("/delete/{certificate_id}", response_model=dict)
def delete_certificate(
    certificate_id: int, session: Session = Depends(get_session)
):
    certificate = session.get(Certificate, certificate_id)
    if not certificate:
        raise HTTPException(status_code=404, detail="Không tìm thấy chứng chỉ")

    file_url = certificate.certificate_file
    session.delete(certificate)
    session.commit()
    cleanup_replaced_upload(file_url)
    return {"message": "Xóa chứng chỉ thành công"}


# ──────────────────────────────────────────────
#  Certificate template endpoints
# ──────────────────────────────────────────────

@router.get("/template", response_model=List[CertificateTemplateResponse])
def get_all_templates(session: Session = Depends(get_session)):
    templates = session.exec(select(CertificateTemplate)).all()
    return [_template_to_response(t) for t in templates]


@router.get("/template/active", response_model=Optional[CertificateTemplateResponse])
def get_active_template_endpoint(session: Session = Depends(get_session)):
    template = get_active_template(session)
    if template is None:
        return None
    return _template_to_response(template)


@router.get("/template/{template_id}", response_model=CertificateTemplateResponse)
def get_template_by_id(
    template_id: int, session: Session = Depends(get_session)
):
    template = session.get(CertificateTemplate, template_id)
    if not template:
        raise HTTPException(status_code=404, detail="Không tìm thấy mẫu chứng chỉ")
    return _template_to_response(template)


@router.post("/template/create", response_model=CertificateTemplateResponse)
def create_template(
    payload: CertificateTemplateCreate, session: Session = Depends(get_session)
):
    if not payload.name.strip():
        raise HTTPException(
            status_code=422,
            detail="Tên mẫu chứng chỉ không được để trống.",
        )

    template = CertificateTemplate(
        name=payload.name.strip(),
        description=payload.description.strip() if payload.description else None,
        is_active=False,
    )
    session.add(template)
    session.commit()
    session.refresh(template)
    return _template_to_response(template)


@router.post("/template/{template_id}/upload")
async def upload_template_file(
    template_id: int,
    file: UploadFile = File(...),
    session: Session = Depends(get_session),
):
    """Upload a template image or PDF file for a certificate template."""
    template = session.get(CertificateTemplate, template_id)
    if not template:
        raise HTTPException(status_code=404, detail="Không tìm thấy mẫu chứng chỉ")

    if not file.filename:
        raise HTTPException(
            status_code=400,
            detail="Tên tệp không hợp lệ.",
        )

    filename = normalize_filename(file.filename)
    extension = get_file_extension(filename)

    allowed_extensions = {".png", ".jpg", ".jpeg", ".pdf", ".bmp", ".webp"}
    if extension not in allowed_extensions:
        raise HTTPException(
            status_code=400,
            detail="Vui lòng tải lên tệp ảnh (.png, .jpg, .jpeg, .bmp, .webp) hoặc PDF (.pdf).",
        )

    contents = await file.read()
    if not contents:
        raise HTTPException(status_code=400, detail="Tệp tải lên đang rỗng.")

    relative_path = build_upload_relative_path("certificate-templates", filename)
    content_type = guess_content_type_from_bytes(filename, contents)

    try:
        file_url = store_file(relative_path, contents, content_type)
    finally:
        await file.close()

    # Store old URL for cleanup before replacing
    old_file_url = template.file_url
    template.file_url = file_url
    template.updated_at = datetime.now(timezone.utc)
    session.commit()
    session.refresh(template)

    # Clean up old file if it was replaced
    if old_file_url:
        cleanup_replaced_upload(old_file_url)

    return {
        "message": "Tải lên mẫu chứng chỉ thành công",
        "template": _template_to_response(template).model_dump(),
    }


@router.put("/template/{template_id}/activate", response_model=CertificateTemplateResponse)
def activate_template(
    template_id: int, session: Session = Depends(get_session)
):
    """Set a template as the active certificate template."""
    template = session.get(CertificateTemplate, template_id)
    if not template:
        raise HTTPException(status_code=404, detail="Không tìm thấy mẫu chứng chỉ")

    # Deactivate all other templates
    all_templates = session.exec(select(CertificateTemplate)).all()
    for t in all_templates:
        if t.is_active:
            t.is_active = False
            t.updated_at = datetime.now(timezone.utc)
            session.add(t)

    # Activate the requested template
    template.is_active = True
    template.updated_at = datetime.now(timezone.utc)
    session.add(template)
    session.commit()
    session.refresh(template)

    return _template_to_response(template)


@router.put("/template/{template_id}/deactivate", response_model=CertificateTemplateResponse)
def deactivate_template(
    template_id: int, session: Session = Depends(get_session)
):
    """Deactivate a template without activating another."""
    template = session.get(CertificateTemplate, template_id)
    if not template:
        raise HTTPException(status_code=404, detail="Không tìm thấy mẫu chứng chỉ")

    template.is_active = False
    template.updated_at = datetime.now(timezone.utc)
    session.add(template)
    session.commit()
    session.refresh(template)

    return _template_to_response(template)


@router.put("/template/update/{template_id}", response_model=CertificateTemplateResponse)
def update_template(
    template_id: int,
    payload: CertificateTemplateCreate,
    session: Session = Depends(get_session),
):
    """Update template metadata (name, description)."""
    template = session.get(CertificateTemplate, template_id)
    if not template:
        raise HTTPException(status_code=404, detail="Không tìm thấy mẫu chứng chỉ")

    if payload.name and payload.name.strip():
        template.name = payload.name.strip()

    if payload.description is not None:
        template.description = payload.description.strip() if payload.description.strip() else None

    template.updated_at = datetime.now(timezone.utc)
    session.add(template)
    session.commit()
    session.refresh(template)

    return _template_to_response(template)


@router.delete("/template/delete/{template_id}", response_model=dict)
def delete_template(
    template_id: int, session: Session = Depends(get_session)
):
    """Delete a certificate template and its associated file."""
    template = session.get(CertificateTemplate, template_id)
    if not template:
        raise HTTPException(status_code=404, detail="Không tìm thấy mẫu chứng chỉ")

    file_url = template.file_url
    session.delete(template)
    session.commit()
    cleanup_replaced_upload(file_url)
    return {"message": "Xóa mẫu chứng chỉ thành công"}

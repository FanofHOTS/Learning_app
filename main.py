import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlsplit

from fastapi import FastAPI, File, UploadFile, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent

load_dotenv(
    dotenv_path=BASE_DIR / ".env",
    override=False,
    encoding="utf-8",
)

from database.engine import create_db_engine
import os
from models.certificate import Certificate  # noqa: F401 — đăng ký bảng certificate
from models.question_bank import (  # noqa: F401 — đăng ký bảng ngân hàng câu hỏi chung
    QuestionBank,
    QuestionBankOption,
)
from routers import (
    category, certificate, course_extra_data, course_progress, course, course_survey, discussion,
    document,
    document_summary,
    exam_result, exam, exam_attempt, module_progress, module, notification,
    option, profile, question, question_bank, user, course_component,
    course_component_progress, course_discussion, assignment, assignment_submitted,
    lesson_draft, lesson_writer,
)
#import ai.question_generator

BASE_DIR = Path(__file__).resolve().parent
UPLOADS_DIR = Path(os.getenv("UPLOAD_DIR", "").strip() or (BASE_DIR / "uploads"))
if not UPLOADS_DIR.is_absolute():
    UPLOADS_DIR = BASE_DIR / UPLOADS_DIR
app = FastAPI(title="Ứng dụng học tập trực tuyến với FastAPI", version="1.0.0")

def _configured_origins(*values: str | None) -> list[str]:
    origins: list[str] = []
    for value in values:
        if not value:
            continue
        for configured_origin in value.split(","):
            candidate = configured_origin.strip()
            if not candidate:
                continue
            parsed = urlsplit(candidate)
            origin = (
                f"{parsed.scheme}://{parsed.netloc}"
                if parsed.scheme and parsed.netloc
                else candidate.rstrip("/")
            )
            if origin not in origins:
                origins.append(origin)
    return origins


frontend_origins = _configured_origins(
    os.getenv("FRONTEND_URL"),
    os.getenv("NEXT_URL", "http://localhost:3000"),
    "https://learning-app-zeta-nine.vercel.app",
)
backend_origins = _configured_origins(
    os.getenv("BACKEND_URL"),
    os.getenv("NEXT_PUBLIC_API_BASE_URL", "http://localhost:8000"),
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        *frontend_origins,
        *backend_origins,
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# Register after CORS so rejected/handled preflight requests are visible in logs.
# Dùng print() flush=True vì fastapi dev ghi đè logging của uvicorn
@app.middleware("http")
async def log_requests(request: Request, call_next):
    start = time.time()
    try:
        response = await call_next(request)
    except Exception as error:
        duration = time.time() - start
        print(
            f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}]"
            f" {request.method} {request.url.path}"
            f" \u2192 500 (unhandled {type(error).__name__})"
            f" ({duration * 1000:.0f}ms)",
            flush=True,
        )
        raise

    duration = time.time() - start
    preflight_details = ""
    if request.method == "OPTIONS":
        preflight_details = (
            f" origin={request.headers.get('origin', '-')}"
            f" requested_method={request.headers.get('access-control-request-method', '-')}"
            f" allow_origin={response.headers.get('access-control-allow-origin', '-')}"
        )
    print(
        f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}]"
        f" {request.method} {request.url.path}"
        f" \u2192 {response.status_code}"
        f"{preflight_details}"
        f" ({duration * 1000:.0f}ms)",
        flush=True,
    )
    return response

#app.mount("/api", StaticFiles(directory=str(BASE_DIR), html=True), name="static")
app.mount("/uploads", StaticFiles(directory=str(UPLOADS_DIR), check_dir=False), name="uploads")

app.include_router(assignment.router)
app.include_router(assignment_submitted.router)
app.include_router(category.router)
app.include_router(certificate.router)
app.include_router(course_extra_data.router)
app.include_router(course_progress.router)
app.include_router(discussion.router)
app.include_router(course.router)
app.include_router(course_survey.router)
app.include_router(course_component.router)
app.include_router(course_component_progress.router)
app.include_router(course_discussion.router)
app.include_router(document.router)
app.include_router(document_summary.router)
app.include_router(lesson_draft.router)
app.include_router(lesson_writer.router)
app.include_router(exam_result.router)
app.include_router(exam.router)
app.include_router(exam_attempt.router)
app.include_router(notification.router)
app.include_router(module_progress.router)
app.include_router(module.router)
app.include_router(option.router)
app.include_router(profile.router)
app.include_router(question.router)
app.include_router(question_bank.router)
app.include_router(user.router)


@app.on_event("startup")
def on_startup():
    from alembic.config import Config
    from alembic import command

    alembic_cfg = Config(str(BASE_DIR / "alembic.ini"))
    command.upgrade(alembic_cfg, "head")

    # Dọn lượt làm bài bỏ dở quá hạn mỗi lần khởi động; lỗi dọn không chặn app.
    try:
        from sqlmodel import Session

        from services.exam_attempt_cleanup import purge_stale_exam_attempts

        with Session(create_db_engine()) as session:
            cleanup = purge_stale_exam_attempts(session)
        if cleanup["deleted"]:
            print(
                f"🧹 Đã dọn {cleanup['deleted']} lượt làm bài quá hạn"
                f" (giữ {cleanup['retention_days']} ngày).",
                flush=True,
            )
    except Exception as error:
        print(f"⚠️ Không dọn được lượt làm bài cũ: {error}", flush=True)

    print(f"🚀 Khởi động vào lúc {datetime.now(timezone.utc).isoformat()}", flush=True)


@app.get("/")
def root():
    return {"message": "Chào mừng đến với ứng dụng học tập trực tuyến!"}


@app.get("/health")
def health():
    return {"status": "ok"}

#@app.post("/upload")
#async def upload_file(file: UploadFile = File(...)):

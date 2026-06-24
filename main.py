from datetime import datetime, timezone
from pathlib import Path
from fastapi import FastAPI, File, UploadFile
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
from sqlmodel import SQLModel, create_engine
import os
from models.certificate import Certificate  # noqa: F401 — đăng ký bảng certificate
from routers import (
    category, certificate, course_extra_data, course_progress, course, course_survey, discussion,
    document,
    exam_result, exam, module_progress, module, notification,
    option, profile, question, user, course_component,
    course_component_progress, course_discussion, assignment, assignment_submitted
)
#import ai.question_generator

BASE_DIR = Path(__file__).resolve().parent
UPLOADS_DIR = Path(os.getenv("UPLOAD_DIR", "").strip() or (BASE_DIR / "uploads"))
if not UPLOADS_DIR.is_absolute():
    UPLOADS_DIR = BASE_DIR / UPLOADS_DIR
app = FastAPI(title="Ứng dụng học tập trực tuyến với FastAPI", version="1.0.0")

frontend_url = os.getenv("FRONTEND_URL") or os.getenv("NEXT_URL", "http://localhost:3000")
backend_url = os.getenv("BACKEND_URL") or os.getenv("NEXT_PUBLIC_API_BASE_URL", "http://localhost:8000")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        frontend_url,
        backend_url,
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

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
app.include_router(exam_result.router)
app.include_router(exam.router)
app.include_router(notification.router)
app.include_router(module_progress.router)
app.include_router(module.router)
app.include_router(option.router)
app.include_router(profile.router)
app.include_router(question.router)
app.include_router(user.router)

@app.on_event("startup")
def on_startup():
    SQLModel.metadata.create_all(bind=create_db_engine())
    print(f"🚀 Khởi động vào lúc {datetime.now(timezone.utc).isoformat()}")

@app.get("/")
def root():
    return {"message": "Chào mừng đến với ứng dụng học tập trực tuyến!"}

#@app.post("/upload")
#async def upload_file(file: UploadFile = File(...)):

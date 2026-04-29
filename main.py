from datetime import datetime, timezone
from pathlib import Path
from fastapi import FastAPI, File, UploadFile
from fastapi.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles
from database.engine import create_db_engine
from sqlmodel import SQLModel, create_engine
import os
from routers import (
    category, course_process, course, document,
    exam_result, exam, module_process, module,
    option, profile, question, user, course_component,
    course_component_progress
)

BASE_DIR = Path(__file__).resolve().parent
app = FastAPI(title="Ứng dụng học tập trực tuyến với FastAPI", version="1.0.0")

app.mount("/api", StaticFiles(directory=str(BASE_DIR), html=True), name="static")

app.include_router(category.router)
app.include_router(course_process.router)
app.include_router(course.router)
app.include_router(course_component.router)
app.include_router(course_component_progress.router)
app.include_router(document.router)
app.include_router(exam_result.router)
app.include_router(exam.router)
app.include_router(module_process.router)
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

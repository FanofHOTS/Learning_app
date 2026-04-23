from datetime import datetime, timezone
from pathlib import Path

from fastapi import FastAPI, File, UploadFile
from fastapi.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles

import os

BASE_DIR = Path(__file__).resolve().parent
app = FastAPI(title="Ứng dụng học tập trực tuyến với FastAPI", version="1.0.0")

app.mount("/api", StaticFiles(directory=str(BASE_DIR), html=True), name="static")

@app.on_event("startup")
def on_startup():
    # create_db_and_tables()
    print(f"🚀 Khởi động vào lúc {datetime.now(timezone.utc).isoformat()}")

@app.get("/")
def root():
    # This is the root endpoint
    # You can return a simple message or redirect to a frontend page
    # For example, redirect to a static HTML page
    return RedirectResponse(url="/static/page/homepage.html")

@app.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    # Save the uploaded file to a temporary location
    temp_file_path = f"/tmp/{file.filename}"
    with open(temp_file_path, "wb") as buffer:
        buffer.write(await file.read())
    
    # Process the file (e.g., extract text using OCR)
    extracted_text = ocr_module.extract_text_from_pdf(temp_file_path)
    
    # Generate questions using the question generator
    qg = question_generator.QuestionGenerator()
    questions = qg.generate_questions(extracted_text, num_questions=5)
    
    # Clean up the temporary file
    os.remove(temp_file_path)
    
    return {"questions": questions}

import importlib.util
from typing import List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlmodel import Field, SQLModel, Session, select

from ai.question_generator import (
    GeneratedQuestion,
    QuestionGenerationRequest,
    QuestionGenerationResponse,
    QuestionGenerationRuntimeMetadata,
    QuestionGeneratorError,
    generate_questions,
    generate_questions_from_upload_file,
    get_question_generator_runtime_metadata,
)
from database.engine import create_db_engine

from models.option import Option
from models.question import Question

router = APIRouter(prefix="/question", tags=["question"])
MULTIPART_AVAILABLE = importlib.util.find_spec("multipart") is not None


def get_session():
    with Session(create_db_engine()) as session:
        yield session


@router.get("/generate-metadata", response_model=QuestionGenerationRuntimeMetadata)
def get_generate_metadata():
    metadata = get_question_generator_runtime_metadata()
    metadata.upload_generation_available = MULTIPART_AVAILABLE
    return metadata


@router.post("/generate", response_model=QuestionGenerationResponse)
def generate_exam_questions(
    payload: QuestionGenerationRequest,
    session: Session = Depends(get_session),
):
    try:
        generated = generate_questions(payload)
        if payload.persist:
            _persist_generated_questions(
                session=session,
                exam_id=payload.exam_id,
                generated_questions=generated.questions,
            )
        return generated
    except HTTPException:
        raise
    except QuestionGeneratorError as exc:
        raise _question_generator_http_error(exc) from exc


if MULTIPART_AVAILABLE:
    @router.post("/generate-upload", response_model=QuestionGenerationResponse)
    async def generate_exam_questions_from_upload(
        file: UploadFile = File(...),
        exam_id: Optional[int] = Form(default=None),
        question_count: int = Form(default=5),
        question_type: str = Form(default="multiple_choice"),
        score_per_question: int = Form(default=1),
        start_sequence: int = Form(default=1),
        persist: bool = Form(default=False),
        topic: Optional[str] = Form(default=None),
        topic_description: Optional[str] = Form(default=None),
        source_mode: str = Form(default="document_only"),
        difficulty_remember: int = Form(default=34),
        difficulty_understand: int = Form(default=33),
        difficulty_apply: int = Form(default=33),
        difficulty_easy: int = Form(default=34),
        difficulty_medium: int = Form(default=33),
        difficulty_hard: int = Form(default=33),
        session: Session = Depends(get_session),
    ):
        payload = QuestionGenerationRequest(
            exam_id=exam_id,
            question_count=question_count,
            topic=topic,
            topic_description=topic_description,
            source_mode=source_mode,
            difficulty_remember=difficulty_remember,
            difficulty_understand=difficulty_understand,
            difficulty_apply=difficulty_apply,
            difficulty_easy=difficulty_easy,
            difficulty_medium=difficulty_medium,
            difficulty_hard=difficulty_hard,
            question_type=question_type,
            score_per_question=score_per_question,
            start_sequence=start_sequence,
            persist=persist,
        )
        try:
            generated = await generate_questions_from_upload_file(file, payload)
            if payload.persist:
                _persist_generated_questions(
                    session=session,
                    exam_id=payload.exam_id,
                    generated_questions=generated.questions,
                )
            return generated
        except HTTPException:
            raise
        except QuestionGeneratorError as exc:
            raise _question_generator_http_error(exc) from exc
else:
    @router.post("/generate-upload", response_model=QuestionGenerationResponse)
    async def generate_exam_questions_from_upload_unavailable():
        raise HTTPException(
            status_code=503,
            detail="Việc sử dụng chức năng tạo câu hỏi từ file tải lên cần phải tải về thư viện python-multipart.",
        )


def _persist_generated_questions(
    session: Session,
    exam_id: Optional[int],
    generated_questions: list[GeneratedQuestion],
) -> None:
    if exam_id is None:
        raise HTTPException(
            status_code=400,
            detail="Giá trị exam_id là cần khi persist=true.",
        )

    created_questions: list[Question] = []
    try:
        for generated_question in generated_questions:
            db_question = Question(
                exam_id=exam_id,
                content=generated_question.content,
                question_type=generated_question.question_type,
                sequence=generated_question.sequence,
                score=generated_question.score,
                answer=generated_question.answer,
                bloom_level=generated_question.bloom_level,
                difficulty=generated_question.difficulty,
            )
            session.add(db_question)
            session.flush()

            generated_question.id = db_question.id
            generated_question.exam_id = db_question.exam_id

            for generated_option in generated_question.options:
                db_option = Option(
                    question_id=db_question.id,
                    content=generated_option.content,
                    is_correct=generated_option.is_correct,
                )
                session.add(db_option)
                session.flush()

                generated_option.id = db_option.id
                generated_option.question_id = db_question.id

            created_questions.append(db_question)

        session.commit()
        for created_question in created_questions:
            session.refresh(created_question)
    except HTTPException:
        session.rollback()
        raise
    except Exception as exc:
        session.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Không thể lưu các câu hỏi đã tạo: {exc}",
        ) from exc


def _question_generator_http_error(exc: QuestionGeneratorError) -> HTTPException:
    message = str(exc)
    status_code = 502 if "hugging face" in message.lower() or "connect" in message.lower() else 400
    return HTTPException(status_code=status_code, detail=message)


@router.get("/", response_model=List[Question])
def get_all_questions(session: Session = Depends(get_session)):
    return session.exec(select(Question)).all()


@router.get("/exam/{exam_id}", response_model=List[Question])
def get_questions_by_exam(exam_id: int, session: Session = Depends(get_session)):
    questions = session.exec(select(Question).where(Question.exam_id == exam_id)).all()
    if not questions:
        raise HTTPException(status_code=404, detail="Không tìm thấy câu hỏi cho bài thi này")
    return questions


@router.get("/{question_id}", response_model=Question)
def get_question(question_id: int, session: Session = Depends(get_session)):
    question = session.get(Question, question_id)
    if not question:
        raise HTTPException(status_code=404, detail="Không tìm thấy câu hỏi")
    return question


@router.post("/create", response_model=Question)
def create_question(question: Question, session: Session = Depends(get_session)):
    session.add(question)
    session.commit()
    session.refresh(question)
    return question


@router.put("/update/{question_id}", response_model=Question)
def update_question(
    question_id: int,
    question_data: Question,
    session: Session = Depends(get_session),
):
    question = session.get(Question, question_id)
    if not question:
        raise HTTPException(status_code=404, detail="Không tìm thấy câu hỏi")
    for key, value in question_data.model_dump(exclude_unset=True).items():
        setattr(question, key, value)
    session.commit()
    session.refresh(question)
    return question


@router.delete("/delete/{question_id}", response_model=dict)
def delete_question(question_id: int, session: Session = Depends(get_session)):
    question = session.get(Question, question_id)
    if not question:
        raise HTTPException(status_code=404, detail="Không tìm thấy câu hỏi")

    options = session.exec(select(Option).where(Option.question_id == question_id)).all()
    for option in options:
        session.delete(option)
    session.delete(question)
    session.commit()
    return {"message": "Xoá câu hỏi và các lụa chọn liên quan thành công"}

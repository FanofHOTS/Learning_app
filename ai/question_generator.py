from __future__ import annotations

import base64
import io
import json
import os
import re
from pathlib import Path
from typing import Any, Optional
from urllib import error as urllib_error
from urllib import request as urllib_request
from uuid import uuid4

import cv2
import pdf2image
from fastapi import UploadFile
from PIL import Image
from sqlmodel import Field, SQLModel

from ai.ocr_module import OCRModule

BASE_DIR = Path(__file__).resolve().parent.parent
UPLOAD_DIR = BASE_DIR / "uploads"
TEMP_SOURCE_DIR = UPLOAD_DIR / ".question_generation_tmp"
HF_CHAT_COMPLETIONS_URL = "https://router.huggingface.co/v1/chat/completions"
DEFAULT_TEXT_MODEL = "mistralai/Mistral-7B-Instruct-v0.3"
DEFAULT_VISION_MODEL = "Qwen/Qwen2.5-VL-7B-Instruct"
MAX_SOURCE_TEXT_CHARS = 12000
MIN_IMAGE_OCR_CHARS = 140
MIN_PDF_OCR_CHARS = 400
MIN_VIDEO_OCR_CHARS = 180
SUPPORTED_TEXT_SUFFIXES = {".txt", ".md", ".markdown"}
SUPPORTED_IMAGE_SUFFIXES = {".png", ".jpg", ".jpeg", ".webp", ".bmp"}
SUPPORTED_VIDEO_SUFFIXES = {".mp4", ".webm", ".ogg", ".mov", ".avi", ".mkv"}


class QuestionGeneratorError(RuntimeError):
    """Raised when question generation cannot continue."""


class GeneratedOption(SQLModel):
    id: Optional[int] = None
    question_id: Optional[int] = None
    content: str
    is_correct: bool = False


class GeneratedQuestion(SQLModel):
    id: Optional[int] = None
    exam_id: Optional[int] = None
    content: str
    question_type: str = "multiple_choice"
    sequence: int
    score: int
    answer: str
    options: list[GeneratedOption] = Field(default_factory=list)


class QuestionGenerationRequest(SQLModel):
    exam_id: Optional[int] = None
    content: Optional[str] = None
    file_url: Optional[str] = None
    question_count: int = Field(default=5, ge=1, le=20)
    difficulty: str = Field(default="basic")
    question_type: str = Field(default="multiple_choice")
    score_per_question: int = Field(default=1, ge=1, le=100)
    start_sequence: int = Field(default=1, ge=1)
    persist: bool = False


class QuestionGenerationResponse(SQLModel):
    exam_id: Optional[int] = None
    source_type: str
    difficulty: str
    question_type: str
    model_used: str
    content_preview: str
    warnings: list[str] = Field(default_factory=list)
    questions: list[GeneratedQuestion] = Field(default_factory=list)


def generate_questions(payload: QuestionGenerationRequest) -> QuestionGenerationResponse:
    """Generate questions from raw text or an uploaded file."""
    difficulty = _normalize_difficulty(payload.difficulty)
    question_type = _normalize_question_type(payload.question_type)
    extracted_text = (payload.content or "").strip()
    warnings: list[str] = []

    if extracted_text and payload.file_url:
        warnings.append("Using direct text content and ignoring file_url.")

    if extracted_text:
        prepared_text = _prepare_source_text(extracted_text)
        generated_questions = _generate_questions_from_text(
            prepared_text=prepared_text,
            question_count=payload.question_count,
            difficulty=difficulty,
            question_type=question_type,
            exam_id=payload.exam_id,
            score_per_question=payload.score_per_question,
            start_sequence=payload.start_sequence,
        )
        return QuestionGenerationResponse(
            exam_id=payload.exam_id,
            source_type="text",
            difficulty=difficulty,
            question_type=question_type,
            model_used=_get_text_model(),
            content_preview=_preview_text(prepared_text),
            warnings=warnings,
            questions=generated_questions,
        )

    if not payload.file_url:
        raise QuestionGeneratorError("Please provide content or file_url to generate questions.")

    file_path = _resolve_input_file(payload.file_url)
    suffix = file_path.suffix.lower()

    if suffix in SUPPORTED_TEXT_SUFFIXES:
        return _generate_from_text_file(
            file_path=file_path,
            payload=payload,
            difficulty=difficulty,
            question_type=question_type,
            warnings=warnings,
        )

    if suffix == ".pdf":
        return _generate_from_pdf(
            file_path=file_path,
            payload=payload,
            difficulty=difficulty,
            question_type=question_type,
            warnings=warnings,
        )

    if suffix in SUPPORTED_IMAGE_SUFFIXES:
        return _generate_from_image(
            file_path=file_path,
            payload=payload,
            difficulty=difficulty,
            question_type=question_type,
            warnings=warnings,
        )

    if suffix in SUPPORTED_VIDEO_SUFFIXES:
        return _generate_from_video(
            file_path=file_path,
            payload=payload,
            difficulty=difficulty,
            question_type=question_type,
            warnings=warnings,
        )

    raise QuestionGeneratorError(f"Unsupported file type: {suffix or 'unknown'}")


async def generate_questions_from_upload_file(
    upload_file: UploadFile,
    payload: QuestionGenerationRequest,
) -> QuestionGenerationResponse:
    file_bytes = await upload_file.read()
    return generate_questions_from_uploaded_bytes(
        filename=upload_file.filename,
        file_bytes=file_bytes,
        payload=payload,
        content_type=upload_file.content_type,
    )


def generate_questions_from_uploaded_bytes(
    filename: Optional[str],
    file_bytes: bytes,
    payload: QuestionGenerationRequest,
    content_type: Optional[str] = None,
) -> QuestionGenerationResponse:
    if not file_bytes:
        raise QuestionGeneratorError("Uploaded file is empty.")

    resolved_filename = _resolve_uploaded_filename(filename=filename, content_type=content_type)
    suffix = Path(resolved_filename).suffix.lower()

    if suffix in SUPPORTED_TEXT_SUFFIXES:
        text_content = _decode_uploaded_text_file(file_bytes)
        upload_payload = payload.model_copy(
            update={
                "content": text_content,
                "file_url": None,
            }
        )
        return generate_questions(upload_payload)

    temp_file_path = _write_uploaded_temp_file(
        filename=resolved_filename,
        file_bytes=file_bytes,
    )
    upload_payload = payload.model_copy(
        update={
            "file_url": str(temp_file_path),
        }
    )
    try:
        return generate_questions(upload_payload)
    finally:
        _cleanup_temp_file(temp_file_path)


def _generate_from_text_file(
    file_path: Path,
    payload: QuestionGenerationRequest,
    difficulty: str,
    question_type: str,
    warnings: list[str],
) -> QuestionGenerationResponse:
    extracted_text = _read_text_file(file_path)
    if not extracted_text.strip():
        raise QuestionGeneratorError("Uploaded text file does not contain usable content.")

    prepared_text = _prepare_source_text(extracted_text)
    questions = _generate_questions_from_text(
        prepared_text=prepared_text,
        question_count=payload.question_count,
        difficulty=difficulty,
        question_type=question_type,
        exam_id=payload.exam_id,
        score_per_question=payload.score_per_question,
        start_sequence=payload.start_sequence,
    )
    return QuestionGenerationResponse(
        exam_id=payload.exam_id,
        source_type="text_file",
        difficulty=difficulty,
        question_type=question_type,
        model_used=_get_text_model(),
        content_preview=_preview_text(prepared_text),
        warnings=warnings,
        questions=questions,
    )


def _generate_from_pdf(
    file_path: Path,
    payload: QuestionGenerationRequest,
    difficulty: str,
    question_type: str,
    warnings: list[str],
) -> QuestionGenerationResponse:
    ocr = OCRModule()
    try:
        extracted_text = ocr.extract_text_from_pdf(str(file_path)).strip()
    except Exception as exc:  # pragma: no cover - depends on local OCR setup
        raise QuestionGeneratorError(f"Could not extract text from PDF: {exc}") from exc

    if len(_cleanup_for_measurement(extracted_text)) >= MIN_PDF_OCR_CHARS:
        prepared_text = _prepare_source_text(extracted_text)
        questions = _generate_questions_from_text(
            prepared_text=prepared_text,
            question_count=payload.question_count,
            difficulty=difficulty,
            question_type=question_type,
            exam_id=payload.exam_id,
            score_per_question=payload.score_per_question,
            start_sequence=payload.start_sequence,
        )
        return QuestionGenerationResponse(
            exam_id=payload.exam_id,
            source_type="pdf_text",
            difficulty=difficulty,
            question_type=question_type,
            model_used=_get_text_model(),
            content_preview=_preview_text(prepared_text),
            warnings=warnings,
            questions=questions,
        )

    warnings.append("OCR text from PDF was limited, so visual analysis was used.")
    page_images = _render_pdf_pages(file_path, max_pages=3)
    questions = _generate_questions_from_visual_inputs(
        image_payloads=[_image_to_data_url(image) for image in page_images],
        question_count=payload.question_count,
        difficulty=difficulty,
        question_type=question_type,
        exam_id=payload.exam_id,
        score_per_question=payload.score_per_question,
        start_sequence=payload.start_sequence,
        source_label="a PDF document",
    )
    preview = _preview_text(extracted_text) if extracted_text else f"Visual question generation from {file_path.name}"
    return QuestionGenerationResponse(
        exam_id=payload.exam_id,
        source_type="pdf_visual",
        difficulty=difficulty,
        question_type=question_type,
        model_used=_get_vision_model(),
        content_preview=preview,
        warnings=warnings,
        questions=questions,
    )


def _generate_from_image(
    file_path: Path,
    payload: QuestionGenerationRequest,
    difficulty: str,
    question_type: str,
    warnings: list[str],
) -> QuestionGenerationResponse:
    ocr = OCRModule()
    try:
        extracted_text = ocr.extract_text(str(file_path)).strip()
    except Exception as exc:  # pragma: no cover - depends on local OCR setup
        raise QuestionGeneratorError(f"Could not extract text from image: {exc}") from exc

    if len(_cleanup_for_measurement(extracted_text)) >= MIN_IMAGE_OCR_CHARS:
        prepared_text = _prepare_source_text(extracted_text)
        questions = _generate_questions_from_text(
            prepared_text=prepared_text,
            question_count=payload.question_count,
            difficulty=difficulty,
            question_type=question_type,
            exam_id=payload.exam_id,
            score_per_question=payload.score_per_question,
            start_sequence=payload.start_sequence,
        )
        return QuestionGenerationResponse(
            exam_id=payload.exam_id,
            source_type="image_ocr_text",
            difficulty=difficulty,
            question_type=question_type,
            model_used=_get_text_model(),
            content_preview=_preview_text(prepared_text),
            warnings=warnings,
            questions=questions,
        )

    warnings.append("OCR text from image was not enough, so visual analysis was used.")
    image = Image.open(file_path)
    questions = _generate_questions_from_visual_inputs(
        image_payloads=[_image_to_data_url(image)],
        question_count=payload.question_count,
        difficulty=difficulty,
        question_type=question_type,
        exam_id=payload.exam_id,
        score_per_question=payload.score_per_question,
        start_sequence=payload.start_sequence,
        source_label="an image",
    )
    preview = _preview_text(extracted_text) if extracted_text else f"Visual question generation from {file_path.name}"
    return QuestionGenerationResponse(
        exam_id=payload.exam_id,
        source_type="image_visual",
        difficulty=difficulty,
        question_type=question_type,
        model_used=_get_vision_model(),
        content_preview=preview,
        warnings=warnings,
        questions=questions,
    )


def _generate_from_video(
    file_path: Path,
    payload: QuestionGenerationRequest,
    difficulty: str,
    question_type: str,
    warnings: list[str],
) -> QuestionGenerationResponse:
    frames = _sample_video_frames(file_path, frame_count=3)
    if not frames:
        raise QuestionGeneratorError("Could not read usable frames from the video.")

    ocr = OCRModule()
    frame_texts: list[str] = []
    for frame in frames:
        try:
            frame_texts.append(ocr.extract_text_from_image_array(frame).strip())
        except Exception:
            continue

    combined_text = "\n".join(text for text in frame_texts if text)
    if len(_cleanup_for_measurement(combined_text)) >= MIN_VIDEO_OCR_CHARS:
        warnings.append("Questions were generated from OCR text found in sampled video frames.")
        prepared_text = _prepare_source_text(combined_text)
        questions = _generate_questions_from_text(
            prepared_text=prepared_text,
            question_count=payload.question_count,
            difficulty=difficulty,
            question_type=question_type,
            exam_id=payload.exam_id,
            score_per_question=payload.score_per_question,
            start_sequence=payload.start_sequence,
        )
        return QuestionGenerationResponse(
            exam_id=payload.exam_id,
            source_type="video_frame_ocr_text",
            difficulty=difficulty,
            question_type=question_type,
            model_used=_get_text_model(),
            content_preview=_preview_text(prepared_text),
            warnings=warnings,
            questions=questions,
        )

    warnings.append("Video support is best-effort and uses sampled frames for visual analysis.")
    images = [Image.fromarray(frame) for frame in frames]
    questions = _generate_questions_from_visual_inputs(
        image_payloads=[_image_to_data_url(image) for image in images],
        question_count=payload.question_count,
        difficulty=difficulty,
        question_type=question_type,
        exam_id=payload.exam_id,
        score_per_question=payload.score_per_question,
        start_sequence=payload.start_sequence,
        source_label="sampled frames from a video",
    )
    preview = _preview_text(combined_text) if combined_text else f"Visual question generation from {file_path.name}"
    return QuestionGenerationResponse(
        exam_id=payload.exam_id,
        source_type="video_visual",
        difficulty=difficulty,
        question_type=question_type,
        model_used=_get_vision_model(),
        content_preview=preview,
        warnings=warnings,
        questions=questions,
    )


def _generate_questions_from_text(
    prepared_text: str,
    question_count: int,
    difficulty: str,
    question_type: str,
    exam_id: Optional[int],
    score_per_question: int,
    start_sequence: int,
) -> list[GeneratedQuestion]:
    system_prompt = (
        "You are an assessment designer. Create accurate Vietnamese quiz questions from the provided study material. "
        "Return valid JSON only."
    )
    user_prompt = (
        f"Create {question_count} {question_type} questions in Vietnamese.\n"
        f"Difficulty: {difficulty}.\n"
        "Use only the provided material. Avoid asking outside knowledge.\n"
        "Make each distractor plausible and avoid duplicate options.\n"
        f"Material:\n{prepared_text}"
    )

    raw_payload = _request_structured_completion(
        model=_get_text_model(),
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        schema=_build_question_schema(question_type),
        fallback_prompt=user_prompt,
    )
    return _coerce_questions(
        raw_payload=raw_payload,
        question_count=question_count,
        question_type=question_type,
        exam_id=exam_id,
        score_per_question=score_per_question,
        start_sequence=start_sequence,
    )


def _generate_questions_from_visual_inputs(
    image_payloads: list[str],
    question_count: int,
    difficulty: str,
    question_type: str,
    exam_id: Optional[int],
    score_per_question: int,
    start_sequence: int,
    source_label: str,
) -> list[GeneratedQuestion]:
    system_prompt = (
        "You are an assessment designer. Analyze the provided visual material and create Vietnamese quiz questions. "
        "Return valid JSON only."
    )
    content_blocks: list[dict[str, Any]] = [
        {
            "type": "text",
            "text": (
                f"Create {question_count} {question_type} questions in Vietnamese.\n"
                f"Difficulty: {difficulty}.\n"
                f"Source: {source_label}.\n"
                "Use only details that are clearly visible or inferable from the visual content.\n"
                "Make the questions specific, accurate, and suitable for study."
            ),
        }
    ]
    content_blocks.extend(
        {"type": "image_url", "image_url": {"url": image_payload}}
        for image_payload in image_payloads
    )

    raw_payload = _request_structured_completion(
        model=_get_vision_model(),
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": content_blocks},
        ],
        schema=_build_question_schema(question_type),
        fallback_prompt=(
            f"Create {question_count} {question_type} questions in Vietnamese from the provided visual material. "
            f"Difficulty: {difficulty}. Return JSON only."
        ),
    )
    return _coerce_questions(
        raw_payload=raw_payload,
        question_count=question_count,
        question_type=question_type,
        exam_id=exam_id,
        score_per_question=score_per_question,
        start_sequence=start_sequence,
    )


def _request_structured_completion(
    model: str,
    messages: list[dict[str, Any]],
    schema: dict[str, Any],
    fallback_prompt: str,
) -> dict[str, Any]:
    try:
        content = _call_hf_chat_completion(
            model=model,
            messages=messages,
            response_format={
                "type": "json_schema",
                "json_schema": {
                    "name": "GeneratedQuestions",
                    "schema": schema,
                    "strict": True,
                },
            },
        )
        return _parse_json_payload(content)
    except QuestionGeneratorError:
        fallback_messages = _build_fallback_messages(
            messages=messages,
            schema=schema,
            fallback_prompt=fallback_prompt,
        )
        content = _call_hf_chat_completion(
            model=model,
            messages=fallback_messages,
            response_format=None,
        )
        return _parse_json_payload(content)


def _call_hf_chat_completion(
    model: str,
    messages: list[dict[str, Any]],
    response_format: Optional[dict[str, Any]],
) -> str:
    hf_token = _get_hf_token()
    payload: dict[str, Any] = {
        "model": model,
        "messages": messages,
        "max_tokens": 1800,
        "temperature": 0.3,
    }
    if response_format is not None:
        payload["response_format"] = response_format

    request = urllib_request.Request(
        HF_CHAT_COMPLETIONS_URL,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {hf_token}",
            "Content-Type": "application/json",
        },
        method="POST",
    )

    try:
        with urllib_request.urlopen(request, timeout=120) as response:
            response_data = json.loads(response.read().decode("utf-8"))
    except urllib_error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="ignore")
        raise QuestionGeneratorError(
            f"Hugging Face API request failed with status {exc.code}: {body}"
        ) from exc
    except urllib_error.URLError as exc:
        raise QuestionGeneratorError(f"Could not connect to Hugging Face API: {exc}") from exc

    try:
        return response_data["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError) as exc:
        raise QuestionGeneratorError("Hugging Face API returned an unexpected response.") from exc


def _coerce_questions(
    raw_payload: dict[str, Any],
    question_count: int,
    question_type: str,
    exam_id: Optional[int],
    score_per_question: int,
    start_sequence: int,
) -> list[GeneratedQuestion]:
    raw_questions = raw_payload.get("questions")
    if not isinstance(raw_questions, list) or not raw_questions:
        raise QuestionGeneratorError("Model response did not contain any questions.")

    questions: list[GeneratedQuestion] = []
    for index, raw_question in enumerate(raw_questions[:question_count], start=0):
        if not isinstance(raw_question, dict):
            continue
        content = str(raw_question.get("content", "")).strip()
        if not content:
            continue

        options = _coerce_options(raw_question.get("options"), question_type)
        answer = _resolve_answer(
            raw_question=raw_question,
            options=options,
            question_type=question_type,
        )
        if not answer:
            continue

        questions.append(
            GeneratedQuestion(
                exam_id=exam_id,
                content=content,
                question_type=question_type,
                sequence=start_sequence + index,
                score=score_per_question,
                answer=answer,
                options=options,
            )
        )

    if not questions:
        raise QuestionGeneratorError("Could not normalize any generated question from the model response.")

    return questions


def _coerce_options(raw_options: Any, question_type: str) -> list[GeneratedOption]:
    if question_type == "true_false":
        normalized = _normalize_option_items(raw_options)
        if len(normalized) >= 2:
            return normalized[:2]
        return [
            GeneratedOption(content="Dung", is_correct=False),
            GeneratedOption(content="Sai", is_correct=False),
        ]

    normalized = _normalize_option_items(raw_options)
    unique_by_text: dict[str, GeneratedOption] = {}
    for option in normalized:
        key = option.content.strip().lower()
        if key and key not in unique_by_text:
            unique_by_text[key] = option
    return list(unique_by_text.values())[:4]


def _normalize_option_items(raw_options: Any) -> list[GeneratedOption]:
    if not isinstance(raw_options, list):
        return []

    normalized: list[GeneratedOption] = []
    for item in raw_options:
        if isinstance(item, dict):
            content = str(item.get("content", "")).strip()
            is_correct = bool(item.get("is_correct", False))
        else:
            content = str(item).strip()
            is_correct = False
        if content:
            normalized.append(GeneratedOption(content=content, is_correct=is_correct))
    return normalized


def _resolve_answer(
    raw_question: dict[str, Any],
    options: list[GeneratedOption],
    question_type: str,
) -> str:
    answer = str(raw_question.get("answer", "")).strip()
    if question_type == "true_false" and answer:
        lowered = answer.lower()
        if lowered in {"true", "dung", "đúng", "yes"} and options:
            options[0].is_correct = True
            for option in options[1:]:
                option.is_correct = False
            return options[0].content
        if lowered in {"false", "sai", "no"} and len(options) >= 2:
            options[0].is_correct = False
            options[1].is_correct = True
            return options[1].content

    if answer:
        for option in options:
            option.is_correct = option.content.strip().lower() == answer.strip().lower() or option.is_correct
        return answer

    correct_option = next((option for option in options if option.is_correct), None)
    if correct_option:
        return correct_option.content

    return ""


def _build_question_schema(question_type: str) -> dict[str, Any]:
    min_options = 2 if question_type == "true_false" else 4
    max_options = 2 if question_type == "true_false" else 4
    return {
        "type": "object",
        "properties": {
            "questions": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "content": {"type": "string"},
                        "answer": {"type": "string"},
                        "options": {
                            "type": "array",
                            "minItems": min_options,
                            "maxItems": max_options,
                            "items": {
                                "type": "object",
                                "properties": {
                                    "content": {"type": "string"},
                                    "is_correct": {"type": "boolean"},
                                },
                                "required": ["content", "is_correct"],
                                "additionalProperties": False,
                            },
                        },
                    },
                    "required": ["content", "answer", "options"],
                    "additionalProperties": False,
                },
            }
        },
        "required": ["questions"],
        "additionalProperties": False,
    }


def _parse_json_payload(content: str) -> dict[str, Any]:
    candidate = _extract_json_block(content)
    try:
        payload = json.loads(candidate)
    except json.JSONDecodeError as exc:
        raise QuestionGeneratorError("Model output was not valid JSON.") from exc

    if not isinstance(payload, dict):
        raise QuestionGeneratorError("Model output JSON must be an object.")
    return payload


def _extract_json_block(content: str) -> str:
    stripped = content.strip()
    fenced_match = re.search(r"```json\s*(\{.*\})\s*```", stripped, flags=re.DOTALL | re.IGNORECASE)
    if fenced_match:
        return fenced_match.group(1)

    start = stripped.find("{")
    end = stripped.rfind("}")
    if start == -1 or end == -1 or end <= start:
        raise QuestionGeneratorError("Could not find a JSON object in the model response.")
    return stripped[start : end + 1]


def _build_fallback_messages(
    messages: list[dict[str, Any]],
    schema: dict[str, Any],
    fallback_prompt: str,
) -> list[dict[str, Any]]:
    schema_text = (
        "Return JSON only. Do not include markdown fences, explanations, or extra text.\n"
        f"JSON schema:\n{json.dumps(schema)}"
    )
    fallback_messages: list[dict[str, Any]] = []

    for index, message in enumerate(messages):
        content = message.get("content")
        if index == 0 and message.get("role") == "system" and isinstance(content, str):
            fallback_messages.append(
                {
                    "role": "system",
                    "content": f"{content}\n{schema_text}",
                }
            )
            continue

        if message.get("role") == "user":
            if isinstance(content, str):
                fallback_messages.append(
                    {
                        "role": "user",
                        "content": f"{fallback_prompt}\n{schema_text}",
                    }
                )
                continue

            if isinstance(content, list):
                fallback_messages.append(
                    {
                        "role": "user",
                        "content": [{"type": "text", "text": f"{fallback_prompt}\n{schema_text}"}, *content[1:]],
                    }
                )
                continue

        fallback_messages.append(message)

    if not fallback_messages:
        return [
            {"role": "system", "content": schema_text},
            {"role": "user", "content": fallback_prompt},
        ]

    return fallback_messages


def _resolve_uploaded_filename(filename: Optional[str], content_type: Optional[str]) -> str:
    original_name = (filename or "").strip()
    if original_name:
        cleaned_name = Path(original_name).name
        if Path(cleaned_name).suffix:
            return cleaned_name

    extension = _infer_extension_from_content_type(content_type)
    if extension:
        return f"uploaded_source{extension}"

    raise QuestionGeneratorError("Uploaded file must include a supported filename or content type.")


def _infer_extension_from_content_type(content_type: Optional[str]) -> str:
    mapping = {
        "text/plain": ".txt",
        "text/markdown": ".md",
        "application/pdf": ".pdf",
        "image/png": ".png",
        "image/jpeg": ".jpg",
        "image/webp": ".webp",
        "image/bmp": ".bmp",
        "video/mp4": ".mp4",
        "video/webm": ".webm",
        "video/ogg": ".ogg",
        "video/quicktime": ".mov",
    }
    return mapping.get((content_type or "").strip().lower(), "")


def _write_uploaded_temp_file(filename: str, file_bytes: bytes) -> Path:
    TEMP_SOURCE_DIR.mkdir(parents=True, exist_ok=True)
    target_path = TEMP_SOURCE_DIR / f"{uuid4().hex}_{Path(filename).name}"
    target_path.write_bytes(file_bytes)
    return target_path.resolve()


def _cleanup_temp_file(file_path: Path) -> None:
    try:
        if file_path.exists():
            file_path.unlink()
    except OSError:
        pass


def _decode_uploaded_text_file(file_bytes: bytes) -> str:
    for encoding in ("utf-8", "utf-8-sig", "cp1258"):
        try:
            return file_bytes.decode(encoding)
        except UnicodeDecodeError:
            continue
    return file_bytes.decode("utf-8", errors="ignore")


def _read_text_file(file_path: Path) -> str:
    return _decode_uploaded_text_file(file_path.read_bytes())


def _resolve_input_file(file_url: str) -> Path:
    candidate = file_url.strip()
    if not candidate:
        raise QuestionGeneratorError("file_url must not be empty.")

    if candidate.startswith("/uploads/"):
        path = (UPLOAD_DIR / candidate.split("/uploads/", 1)[1]).resolve()
    else:
        path = Path(candidate).expanduser().resolve()

    if not path.exists():
        raise QuestionGeneratorError(f"Input file does not exist: {file_url}")

    if not _is_path_inside_workspace(path):
        raise QuestionGeneratorError("Input file must be inside the current workspace.")

    return path


def _is_path_inside_workspace(path: Path) -> bool:
    try:
        path.relative_to(BASE_DIR)
        return True
    except ValueError:
        return False


def _prepare_source_text(text: str) -> str:
    normalized = re.sub(r"\s+", " ", text).strip()
    if len(normalized) <= MAX_SOURCE_TEXT_CHARS:
        return normalized

    head_size = MAX_SOURCE_TEXT_CHARS // 2
    tail_size = MAX_SOURCE_TEXT_CHARS - head_size
    return f"{normalized[:head_size]}\n...\n{normalized[-tail_size:]}"


def _preview_text(text: str, max_chars: int = 280) -> str:
    cleaned = re.sub(r"\s+", " ", text).strip()
    if not cleaned:
        return ""
    if len(cleaned) <= max_chars:
        return cleaned
    return f"{cleaned[: max_chars - 3]}..."


def _cleanup_for_measurement(text: str) -> str:
    return re.sub(r"\s+", "", text)


def _render_pdf_pages(file_path: Path, max_pages: int) -> list[Image.Image]:
    try:
        return pdf2image.convert_from_path(str(file_path), first_page=1, last_page=max_pages)
    except Exception as exc:  # pragma: no cover - depends on local PDF/image tooling
        raise QuestionGeneratorError(f"Could not render PDF pages for visual analysis: {exc}") from exc


def _sample_video_frames(file_path: Path, frame_count: int) -> list[Any]:
    capture = cv2.VideoCapture(str(file_path))
    if not capture.isOpened():
        return []

    total_frames = int(capture.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
    if total_frames <= 0:
        capture.release()
        return []

    indices = sorted({max(0, min(total_frames - 1, int(total_frames * ratio))) for ratio in (0.15, 0.5, 0.85)})
    frames: list[Any] = []
    for index in indices[:frame_count]:
        capture.set(cv2.CAP_PROP_POS_FRAMES, index)
        success, frame = capture.read()
        if not success or frame is None:
            continue
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        frames.append(rgb_frame)

    capture.release()
    return frames


def _image_to_data_url(image: Image.Image) -> str:
    prepared = image.copy()
    prepared.thumbnail((1280, 1280))
    buffer = io.BytesIO()
    prepared.save(buffer, format="JPEG", quality=85)
    encoded = base64.b64encode(buffer.getvalue()).decode("utf-8")
    return f"data:image/jpeg;base64,{encoded}"


def _normalize_difficulty(value: str) -> str:
    normalized = re.sub(r"[\s_-]+", " ", value.strip().lower())
    mapping = {
        "co ban": "basic",
        "coban": "basic",
        "cơ bản": "basic",
        "basic": "basic",
        "trung cap": "intermediate",
        "trungcap": "intermediate",
        "trung cấp": "intermediate",
        "intermediate": "intermediate",
        "nang cao": "advanced",
        "nangcao": "advanced",
        "nâng cao": "advanced",
        "advanced": "advanced",
    }
    return mapping.get(normalized, "basic")


def _normalize_question_type(value: str) -> str:
    normalized = re.sub(r"[\s_-]+", " ", value.strip().lower())
    mapping = {
        "multiple choice": "multiple_choice",
        "multiple choice question": "multiple_choice",
        "many choices": "multiple_choice",
        "nhieu lua chon": "multiple_choice",
        "nhiều lựa chọn": "multiple_choice",
        "trac nghiem": "multiple_choice",
        "trắc nghiệm": "multiple_choice",
        "multiple_choice": "multiple_choice",
        "true false": "true_false",
        "true/false": "true_false",
        "dung sai": "true_false",
        "đúng sai": "true_false",
        "true_false": "true_false",
    }
    return mapping.get(normalized, "multiple_choice")


def _get_text_model() -> str:
    return _get_env_value("HF_TEXT_QUESTION_MODEL") or DEFAULT_TEXT_MODEL


def _get_vision_model() -> str:
    return _get_env_value("HF_VISION_QUESTION_MODEL") or DEFAULT_VISION_MODEL


def _get_hf_token() -> str:
    hf_token = _get_env_value("HF_TOKEN")
    if not hf_token:
        raise QuestionGeneratorError("HF_TOKEN was not found in the environment or .env file.")
    return hf_token


def _get_env_value(key: str) -> Optional[str]:
    direct_value = os.getenv(key)
    if direct_value:
        return direct_value.strip().strip('"').strip("'")

    env_path = BASE_DIR / ".env"
    if not env_path.exists():
        return None

    try:
        lines = env_path.read_text(encoding="utf-8").splitlines()
    except OSError:
        return None

    for line in lines:
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            continue
        name, raw_value = stripped.split("=", 1)
        if name.strip() != key:
            continue
        return raw_value.strip().strip('"').strip("'")
    return None

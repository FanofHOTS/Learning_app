from __future__ import annotations

import base64
import hashlib
import io
import json
import os
import re
import unicodedata
from pathlib import Path
from typing import Any, Optional
from uuid import uuid4

import cv2
import pdf2image
from fastapi import UploadFile
from openai import APIConnectionError, APIStatusError, APITimeoutError, OpenAI, OpenAIError
from PIL import Image
from sqlmodel import Field, SQLModel

from ai.env_utils import (
    read_env_bool,
    read_env_float,
    read_env_int,
    read_env_int_clamped,
    read_env_value,
)
from ai.image_utils import cap_longest_side, deskew_image, trim_white_margins
from ai.ocr_module import OCRModule

BASE_DIR = Path(__file__).resolve().parent.parent
UPLOAD_DIR = BASE_DIR / "uploads"
TEMP_SOURCE_DIR = UPLOAD_DIR / ".question_generation_tmp"
HF_ROUTER_BASE_URL = "https://router.huggingface.co/v1"
DEFAULT_TEXT_MODEL = "Qwen/Qwen3-8B-Instruct:preferred"
DEFAULT_VISION_MODEL = "Qwen/Qwen3-VL-8B-Instruct:preferred"
MAX_SOURCE_TEXT_CHARS = 12000
DEFAULT_SCORE_PER_QUESTION = 1
MAX_SCORE_PER_QUESTION = 100
DEFAULT_START_SEQUENCE = 1
PDF_VISUAL_MAX_PAGES = 3
VIDEO_SAMPLE_FRAME_COUNT = 3
#MIN_IMAGE_OCR_CHARS = 140
MIN_IMAGE_OCR_CHARS = 50
#MIN_PDF_OCR_CHARS = 400
MIN_PDF_OCR_CHARS = 50
#MIN_VIDEO_OCR_CHARS = 180
MIN_VIDEO_OCR_CHARS = 50
SUPPORTED_TEXT_SUFFIXES = {".txt", ".md", ".markdown"}
SUPPORTED_IMAGE_SUFFIXES = {".png", ".jpg", ".jpeg", ".webp", ".bmp"}
SUPPORTED_VIDEO_SUFFIXES = {".mp4", ".webm", ".ogg", ".mov", ".avi", ".mkv"}


MAX_QUESTION_COUNT = read_env_int(
    "AI_GENERATOR_MAX_QUESTIONS",
    read_env_int("NEXT_PUBLIC_AI_GENERATOR_MAX_QUESTIONS", 20),
)


_SELF_CRITIQUE_RAW = read_env_value("AI_GENERATOR_SELF_CRITIQUE")
if _SELF_CRITIQUE_RAW is not None:
    ENABLE_SELF_CRITIQUE = _SELF_CRITIQUE_RAW.strip().lower() in ("1", "true", "yes")
else:
    ENABLE_SELF_CRITIQUE = True

GENERATION_TEMPERATURE = read_env_float("AI_GENERATOR_TEMPERATURE", 0.7)
CRITIQUE_TEMPERATURE = read_env_float("AI_GENERATOR_CRITIQUE_TEMPERATURE", 0.1)
MAX_TOKENS = read_env_int("AI_GENERATOR_MAX_TOKENS", 4096)

# ── Visual pipeline token optimization ───────────────────────────────
# Qwen-VL tokenizes images proportionally to pixel count (≈ pixels/784,
# capped at ~1280 tokens per image). These knobs reduce the number and
# size of images sent to the vision model.
#   - max dim: cap the longest side of each image (1280 → ~1024 saves
#     roughly 20-25% tokens per page while keeping text legible).
#   - jpeg quality: smaller payload = faster upload (tokens are pixel-
#     based, but bandwidth/latency improve).
#   - trim margins: auto-crop near-white borders before encoding.
#   - skip blank pages: drop cover/blank PDF pages before sending.
#   - dedupe frames: drop near-identical video frames (static slides).
VISUAL_IMAGE_MAX_DIM = read_env_int_clamped(
    "HF_VISUAL_IMAGE_MAX_DIM", 1024, 512, 2048
)
VISUAL_IMAGE_JPEG_QUALITY = read_env_int_clamped(
    "HF_VISUAL_IMAGE_JPEG_QUALITY", 80, 50, 95
)
VISUAL_TRIM_MARGINS = read_env_bool("HF_VISUAL_TRIM_MARGINS", True)
VISUAL_SKIP_BLANK_PAGES = read_env_bool("HF_VISUAL_SKIP_BLANK_PAGES", True)
VISUAL_DEDUPE_FRAMES = read_env_bool("HF_VISUAL_DEDUPE_FRAMES", True)
VISUAL_DESKEW = read_env_bool("HF_VISUAL_DESKEW", True)


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
    bloom_level: str = "remember"
    difficulty: str = "medium"
    explanation: str = Field(default="", description="Giải thích tại sao đáp án đúng là đúng, giúp người học hiểu rõ hơn.")


class QuestionGenerationRequest(SQLModel):
    exam_id: Optional[int] = None
    content: Optional[str] = None
    file_url: Optional[str] = None
    topic: Optional[str] = None
    topic_description: Optional[str] = None
    source_mode: str = Field(default="document_only")
    question_count: int = Field(default=5, ge=1, le=MAX_QUESTION_COUNT)
    difficulty_remember: int = Field(default=34, ge=0, le=100)
    difficulty_understand: int = Field(default=33, ge=0, le=100)
    difficulty_apply: int = Field(default=33, ge=0, le=100)
    question_type: str = Field(default="multiple_choice")
    score_per_question: int = Field(
        default=DEFAULT_SCORE_PER_QUESTION,
        ge=1,
        le=MAX_SCORE_PER_QUESTION,
    )
    start_sequence: int = Field(default=DEFAULT_START_SEQUENCE, ge=1)
    persist: bool = False


class QuestionGenerationResponse(SQLModel):
    exam_id: Optional[int] = None
    source_type: str
    source_mode: str
    difficulty_remember: int
    difficulty_understand: int
    difficulty_apply: int
    question_type: str
    model_used: str
    content_preview: str
    topic: Optional[str] = None
    warnings: list[str] = Field(default_factory=list)
    questions: list[GeneratedQuestion] = Field(default_factory=list)


class QuestionGenerationRuntimeMetadata(SQLModel):
    provider_name: str = "Hugging Face Router"
    client_library: str = "openai"
    router_base_url: str = HF_ROUTER_BASE_URL
    text_model: str
    vision_model: str
    max_question_count: int
    max_source_text_chars: int
    min_pdf_ocr_chars: int
    min_image_ocr_chars: int
    min_video_ocr_chars: int
    pdf_visual_max_pages: int
    video_sample_frame_count: int
    visual_image_max_dim: int
    visual_image_jpeg_quality: int
    visual_trim_margins: bool
    visual_deskew: bool
    visual_skip_blank_pages: bool
    visual_dedupe_frames: bool
    score_per_question_default: int = DEFAULT_SCORE_PER_QUESTION
    score_per_question_max: int = MAX_SCORE_PER_QUESTION
    start_sequence_default: int = DEFAULT_START_SEQUENCE
    persist_default: bool = False
    upload_generation_available: bool = True
    supported_text_suffixes: list[str] = Field(default_factory=list)
    supported_image_suffixes: list[str] = Field(default_factory=list)
    supported_video_suffixes: list[str] = Field(default_factory=list)
    source_modes_supported: list[str] = Field(default_factory=list)


def get_question_generator_runtime_metadata() -> QuestionGenerationRuntimeMetadata:
    return QuestionGenerationRuntimeMetadata(
        text_model=_get_text_model(),
        vision_model=_get_vision_model(),
        max_question_count=MAX_QUESTION_COUNT,
        max_source_text_chars=MAX_SOURCE_TEXT_CHARS,
        min_pdf_ocr_chars=MIN_PDF_OCR_CHARS,
        min_image_ocr_chars=MIN_IMAGE_OCR_CHARS,
        min_video_ocr_chars=MIN_VIDEO_OCR_CHARS,
        pdf_visual_max_pages=PDF_VISUAL_MAX_PAGES,
        video_sample_frame_count=VIDEO_SAMPLE_FRAME_COUNT,
        visual_image_max_dim=VISUAL_IMAGE_MAX_DIM,
        visual_image_jpeg_quality=VISUAL_IMAGE_JPEG_QUALITY,
        visual_trim_margins=VISUAL_TRIM_MARGINS,
        visual_deskew=VISUAL_DESKEW,
        visual_skip_blank_pages=VISUAL_SKIP_BLANK_PAGES,
        visual_dedupe_frames=VISUAL_DEDUPE_FRAMES,
        supported_text_suffixes=sorted(SUPPORTED_TEXT_SUFFIXES),
        supported_image_suffixes=sorted(SUPPORTED_IMAGE_SUFFIXES),
        supported_video_suffixes=sorted(SUPPORTED_VIDEO_SUFFIXES),
        source_modes_supported=["topic_only", "document_only", "combined", "text", "upload", "url"],
    )


def _classify_topic_for_apply(
    topic: Optional[str],
    topic_description: Optional[str],
) -> str:
    """
    Classify a topic as 'theoretical', 'practical', or 'general'.

    'theoretical' = conceptual/system topics (e.g., web design, algorithms).
    'practical' = topics with real-life applications (e.g., digital citizenship).
    'general' = can't determine or mixed.
    """
    combined = ((topic or "") + " " + (topic_description or "")).lower()

    theoretical_keywords = [
        "thiết kế web", "lập trình", "thuật toán", "giải thuật",
        "cấu trúc dữ liệu", "kiến trúc", "ngôn ngữ lập trình",
        "cơ sở dữ liệu", "mạng máy tính", "hệ điều hành", "phần cứng",
        "framework", "backend", "frontend", "api", "microservice",
        "html", "css", "javascript", "typescript", "python",
        "database", "sql", "server", "client", "component",
        "module", "code", "compile", "deploy", "tích hợp", "triển khai",
        "mô hình", "đặc tả", "phân tích thiết kế", "yêu cầu phần mềm",
        "devops", "docker", "cloud", "unit test", "class diagram",
    ]
    practical_keywords = [
        "công dân số", "an toàn thông tin", "bảo mật", "đạo đức",
        "ứng dụng thực tế", "cuộc sống", "xã hội", "pháp luật",
        "sức khỏe", "tài chính", "giao tiếp", "kỹ năng mềm",
        "kinh doanh", "marketing", "giáo dục", "môi trường",
        "cộng đồng", "người dùng", "quyền riêng tư",
        "dữ liệu cá nhân", "an ninh mạng", "lừa đảo",
        "email", "mật khẩu", "virus", "tấn công mạng",
        "bảo vệ", "quyền", "trách nhiệm", "hành vi",
        "văn hóa", "ứng xử", "rủi ro", "cảnh báo",
        "sử dụng internet", "mạng xã hội", "thương mại điện tử",
    ]

    theoretical_score = sum(1 for kw in theoretical_keywords if kw in combined)
    practical_score = sum(1 for kw in practical_keywords if kw in combined)

    if theoretical_score > practical_score and theoretical_score >= 2:
        return "theoretical"
    if practical_score > theoretical_score and practical_score >= 2:
        return "practical"
    if theoretical_score >= 2 and practical_score >= 2:
        return "general"
    # Single keyword match or no match
    if theoretical_score > 0 and practical_score == 0:
        return "theoretical"
    if practical_score > 0 and theoretical_score == 0:
        return "practical"
    return "general"


def _build_apply_level_guidance(classification: str) -> str:
    """Build specific guidance for Vận dụng (Apply) level questions based on topic classification."""
    if classification == "theoretical":
        return (
            "  Topic type: Theoretical/technical (e.g., web design, programming, system architecture).\n"
            "  Apply-level rules:\n"
            "  - Create scenario-based questions about design decisions, code/structure analysis, or problem-solving.\n"
            "  - Example: 'Nếu cần xây dựng một website bán hàng, bạn sẽ chọn cấu trúc HTML nào cho trang chủ?'\n"
            "  - Example: 'Cho đoạn code sau, hãy xác định lỗi và đề xuất cách sửa.'\n"
            "  - Example: 'Hãy thiết kế CSDL cho hệ thống quản lý thư viện với các yêu cầu sau...'\n"
            "  - Focus on applying rules, principles, or techniques to a concrete problem.\n"
            "  - Avoid purely theoretical questions (those belong to Thông hiểu level)."
        )
    if classification == "practical":
        return (
            "  Topic type: Practical/real-life scenarios (e.g., digital citizenship, online safety).\n"
            "  Apply-level rules:\n"
            "  - Create real-life scenario questions that require students to make decisions or take actions.\n"
            "  - Example: 'Khi nhận được email lạ yêu cầu cung cấp mật khẩu, bạn nên làm gì?'\n"
            "  - Example: 'Bạn thấy một bài viết lan truyền thông tin sai lệch trên mạng xã hội. Hãy đề xuất cách xử lý phù hợp.'\n"
            "  - Example: 'Trong tình huống bị mất điện thoại có chứa dữ liệu cá nhân, bạn cần làm những gì?'\n"
            "  - Focus on applying knowledge to everyday situations, making ethical judgments, or taking protective actions.\n"
            "  - Avoid theoretical or recall questions (those belong to Nhận biết or Thông hiểu levels)."
        )
    # general or unknown — include both styles
    return (
        "  Topic type: General/mixed. Include a variety of apply-level scenarios:\n"
        "  - For technical content: design decisions, code/structure analysis, or problem-solving scenarios.\n"
        "  - For real-life content: everyday situations requiring decisions, ethical judgments, or actions.\n"
        "  - Make sure each question has a concrete scenario that requires applying the learned knowledge.\n"
        "  - Avoid purely theoretical questions (those belong to Thông hiểu level)."
    )


def _build_remember_level_guidance(classification: str) -> str:
    """Build specific validation rules for Nhận biết (Remember) level based on topic type."""
    if classification == "theoretical":
        return (
            "  Topic type: Theoretical/technical (e.g., programming, databases, algorithms).\n"
            "  Remember-level validation rules:\n"
            "  - Only ask about terminology, definitions, syntax, component names, or basic facts.\n"
            "  - Example: 'Thẻ HTML nào dùng để tạo liên kết?', 'Hàm print() trong Python dùng để làm gì?'\n"
            "  - Example: 'Giao thức nào được dùng để truyền tải trang web?'\n"
            "  - The question must have exactly ONE correct answer clearly stated in the material.\n"
            "  - Do NOT ask about relationships, comparisons, or cause-effect (that belongs to Thông hiểu).\n"
            "  - Do NOT ask students to apply knowledge to new situations (that belongs to Vận dụng)."
        )
    if classification == "practical":
        return (
            "  Topic type: Practical/real-life (e.g., digital citizenship, online safety).\n"
            "  Remember-level validation rules:\n"
            "  - Ask about rules, guidelines, definitions, key concepts, or correct/incorrect behaviors.\n"
            "  - Example: 'Mật khẩu mạnh cần có những yếu tố nào?', 'Đâu là dấu hiệu của email lừa đảo?'\n"
            "  - Example: 'Theo quy định, độ tuổi tối thiểu để sử dụng mạng xã hội là bao nhiêu?'\n"
            "  - The answer must be directly stated in the material as a clear fact or rule.\n"
            "  - Do NOT ask students to evaluate or judge situations (that belongs to Vận dụng).\n"
            "  - Do NOT ask 'tại sao' or 'giải thích' questions (that belongs to Thông hiểu)."
        )
    # general
    return (
        "  Topic type: General/mixed.\n"
        "  Remember-level validation rules:\n"
        "  - For technical content: ask about terminology, definitions, syntax, or basic facts.\n"
        "  - For practical content: ask about rules, guidelines, or key concepts.\n"
        "  - The answer must be directly stated in the material.\n"
        "  - Do NOT ask for explanations, comparisons, or analysis."
    )


def _build_understand_level_guidance(classification: str) -> str:
    """Build specific validation rules for Thông hiểu (Understand) level based on topic type."""
    if classification == "theoretical":
        return (
            "  Topic type: Theoretical/technical (e.g., programming, databases, algorithms).\n"
            "  Understand-level validation rules:\n"
            "  - Ask students to explain relationships, compare pros/cons, analyze causes, or summarize processes.\n"
            "  - Example: 'Tại sao nên phân biệt thẻ block và thẻ inline trong HTML?'\n"
            "  - Example: 'So sánh ưu nhược điểm của biến local và global.'\n"
            "  - Example: 'Hãy giải thích quy trình xử lý một request HTTP từ client đến server.'\n"
            "  - Students must combine multiple pieces of information to form an explanation.\n"
            "  - The correct answer should demonstrate understanding, not just recall.\n"
            "  - Do NOT ask students to create something new or solve a novel problem (that belongs to Vận dụng)."
        )
    if classification == "practical":
        return (
            "  Topic type: Practical/real-life (e.g., digital citizenship, online safety).\n"
            "  Understand-level validation rules:\n"
            "  - Ask students to explain consequences, justify rules, distinguish between concepts, or analyze situations.\n"
            "  - Example: 'Tại sao không nên dùng chung mật khẩu cho nhiều tài khoản?'\n"
            "  - Example: 'Hậu quả của việc chia sẻ quá nhiều thông tin cá nhân trên mạng xã hội là gì?'\n"
            "  - Example: 'Điểm khác nhau giữa bắt nạt trực tuyến và bất đồng quan điểm thông thường là gì?.'\n"
            "  - Students must show they understand the reasoning behind rules and guidelines.\n"
            "  - Do NOT ask what the student would DO in a situation (that belongs to Vận dụng).\n"
            "  - Do NOT ask basic recall questions (that belongs to Nhận biết)."
        )
    # general
    return (
        "  Topic type: General/mixed.\n"
        "  Understand-level validation rules:\n"
        "  - For technical content: ask about relationships, comparisons, or cause-effect.\n"
        "  - For practical content: explain consequences, justify rules, or analyze situations.\n"
        "  - Students must show understanding, not just recall.\n"
        "  - The answer may require combining multiple pieces of information."
    )


def _build_true_false_rules() -> str:
    """Build specific rules for True/False (Đúng/Sai) questions.

    These rules are appended to prompts only when the requested question
    type is true_false, and are enforced again in code by
    `_validate_generated_questions`.
    """
    return (
        "\n"
        "=== TRUE/FALSE QUESTIONS (Đúng/Sai) — ADDITIONAL RULES ===\n"
        "Apply these rules to EVERY true/false question in addition to all rules above:\n"
        "\n"
        "1. OPTIONS FORMAT:\n"
        "   - Each true/false question has EXACTLY 2 options: 'Đúng' (True) and 'Sai' (False).\n"
        "   - Never rewrite the options (e.g. 'Đúng, vì...', 'Sai, vì...', 'Có', 'Không').\n"
        "   - The 'answer' field must be exactly 'Đúng' or 'Sai', matching the correct option.\n"
        "\n"
        "2. STEM FORMAT:\n"
        "   - The stem must be a complete DECLARATIVE STATEMENT that is clearly either true or false.\n"
        "   - Do NOT write the stem as a question ending in '?' (e.g. '...có phải không?',\n"
        "     '...đúng hay sai?'). The student must judge the statement itself.\n"
        "   - The statement must be determinate: clearly TRUE or clearly FALSE in the context\n"
        "     of the material — never a matter of opinion, judgment, or interpretation.\n"
        "   - Test only ONE claim per statement. Do not join several claims with 'và' —\n"
        "     a partly-true statement is a flawed question.\n"
        "\n"
        "3. NO GIVEAWAY QUALIFIERS:\n"
        "   - Do NOT use absolute words ('luôn luôn', 'không bao giờ', 'tất cả', 'mọi', 'chỉ',\n"
        "     'duy nhất') — statements with absolutes are almost always FALSE and this reveals\n"
        "     the answer. Only use an absolute if the source material itself states it.\n"
        "   - Do NOT use hedge words ('thường', 'đôi khi', 'có thể', 'một số', 'nhìn chung',\n"
        "     'phần lớn') to make a claim trivially TRUE — hedges give the answer away.\n"
        "\n"
        "4. NO NEGATIVES:\n"
        "   - Avoid 'không', 'không phải', and double negatives in the stem — they test\n"
        "     reading comprehension rather than the subject matter.\n"
        "   - Prefer positive statements whenever possible.\n"
        "\n"
        "5. BALANCED TRUE/FALSE MIX:\n"
        "   - Across the whole set, balance the correct answers: roughly half 'Đúng' and half 'Sai'.\n"
        "   - Randomize the correct position — do not always mark the first option ('Đúng') as correct.\n"
        "\n"
        "6. COGNITIVE LEVEL:\n"
        "   - remember: restate a fact, definition, or term exactly as it appears in the material.\n"
        "   - understand: paraphrase or restate a concept in different words; the student must\n"
        "     verify whether the claim is correct.\n"
        "   - apply: present a concrete scenario and state what would happen; the student judges\n"
        "     whether the claim is correct.\n"
        "\n"
        "7. QUALITY BAR:\n"
        "   - Statements that are obviously true or obviously false are poor questions.\n"
        "   - Aim for claims a careless reader could misjudge but a prepared student gets right.\n"
        "   - Apply the same language rules as other types: Vietnamese, precise academic wording,\n"
        "     exact terminology from the material, no spelling or grammar errors.\n"
    )


def _build_multiple_choice_rules() -> str:
    """Build specific rules for multiple-choice (trắc nghiệm) questions.

    These rules are appended to prompts only when the requested question
    type is multiple_choice, and are enforced again in code by
    `_validate_generated_questions`.
    """
    return (
        "\n"
        "=== MULTIPLE-CHOICE QUESTIONS (Trắc nghiệm) — ADDITIONAL RULES ===\n"
        "Apply these rules to EVERY multiple-choice question in addition to all rules above:\n"
        "\n"
        "1. OPTIONS FORMAT:\n"
        "   - Each multiple-choice question has EXACTLY 4 options (A, B, C, D).\n"
        "   - Only ONE option is correct; the other three are distractors.\n"
        "   - The 'answer' field must equal the content of the correct option.\n"
        "\n"
        "2. STEM FORMAT:\n"
        "   - The stem must be a complete question ending in '?' (or a directive\n"
        "     starting with 'Hãy', 'Cho biết', 'Xác định').\n"
        "   - The question must be answerable WITHOUT reading the options.\n"
        "   - Test only ONE knowledge point — do not combine two independent ideas\n"
        "     with 'và' into a single stem.\n"
        "   - Use precise wording; avoid vague phrases like 'một số', 'nhiều cách'.\n"
        "\n"
        "3. DISTRACTOR QUALITY:\n"
        "   - Every distractor must be PLAUSIBLE and realistic — a common student\n"
        "     mistake or misconception, never obviously wrong.\n"
        "   - Distractors must match the correct answer in length, grammatical\n"
        "     structure, and level of technical detail.\n"
        "   - Distractors must be mutually exclusive — they must not overlap or\n"
        "     imply each other.\n"
        "   - Do NOT use 'Tất cả đáp án trên' (All of the above) or\n"
        "     'Không có đáp án nào đúng' (None of the above).\n"
        "\n"
        "4. NO CUEING (CRITICAL):\n"
        "   - The correct option must NOT stand out: same length, same wording\n"
        "     style, same technical level as the distractors.\n"
        "   - Do NOT put absolute words ('luôn luôn', 'không bao giờ', 'chắc chắn',\n"
        "     'duy nhất') only in the correct option — absolutes usually signal a\n"
        "     wrong option to students.\n"
        "   - Do NOT put hedge words ('có thể là', 'thường được coi là') only in the\n"
        "     correct option to make it safely true.\n"
        "   - Keep qualifiers consistent across all four options.\n"
        "   - The correct answer position must be RANDOM (A/B/C/D) — not always A or D.\n"
        "\n"
        "5. COGNITIVE LEVEL:\n"
        "   - remember: recall a fact, term, or definition; options are concrete\n"
        "     names or values.\n"
        "   - understand: ask for explanation, comparison, or interpretation.\n"
        "   - apply: present a concrete scenario; the student chooses what to do.\n"
        "\n"
        "6. QUALITY BAR:\n"
        "   - The correct answer must be unambiguously correct; every distractor\n"
        "     unambiguously wrong.\n"
        "   - All options in Vietnamese, precise academic wording, exact terminology\n"
        "     from the material, no spelling or grammar errors.\n"
    )


def _build_general_validation_rules(question_type: str = "multiple_choice") -> str:
    """Build general validation rules that apply to the entire question set.
    Covers both question content (stem) and options/answers.
    The question-type-specific rules (Đúng/Sai or trắc nghiệm) are appended.
    """
    rules = (
        "\n=== General Validation Rules for the Question Set ===\n"
        "Apply these rules to ALL questions regardless of cognitive level:\n"
        "\n"
        "--- PART A: Question Content (the question stem itself) ---\n"
        "\n"
        "1. Cognitive alignment:\n"
        "   - Each question must match its assigned cognitive level.\n"
        "   - A 'Nhận biết' question must ONLY require recall; do NOT sneak in explanation or application.\n"
        "   - A 'Thông hiểu' question must require understanding, not mere recall.\n"
        "   - A 'Vận dụng' question must present a concrete scenario to apply knowledge.\n"
        "\n"
        "2. Single knowledge point:\n"
        "   - Each question should test ONLY ONE concept or skill, not multiple things at once.\n"
        "   - Do NOT combine two independent questions into one stem (e.g., 'A là gì và B khác A thế nào?').\n"
        "\n"
        "3. Clear question stem:\n"
        "   - The question must be answerable WITHOUT reading the options first.\n"
        "   - The stem must contain a complete, well-formed question or directive.\n"
        "   - For direct recall: start with 'là gì', 'ai là', 'khi nào', 'hãy kể tên', 'định nghĩa'.\n"
        "   - For identification: patterns like 'Cái nào sau đây...' or 'Điều nào sau đây...' are acceptable.\n"
        "   - Do NOT use incomplete stems that only make sense when combined with options.\n"
        "   - The stem alone must already define what is being asked.\n"
        "\n"
        "4. Specificity and precision:\n"
        "   - Be specific: avoid vague phrases like 'một số', 'nhiều cách', 'có thể'.\n"
        "   - If asking about a quantity, number, or measurement, be exact.\n"
        "   - If referencing a concept, use its exact term from the material.\n"
        "\n"
        "5. No misleading or trick wording:\n"
        "   - Do NOT use double negatives or unnecessarily complex phrasing in the stem.\n"
        "   - Do NOT include extraneous information that distracts from what is being tested.\n"
        "   - The stem should not contain clues (hints) that give away the correct answer.\n"
        "\n"
        "6. Independence:\n"
        "   - Each question must be self-contained and NOT depend on other questions.\n"
        "   - Do NOT reference previous questions or assume a specific answering order.\n"
        "\n"
        "7. No duplication across questions:\n"
        "   - No two questions should test the exact same knowledge point.\n"
        "   - The stems of different questions should not be nearly identical.\n"
        "\n"
        "8. Material boundary:\n"
        "   - Use ONLY the provided material to create questions.\n"
        "   - Do NOT ask about external knowledge or require assumptions beyond the material.\n"
        "   - Every fact or concept referenced in the stem must appear in the material.\n"
        "\n"
        "9. Language quality:\n"
        "   - ALL questions, options, and answers must be in Vietnamese.\n"
        "   - Use clear, standard academic Vietnamese. Avoid slang or overly casual language.\n"
        "   - Check grammar and spelling in the stem: no typos or incorrect word order.\n"
        "\n"
        "--- PART B: Options and Answers ---\n"
        "\n"
        "10. ONE correct answer:\n"
        "    - Each question must have exactly ONE unambiguously correct answer.\n"
        "    - Avoid vague wording, double negatives, or trick phrasing in options.\n"
        "\n"
        "11. Distractor quality:\n"
        "    - All distractors (wrong options) must be plausible and realistic.\n"
        "    - Avoid distractors that are obviously wrong (too absurd, too similar to correct answer).\n"
        "    - Each distractor should represent a common misunderstanding if possible.\n"
        "\n"
        "12. Answer positioning:\n"
        "    - The correct answer must appear in a random position among options.\n"
        "    - Do NOT always put the correct answer as option A or the last option.\n"
        "\n"
        "13. Prohibited option patterns:\n"
        "    - Do NOT use 'Tất cả đáp án trên' (All of the above) as an option.\n"
        "    - Do NOT use 'Không có đáp án nào đúng' (None of the above) as an option.\n"
        "    - Do NOT ask questions that test reading comprehension of the question itself.\n"
        "\n"
        "14. Option independence:\n"
        "    - Options should be mutually exclusive and not overlap in meaning.\n"
        "    - No option should contain or imply another option."
    )
    if question_type == "true_false":
        rules += _build_true_false_rules()
    elif question_type == "multiple_choice":
        rules += _build_multiple_choice_rules()
    return rules


def _build_cognitive_level_prompt(
    remember: int,
    understand: int,
    apply: int,
    topic: Optional[str] = None,
    topic_description: Optional[str] = None,
    question_type: str = "multiple_choice",
) -> str:
    """Build cognitive level distribution with detailed criteria for each level."""
    total = remember + understand + apply
    if total <= 0:
        return ""
    # Normalize to 100%
    r = round(remember / total * 100)
    u = round(understand / total * 100)
    a = 100 - r - u
    classification = _classify_topic_for_apply(topic, topic_description)

    parts: list[str] = ["Cognitive level distribution with specific criteria:"]

    if r > 0:
        remember_guidance = _build_remember_level_guidance(classification)
        parts.append(
            f"\n--- {r}% Nhận biết (Remember) ---\n"
            f"Goal: Student recalls facts, terminology, definitions, and basic concepts from the material.\n"
            f"Question patterns:\n"
            f"- Direct recall: start with 'là gì', 'ai là', 'khi nào', 'hãy kể tên', 'định nghĩa'\n"
            f"- Identification: 'cái nào sau đây là đúng về...', 'đâu là ví dụ của...'\n"
            f"- Listing: 'hãy liệt kê các bước...', 'những thành phần nào tạo nên...'\n"
            f"Basic rules:\n"
            f"- Do NOT ask for explanations, comparisons, or analysis.\n"
            f"- The answer must be directly stated in the material.\n"
            f"- Avoid trick questions or subtle distinctions.\n"
            f"{remember_guidance}"
        )

    if u > 0:
        understand_guidance = _build_understand_level_guidance(classification)
        parts.append(
            f"\n--- {u}% Thông hiểu (Understand) ---\n"
            f"Goal: Student explains, interprets, compares, or summarizes concepts in their own words.\n"
            f"Question patterns:\n"
            f"- Explanation: 'hãy giải thích tại sao...', 'ý nghĩa của... là gì'\n"
            f"- Comparison: 'sự khác biệt giữa A và B là gì', 'so sánh ưu nhược điểm của...'\n"
            f"- Summary: 'hãy tóm tắt quy trình...', 'trình bày ngắn gọn về...'\n"
            f"- Cause-effect: 'tại sao... lại dẫn đến...', 'hậu quả của việc... là gì'\n"
            f"Basic rules:\n"
            f"- Students must show understanding of relationships, not just recall isolated facts.\n"
            f"- The answer may require combining multiple pieces of information from the material.\n"
            f"- Avoid asking students to create something new (that belongs to Vận dụng level).\n"
            f"{understand_guidance}"
        )

    if a > 0:
        apply_guidance = _build_apply_level_guidance(classification)
        parts.append(
            f"\n--- {a}% Vận dụng (Apply) ---\n"
            f"Goal: Student applies knowledge to a new, concrete situation or problem.\n"
            f"Question patterns:\n"
            f"- Scenario-based: provide a brief context, then ask the student what to do\n"
            f"- Problem-solving: give a specific problem that requires applying learned concepts\n"
            f"- Case study: describe a realistic case and ask for analysis or decision\n"
            f"{apply_guidance}"
        )

    parts.append(_build_general_validation_rules(question_type))
    return "\n".join(parts).strip()


def _build_topic_context(payload: QuestionGenerationRequest) -> str:
    """Build formatted topic context string from payload."""
    if not payload.topic:
        return ""
    ctx = f"Topic: {payload.topic.strip()}"
    if payload.topic_description:
        ctx += f"\nTopic context: {payload.topic_description.strip()}"
    return ctx


def _prepend_topic_to_text(text: str, topic_context: str, warnings: list[str]) -> str:
    """Prepend topic context to text and add a warning."""
    if topic_context:
        warnings.append("Topic context included alongside document content.")
        return f"{topic_context}\n\nMaterial:\n{text}"
    return text


def _extract_text_from_pdf_file(file_path: Path) -> str:
    """Extract text from a PDF file using OCR."""
    ocr = OCRModule()
    try:
        return ocr.extract_text_from_pdf(str(file_path)).strip()
    except Exception as exc:
        raise QuestionGeneratorError(f"Could not extract text from PDF: {exc}") from exc


def _extract_text_from_image_file(file_path: Path) -> str:
    """Extract text from an image file using OCR."""
    ocr = OCRModule()
    try:
        return ocr.extract_text(str(file_path)).strip()
    except Exception as exc:
        raise QuestionGeneratorError(f"Could not extract text from image: {exc}") from exc


def _handle_document_only_text(
    extracted_text: str,
    file_url: Optional[str],
    topic_context: str,
    warnings: list[str],
) -> tuple[str, str, list[str]]:
    """
    Handle document_only source mode when content is plain text or a text file.
    Returns (prepared_text, source_type, warnings).
    """
    if extracted_text and file_url:
        warnings.append("Using direct text content and ignoring file_url.")
    if extracted_text:
        prepared = _prepare_source_text(extracted_text)
        prepared = _prepend_topic_to_text(prepared, topic_context, warnings)
        return prepared, "text", warnings

    if not file_url:
        raise QuestionGeneratorError(
            "Please provide content or file_url to generate questions."
        )

    file_path = _resolve_input_file(file_url)
    suffix = file_path.suffix.lower()

    if suffix in SUPPORTED_TEXT_SUFFIXES:
        text = _read_text_file(file_path)
        if not text.strip():
            raise QuestionGeneratorError("Uploaded text file does not contain usable content.")
        prepared = _prepare_source_text(text)
        prepared = _prepend_topic_to_text(prepared, topic_context, warnings)
        return prepared, "text_file", warnings

    if suffix == ".pdf":
        extracted = _extract_text_from_pdf_file(file_path)
        if len(_cleanup_for_measurement(extracted)) >= MIN_PDF_OCR_CHARS:
            prepared = _prepare_source_text(extracted)
            prepared = _prepend_topic_to_text(prepared, topic_context, warnings)
            return prepared, "pdf_text", warnings
        warnings.append("OCR text from PDF was limited, so visual analysis was used.")
        return str(file_path), "pdf_visual", warnings

    if suffix in SUPPORTED_IMAGE_SUFFIXES:
        return str(file_path), "image_file", warnings

    if suffix in SUPPORTED_VIDEO_SUFFIXES:
        return str(file_path), "video_file", warnings

    raise QuestionGeneratorError(f"Unsupported file type: {suffix or 'unknown'}")


def _handle_combined_text(
    payload: QuestionGenerationRequest,
    topic_context: str,
) -> tuple[str, list[str]]:
    """
    Handle combined source mode — merge topic context with document content.
    Returns (prepared_text, warnings).
    """
    warnings: list[str] = []
    extracted_text = (payload.content or "").strip()
    prepared = ""

    if not extracted_text and not payload.file_url:
        if payload.topic:
            # Fallback to topic-only
            warnings.append("No document provided; questions generated from topic only.")
            return topic_context, warnings
        raise QuestionGeneratorError(
            "Please provide both topic and content, or a combination, to generate questions in combined mode."
        )

    if extracted_text:
        prepared = _prepare_source_text(extracted_text)
    elif payload.file_url:
        file_path = _resolve_input_file(payload.file_url)
        suffix = file_path.suffix.lower()

        if suffix in SUPPORTED_TEXT_SUFFIXES:
            text = _read_text_file(file_path)
            prepared = _prepare_source_text(text)
        elif suffix == ".pdf":
            extracted = _extract_text_from_pdf_file(file_path)
            prepared = _prepare_source_text(extracted)
        elif suffix in SUPPORTED_IMAGE_SUFFIXES:
            extracted = _extract_text_from_image_file(file_path)
            prepared = _prepare_source_text(extracted) if extracted else ""
        else:
            raise QuestionGeneratorError(f"Unsupported file type for combined mode: {suffix}")

    if payload.topic and prepared:
        combined = f"{topic_context}\n\nRelated study material:\n{prepared}"
        warnings.append("Questions generated from both topic and document content.")
    elif payload.topic:
        combined = topic_context
        warnings.append("Questions generated from topic only (no usable document content).")
    else:
        combined = prepared

    return combined, warnings


def _build_source_text(payload: QuestionGenerationRequest) -> tuple[str, str, list[str]]:
    """
    Build the source text and source_type based on source_mode and payload fields.
    Returns (prepared_text, source_type, warnings).
    """
    warnings: list[str] = []
    source_mode = payload.source_mode.strip().lower()
    topic_context = _build_topic_context(payload)
    extracted_text = (payload.content or "").strip()

    # --- source_mode = topic_only ---
    if source_mode == "topic_only":
        if not payload.topic:
            raise QuestionGeneratorError("Please provide a topic to generate questions.")
        warnings.append("Questions generated from topic only, no document was used.")
        return topic_context, "topic_only", warnings

    # --- source_mode = document_only (default) ---
    if source_mode == "document_only" or source_mode not in ("combined",):
        return _handle_document_only_text(
            extracted_text=extracted_text,
            file_url=payload.file_url,
            topic_context=topic_context,
            warnings=warnings,
        )

    # --- source_mode = combined ---
    combined_text, combined_warnings = _handle_combined_text(payload, topic_context)
    warnings.extend(combined_warnings)
    return combined_text, "combined", warnings


def generate_questions(payload: QuestionGenerationRequest) -> QuestionGenerationResponse:
    """Generate questions from topic, raw text, uploaded file, or a combination."""
    distribution_total = (
        payload.difficulty_remember
        + payload.difficulty_understand
        + payload.difficulty_apply
    )
    if distribution_total != 100:
        raise QuestionGeneratorError(
            f"Tổng tỷ lệ phân bố cấp độ nhận thức phải bằng 100% (hiện tại: {distribution_total}%)."
        )

    question_type = _normalize_question_type(payload.question_type)

    prepared_text, source_type, warnings = _build_source_text(payload)

    # Check if visual pipeline is needed for files
    if source_type in ("pdf_visual", "image_file", "video_file"):
        return _generate_from_file_visual(
            file_path_str=prepared_text,
            source_type=source_type,
            payload=payload,
            question_type=question_type,
            warnings=warnings,
        )

    # Text-based generation
    questions = _generate_questions_from_text(
        prepared_text=prepared_text,
        question_count=payload.question_count,
        difficulty_remember=payload.difficulty_remember,
        difficulty_understand=payload.difficulty_understand,
        difficulty_apply=payload.difficulty_apply,
        question_type=question_type,
        exam_id=payload.exam_id,
        score_per_question=payload.score_per_question,
        start_sequence=payload.start_sequence,
        topic=payload.topic,
        topic_description=payload.topic_description,
        warnings=warnings,
    )
    questions = _validate_generated_questions(questions, warnings)

    return QuestionGenerationResponse(
        exam_id=payload.exam_id,
        source_type=source_type,
        source_mode=payload.source_mode,
        difficulty_remember=payload.difficulty_remember,
        difficulty_understand=payload.difficulty_understand,
        difficulty_apply=payload.difficulty_apply,
        question_type=question_type,
        model_used=_get_text_model(),
        content_preview=_preview_text(prepared_text),
        topic=payload.topic,
        warnings=warnings,
        questions=questions,
    )


def _generate_from_file_visual(
    file_path_str: str,
    source_type: str,
    payload: QuestionGenerationRequest,
    question_type: str,
    warnings: list[str],
) -> QuestionGenerationResponse:
    """Handle visual-based generation for PDF, image, and video files."""
    file_path = Path(file_path_str)
    suffix = file_path.suffix.lower()

    # Build topic context prefix for visual prompts
    topic_prefix = ""
    if payload.topic:
        topic_prefix = f"Topic: {payload.topic}"
        if payload.topic_description:
            topic_prefix += f" ({payload.topic_description})"
        topic_prefix += "\n\n"
        if "topic_only" not in source_type:
            warnings.append("Topic context included alongside visual analysis.")

    # Prepare image payloads and source label per file type
    if suffix in SUPPORTED_IMAGE_SUFFIXES or source_type == "image_file":
        image = Image.open(file_path)
        image_payloads = [_image_to_data_url(image)]
        source_label = "an image"
        content_preview = f"Visual analysis of {file_path.name}"

    elif source_type == "pdf_visual" or suffix == ".pdf":
        page_images = _render_pdf_pages(file_path, max_pages=PDF_VISUAL_MAX_PAGES)
        image_payloads = [_image_to_data_url(image) for image in page_images]
        source_label = "a PDF document"
        content_preview = f"Visual question generation from {file_path.name}"

    elif source_type == "video_file" or suffix in SUPPORTED_VIDEO_SUFFIXES:
        frames = _sample_video_frames(file_path, frame_count=VIDEO_SAMPLE_FRAME_COUNT)
        if not frames:
            raise QuestionGeneratorError("Could not read usable frames from the video.")
        images = [Image.fromarray(frame) for frame in frames]
        image_payloads = [_image_to_data_url(image) for image in images]
        source_label = "sampled frames from a video"
        content_preview = f"Visual question generation from {file_path.name}"

    else:
        raise QuestionGeneratorError(f"Unsupported file type for visual: {suffix or 'unknown'}")

    if not image_payloads:
        raise QuestionGeneratorError(
            "No usable visual content could be prepared from the source file "
            "(pages may be blank or frames unreadable)."
        )

    questions = _generate_questions_from_visual_inputs(
        image_payloads=image_payloads,
        question_count=payload.question_count,
        difficulty_remember=payload.difficulty_remember,
        difficulty_understand=payload.difficulty_understand,
        difficulty_apply=payload.difficulty_apply,
        question_type=question_type,
        exam_id=payload.exam_id,
        score_per_question=payload.score_per_question,
        start_sequence=payload.start_sequence,
        source_label=source_label,
        topic_prefix=topic_prefix,
        topic=payload.topic,
        topic_description=payload.topic_description,
        warnings=warnings,
    )
    questions = _validate_generated_questions(questions, warnings)

    return QuestionGenerationResponse(
        exam_id=payload.exam_id,
        source_type=source_type,
        source_mode=payload.source_mode,
        difficulty_remember=payload.difficulty_remember,
        difficulty_understand=payload.difficulty_understand,
        difficulty_apply=payload.difficulty_apply,
        question_type=question_type,
        model_used=_get_vision_model(),
        content_preview=content_preview,
        topic=payload.topic,
        warnings=warnings,
        questions=questions,
    )


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


def _critique_and_improve_questions(
    questions: list[GeneratedQuestion],
    prepared_text: str,
    question_type: str,
    difficulty_remember: int,
    difficulty_understand: int,
    difficulty_apply: int,
    model: str,
    warnings: list[str],
) -> list[GeneratedQuestion]:
    """
    Self-critique loop: send generated questions back to the AI model,
    ask it to review for common item-writing flaws, and return improved questions.

    The model sees the original questions + source material + critique criteria,
    then returns a corrected/improved set in the same JSON schema.

    Falls back to the original questions if:
    - Self-critique is disabled via env var AI_GENERATOR_SELF_CRITIQUE=0
    - Fewer than 3 questions (not worth the extra API call)
    - The model returns a different number of questions
    - The model fails to return valid JSON
    """
    if not ENABLE_SELF_CRITIQUE:
        return questions

    if len(questions) < 3:
        return questions

    # Serialize the original questions for the critique prompt
    question_list = []
    for q in questions:
        opts = [
            {"content": o.content, "is_correct": o.is_correct}
            for o in q.options
        ]
        question_list.append({
            "content": q.content,
            "answer": q.answer,
            "bloom_level": q.bloom_level,
            "difficulty": q.difficulty,
            "options": opts,
        })

    questions_json = json.dumps(question_list, ensure_ascii=False, indent=2)

    # Build targeted critique instructions with concrete examples from the codebase
    critique_instructions = (
        "You are a senior assessment reviewer. Your task is to review the following "
        f"Vietnamese {question_type} questions and fix ANY issues you find.\n\n"
        "=== Review Criteria (check EVERY question against ALL of these) ===\n\n"
        "1. STEM QUALITY:\n"
        "   - The question stem must be complete and answerable WITHOUT reading the options.\n"
        "   - No double negatives or unnecessarily complex phrasing.\n"
        "   - No vague phrases like 'một số', 'nhiều cách', 'có thể'.\n"
        "   - The stem should not contain clues that give away the correct answer.\n"
        "   - Each question should test only ONE concept.\n\n"
        "2. CUEING (CRITICAL — this is the most common AI flaw):\n"
        "   - The correct answer must NOT be grammatically, structurally, or stylistically \n"
        "     different from the distractors.\n"
        "   - The correct answer must NOT be noticeably longer or shorter than distractors.\n"
        "   - The correct answer must NOT use more specific/technical language than distractors.\n"
        "   - If the stem ends with 'là gì?' or 'là ai?', all options should be similar in form.\n"
        "   - Check that the correct answer doesn't stand out visually in any way.\n\n"
        "3. DISTRACTOR QUALITY:\n"
        "   - Every distractor must be plausible and realistic (not obviously wrong).\n"
        "   - No distractors should be too similar to each other or to the correct answer.\n"
        "   - Distractors should represent common misunderstandings when possible.\n"
        "   - No 'Tất cả đáp án trên' or 'Không có đáp án nào đúng' as options.\n"
        "   - No duplicate or overlapping options within the same question.\n\n"
        "4. BLOOM'S TAXONOMY ALIGNMENT:\n"
        "   - 'remember': must ONLY test recall of facts, terms, definitions.\n"
        "   - 'understand': must require explanation, comparison, or interpretation.\n"
        "   - 'apply': must present a concrete scenario requiring application.\n"
        "   - 'analyze': must require drawing connections or breaking down concepts.\n"
        "   - 'evaluate': must require making a judgment or defending a position.\n"
        "   - 'create': must require producing new work or original design.\n"
        "   - If a question's cognitive level doesn't match its stem, fix the STEM or change the level.\n"
        f"   Target distribution: Remember {difficulty_remember}%, Understand {difficulty_understand}%, Apply {difficulty_apply}%.\n\n"
        "5. EXPLANATION QUALITY:\n"
        "   - Each question MUST have an 'explanation' field explaining why the answer is correct.\n"
        "   - The explanation should be educational: it should help the student understand the underlying concept.\n"
        "   - For 'remember' questions: explain what the correct term/concept means.\n"
        "   - For 'understand' questions: explain the reasoning or relationship.\n"
        "   - For 'apply' questions: explain how the knowledge is applied in the scenario.\n"
        "   - If any question is missing 'explanation', ADD a proper one.\n"
        "\n"
        "6. CROSS-QUESTION ISSUES:\n"
        "   - No two questions should test the same knowledge point.\n"
        "   - No two questions should have nearly identical stems.\n"
        "   - The correct answer positions should be varied (not always A or D).\n"
        "   - Each question must be self-contained and not depend on other questions.\n\n"
        "7. LANGUAGE QUALITY:\n"
        "   - All content must be in Vietnamese, using clear academic language.\n"
        "   - No spelling or grammar errors.\n"
        "   - Use standard Vietnamese terms — avoid direct translations from English.\n\n"
        "8. TRUE/FALSE-SPECIFIC (only for 'Đúng'/'Sai' questions):\n"
        "   - Each question must have EXACTLY 2 options: 'Đúng' and 'Sai'.\n"
        "   - The stem must be a complete DECLARATIVE statement — not a question ending in '?'\n"
        "     and not a '...có phải không?' phrasing.\n"
        "   - The statement must be unambiguously true or false: no opinion, no hedge words\n"
        "     ('thường', 'có thể', 'đôi khi', 'một số'), and no absolute words\n"
        "     ('luôn luôn', 'không bao giờ', 'tất cả', 'chỉ', 'duy nhất') unless the material states them.\n"
        "   - No double negatives and no stem starting with 'không' unless unavoidable.\n"
        "   - The correct answers must be a rough mix of 'Đúng' and 'Sai' across the set —\n"
        "     not all one side.\n"
        "   - The 'answer' field must equal the content of the correct option ('Đúng' or 'Sai').\n\n"
        "9. MULTIPLE-CHOICE-SPECIFIC (only for 4-option questions):\n"
        "   - Each question must have EXACTLY 4 options (A, B, C, D).\n"
        "   - Exactly ONE option must be correct; the rest must be plausible distractors\n"
        "     that represent common misunderstandings.\n"
        "   - No cueing: the correct option must not differ in length, wording style, or\n"
        "     technical level from the distractors.\n"
        "   - Do not use absolute or hedge words only in the correct option.\n"
        "   - Do not use 'Tất cả đáp án trên' or 'Không có đáp án nào đúng'.\n"
        "   - The 'answer' field must equal the content of the correct option.\n\n"
        "=== INSTRUCTIONS ===\n"
        "1. Review EVERY question against ALL criteria above.\n"
        "2. Fix any issues you find — rewrite stems, swap options, adjust bloom_level or difficulty.\n"
        "3. Return the COMPLETE improved set of questions in the same JSON schema.\n"
        "4. Preserve the exact same number of questions ({len(questions)} questions).\n"
        "5. If a question is already perfect, keep it as-is — only change what needs fixing.\n"
        f"\n=== Source Material (for fact-checking) ===\n{prepared_text}"
    )

    critique_prompt = (
        f"{critique_instructions}\n\n"
        f"=== Original Questions to Review ===\n{questions_json}"
    )

    system_prompt = (
        "You are a senior assessment quality reviewer. Review the provided Vietnamese quiz "
        "questions, identify item-writing flaws, and return an improved set. "
        "Return valid JSON only."
    )

    try:
        raw_payload = _request_structured_completion(
            model=model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": critique_prompt},
            ],
            schema=_build_question_schema(question_type),
            fallback_prompt=f"Review and improve these Vietnamese {question_type} questions. "
            f"Fix all item-writing flaws. Return valid JSON only with the same schema.\n\n{questions_json}",
            temperature=CRITIQUE_TEMPERATURE,
        )

        improved = _coerce_questions(
            raw_payload=raw_payload,
            question_count=len(questions),
            question_type=question_type,
            exam_id=questions[0].exam_id,
            score_per_question=questions[0].score,
            start_sequence=questions[0].sequence,
        )

        if len(improved) == len(questions):
            warnings.append(
                f"Self-critique: {len(improved)} câu hỏi đã được xem xét và cải thiện."
            )
            return improved

        # If count mismatches, keep originals but note the issue
        warnings.append(
            "Self-critique: số lượng câu hỏi không khớp, giữ nguyên bản gốc."
        )
        return questions

    except QuestionGeneratorError as exc:
        warnings.append(f"Self-critique: không thể cải thiện câu hỏi ({exc}). Giữ nguyên bản gốc.")
        return questions


def _generate_questions_from_text(
    prepared_text: str,
    question_count: int,
    difficulty_remember: int,
    difficulty_understand: int,
    difficulty_apply: int,
    question_type: str,
    exam_id: Optional[int],
    score_per_question: int,
    start_sequence: int,
    topic: Optional[str] = None,
    topic_description: Optional[str] = None,
    warnings: Optional[list[str]] = None,
) -> list[GeneratedQuestion]:
    system_prompt = (
        "You are a senior assessment designer with 15 years of experience. "
        "Your task is to create high-quality Vietnamese multiple-choice questions that meet academic standards."
        "Return valid JSON only, no markdown fences, no extra text.\n\n"
        "=== ACADEMIC QUALITY STANDARDS ===\n"
        "1. STEM QUALITY:\n"
        "   - Must be a COMPLETE question that can be answered WITHOUT reading the options.\n"
        "   - End with '?'. For imperative stems, start with 'Hãy', 'Cho biết', 'Xác định'.\n"
        "   - Test only ONE knowledge point per question — do not combine multiple concepts.\n"
        "   - Use precise, specific wording. Avoid vague phrases like 'một số', 'nhiều cách', 'có thể'.\n"
        "   - Do NOT contain hints or clues that reveal the correct answer.\n"
        "\n"
        "2. OPTIONS:\n"
        "   - Exactly 4 options (A, B, C, D) for multiple-choice questions.\n"
        "   - Exactly 2 options for true/false questions: 'Đúng' (True) and 'Sai' (False).\n"
        "   - Only ONE correct answer per question.\n"
        "   - Distractors for multiple-choice questions must be:\n"
        "     • Plausible and realistic — not obviously wrong or too easy to eliminate.\n"
        "     • Representative of common student mistakes or misconceptions.\n"
        "     • Similar in length and grammatical structure to the correct answer.\n"
        "     • Not overlapping or implying each other.\n"
        "     • Do NOT use 'Tất cả đáp án trên' (All of the above) or 'Không có đáp án nào đúng' (None of the above).\n"
        "   - The correct answer position must be RANDOM — not always A or D for multiple-choice questions.\n"
        "   - The correct answer position must be RANDOM — not always 'Đúng' or 'Sai' for true/false questions.\n"
        "\n"
        "3. EXPLANATION:\n"
        "   - Each question MUST include an 'explanation' field explaining why the correct answer is correct.\n"
        "   - Keep explanations concise (1-3 sentences), in Vietnamese.\n"
        "   - Point out the underlying knowledge being tested.\n"
        "   - Optionally explain why distractors are wrong.\n"
        "\n"
        "4. LANGUAGE:\n"
        "   - ALL content (stem, options, explanation) must be in Vietnamese.\n"
        "   - Use clear, standard academic Vietnamese. No slang or regional dialects.\n"
        "   - Check spelling and grammar: no tone-mark errors, no wrong words.\n"
        "   - Use the EXACT technical terminology from the source material.\n"
        "\n"
        "5. MATERIAL FIDELITY:\n"
        "   - Use ONLY information present in the provided material.\n"
        "   - Do not ask about external knowledge or require reasoning beyond the content.\n"
        "   - Every fact or concept referenced must appear in the source material.\n"
        "\n"
        "6. COGNITIVE LEVEL CONSISTENCY:\n"
        "   - 'remember': Only ask about terms, definitions, basic facts. Do NOT require explanation.\n"
        "   - 'understand': Require explanation, comparison, or summary. Do NOT require application.\n"
        "   - 'apply': Provide a concrete scenario and require applying knowledge.\n"
        "\n"
        "7. DIVERSITY:\n"
        "   - Ensure a mix of cognitive levels according to the specified distribution.\n"
        "   - Avoid repetitive question patterns or stems.\n"
        "   - Ensure that no two questions test the same knowledge point.\n"
        "   - Ensure that no two questions have nearly identical stems or options.\n"
        "\n"
    )
    if question_type == "true_false":
        system_prompt += _build_true_false_rules()
    elif question_type == "multiple_choice":
        system_prompt += _build_multiple_choice_rules()
    cognitive_prompt = _build_cognitive_level_prompt(
        difficulty_remember, difficulty_understand, difficulty_apply,
        topic, topic_description,
        question_type=question_type,
    )
    user_prompt = (
        f"Create {question_count} Vietnamese {question_type} questions.\n"
        f"{cognitive_prompt}\n"
        "\n"
        "=== CRITICAL RULES ===\n"
        "- Each question must have EXACTLY 4 options (A, B, C, D) for multiple-choice questions.\n"
        "- Each question must have EXACTLY 2 options for true/false questions: 'Đúng' (True) and 'Sai' (False).\n"
        "- Each question must include an 'explanation' field explaining the answer.\n"
        "- Distractors for multiple-choice questions must be PLAUSIBLE — not so obviously wrong that students can easily eliminate them.\n"
        "- The correct answer position must be RANDOM among the options for multiple-choice questions.\n"
        "- The correct answer position must be RANDOM between 'Đúng' and 'Sai' for true/false questions.\n"
        "- Do NOT use 'Tất cả đáp án trên' (All of the above) or 'Không có đáp án nào đúng' (None of the above) for multiple-choice questions.\n"
        "- Ensure a mix of cognitive levels according to the specified distribution.\n"
        f"\nMaterial:\n{prepared_text}"
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
    questions = _coerce_questions(
        raw_payload=raw_payload,
        question_count=question_count,
        question_type=question_type,
        exam_id=exam_id,
        score_per_question=score_per_question,
        start_sequence=start_sequence,
    )

    # Self-critique loop — improve questions via a second model call
    if warnings is not None:
        questions = _critique_and_improve_questions(
            questions=questions,
            prepared_text=prepared_text,
            question_type=question_type,
            difficulty_remember=difficulty_remember,
            difficulty_understand=difficulty_understand,
            difficulty_apply=difficulty_apply,

            model=_get_text_model(),
            warnings=warnings,
        )

    return questions


def _generate_questions_from_visual_inputs(
    image_payloads: list[str],
    question_count: int,
    difficulty_remember: int,
    difficulty_understand: int,
    difficulty_apply: int,
    question_type: str,
    exam_id: Optional[int],
    score_per_question: int,
    start_sequence: int,
    source_label: str,
    topic_prefix: str = "",
    topic: Optional[str] = None,
    topic_description: Optional[str] = None,
) -> list[GeneratedQuestion]:
    system_prompt = (
        "You are an assessment designer. Analyze the provided visual material and create Vietnamese quiz questions. "
        "Return valid JSON only."
    )
    cognitive_prompt = _build_cognitive_level_prompt(
        difficulty_remember, difficulty_understand, difficulty_apply,
        topic, topic_description,
        question_type=question_type,
    )
    text_block = (
        f"{topic_prefix}"
        f"Create {question_count} {question_type} questions in Vietnamese.\n"
        f"{cognitive_prompt}\n"
        f"Source: {source_label}.\n"
        "Use only details that are clearly visible or inferable from the visual content.\n"
        "Make the questions specific, accurate, and suitable for study.\n"
        "Make sure the correct option appear in a random order if the question type is multiple choice.\n"
        "For each question, classify its cognitive level using one of these Bloom's taxonomy levels:\n"
        "  - remember: recall facts, terms, basic concepts (Nhận biết)\n"
        "  - understand: explain ideas, interpret information (Thông hiểu)\n"
        "  - apply: use information in new situations (Vận dụng)\n"
        "  - analyze: draw connections among ideas (Phân tích)\n"
        "  - evaluate: justify a decision or course of action (Đánh giá)\n"
        "  - create: produce new or original work (Sáng tạo)\n"
        "Include the field 'bloom_level' in each question object with the appropriate level.\n"
        "Include the field 'difficulty' in each question object ('easy', 'medium', or 'hard')."
        + (
            "\nFor true/false questions: exactly 2 options 'Đúng' and 'Sai', the stem must be a "
            "declarative statement (not a question), avoid absolute and hedge words, and randomize "
            "the correct position between 'Đúng' and 'Sai'.\n"
            if question_type == "true_false"
            else "\nFor multiple-choice questions: exactly 4 plausible options, only one correct, "
            "no cueing (correct option must not differ in length or style), and randomize the "
            "correct position.\n"
            if question_type == "multiple_choice"
            else ""
        )
    )
    content_blocks: list[dict[str, Any]] = [
        {"type": "text", "text": text_block},
    ]
    content_blocks.extend(
        {"type": "image_url", "image_url": {"url": image_payload}}
        for image_payload in image_payloads
    )

    cognitive_prompt_for_fallback = _build_cognitive_level_prompt(
        difficulty_remember, difficulty_understand, difficulty_apply,
        question_type=question_type,
    )
    raw_payload = _request_structured_completion(
        model=_get_vision_model(),
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": content_blocks},
        ],
        schema=_build_question_schema(question_type),
        fallback_prompt=(
            f"Create {question_count} {question_type} questions in Vietnamese from the provided visual material.\n"
            f"{cognitive_prompt_for_fallback}\n"
            f"Return JSON only."
        ),
    )
    questions = _coerce_questions(
        raw_payload=raw_payload,
        question_count=question_count,
        question_type=question_type,
        exam_id=exam_id,
        score_per_question=score_per_question,
        start_sequence=start_sequence,
    )

    # Self-critique loop for visual pipeline
    if warnings is not None:
        # For visual inputs, prepare a textual description of the source for the critique
        source_context = f"[Content from {source_label}]"
        questions = _critique_and_improve_questions(
            questions=questions,
            prepared_text=source_context,
            question_type=question_type,
            difficulty_remember=difficulty_remember,
            difficulty_understand=difficulty_understand,
            difficulty_apply=difficulty_apply,

            model=_get_vision_model(),
            warnings=warnings,
        )

    return questions


def _request_structured_completion(
    model: str,
    messages: list[dict[str, Any]],
    schema: dict[str, Any],
    fallback_prompt: str,
    temperature: float = GENERATION_TEMPERATURE,
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
            temperature=temperature,
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
            temperature=temperature,
        )
        return _parse_json_payload(content)


def _call_hf_chat_completion(
    model: str,
    messages: list[dict[str, Any]],
    response_format: Optional[dict[str, Any]],
    temperature: float = GENERATION_TEMPERATURE,
) -> str:
    hf_token = _get_hf_token()
    client = OpenAI(
        base_url=HF_ROUTER_BASE_URL,
        api_key=hf_token,
        timeout=120.0,
        max_retries=1,
    )

    model_candidates = _build_hf_router_model_candidates(model)
    last_status_error: Optional[APIStatusError] = None

    for candidate_index, model_candidate in enumerate(model_candidates):
        try:
            completion = client.chat.completions.create(
                model=model_candidate,
                messages=messages,
                max_tokens=MAX_TOKENS,
                temperature=temperature,
                response_format=response_format,
            )
            return _extract_openai_completion_text(completion)
        except APIStatusError as exc:
            last_status_error = exc
            if (
                candidate_index < len(model_candidates) - 1
                and _should_retry_hf_router_with_next_candidate(exc)
            ):
                continue

            raise QuestionGeneratorError(
                f"Hugging Face API request failed with status {exc.status_code}: "
                f"{_extract_openai_status_error_body(exc)}"
            ) from exc
        except (APITimeoutError, APIConnectionError) as exc:
            raise QuestionGeneratorError(f"Could not connect to Hugging Face API: {exc}") from exc
        except OpenAIError as exc:
            raise QuestionGeneratorError(f"Hugging Face OpenAI-compatible client failed: {exc}") from exc

    if last_status_error is not None:
        raise QuestionGeneratorError(
            f"Hugging Face API request failed with status {last_status_error.status_code}: "
            f"{_extract_openai_status_error_body(last_status_error)}"
        ) from last_status_error

    raise QuestionGeneratorError("Hugging Face API returned an unexpected empty response.")


def _build_hf_router_model_candidates(model: str) -> list[str]:
    cleaned_model = model.strip()
    if not cleaned_model:
        return [model]

    if ":" in cleaned_model.rsplit("/", 1)[-1]:
        return [cleaned_model]

    return [
        cleaned_model,
        f"{cleaned_model}:preferred",
        f"{cleaned_model}:fastest",
        f"{cleaned_model}:cheapest",
    ]


def _should_retry_hf_router_with_next_candidate(exc: APIStatusError) -> bool:
    status_code = exc.status_code
    return status_code in {403, 404, 429, 500, 502, 503, 504}


def _extract_openai_status_error_body(exc: APIStatusError) -> str:
    response = getattr(exc, "response", None)
    if response is None:
        return str(exc)

    try:
        body = response.text
    except Exception:
        body = ""

    if body:
        return body

    try:
        json_payload = response.json()
    except Exception:
        json_payload = None

    if json_payload is not None:
        try:
            return json.dumps(json_payload, ensure_ascii=False)
        except TypeError:
            return str(json_payload)

    return str(exc)


def _extract_openai_completion_text(completion: Any) -> str:
    try:
        content = completion.choices[0].message.content
    except (AttributeError, IndexError, TypeError) as exc:
        raise QuestionGeneratorError("Hugging Face API returned an unexpected response.") from exc

    if isinstance(content, str):
        return content

    if isinstance(content, list):
        text_parts: list[str] = []
        for item in content:
            if isinstance(item, dict):
                text = item.get("text")
            else:
                text = getattr(item, "text", None)
            if isinstance(text, str):
                text_parts.append(text)

        combined_text = "".join(text_parts).strip()
        if combined_text:
            return combined_text

    raise QuestionGeneratorError("Hugging Face API did not return textual message content.")


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

        # Extract bloom_level from AI response, fall back to "remember"
        bloom_level = str(raw_question.get("bloom_level", "remember")).strip().lower()
        valid_levels = {"remember", "understand", "apply", "analyze", "evaluate", "create"}
        if bloom_level not in valid_levels:
            bloom_level = "remember"

        # Extract difficulty from AI response, fall back to "medium"
        difficulty = str(raw_question.get("difficulty", "medium")).strip().lower()
        valid_difficulties = {"easy", "medium", "hard"}
        if difficulty not in valid_difficulties:
            difficulty = "medium"

        # Extract explanation from AI response
        explanation = str(raw_question.get("explanation", "")).strip()
        if not explanation:
            # Try to generate a minimal explanation from answer and options
            correct_option = next((o.content for o in options if o.is_correct), None)
            if correct_option and answer:
                explanation = f"Đáp án đúng là: {correct_option}"
            elif answer:
                explanation = f"Đáp án đúng là: {answer}"

        questions.append(
            GeneratedQuestion(
                exam_id=exam_id,
                content=content,
                question_type=question_type,
                sequence=start_sequence + index,
                score=score_per_question,
                answer=answer,
                options=options,
                bloom_level=bloom_level,
                difficulty=difficulty,
                explanation=explanation,
            )
        )

    if not questions:
        raise QuestionGeneratorError("Could not normalize any generated question from the model response.")

    return questions


def _text_similarity(a: str, b: str) -> float:
    """Jaccard similarity on word tokens between two strings."""
    words_a = set(re.findall(r"\w+", a.lower()))
    words_b = set(re.findall(r"\w+", b.lower()))
    if not words_a and not words_b:
        return 1.0
    if not words_a or not words_b:
        return 0.0
    intersection = words_a & words_b
    union = words_a | words_b
    return len(intersection) / len(union)


def _strip_vietnamese_diacritics(text: str) -> str:
    """Remove Vietnamese diacritics so 'Đúng'/'đúng'/'dung' compare equal."""
    normalized = unicodedata.normalize("NFD", text)
    stripped = "".join(ch for ch in normalized if not unicodedata.combining(ch))
    # NFD only decomposes tone marks; base-letter marks (đ, ă, â, ê, ô, ơ, ư)
    # must be mapped explicitly.
    replacements = str.maketrans(
        {"đ": "d", "Đ": "D", "ă": "a", "â": "a", "ê": "e", "ô": "o", "ơ": "o", "ư": "u"}
    )
    return stripped.translate(replacements)


def _validate_generated_questions(
    questions: list[GeneratedQuestion],
    warnings: list[str],
) -> list[GeneratedQuestion]:
    """
    Post-generation validation rules implemented in Python code.

    Checks question stems, options, and cross-question patterns.
    Appends warnings for any issues found.
    Returns the (unmodified) question list.
    """
    if not questions:
        return questions

    answer_positions: list[int] = []

    for q in questions:
        content = q.content.strip()
        seq = q.sequence
        is_true_false = q.question_type == "true_false"

        # --- Question stem checks ---

        # 1. Prohibited patterns in stem (avoid answer-pattern leakage into stem)
        prohibited_stem = [
            "tất cả các đáp án", "tất cả đáp án trên",
            "không có đáp án nào",
        ]
        for pattern in prohibited_stem:
            if pattern in content.lower():
                warnings.append(
                    f"Câu {seq}: nội dung chứa pattern '{pattern}' có thể gây nhầm lẫn."
                )

        # 2. Stem length
        if len(content) > 300:
            warnings.append(
                f"Câu {seq}: nội dung quá dài ({len(content)} ký tự). Nên rút gọn."
            )
        elif len(content) < 15:
            warnings.append(
                f"Câu {seq}: nội dung quá ngắn ({len(content)} ký tự). Câu hỏi nên đầy đủ ý."
            )

        # 3. Question format
        if is_true_false:
            # True/false stems must be declarative statements, not questions
            if content.endswith("?"):
                warnings.append(
                    f"Câu {seq}: câu Đúng/Sai nên là mệnh đề khẳng định, "
                    "không nên kết thúc bằng dấu '?'."
                )
        elif not content.endswith("?"):
            directive_starters = ("hãy", "hã", "cho", "liệt kê", "kể tên", "trình bày")
            if not any(content.lower().startswith(w) for w in directive_starters):
                warnings.append(
                    f"Câu {seq}: nội dung không kết thúc bằng dấu '?' và không phải dạng mệnh lệnh."
                )

        # 4. Double negatives
        double_neg_patterns = ["không phải là không", "không thể không", "không có nghĩa là không"]
        for pattern in double_neg_patterns:
            if pattern in content.lower():
                warnings.append(
                    f"Câu {seq}: phát hiện phủ định kép '{pattern}' có thể gây khó hiểu."
                )

        # --- Option checks ---
        options = q.options
        if len(options) >= 2:
            # Track correct answer position
            for i, opt in enumerate(options):
                if opt.is_correct:
                    answer_positions.append(i)
                    break

            # 5. Prohibited option patterns
            prohibited_opts = [
                "tất cả đáp án trên", "không có đáp án nào đúng",
                "tất cả các đáp án trên", "tất cả đều đúng",
                "không có phương án nào đúng",
            ]
            for opt in options:
                opt_lower = opt.content.strip().lower()
                if opt_lower in prohibited_opts:
                    warnings.append(
                        f"Câu {seq}: lựa chọn '{opt.content}' là pattern bị cấm."
                    )

            # 6. Duplicate options within same question
            option_texts = [opt.content.strip().lower() for opt in options]
            if len(option_texts) != len(set(option_texts)):
                warnings.append(
                    f"Câu {seq}: phát hiện các lựa chọn trùng lặp."
                )

            # 7. Option length imbalance (correct answer too long/short)
            option_lengths = [len(opt.content) for opt in options]
            if option_lengths:
                correct_idx = next(
                    (i for i, opt in enumerate(options) if opt.is_correct), None
                )
                if correct_idx is not None:
                    correct_len = option_lengths[correct_idx]
                    other_lens = [
                        option_lengths[i]
                        for i in range(len(options))
                        if i != correct_idx
                    ]
                    if other_lens:
                        avg_other = sum(other_lens) / len(other_lens)
                        if avg_other > 0:
                            if correct_len > avg_other * 2:
                                warnings.append(
                                    f"Câu {seq}: đáp án đúng dài hơn đáng kể so với "
                                    f"các lựa chọn khác, có thể gây nhận diện pattern."
                                )
                            elif correct_len < avg_other * 0.5:
                                warnings.append(
                                    f"Câu {seq}: đáp án đúng ngắn hơn đáng kể so với "
                                    f"các lựa chọn khác, có thể gây nhận diện pattern."
                                )

        # --- True/False-specific checks ---
        if is_true_false:
            # Options must be exactly 'Đúng' and 'Sai'
            normalized_opt_texts = [
                _strip_vietnamese_diacritics(opt.content).strip().lower()
                for opt in q.options
            ]
            if len(q.options) != 2 or not all(
                text in ("dung", "sai") for text in normalized_opt_texts
            ):
                warnings.append(
                    f"Câu {seq}: câu Đúng/Sai phải có đúng 2 phương án 'Đúng' và 'Sai'."
                )

            # Answer field must match the correct option
            correct_opt = next((o for o in q.options if o.is_correct), None)
            if correct_opt and q.answer.strip().lower() != correct_opt.content.strip().lower():
                warnings.append(
                    f"Câu {seq}: trường 'answer' ('{q.answer}') không khớp với "
                    f"phương án đúng ('{correct_opt.content}')."
                )

            # Giveaway qualifiers (absolutes / hedges) in the stem
            absolute_words = ["luôn luôn", "không bao giờ", "tất cả", "duy nhất"]
            for word in absolute_words:
                if word in content.lower():
                    warnings.append(
                        f"Câu {seq}: mệnh đề dùng từ tuyệt đối '{word}' — thường làm lộ "
                        "đáp án 'Sai' trừ khi tài liệu gốc nêu đúng như vậy."
                    )
                    break
            hedge_words = ["thường", "đôi khi", "có thể", "một số"]
            for word in hedge_words:
                if word in content.lower():
                    warnings.append(
                        f"Câu {seq}: mệnh đề dùng từ mơ hồ '{word}' — dễ khiến câu "
                        "luôn đúng và làm lộ đáp án."
                    )
                    break

        # --- Multiple-choice-specific checks ---
        if q.question_type == "multiple_choice":
            if len(q.options) != 4:
                warnings.append(
                    f"Câu {seq}: câu trắc nghiệm phải có đúng 4 phương án (A, B, C, D) "
                    f"(hiện tại: {len(q.options)})."
                )
            correct_count = sum(1 for o in q.options if o.is_correct)
            if correct_count != 1:
                warnings.append(
                    f"Câu {seq}: cần đúng 1 phương án đúng "
                    f"(hiện tại: {correct_count})."
                )
            correct_opt = next((o for o in q.options if o.is_correct), None)
            if correct_opt and q.answer.strip().lower() != correct_opt.content.strip().lower():
                warnings.append(
                    f"Câu {seq}: trường 'answer' ('{q.answer}') không khớp với "
                    f"phương án đúng ('{correct_opt.content}')."
                )

        # 8b. Explanation quality check
        if not q.explanation or len(q.explanation.strip()) < 10:
            warnings.append(
                f"Câu {seq}: thiếu giải thích hoặc giải thích quá ngắn. "
                "Nên bổ sung giải thích tại sao đáp án đúng là đúng."
            )

        # 8c. Grammar check (common Vietnamese errors)
        grammar_issues = []
        # Check for missing question mark on interrogative stems (multiple-choice only)
        if not is_true_false and any(
            word in content.lower()
            for word in ["là gì", "như thế nào", "tại sao", "khi nào", "bao nhiêu"]
        ):
            if not content.strip().endswith("?"):
                grammar_issues.append("câu hỏi nghi vấn cần kết thúc bằng '?'")
        # Check for common Vietnamese spelling errors
        common_spelling_errors = [
            ("giống như là", "giống như"),
            ("bởi vì cho nên", "bởi vì"),
        ]
        for wrong, _ in common_spelling_errors:
            if wrong in content.lower():
                grammar_issues.append(f"có thể sai chính tả: '{wrong}'")
                break
        if grammar_issues:
            warnings.append(
                f"Câu {seq}: phát hiện vấn đề ngữ pháp: {', '.join(grammar_issues)}."
            )

        # 8d. Option overlap check
        if len(options) >= 2:
            for i in range(len(options)):
                for j in range(i + 1, len(options)):
                    opt_i = options[i].content.strip().lower()
                    opt_j = options[j].content.strip().lower()
                    if opt_i and opt_j and len(opt_i) > 5 and len(opt_j) > 5:
                        # Check if one option is contained in another
                        if opt_i in opt_j or opt_j in opt_i:
                            warnings.append(
                                f"Câu {seq}: lựa chọn {chr(65 + i)} và {chr(65 + j)} "
                                "có nội dung bao hàm nhau, cần tách bạch rõ ràng."
                            )
                            break

    # --- Cross-question checks ---

    # 8. Answer position bias
    if len(answer_positions) >= 3:
        pos_counts: dict[int, int] = {}
        for pos in answer_positions:
            pos_counts[pos] = pos_counts.get(pos, 0) + 1
        most_common_pos = max(pos_counts, key=pos_counts.get)
        most_common_count = pos_counts[most_common_pos]
        if most_common_count >= len(answer_positions) * 0.6:
            pos_label = ["A", "B", "C", "D"][most_common_pos] if most_common_pos < 4 else str(most_common_pos)
            warnings.append(
                f"Phát hiện thiên vị vị trí đáp án: {most_common_count}/{len(answer_positions)} "
                f"câu có đáp án ở vị trí {pos_label}."
            )

    # 8e. True/False answer balance
    tf_answers = [
        _strip_vietnamese_diacritics(q.answer).strip().lower()
        for q in questions
        if q.question_type == "true_false"
    ]
    if len(tf_answers) >= 3:
        dung_count = sum(1 for a in tf_answers if a in ("dung", "true", "yes"))
        sai_count = len(tf_answers) - dung_count
        dominant = max(dung_count, sai_count)
        if dominant > len(tf_answers) * 0.7:
            dominant_label = "Đúng" if dung_count > sai_count else "Sai"
            warnings.append(
                f"Phát hiện thiên vị đáp án Đúng/Sai: {dominant}/{len(tf_answers)} "
                f"câu đều là '{dominant_label}'. Nên cân bằng tỷ lệ Đúng/Sai."
            )

    # --- Cross-question checks ---

    # 9. Near-duplicate questions
    if len(questions) >= 2:
        for i in range(len(questions)):
            for j in range(i + 1, len(questions)):
                qi = questions[i].content.strip().lower()
                qj = questions[j].content.strip().lower()
                if qi == qj:
                    warnings.append(
                        f"Phát hiện hai câu hỏi trùng lặp hoàn toàn: "
                        f"câu {questions[i].sequence} và {questions[j].sequence}."
                    )
                elif len(qi) > 10 and len(qj) > 10 and _text_similarity(qi, qj) > 0.8:
                    warnings.append(
                        f"Phát hiện hai câu hỏi gần giống nhau: "
                        f"câu {questions[i].sequence} và {questions[j].sequence}."
                    )

    return questions


def _coerce_options(raw_options: Any, question_type: str) -> list[GeneratedOption]:
    if question_type == "true_false":
        normalized = _normalize_option_items(raw_options)
        if len(normalized) >= 2:
            return normalized[:2]
        return [
            GeneratedOption(content="Đúng", is_correct=False),
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
        is_dung = lowered in {"true", "dung", "đúng", "yes"}
        is_sai = lowered in {"false", "sai", "no"}
        if is_dung or is_sai:
            target = "dung" if is_dung else "sai"
            # Match the answer by option CONTENT, not by position, so that
            # the model's random ordering of 'Đúng'/'Sai' is preserved.
            matched = next(
                (
                    option
                    for option in options
                    if _strip_vietnamese_diacritics(option.content).strip().lower() == target
                ),
                None,
            )
            if matched is None and options:
                # Fall back to positional default: first option for 'Đúng',
                # second option for 'Sai'.
                matched = options[0] if is_dung else (options[1] if len(options) >= 2 else None)
            if matched is not None:
                for option in options:
                    option.is_correct = option is matched
                return matched.content

    if question_type == "multiple_choice" and answer:
        letter = answer.strip().upper()
        if letter in ("A", "B", "C", "D"):
            option_index = ord(letter) - ord("A")
            if option_index < len(options):
                for index, option in enumerate(options):
                    option.is_correct = index == option_index
                return options[option_index].content

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
                        "bloom_level": {
                            "type": "string",
                            "enum": ["remember", "understand", "apply", "analyze", "evaluate", "create"],
                        },
                        "difficulty": {
                            "type": "string",
                            "enum": ["easy", "medium", "hard"],
                        },
                        "explanation": {"type": "string"},
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
                    "required": ["content", "answer", "bloom_level", "difficulty", "options"],
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
        "Return JSON only. Do not include markdown fences, explanations or extra text.\n"
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


def _is_mostly_blank(image: Image.Image, dark_ratio: float = 0.015) -> bool:
    """Return True when fewer than ~1.5% of pixels are dark (blank/cover page)."""
    gray = image.convert("L")
    gray.thumbnail((200, 200))
    values = list(gray.getdata())
    if not values:
        return True
    dark_count = sum(1 for value in values if value < 200)
    return dark_count / len(values) < dark_ratio


def _frame_fingerprint(frame: Any) -> str:
    """Deterministic perceptual fingerprint of a video frame (BGR ndarray)."""
    small = cv2.resize(frame, (24, 24), interpolation=cv2.INTER_AREA)
    gray = cv2.cvtColor(small, cv2.COLOR_BGR2GRAY)
    quantized = (gray // 16).tobytes()
    return hashlib.md5(quantized).hexdigest()


def _dedupe_frames(frames: list[Any], max_count: int) -> list[Any]:
    """Drop near-identical frames (e.g. static slides) keeping at most max_count."""
    if not frames:
        return []

    seen: set[str] = set()
    kept: list[Any] = []
    for frame in frames:
        fingerprint = _frame_fingerprint(frame)
        if fingerprint in seen:
            continue
        seen.add(fingerprint)
        kept.append(frame)
        if len(kept) >= max_count:
            break

    return kept


def _render_pdf_pages(file_path: Path, max_pages: int) -> list[Image.Image]:
    # Scan a small window beyond max_pages so blank cover pages can be skipped
    # while still collecting enough content pages.
    scan_budget = max(max_pages * 4, max_pages + 4)
    try:
        pages = pdf2image.convert_from_path(str(file_path), first_page=1, last_page=scan_budget)
    except Exception as exc:  # pragma: no cover - depends on local PDF/image tooling
        raise QuestionGeneratorError(f"Could not render PDF pages for visual analysis: {exc}") from exc

    if not pages:
        return []

    if VISUAL_SKIP_BLANK_PAGES:
        pages = [page for page in pages if not _is_mostly_blank(page)]

    return pages[:max_pages]


def _sample_video_frames(file_path: Path, frame_count: int) -> list[Any]:
    capture = cv2.VideoCapture(str(file_path))
    if not capture.isOpened():
        return []

    total_frames = int(capture.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
    if total_frames <= 0:
        capture.release()
        return []

    # Sample a denser set of candidate frames, then dedupe near-identical ones.
    candidate_count = max(frame_count * 3, frame_count + 2)
    if candidate_count > 1:
        ratios = [index / (candidate_count - 1) for index in range(candidate_count)]
    else:
        ratios = [0.0]
    indices = sorted({
        max(0, min(total_frames - 1, int(total_frames * ratio)))
        for ratio in ratios
    })

    frames: list[Any] = []
    for index in indices:
        capture.set(cv2.CAP_PROP_POS_FRAMES, index)
        success, frame = capture.read()
        if not success or frame is None:
            continue
        frames.append(frame)

    capture.release()
    if not frames:
        return []

    if VISUAL_DEDUPE_FRAMES:
        frames = _dedupe_frames(frames, frame_count)

    return [cv2.cvtColor(frame, cv2.COLOR_BGR2RGB) for frame in frames[:frame_count]]


def _image_to_data_url(image: Image.Image) -> str:
    prepared = image.copy()
    # Deskew first: rotation leaves white corner wedges, and the trim below
    # removes them so they are not encoded as image tokens.
    if VISUAL_DESKEW:
        prepared = deskew_image(prepared)
    if VISUAL_TRIM_MARGINS:
        prepared = trim_white_margins(
            prepared,
            threshold=245,
            pad=12,
            min_content_dim_ratio=0.4,
        )
    prepared = cap_longest_side(prepared, VISUAL_IMAGE_MAX_DIM)
    buffer = io.BytesIO()
    prepared.convert("RGB").save(buffer, format="JPEG", quality=VISUAL_IMAGE_JPEG_QUALITY)
    encoded = base64.b64encode(buffer.getvalue()).decode("utf-8")
    return f"data:image/jpeg;base64,{encoded}"


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
    return read_env_value("HF_TEXT_QUESTION_MODEL") or DEFAULT_TEXT_MODEL


def _get_vision_model() -> str:
    return read_env_value("HF_VISION_QUESTION_MODEL") or DEFAULT_VISION_MODEL


def _get_hf_token() -> str:
    hf_token = read_env_value("HF_TOKEN")
    if not hf_token:
        raise QuestionGeneratorError("HF_TOKEN was not found in the environment or .env file.")
    return hf_token



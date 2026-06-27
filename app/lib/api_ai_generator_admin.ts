"use client";

import {
  AI_GENERATOR_MAX_QUESTIONS,
  AI_GENERATOR_PAGE_SIZE,
  AI_GENERATOR_UPLOAD_ACCEPT,
  clampQuestionCount,
  downloadQuestionsAsJson,
  downloadQuestionsAsTxt,
  generateQuestionsFromText,
  generateQuestionsFromUpload,
  generateQuestionsFromUrl,
  getCognitiveDistributionLabel,
  getDifficultyDistributionLabel,
  getCorrectAnswerLabel,
  getCorrectOption,
  getSourceModeLabel,
  isSelectedAnswerCorrect,
  type AiGeneratorSourceMode,
  type AiGeneratorQuestionType,
  type CognitiveDistribution,
  type GeneratedQuestion,
  type QuestionGenerationResponse,
} from "./api_ai_generator";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";

type FastApiValidationDetail = {
  msg?: string;
};

type FastApiError = {
  detail?: string | FastApiValidationDetail[];
};

export type AiGeneratorAdminMetadata = {
  provider_name: string;
  client_library: string;
  router_base_url: string;
  text_model: string;
  vision_model: string;
  max_question_count: number;
  max_source_text_chars: number;
  min_pdf_ocr_chars: number;
  min_image_ocr_chars: number;
  min_video_ocr_chars: number;
  pdf_visual_max_pages: number;
  video_sample_frame_count: number;
  score_per_question_default: number;
  score_per_question_max: number;
  start_sequence_default: number;
  persist_default: boolean;
  upload_generation_available: boolean;
  supported_text_suffixes: string[];
  supported_image_suffixes: string[];
  supported_video_suffixes: string[];
  source_modes_supported: string[];
};

async function parseError(response: Response): Promise<string> {
  try {
    const error = (await response.json()) as FastApiError;

    if (typeof error.detail === "string" && error.detail.trim()) {
      return error.detail;
    }

    if (Array.isArray(error.detail) && error.detail.length > 0) {
      const combinedMessage = error.detail
        .map((item) => item.msg?.trim())
        .filter((message): message is string => Boolean(message))
        .join(" ");

      if (combinedMessage) {
        return combinedMessage;
      }
    }
  } catch {
    // Giữ thông báo mặc định nếu phản hồi lỗi không phải JSON hợp lệ.
  }

  return "Không thể kết nối tới máy chủ FastAPI.";
}

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  return (await response.json()) as T;
}

export async function getAdminAiGeneratorMetadata(): Promise<AiGeneratorAdminMetadata> {
  return getJson<AiGeneratorAdminMetadata>(`${API_BASE_URL}/question/generate-metadata`);
}

export async function generateAdminQuestionsFromText(input: {
  content: string;
  questionCount: number;
  questionType: AiGeneratorQuestionType;
  sourceMode: AiGeneratorSourceMode;
  topic: string;
  topicDescription: string;
  difficultyRemember: number;
  difficultyUnderstand: number;
  difficultyApply: number;
  difficultyEasy: number;
  difficultyMedium: number;
  difficultyHard: number;
}): Promise<QuestionGenerationResponse> {
  return generateQuestionsFromText(input);
}

export async function generateAdminQuestionsFromUpload(input: {
  file: File;
  questionCount: number;
  questionType: AiGeneratorQuestionType;
  sourceMode: AiGeneratorSourceMode;
  topic: string;
  topicDescription: string;
  difficultyRemember: number;
  difficultyUnderstand: number;
  difficultyApply: number;
  difficultyEasy: number;
  difficultyMedium: number;
  difficultyHard: number;
}): Promise<QuestionGenerationResponse> {
  return generateQuestionsFromUpload(input);
}

export async function generateAdminQuestionsFromUrl(input: {
  documentUrl: string;
  questionCount: number;
  questionType: AiGeneratorQuestionType;
  sourceMode: AiGeneratorSourceMode;
  topic: string;
  topicDescription: string;
  difficultyRemember: number;
  difficultyUnderstand: number;
  difficultyApply: number;
  difficultyEasy: number;
  difficultyMedium: number;
  difficultyHard: number;
}): Promise<QuestionGenerationResponse> {
  return generateQuestionsFromUrl(input);
}

export {
  AI_GENERATOR_MAX_QUESTIONS,
  AI_GENERATOR_PAGE_SIZE,
  AI_GENERATOR_UPLOAD_ACCEPT,
  clampQuestionCount,
  downloadQuestionsAsJson as downloadAdminQuestionsAsJson,
  downloadQuestionsAsTxt as downloadAdminQuestionsAsTxt,
  getCorrectAnswerLabel,
  getCorrectOption,
  isSelectedAnswerCorrect,
  getCognitiveDistributionLabel,
  getDifficultyDistributionLabel,
  getSourceModeLabel,
};

export type {
  AiGeneratorSourceMode,
  AiGeneratorQuestionType,
  CognitiveDistribution,
  GeneratedQuestion,
  QuestionGenerationResponse,
};

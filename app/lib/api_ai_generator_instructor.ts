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
  getCorrectAnswerLabel,
  getCorrectOption,
  isSelectedAnswerCorrect,
  type AiGeneratorDifficulty,
  type AiGeneratorQuestionType,
  type GeneratedQuestion,
  type QuestionGenerationResponse,
} from "./api_ai_generator";
import {
  createInstructorOption,
  createInstructorQuestion,
  getInstructorExamList,
  updateInstructorExam,
  type ExamQuestion,
  type InstructorExam,
} from "./api_exam_instructor";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";

type FastApiValidationDetail = {
  msg?: string;
};

type FastApiError = {
  detail?: string | FastApiValidationDetail[];
};

export type InstructorAiExamChoice = InstructorExam;

export type SaveGeneratedQuestionsToExamInput = {
  examId: number;
  generatedQuestions: GeneratedQuestion[];
};

export type SaveGeneratedQuestionsToExamResult = {
  examId: number;
  createdQuestionCount: number;
  createdOptionCount: number;
  totalQuestionCount: number;
  nextSequenceStart: number;
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

async function getExamQuestionsOrEmpty(examId: number): Promise<ExamQuestion[]> {
  const response = await fetch(`${API_BASE_URL}/question/exam/${examId}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (response.status === 404) {
    return [];
  }

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  return (await response.json()) as ExamQuestion[];
}

export async function getInstructorAiExamChoices(
  instructorId: number,
): Promise<InstructorAiExamChoice[]> {
  const exams = await getInstructorExamList(instructorId);

  return [...exams].sort((left, right) => {
    if (left.course_name !== right.course_name) {
      return left.course_name.localeCompare(right.course_name, "vi");
    }

    return left.title.localeCompare(right.title, "vi");
  });
}

export async function generateInstructorQuestionsFromText(input: {
  content: string;
  questionCount: number;
  difficulty: AiGeneratorDifficulty;
  questionType: AiGeneratorQuestionType;
}): Promise<QuestionGenerationResponse> {
  return generateQuestionsFromText(input);
}

export async function generateInstructorQuestionsFromUpload(input: {
  file: File;
  questionCount: number;
  difficulty: AiGeneratorDifficulty;
  questionType: AiGeneratorQuestionType;
}): Promise<QuestionGenerationResponse> {
  return generateQuestionsFromUpload(input);
}

export async function generateInstructorQuestionsFromUrl(input: {
  documentUrl: string;
  questionCount: number;
  difficulty: AiGeneratorDifficulty;
  questionType: AiGeneratorQuestionType;
}): Promise<QuestionGenerationResponse> {
  return generateQuestionsFromUrl(input);
}

export async function saveGeneratedQuestionsToExam(
  input: SaveGeneratedQuestionsToExamInput,
): Promise<SaveGeneratedQuestionsToExamResult> {
  if (!Number.isInteger(input.examId) || input.examId <= 0) {
    throw new Error("Vui lòng chọn bài kiểm tra hợp lệ.");
  }

  if (input.generatedQuestions.length === 0) {
    throw new Error("Chưa có bộ câu hỏi nào để đưa vào bài kiểm tra.");
  }

  const existingQuestions = await getExamQuestionsOrEmpty(input.examId);
  const currentMaxSequence = existingQuestions.reduce((maxValue, question) => {
    return Math.max(maxValue, question.sequence);
  }, 0);

  let createdQuestionCount = 0;
  let createdOptionCount = 0;

  for (const [questionIndex, generatedQuestion] of input.generatedQuestions.entries()) {
    const createdQuestion = await createInstructorQuestion({
      exam_id: input.examId,
      content: generatedQuestion.content,
      question_type: generatedQuestion.question_type,
      sequence: currentMaxSequence + questionIndex + 1,
      score: generatedQuestion.score,
      answer: generatedQuestion.answer,
    });

    createdQuestionCount += 1;

    for (const option of generatedQuestion.options) {
      await createInstructorOption({
        question_id: createdQuestion.id,
        content: option.content,
        is_correct: option.is_correct,
      });
      createdOptionCount += 1;
    }
  }

  const totalQuestionCount = existingQuestions.length + createdQuestionCount;
  await updateInstructorExam(input.examId, {
    total_questions: totalQuestionCount,
  });

  return {
    examId: input.examId,
    createdQuestionCount,
    createdOptionCount,
    totalQuestionCount,
    nextSequenceStart: currentMaxSequence + 1,
  };
}

export {
  AI_GENERATOR_MAX_QUESTIONS,
  AI_GENERATOR_PAGE_SIZE,
  AI_GENERATOR_UPLOAD_ACCEPT,
  clampQuestionCount,
  downloadQuestionsAsJson as downloadInstructorQuestionsAsJson,
  downloadQuestionsAsTxt as downloadInstructorQuestionsAsTxt,
  getCorrectAnswerLabel,
  getCorrectOption,
  isSelectedAnswerCorrect,
};

export type {
  AiGeneratorDifficulty,
  AiGeneratorQuestionType,
  GeneratedQuestion,
  QuestionGenerationResponse,
};

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
import {
  createInstructorOption,
  createInstructorQuestion,
  getInstructorExamList,
  getInstructorExamQuestions,
  renumberInstructorExamQuestions,
  updateInstructorExam,
  type InstructorExam,
} from "./api_exam_instructor";

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
  questionType: AiGeneratorQuestionType;
  sourceMode: AiGeneratorSourceMode;
  topic: string;
  topicDescription: string;
  difficultyRemember: number;
  difficultyUnderstand: number;
  difficultyApply: number;
}): Promise<QuestionGenerationResponse> {
  return generateQuestionsFromText(input);
}

export async function generateInstructorQuestionsFromUpload(input: {
  file: File;
  questionCount: number;
  questionType: AiGeneratorQuestionType;
  sourceMode: AiGeneratorSourceMode;
  topic: string;
  topicDescription: string;
  difficultyRemember: number;
  difficultyUnderstand: number;
  difficultyApply: number;
}): Promise<QuestionGenerationResponse> {
  return generateQuestionsFromUpload(input);
}

export async function generateInstructorQuestionsFromUrl(input: {
  documentUrl: string;
  questionCount: number;
  questionType: AiGeneratorQuestionType;
  sourceMode: AiGeneratorSourceMode;
  topic: string;
  topicDescription: string;
  difficultyRemember: number;
  difficultyUnderstand: number;
  difficultyApply: number;
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

  const existingQuestions = await getInstructorExamQuestions(input.examId);
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

  // Đánh số lại toàn bộ câu hỏi của bài kiểm tra theo thứ tự liên tục 1..N
  await renumberInstructorExamQuestions(input.examId);

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
  getCognitiveDistributionLabel,
  getSourceModeLabel,
};

export type {
  AiGeneratorSourceMode,
  AiGeneratorQuestionType,
  CognitiveDistribution,
  GeneratedQuestion,
  QuestionGenerationResponse,
};

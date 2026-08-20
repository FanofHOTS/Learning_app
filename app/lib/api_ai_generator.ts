"use client";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";
const DEFAULT_MAX_QUESTION_COUNT = 20;

export const AI_GENERATOR_MAX_QUESTIONS = resolveMaxQuestionCount();
export const AI_GENERATOR_PAGE_SIZE = 5;
export const AI_GENERATOR_UPLOAD_ACCEPT =
  ".txt,.md,.markdown,.pdf,.png,.jpg,.jpeg,.webp,.bmp,.mp4,.webm,.ogg,.mov,.avi,.mkv";

export type AiGeneratorSourceMode = "topic_only" | "document_only" | "combined";
export type AiGeneratorCognitiveLevel = "remember" | "understand" | "apply";
export type AiGeneratorQuestionType = "multiple_choice" | "true_false";
export type CognitiveDistribution = {
  remember: number;
  understand: number;
  apply: number;
};

export type GeneratedOption = {
  id: number | null;
  question_id: number | null;
  content: string;
  is_correct: boolean;
};

export type GeneratedQuestion = {
  id: number | null;
  exam_id: number | null;
  content: string;
  question_type: string;
  sequence: number;
  score: number;
  answer: string;
  options: GeneratedOption[];
  bloom_level?: string;
  difficulty?: string;
  explanation?: string;
};

export type QuestionGenerationResponse = {
  exam_id: number | null;
  source_type: string;
  source_mode: string;
  difficulty_remember: number;
  difficulty_understand: number;
  difficulty_apply: number;
  question_type: string;
  model_used: string;
  content_preview: string;
  topic: string | null;
  warnings: string[];
  questions: GeneratedQuestion[];
};

type FastApiValidationDetail = {
  msg?: string;
};

type FastApiError = {
  detail?: string | FastApiValidationDetail[];
};

type CommonGenerationInput = {
  questionCount: number;
  questionType: AiGeneratorQuestionType;
  sourceMode: AiGeneratorSourceMode;
  topic: string;
  topicDescription: string;
  difficultyRemember: number;
  difficultyUnderstand: number;
  difficultyApply: number;
};

type GenerateFromTextInput = CommonGenerationInput & {
  content: string;
};

type GenerateFromUploadInput = CommonGenerationInput & {
  file: File;
};

type GenerateFromUrlInput = CommonGenerationInput & {
  documentUrl: string;
};

function resolveMaxQuestionCount(): number {
  const rawValue = process.env.NEXT_PUBLIC_AI_GENERATOR_MAX_QUESTIONS?.trim();
  if (!rawValue) {
    return DEFAULT_MAX_QUESTION_COUNT;
  }

  const parsedValue = Number(rawValue);
  if (!Number.isFinite(parsedValue) || parsedValue < 1) {
    return DEFAULT_MAX_QUESTION_COUNT;
  }

  return Math.floor(parsedValue);
}

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
    // Giữ thông báo mặc định khi phản hồi lỗi không phải JSON hợp lệ.
  }

  return "Không thể kết nối tới máy chủ FastAPI.";
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  return (await response.json()) as T;
}

async function postFormData<T>(url: string, formData: FormData): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  return (await response.json()) as T;
}

function normalizeQuestionCount(value: number): number {
  if (!Number.isFinite(value)) {
    return 1;
  }

  const roundedValue = Math.floor(value);
  return Math.min(AI_GENERATOR_MAX_QUESTIONS, Math.max(1, roundedValue));
}

function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function buildJsonPayload(input: CommonGenerationInput) {
  return {
    question_count: normalizeQuestionCount(input.questionCount),
    source_mode: input.sourceMode,
    topic: input.topic || null,
    topic_description: input.topicDescription || null,
    difficulty_remember: input.difficultyRemember,
    difficulty_understand: input.difficultyUnderstand,
    difficulty_apply: input.difficultyApply,
    question_type: input.questionType,
    score_per_question: 1,
    start_sequence: 1,
    persist: false,
  };
}

function getExtensionFromContentType(contentType: string): string {
  const normalized = contentType.split(";")[0]?.trim().toLowerCase() ?? "";

  switch (normalized) {
    case "text/plain":
      return ".txt";
    case "text/markdown":
      return ".md";
    case "application/pdf":
      return ".pdf";
    case "image/png":
      return ".png";
    case "image/jpeg":
      return ".jpg";
    case "image/webp":
      return ".webp";
    case "image/bmp":
      return ".bmp";
    case "video/mp4":
      return ".mp4";
    case "video/webm":
      return ".webm";
    case "video/ogg":
      return ".ogg";
    case "video/quicktime":
      return ".mov";
    default:
      return "";
  }
}

function getFilenameFromResponse(
  documentUrl: string,
  response: Response,
  contentType: string,
): string {
  const contentDisposition = response.headers.get("content-disposition") ?? "";
  const matchedFilename = contentDisposition.match(/filename\*?=(?:UTF-8''|")?([^\";]+)/i);

  if (matchedFilename?.[1]) {
    return decodeURIComponent(matchedFilename[1].replace(/"/g, "").trim());
  }

  try {
    const resolvedUrl = new URL(documentUrl);
    const pathname = resolvedUrl.pathname;
    const filename = pathname.split("/").pop();

    if (filename && filename.includes(".")) {
      return decodeURIComponent(filename);
    }
  } catch {
    if (documentUrl.startsWith("/uploads/")) {
      const filename = documentUrl.split("/").pop();
      if (filename && filename.includes(".")) {
        return decodeURIComponent(filename);
      }
    }
  }

  const extension = getExtensionFromContentType(contentType);
  return `tai-lieu-ai${extension || ".txt"}`;
}

function normalizeWorkspaceUploadUrl(documentUrl: string): string | null {
  const trimmedUrl = documentUrl.trim();
  if (!trimmedUrl) {
    return null;
  }

  if (trimmedUrl.startsWith("/uploads/")) {
    return trimmedUrl;
  }

  try {
    const apiBaseUrl = new URL(API_BASE_URL);
    const resolvedUrl = new URL(trimmedUrl);

    if (
      resolvedUrl.origin === apiBaseUrl.origin &&
      resolvedUrl.pathname.startsWith("/uploads/")
    ) {
      return resolvedUrl.pathname;
    }
  } catch {
    return null;
  }

  return null;
}

async function fetchDocumentFromUrlAsFile(documentUrl: string): Promise<File> {
  let resolvedUrl: URL;

  try {
    resolvedUrl = new URL(documentUrl.trim());
  } catch {
    throw new Error("URL tài liệu không hợp lệ.");
  }

  let response: Response;
  try {
    response = await fetch(resolvedUrl.toString());
  } catch {
    throw new Error(
      "Không thể tải tài liệu từ URL này. Một số website chặn truy cập trực tiếp, hãy thử tải tệp lên thủ công.",
    );
  }

  if (!response.ok) {
    throw new Error("Không thể tải tài liệu từ URL đã cung cấp.");
  }

  const blob = await response.blob();
  if (!blob.size) {
    throw new Error("Tài liệu lấy từ URL đang rỗng.");
  }

  const contentType = response.headers.get("content-type") ?? blob.type;
  const filename = getFilenameFromResponse(resolvedUrl.toString(), response, contentType);

  return new File([blob], filename, {
    type: contentType || blob.type || "application/octet-stream",
  });
}

function downloadBlob(blob: Blob, filename: string) {
  const objectUrl = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename;
  link.click();
  window.URL.revokeObjectURL(objectUrl);
}

function getQuestionTypeLabel(questionType: string): string {
  return questionType === "true_false" ? "Đúng hoặc sai" : "Nhiều lựa chọn";
}

function getBloomLevelLabel(level: string | null | undefined): string {
  switch (level) {
    case "remember":
      return "Nhận biết";
    case "understand":
      return "Thông hiểu";
    case "apply":
      return "Vận dụng";
    case "analyze":
      return "Phân tích";
    case "evaluate":
      return "Đánh giá";
    case "create":
      return "Sáng tạo";
    default:
      return level?.trim() || "Chưa xác định";
  }
}

export function getSourceModeLabel(sourceMode: string): string {
  switch (sourceMode) {
    case "topic_only":
      return "Chỉ chủ đề";
    case "combined":
      return "Chủ đề + tài liệu";
    default:
      return "Chỉ tài liệu";
  }
}

export function getCognitiveDistributionLabel(
  remember: number, understand: number, apply: number,
): string {
  return `NB ${remember}% · TH ${understand}% · VD ${apply}%`;
}


function getSourceTypeLabel(sourceType: string): string {
  switch (sourceType) {
    case "text":
      return "Văn bản thuần";
    case "text_file":
      return "Tệp văn bản";
    case "pdf_text":
      return "PDF qua OCR";
    case "pdf_visual":
      return "PDF qua phân tích hình ảnh";
    case "image_ocr_text":
      return "Ảnh qua OCR";
    case "image_visual":
      return "Ảnh qua phân tích hình ảnh";
    case "video_frame_ocr_text":
      return "Video qua OCR";
    case "video_visual":
      return "Video qua phân tích hình ảnh";
    default:
      return sourceType;
  }
}

function getTotalScore(questions: GeneratedQuestion[]): number {
  return questions.reduce((total, question) => total + question.score, 0);
}

function countQuestionValues(
  questions: GeneratedQuestion[],
  getValue: (question: GeneratedQuestion) => string,
): Record<string, number> {
  return questions.reduce<Record<string, number>>((counts, question) => {
    const value = getValue(question);
    counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {});
}

function formatCountSummary(counts: Record<string, number>): string {
  const entries = Object.entries(counts);
  if (entries.length === 0) {
    return "Không có dữ liệu";
  }

  return entries.map(([label, count]) => `${label}: ${count}`).join(" · ");
}

function buildQuestionsDownloadPayload(response: QuestionGenerationResponse) {
  const exportedQuestions = response.questions.map((question) => ({
    ...question,
    question_type_label: getQuestionTypeLabel(question.question_type),
    bloom_level_label: getBloomLevelLabel(question.bloom_level),
    correct_answer_label: getCorrectAnswerLabel(question),
    option_count: question.options.length,
    options: question.options.map((option, index) => ({
      ...option,
      label: String.fromCharCode(65 + index),
      display_content: `${String.fromCharCode(65 + index)}. ${option.content}`,
    })),
  }));

  const bloomLevelCounts = countQuestionValues(
    response.questions,
    (question) => getBloomLevelLabel(question.bloom_level),
  );
  const questionTypeCounts = countQuestionValues(
    response.questions,
    (question) => getQuestionTypeLabel(question.question_type),
  );

  return {
    ...response,
    exported_at: new Date().toISOString(),
    source_type_label: getSourceTypeLabel(response.source_type),
    source_mode_label: getSourceModeLabel(response.source_mode),
    question_type_label: getQuestionTypeLabel(response.question_type),
    cognitive_distribution: {
      remember: {
        label: "Nhận biết",
        value: response.difficulty_remember,
      },
      understand: {
        label: "Thông hiểu",
        value: response.difficulty_understand,
      },
      apply: {
        label: "Vận dụng",
        value: response.difficulty_apply,
      },
    },
    cognitive_distribution_label: getCognitiveDistributionLabel(
      response.difficulty_remember,
      response.difficulty_understand,
      response.difficulty_apply,
    ),
    total_questions: response.questions.length,
    total_score: getTotalScore(response.questions),
    question_statistics: {
      by_bloom_level: bloomLevelCounts,
      by_question_type: questionTypeCounts,
    },
    questions: exportedQuestions,
  };
}

export function clampQuestionCount(value: number): number {
  return normalizeQuestionCount(value);
}

export function getCorrectOption(question: GeneratedQuestion): GeneratedOption | null {
  const correctByFlag =
    question.options.find((option) => option.is_correct) ?? null;

  if (correctByFlag) {
    return correctByFlag;
  }

  const normalizedAnswer = normalizeText(question.answer);
  return (
    question.options.find(
      (option) => normalizeText(option.content) === normalizedAnswer,
    ) ?? null
  );
}

export function getCorrectAnswerLabel(question: GeneratedQuestion): string {
  const correctOption = getCorrectOption(question);
  if (!correctOption) {
    return question.answer;
  }

  const optionIndex = question.options.findIndex(
    (option) => normalizeText(option.content) === normalizeText(correctOption.content),
  );

  if (optionIndex < 0) {
    return correctOption.content;
  }

  return `${String.fromCharCode(65 + optionIndex)}. ${correctOption.content}`;
}

export function isSelectedAnswerCorrect(
  question: GeneratedQuestion,
  selectedAnswer: string,
): boolean {
  if (!selectedAnswer.trim()) {
    return false;
  }

  const correctOption = getCorrectOption(question);
  if (correctOption) {
    return normalizeText(correctOption.content) === normalizeText(selectedAnswer);
  }

  return normalizeText(question.answer) === normalizeText(selectedAnswer);
}

export async function generateQuestionsFromText(
  input: GenerateFromTextInput,
): Promise<QuestionGenerationResponse> {
  const content = input.content.trim();
  if (!content && input.sourceMode !== "topic_only") {
    throw new Error("Vui lòng nhập nội dung văn bản để tạo câu hỏi.");
  }
  if (!content && input.sourceMode === "topic_only" && !input.topic.trim()) {
    throw new Error("Vui lòng nhập chủ đề để tạo câu hỏi.");
  }

  return postJson<QuestionGenerationResponse>(`${API_BASE_URL}/question/generate`, {
    ...buildJsonPayload(input),
    content: content || "",
  });
}

export async function generateQuestionsFromUpload(
  input: GenerateFromUploadInput,
): Promise<QuestionGenerationResponse> {
  if (!(input.file instanceof File)) {
    throw new Error("Vui lòng chọn tệp tài liệu trước khi tạo câu hỏi.");
  }

  const formData = new FormData();
  formData.append("file", input.file);
  formData.append("question_count", String(normalizeQuestionCount(input.questionCount)));
  formData.append("source_mode", input.sourceMode);
  if (input.topic) formData.append("topic", input.topic);
  if (input.topicDescription) formData.append("topic_description", input.topicDescription);
  formData.append("difficulty_remember", String(input.difficultyRemember));
  formData.append("difficulty_understand", String(input.difficultyUnderstand));
  formData.append("difficulty_apply", String(input.difficultyApply));
  formData.append("question_type", input.questionType);
  formData.append("score_per_question", "1");
  formData.append("start_sequence", "1");
  formData.append("persist", "false");

  return postFormData<QuestionGenerationResponse>(
    `${API_BASE_URL}/question/generate-upload`,
    formData,
  );
}

export async function generateQuestionsFromUrl(
  input: GenerateFromUrlInput,
): Promise<QuestionGenerationResponse> {
  const documentUrl = input.documentUrl.trim();
  if (!documentUrl) {
    throw new Error("Vui lòng nhập URL tài liệu.");
  }

  const workspaceUploadUrl = normalizeWorkspaceUploadUrl(documentUrl);
  if (workspaceUploadUrl) {
    return postJson<QuestionGenerationResponse>(`${API_BASE_URL}/question/generate`, {
      ...buildJsonPayload(input),
      file_url: workspaceUploadUrl,
    });
  }

  const file = await fetchDocumentFromUrlAsFile(documentUrl);
  return generateQuestionsFromUpload({
    ...input,
    file,
  });
}

export function downloadQuestionsAsJson(
  response: QuestionGenerationResponse,
  filename = "bo-cau-hoi-trac-nghiem.json",
) {
  const payload = buildQuestionsDownloadPayload(response);
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json;charset=utf-8",
  });
  downloadBlob(blob, filename);
}

export function downloadQuestionsAsTxt(
  response: QuestionGenerationResponse,
  filename = "bo-cau-hoi-trac-nghiem.txt",
) {
  const bloomLevelCounts = countQuestionValues(
    response.questions,
    (question) => getBloomLevelLabel(question.bloom_level),
  );
  const questionTypeCounts = countQuestionValues(
    response.questions,
    (question) => getQuestionTypeLabel(question.question_type),
  );
  const lines: string[] = [
    "BỘ CÂU HỎI TRẮC NGHIỆM TẠO BẰNG AI",
    `Thời gian tải về: ${new Date().toLocaleString("vi-VN")}`,
    `Nguồn dữ liệu: ${getSourceTypeLabel(response.source_type)}`,
    `Phạm vi: ${getSourceModeLabel(response.source_mode)}`,
    `Tỷ lệ mức độ nhận thức: ${getCognitiveDistributionLabel(
      response.difficulty_remember,
      response.difficulty_understand,
      response.difficulty_apply,
    )}`,
    `Loại câu hỏi: ${getQuestionTypeLabel(response.question_type)}`,
    `Mô hình sử dụng: ${response.model_used}`,
    `Số câu hỏi: ${response.questions.length}`,
    `Tổng điểm: ${getTotalScore(response.questions)}`,
    `Thống kê cấp độ nhận thức: ${formatCountSummary(bloomLevelCounts)}`,
    `Thống kê loại câu hỏi: ${formatCountSummary(questionTypeCounts)}`,
  ];

  if (response.exam_id !== null) {
    lines.push(`ID bài kiểm tra: ${response.exam_id}`);
  }

  if (response.topic) {
    lines.push(`Chủ đề: ${response.topic}`);
  }

  if (response.content_preview.trim()) {
    lines.push("", "TÓM TẮT NỘI DUNG NGUỒN", response.content_preview.trim());
  }

  if (response.warnings.length > 0) {
    lines.push("", "LƯU Ý");
    response.warnings.forEach((warning, index) => {
      lines.push(`${index + 1}. ${warning}`);
    });
  }

  response.questions.forEach((question) => {
    lines.push("", `Câu ${question.sequence}. ${question.content}`);
    if (question.id !== null) {
      lines.push(`ID câu hỏi: ${question.id}`);
    }
    if (question.exam_id !== null) {
      lines.push(`ID bài kiểm tra của câu hỏi: ${question.exam_id}`);
    }
    lines.push(`Loại câu hỏi: ${getQuestionTypeLabel(question.question_type)}`);
    lines.push(`Mức độ nhận thức: ${getBloomLevelLabel(question.bloom_level)}`);
    lines.push(`Điểm: ${question.score}`);
    question.options.forEach((option, index) => {
      const optionLabel = String.fromCharCode(65 + index);
      const correctnessLabel = option.is_correct ? "đúng" : "sai";
      const optionId = option.id !== null ? ` | ID: ${option.id}` : "";
      lines.push(
        `${optionLabel}. ${option.content} (${correctnessLabel}${optionId})`,
      );
    });
    lines.push(`Đáp án đúng: ${getCorrectAnswerLabel(question)}`);
    if (question.answer.trim()) {
      lines.push(`Giá trị đáp án gốc: ${question.answer}`);
    }
    if (question.explanation) {
      lines.push(`Giải thích: ${question.explanation}`);
    }
  });

  const blob = new Blob([lines.join("\n")], {
    type: "text/plain;charset=utf-8",
  });
  downloadBlob(blob, filename);
}
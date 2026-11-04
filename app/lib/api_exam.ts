const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";
const USE_MOCK_EXAM_DATA =
  process.env.NEXT_PUBLIC_USE_MOCK_DATA !== "false";

export type Exam = {
  id: number;
  title: string;
  description?: string | null;
  module_id?: number | null;
  course_id?: number | null;
  duration_minutes: number;
  total_questions: number;
  actual_question_count?: number;
  is_active: boolean;
  pass_score: number;
  max_score: number;
  /** Cách chia cấu trúc câu hỏi: none, bloom (mức độ nhận thức), topic (chủ đề). */
  question_distribution_mode?: string | null;
  /** JSON danh sách {"key": ..., "weight": ...} quy định tỷ lệ câu hỏi. */
  question_distribution?: string | null;
};

export type ExamDistributionMode = "none" | "bloom" | "topic";

export type ExamQuestionDistributionItem = {
  key: string;
  weight: number;
};

export type ExamOption = {
  id: number;
  question_id: number;
  content: string;
  is_correct: boolean;
};

export type ExamQuestion = {
  id: number;
  exam_id: number;
  content: string;
  question_type: string;
  sequence: number;
  score: number;
  answer: string;
  bloom_level?: string;
  topic?: string | null;
  difficulty?: string;
  options?: ExamOption[];
};

export type ExamResult = {
  id: number;
  user_id: number;
  exam_id: number;
  score: number;
  max_score: number;
  total_questions: number;
  correct_answers: number;
  is_passed: boolean;
  submitted_at?: string | null;
  bloom_breakdown?: Record<string, { correct: number; total: number; score: number }> | null;
};

/**
 * Loại câu hỏi được hỗ trợ trong bài kiểm tra.
 * - multiple_choice: trắc nghiệm một đáp án
 * - multiple_answer: trắc nghiệm nhiều đáp án
 * - fill_in_blank: điền chỗ trống (đáp án của từng chỗ trống phân tách bằng dấu |;
 *   các cách viết được chấp nhận của cùng một chỗ trống phân tách bằng dấu ~)
 */
export type ExamQuestionType =
  | "multiple_choice"
  | "multiple_answer"
  | "fill_in_blank";

/** Lựa chọn đáp án của sinh viên cho một câu hỏi. */
export type ExamAnswerSelection =
  | { kind: "single"; optionId: number; content: string }
  | { kind: "multiple"; optionIds: number[] }
  | { kind: "blanks"; values: string[] };

const QUESTION_TYPE_LABELS: Record<string, string> = {
  multiple_choice: "Một đáp án",
  multiple_answer: "Nhiều đáp án",
  fill_in_blank: "Điền chỗ trống",
  true_false: "Đúng / Sai",
};

const BLANK_MARKER_PATTERN = /_{2,}/g;

/** Dấu phân tách các cách viết được chấp nhận của CÙNG một chỗ trống. */
export const BLANK_ALTERNATIVE_SEPARATOR = "~";

const FILL_IN_BLANK_TYPES = new Set([
  "fill_in_blank",
  "fill_blank",
  "fill_in_the_blank",
]);

const MULTIPLE_ANSWER_TYPES = new Set([
  "multiple_answer",
  "multiple_answers",
  "multiple_select",
]);

export function getQuestionTypeLabel(type: string | null | undefined): string {
  const key = (type ?? "").trim().toLowerCase();
  return QUESTION_TYPE_LABELS[key] ?? "Trắc nghiệm";
}

export function isFillInBlankType(type: string | null | undefined): boolean {
  return FILL_IN_BLANK_TYPES.has((type ?? "").trim().toLowerCase());
}

export function isMultipleAnswerType(type: string | null | undefined): boolean {
  return MULTIPLE_ANSWER_TYPES.has((type ?? "").trim().toLowerCase());
}

/** Đếm số chỗ trống trong nội dung câu hỏi (mỗi chỗ trống là 2+ dấu gạch dưới). */
export function countQuestionBlanks(content: string | null | undefined): number {
  const matches = (content ?? "").match(BLANK_MARKER_PATTERN);
  return matches ? matches.length : 0;
}

/** Số ô trả lời của câu điền chỗ trống (tối thiểu 1 khi không có ký hiệu chỗ trống). */
export function getFillInBlankCount(content: string | null | undefined): number {
  return Math.max(countQuestionBlanks(content), 1);
}

/** Tách đáp án điền chỗ trống đã lưu (phân tách bằng dấu |) thành từng chỗ trống. */
export function parseFillInBlankAnswers(answer: string | null | undefined): string[] {
  const parts = (answer ?? "").split("|").map((part) => part.trim());
  while (parts.length > 0 && parts[parts.length - 1] === "") {
    parts.pop();
  }
  return parts;
}

/**
 * Các cách viết được chấp nhận cho MỘT chỗ trống (phân tách bằng dấu ~).
 * Đáp án không dùng dấu ~ vẫn cho đúng một cách viết như trước.
 */
export function splitBlankAlternatives(
  blankAnswer: string | null | undefined,
): string[] {
  const alternatives: string[] = [];
  for (const part of (blankAnswer ?? "").split(BLANK_ALTERNATIVE_SEPARATOR)) {
    const candidate = part.trim();
    if (candidate && !alternatives.includes(candidate)) {
      alternatives.push(candidate);
    }
  }
  return alternatives;
}

/** Các cách viết được chấp nhận cho TỪNG chỗ trống của câu điền chỗ trống. */
export function getBlankAlternatives(
  answer: string | null | undefined,
): string[][] {
  return parseFillInBlankAnswers(answer).map(splitBlankAlternatives);
}

/** Hiển thị đáp án điền chỗ trống, gộp các cách viết thay thế thành "a (hoặc b)". */
export function formatBlankAnswers(answer: string | null | undefined): string {
  return getBlankAlternatives(answer)
    .map((alternatives) =>
      alternatives.length > 1
        ? `${alternatives[0]} (hoặc ${alternatives.slice(1).join(", ")})`
        : alternatives[0] ?? "",
    )
    .filter((text) => text !== "")
    .join(" • ");
}

/** Chuẩn hoá văn bản đáp án để so khớp (bỏ khoảng trắng thừa, không phân biệt hoa thường). */
export function normalizeAnswerText(value: string | null | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim().toLowerCase();
}

export function getCorrectOptionIds(options?: ExamOption[]): number[] {
  return (options ?? [])
    .filter((option) => option.is_correct)
    .map((option) => option.id)
    .sort((left, right) => left - right);
}

/** Lấy giá trị hiện tại của từng chỗ trống, đã căn đúng số lượng chỗ trống. */
export function getBlankValues(
  question: Pick<ExamQuestion, "content">,
  selection?: ExamAnswerSelection,
): string[] {
  const blankCount = getFillInBlankCount(question.content);
  const currentValues = selection?.kind === "blanks" ? selection.values : [];
  return Array.from(
    { length: blankCount },
    (_, index) => currentValues[index] ?? "",
  );
}

/** Sinh viên đã trả lời câu hỏi này chưa? */
export function isSelectionProvided(
  question: ExamQuestion,
  selection?: ExamAnswerSelection,
): boolean {
  if (!selection) {
    return false;
  }

  if (isFillInBlankType(question.question_type)) {
    if (selection.kind !== "blanks") {
      return false;
    }
    return getBlankValues(question, selection).every(
      (value) => value.trim() !== "",
    );
  }

  if (isMultipleAnswerType(question.question_type)) {
    return selection.kind === "multiple" && selection.optionIds.length > 0;
  }

  return selection.kind === "single" && selection.optionId > 0;
}

/** Câu trả lời của sinh viên có đúng hoàn toàn không? */
export function isSelectionCorrect(
  question: ExamQuestion,
  selection?: ExamAnswerSelection,
): boolean {
  if (!selection) {
    return false;
  }

  if (isFillInBlankType(question.question_type)) {
    if (selection.kind !== "blanks") {
      return false;
    }
    const expectedBlanks = getBlankAlternatives(question.answer);
    if (expectedBlanks.length === 0) {
      return false;
    }
    // Đúng khi MỌI chỗ trống khớp một trong các cách viết được chấp nhận.
    return expectedBlanks.every((alternatives, index) => {
      const given = normalizeAnswerText(selection.values[index] ?? "");
      if (!given) {
        return false;
      }
      return alternatives.some(
        (alternative) => normalizeAnswerText(alternative) === given,
      );
    });
  }

  if (isMultipleAnswerType(question.question_type)) {
    if (selection.kind !== "multiple") {
      return false;
    }
    const correctOptionIds = getCorrectOptionIds(question.options);
    if (correctOptionIds.length === 0) {
      return false;
    }
    const selectedOptionIds = [...selection.optionIds].sort(
      (left, right) => left - right,
    );
    if (selectedOptionIds.length !== correctOptionIds.length) {
      return false;
    }
    return correctOptionIds.every(
      (optionId, index) => selectedOptionIds[index] === optionId,
    );
  }

  const correctOption = question.options?.find((option) => option.is_correct);
  if (correctOption) {
    return selection.kind === "single" && selection.optionId === correctOption.id;
  }

  if (selection.kind !== "single") {
    return false;
  }

  return (
    normalizeAnswerText(selection.content) ===
    normalizeAnswerText(question.answer)
  );
}

/**
 * Dựng câu trả lời gửi lên backend.
 *
 * Gửi kèm nội dung trả lời thật (`answer_text`/`option_ids`) để backend tự
 * chấm; `is_correct` chỉ còn là gợi ý cho client cũ và chế độ mock.
 */
export function buildAnswerPayload(
  question: ExamQuestion,
  selection?: ExamAnswerSelection,
): AnswerItem {
  const isCorrect = isSelectionCorrect(question, selection);

  if (isFillInBlankType(question.question_type)) {
    const values = getBlankValues(question, selection);
    return {
      question_id: question.id,
      is_correct: isCorrect,
      answer_text: values.join(" | "),
    };
  }

  if (selection?.kind === "multiple") {
    return {
      question_id: question.id,
      is_correct: isCorrect,
      option_ids: [...selection.optionIds],
    };
  }

  if (selection?.kind === "single") {
    return {
      question_id: question.id,
      is_correct: isCorrect,
      option_ids: [selection.optionId],
    };
  }

  return { question_id: question.id, is_correct: isCorrect };
}

type FastApiError = {
  detail?: string;
};

type MockQuestionTemplate = {
  sequence: number;
  content: string;
  question_type: string;
  score: number;
  answer: string;
  bloom_level: string;
  topic?: string;
  difficulty: string;
  options: Array<{
    content: string;
    is_correct: boolean;
  }>;
};

export type BloomAnalysisItem = {
  level: string;
  correct: number;
  total: number;
  score: number;
};

export type BloomAnalysisResult = {
  exam_id: number;
  exam_title: string;
  breakdown: BloomAnalysisItem[];
  overall_score: number;
};

export type BloomAnalysisResponse = {
  results: BloomAnalysisResult[];
};

export type InstructorBloomItem = {
  level: string;
  correct: number;
  total: number;
  score: number;
};

export type InstructorBloomCourseDetail = {
  course_id: number;
  course_title: string;
  breakdown: InstructorBloomItem[];
  overall_score: number;
  total_students: number;
};

export type InstructorBloomResponse = {
  total_exam_results: number;
  total_students: number;
  courses: InstructorBloomCourseDetail[];
};

const endpoints = {
  examById: (examId: number) => `${API_BASE_URL}/exam/${examId}`,
  questionsByExam: (examId: number) => `${API_BASE_URL}/question/exam/${examId}`,
  optionsByQuestion: (questionId: number) => `${API_BASE_URL}/option/question/${questionId}`,
  submitExamResult: `${API_BASE_URL}/exam_result/submit`,
  resultsByUser: (userId: number) => `${API_BASE_URL}/exam_result/user/${userId}`,
  bloomAnalysisByUser: (userId: number) => `${API_BASE_URL}/exam_result/bloom-analysis/${userId}`,
  bloomAnalysisByInstructor: (instructorId: number) => `${API_BASE_URL}/exam_result/bloom-analysis/instructor/${instructorId}`,
};

const mockExamTemplate: Omit<Exam, "id"> = {
  title: "Bài kiểm tra mô phỏng",
  description:
    "Đây là bài kiểm tra mô phỏng để sinh viên luyện tập và lưu kết quả về hệ thống.",
  module_id: 1,
  course_id: 1,
  duration_minutes: 20,
  total_questions: 6,
  is_active: true,
  pass_score: 50,
  max_score: 100,
  question_distribution_mode: "bloom",
  question_distribution: JSON.stringify([
    { key: "remember", weight: 50 },
    { key: "understand", weight: 50 },
  ]),
};

const mockQuestionTemplates: MockQuestionTemplate[] = [
  {
    sequence: 1,
    content:
      "Ngôn ngữ lập trình nào sau đây thường được dùng để xây dựng giao diện web phía client?",
    question_type: "multiple_choice",
    score: 20,
    answer: "JavaScript",
    bloom_level: "remember",
    topic: "JavaScript",
    difficulty: "easy",
    options: [
      { content: "Java", is_correct: false },
      { content: "Python", is_correct: false },
      { content: "JavaScript", is_correct: true },
      { content: "SQL", is_correct: false },
    ],
  },
  {
    sequence: 2,
    content: "Thuộc tính nào của HTML dùng để gán lớp cho phần tử?",
    question_type: "multiple_choice",
    score: 20,
    answer: "class",
    bloom_level: "remember",
    topic: "HTML",
    difficulty: "easy",
    options: [
      { content: "id", is_correct: false },
      { content: "style", is_correct: false },
      { content: "class", is_correct: true },
      { content: "href", is_correct: false },
    ],
  },
  {
    sequence: 3,
    content:
      "Trong Next.js, thành phần nào dùng để chuyển hướng điều hướng trong client?",
    question_type: "multiple_choice",
    score: 20,
    answer: "useRouter",
    bloom_level: "understand",
    topic: "Next.js",
    difficulty: "medium",
    options: [
      { content: "useState", is_correct: false },
      { content: "useEffect", is_correct: false },
      { content: "useRouter", is_correct: true },
      { content: "useCallback", is_correct: false },
    ],
  },
  {
    sequence: 4,
    content:
      "Khi gửi dữ liệu lên FastAPI, phương thức HTTP nào thường dùng để tạo mới tài nguyên?",
    question_type: "multiple_choice",
    score: 20,
    answer: "POST",
    bloom_level: "understand",
    topic: "FastAPI",
    difficulty: "medium",
    options: [
      { content: "GET", is_correct: false },
      { content: "POST", is_correct: true },
      { content: "PUT", is_correct: false },
      { content: "DELETE", is_correct: false },
    ],
  },
  {
    sequence: 5,
    content:
      "Những ngôn ngữ nào sau đây là ngôn ngữ lập trình bậc cao?",
    question_type: "multiple_answer",
    score: 10,
    answer: "Java | Python",
    bloom_level: "understand",
    topic: "Ngôn ngữ lập trình",
    difficulty: "medium",
    options: [
      { content: "Java", is_correct: true },
      { content: "HTML", is_correct: false },
      { content: "Python", is_correct: true },
      { content: "CSS", is_correct: false },
    ],
  },
  {
    sequence: 6,
    content:
      "Trong React, hook ___ dùng để quản lý trạng thái của component.",
    question_type: "fill_in_blank",
    score: 10,
    // Nhiều cách viết được chấp nhận cho cùng một chỗ trống: phân tách bằng dấu ~
    answer: "useState ~ useState()",
    bloom_level: "remember",
    topic: "React",
    difficulty: "easy",
    options: [],
  },
];

let mockExamResults: ExamResult[] = [
  {
    id: 1,
    user_id: 1,
    exam_id: 301,
    score: 75,
    max_score: 100,
    total_questions: 4,
    correct_answers: 3,
    is_passed: true,
    submitted_at: "2026-05-02T08:15:00.000Z",
    bloom_breakdown: {
      remember: { correct: 2, total: 2, score: 100 },
      understand: { correct: 1, total: 2, score: 50 },
    },
  },
  {
    id: 2,
    user_id: 1,
    exam_id: 301,
    score: 100,
    max_score: 100,
    total_questions: 4,
    correct_answers: 4,
    is_passed: true,
    submitted_at: "2026-05-09T09:30:00.000Z",
    bloom_breakdown: {
      remember: { correct: 2, total: 2, score: 100 },
      understand: { correct: 2, total: 2, score: 100 },
    },
  },
];

function buildMockExam(examId: number): Exam {
  return {
    ...mockExamTemplate,
    id: examId,
    title: `Bài kiểm tra mô phỏng #${examId}`,
  };
}

function buildMockQuestionsForExam(examId: number): ExamQuestion[] {
  return mockQuestionTemplates.map((template) => ({
    id: examId * 10 + template.sequence,
    exam_id: examId,
    content: template.content,
    question_type: template.question_type,
    sequence: template.sequence,
    score: template.score,
    answer: template.answer,
    bloom_level: template.bloom_level,
    topic: template.topic,
    difficulty: template.difficulty,
  }));
}

function buildMockOptionsForQuestion(questionId: number): ExamOption[] {
  const sequence = questionId % 10;
  const template = mockQuestionTemplates.find(
    (question) => question.sequence === sequence,
  );

  if (!template) {
    return [];
  }

  return template.options.map((option, index) => ({
    id: questionId * 10 + index + 1,
    question_id: questionId,
    content: option.content,
    is_correct: option.is_correct,
  }));
}

async function parseError(response: Response): Promise<string> {
  try {
    const error = (await response.json()) as FastApiError;
    if (typeof error.detail === "string" && error.detail.trim()) {
      return error.detail;
    }
  } catch {
    // Bỏ qua lỗi parse JSON để dùng thông báo mặc định.
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

async function getJsonOrFallback<T>(url: string, fallbackValue: T): Promise<T> {
  const response = await fetch(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    return fallbackValue;
  }

  return (await response.json()) as T;
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

export async function getExamById(examId: number): Promise<Exam> {
  if (USE_MOCK_EXAM_DATA) {
    return buildMockExam(examId);
  }

  return getJson<Exam>(endpoints.examById(examId));
}

export async function getQuestionsByExam(examId: number): Promise<ExamQuestion[]> {
  if (USE_MOCK_EXAM_DATA) {
    return buildMockQuestionsForExam(examId);
  }

  return getJsonOrFallback<ExamQuestion[]>(endpoints.questionsByExam(examId), []);
}

export async function getOptionsByQuestion(
  questionId: number,
): Promise<ExamOption[]> {
  if (USE_MOCK_EXAM_DATA) {
    return buildMockOptionsForQuestion(questionId);
  }

  return getJsonOrFallback<ExamOption[]>(endpoints.optionsByQuestion(questionId), []);
}

export async function getExamResultsByUser(userId: number): Promise<ExamResult[]> {
  if (USE_MOCK_EXAM_DATA) {
    return mockExamResults
      .filter((result) => result.user_id === userId)
      .map((result) => ({ ...result }));
  }

  return getJsonOrFallback<ExamResult[]>(endpoints.resultsByUser(userId), []);
}

export async function getExamResultsByUserAndExam(
  userId: number,
  examId: number,
): Promise<ExamResult[]> {
  const results = await getExamResultsByUser(userId);
  return results.filter((result) => result.exam_id === examId);
}

export type AnswerItem = {
  question_id: number;
  is_correct: boolean;
  /** Nội dung sinh viên nhập (câu điền chỗ trống: các chỗ trống phân tách bằng " | "). */
  answer_text?: string;
  /** Id các phương án sinh viên chọn (câu trắc nghiệm). */
  option_ids?: number[];
};

export async function submitExamResult(
  result: Omit<ExamResult, "id"> & { answers?: AnswerItem[] },
): Promise<ExamResult> {
  if (USE_MOCK_EXAM_DATA) {
    const { answers, ...resultWithoutAnswers } = result;

    // Tính bloom_breakdown từ answers
    let bloomBreakdown: Record<string, { correct: number; total: number; score: number }> | null = null;

    if (answers && answers.length > 0) {
      const questions = buildMockQuestionsForExam(result.exam_id);
      const questionMap = new Map(questions.map((q) => [q.id, q]));

      const bloomAcc: Record<string, { correct: number; total: number }> = {};

      for (const answer of answers) {
        const q = questionMap.get(answer.question_id);
        const bLevel = q?.bloom_level ?? "remember";

        if (!bloomAcc[bLevel]) bloomAcc[bLevel] = { correct: 0, total: 0 };

        bloomAcc[bLevel].total++;
        if (answer.is_correct) {
          bloomAcc[bLevel].correct++;
        }
      }

      bloomBreakdown = {};
      for (const [level, data] of Object.entries(bloomAcc)) {
        bloomBreakdown[level] = {
          correct: data.correct,
          total: data.total,
          score: data.total > 0 ? parseFloat(((data.correct / data.total) * 100).toFixed(1)) : 0,
        };
      }
    }

    const newResult: ExamResult = {
      id: mockExamResults.length + 1,
      submitted_at: result.submitted_at ?? new Date().toISOString(),
      ...resultWithoutAnswers,
      bloom_breakdown: bloomBreakdown,
    };
    mockExamResults = [...mockExamResults, newResult];
    return newResult;
  }

  return postJson<ExamResult>(endpoints.submitExamResult, result);
}

export async function getBloomAnalysisByUser(
  userId: number,
): Promise<BloomAnalysisResponse> {
  if (USE_MOCK_EXAM_DATA) {
    const userResults = mockExamResults.filter((r) => r.user_id === userId);
    if (userResults.length === 0) return { results: [] };

    // Gom nhóm theo exam_id
    const examGroups = new Map<number, ExamResult[]>();
    for (const r of userResults) {
      const group = examGroups.get(r.exam_id) ?? [];
      group.push(r);
      examGroups.set(r.exam_id, group);
    }

    const results: BloomAnalysisResult[] = [];
    for (const [examId, examResults] of examGroups) {
      const exam = buildMockExam(examId);

      // Tổng hợp bloom_breakdown qua các lần thi
      const combined: Record<string, { correct: number; total: number }> = {};
      for (const r of examResults) {
        if (!r.bloom_breakdown) continue;
        for (const [level, data] of Object.entries(r.bloom_breakdown)) {
          if (!combined[level]) combined[level] = { correct: 0, total: 0 };
          combined[level].correct += data.correct;
          combined[level].total += data.total;
        }
      }

      if (Object.keys(combined).length === 0) continue;

      const totalAll = Object.values(combined).reduce((s, v) => s + v.total, 0);
      const correctAll = Object.values(combined).reduce((s, v) => s + v.correct, 0);
      const overallScore =
        totalAll > 0 ? parseFloat(((correctAll / totalAll) * 100).toFixed(1)) : 0;

      const breakdown: BloomAnalysisItem[] = Object.entries(combined)
        .map(([level, data]) => ({
          level,
          correct: data.correct,
          total: data.total,
          score:
            data.total > 0
              ? parseFloat(((data.correct / data.total) * 100).toFixed(1))
              : 0,
        }))
        .sort((a, b) => a.level.localeCompare(b.level));

      results.push({
        exam_id: examId,
        exam_title: exam.title,
        breakdown,
        overall_score: overallScore,
      });
    }

    return { results };
  }

  return getJson<BloomAnalysisResponse>(endpoints.bloomAnalysisByUser(userId));
}

export async function getBloomAnalysisByInstructor(
  instructorId: number,
): Promise<InstructorBloomResponse> {
  if (USE_MOCK_EXAM_DATA) {
    if (mockExamResults.length === 0) {
      return { total_exam_results: 0, total_students: 0, courses: [] };
    }

    // Gom nhóm kết quả theo course_id thông qua exam
    // (trong mock data tất cả exam đều thuộc course_id=1)
    const examCourseMap = new Map<number, number>();
    const uniqueExams = new Set(mockExamResults.map((r) => r.exam_id));
    for (const examId of uniqueExams) {
      const exam = buildMockExam(examId);
      examCourseMap.set(examId, exam.course_id ?? 0);
    }

    // Nhóm exam_results theo course
    const courseResults = new Map<number, ExamResult[]>();
    for (const r of mockExamResults) {
      const courseId = examCourseMap.get(r.exam_id) ?? 0;
      const group = courseResults.get(courseId) ?? [];
      group.push(r);
      courseResults.set(courseId, group);
    }

    const courseDetails: InstructorBloomCourseDetail[] = [];
    let totalExamResults = 0;
    const allUniqueStudents = new Set<number>();

    for (const [courseId, results] of courseResults) {
      totalExamResults += results.length;

      // Tổng hợp bloom_breakdown
      const combined: Record<string, { correct: number; total: number }> = {};
      const students = new Set<number>();

      for (const r of results) {
        students.add(r.user_id);
        allUniqueStudents.add(r.user_id);
        if (!r.bloom_breakdown) continue;
        for (const [level, data] of Object.entries(r.bloom_breakdown)) {
          if (!combined[level]) combined[level] = { correct: 0, total: 0 };
          combined[level].correct += data.correct;
          combined[level].total += data.total;
        }
      }

      if (Object.keys(combined).length === 0) continue;

      const totalAll = Object.values(combined).reduce((s, v) => s + v.total, 0);
      const correctAll = Object.values(combined).reduce((s, v) => s + v.correct, 0);
      const overallScore =
        totalAll > 0 ? parseFloat(((correctAll / totalAll) * 100).toFixed(1)) : 0;

      const breakdown: InstructorBloomItem[] = Object.entries(combined)
        .map(([level, data]) => ({
          level,
          correct: data.correct,
          total: data.total,
          score:
            data.total > 0
              ? parseFloat(((data.correct / data.total) * 100).toFixed(1))
              : 0,
        }))
        .sort((a, b) => a.level.localeCompare(b.level));

      courseDetails.push({
        course_id: courseId,
        course_title:
          courseId === 1
            ? "Khóa học mô phỏng"
            : `Khóa học #${courseId}`,
        breakdown,
        overall_score: overallScore,
        total_students: students.size,
      });
    }

    return {
      total_exam_results: totalExamResults,
      total_students: allUniqueStudents.size,
      courses: courseDetails,
    };
  }

  return getJson<InstructorBloomResponse>(
    endpoints.bloomAnalysisByInstructor(instructorId),
  );
}

function getLevelLabel(level: string): string {
  const labels: Record<string, string> = {
    remember: "Nhận biết",
    understand: "Thông hiểu",
    apply: "Vận dụng",
    analyze: "Phân tích",
    evaluate: "Đánh giá",
    create: "Sáng tạo",
  };
  return labels[level] ?? level;
}

function getLevelColor(level: string): string {
  const colors: Record<string, string> = {
    remember: "#06b6d4",
    understand: "#22c55e",
    apply: "#f59e0b",
    analyze: "#f97316",
    evaluate: "#ef4444",
    create: "#8b5cf6",
  };
  return colors[level] ?? "#64748b";
}

export async function deleteExam(examId: number): Promise<{ message: string }> {
  if (USE_MOCK_EXAM_DATA) {
    return Promise.resolve({ message: "Đã xóa bài kiểm tra" });
  }
  const response = await fetch(`${API_BASE_URL}/exam/delete/${examId}`, {
    method: "DELETE",
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data?.detail ?? "Không thể xóa bài kiểm tra");
  }
  return response.json();
}

export { getLevelLabel, getLevelColor };

/**
 * Fisher-Yates shuffle – trả về mảng mới đã xáo trộn.
 */
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Chọn một tập con câu hỏi từ bộ câu hỏi lớn dựa trên tỷ lệ mức độ nhận thức
 * (Bloom) của toàn bộ bộ câu hỏi.
 *
 * Chiến lược:
 * 1. Đếm số lượng câu hỏi theo từng mức độ Bloom
 * 2. Tính tỷ lệ phần trăm mỗi mức độ so với tổng số
 * 3. Phân bổ số lượng cần chọn (targetCount) theo tỷ lệ đó
 * 4. Chọn ngẫu nhiên từ mỗi mức độ
 * 5. Xáo trộn kết quả cuối cùng
 */
export function selectQuestionsByProportions<
  T extends { bloom_level?: string | null },
>(
  allQuestions: T[],
  targetCount: number,
): { selected: T[]; stats: { key: string; pool: number; taken: number }[] } {
  if (targetCount <= 0 || allQuestions.length === 0) {
    return { selected: [], stats: [] };
  }

  if (targetCount >= allQuestions.length) {
    return {
      selected: shuffleArray(allQuestions),
      stats: [{ key: "all", pool: allQuestions.length, taken: allQuestions.length }],
    };
  }

  // Bước 1: Nhóm câu hỏi theo mức độ Bloom
  const groups = new Map<string, T[]>();
  for (const q of allQuestions) {
    const key = q.bloom_level ?? "remember";
    const group = groups.get(key);
    if (group) {
      group.push(q);
    } else {
      groups.set(key, [q]);
    }
  }

  const totalPool = allQuestions.length;

  // Bước 2 & 3: Phân bổ số lượng cần chọn cho mỗi nhóm theo phương pháp
  // "số dư lớn nhất" (largest remainder): lấy phần nguyên trước, rồi phát
  // số còn thiếu cho nhóm có phần thập phân lớn nhất để luôn đủ targetCount.
  const allocations = new Map<string, number>();
  const remainders: { key: string; fraction: number; capacity: number }[] = [];
  let allocatedTotal = 0;

  for (const [key, group] of groups) {
    const exact = (group.length * targetCount) / totalPool;
    const base = Math.min(Math.floor(exact), group.length);
    allocations.set(key, base);
    allocatedTotal += base;
    remainders.push({
      key,
      fraction: exact - base,
      capacity: group.length - base,
    });
  }

  // Phát phần còn thiếu cho các nhóm có phần thập phân lớn nhất
  let remainder = targetCount - allocatedTotal;
  remainders.sort((left, right) => right.fraction - left.fraction);
  for (const item of remainders) {
    if (remainder <= 0) break;
    if (item.capacity <= 0) continue;
    allocations.set(item.key, (allocations.get(item.key) ?? 0) + 1);
    remainder -= 1;
  }

  // Nếu vẫn còn thiếu (một số nhóm đã chạm giới hạn), lấy bổ sung từ các
  // nhóm còn dư, ưu tiên nhóm có số dư nhiều nhất.
  if (remainder > 0) {
    const spareGroups = [...groups.entries()]
      .map(([key, group]) => ({
        key,
        remaining: group.length - (allocations.get(key) ?? 0),
      }))
      .filter((item) => item.remaining > 0)
      .sort((left, right) => right.remaining - left.remaining);

    for (const item of spareGroups) {
      if (remainder <= 0) break;
      const take = Math.min(remainder, item.remaining);
      allocations.set(item.key, (allocations.get(item.key) ?? 0) + take);
      remainder -= take;
    }
  }

  // Bước 4: Chọn ngẫu nhiên từ mỗi nhóm
  const selected: T[] = [];
  const stats: { key: string; pool: number; taken: number }[] = [];

  for (const [key, group] of groups) {
    const take = allocations.get(key) ?? 0;
    if (take <= 0) continue;

    const shuffled = shuffleArray(group);
    const picked = shuffled.slice(0, take);
    selected.push(...picked);
    stats.push({ key, pool: group.length, taken: take });
  }

  // Bước 5: Xáo trộn kết quả cuối
  return { selected: shuffleArray(selected), stats };
}

/** Thứ tự hiển thị chuẩn của các mức độ nhận thức (Bloom). */
export const EXAM_BLOOM_LEVELS = [
  "remember",
  "understand",
  "apply",
  "analyze",
  "evaluate",
  "create",
] as const;

/** Nhãn hiển thị của cách chia cấu trúc câu hỏi. */
export function getExamDistributionModeLabel(
  mode: string | null | undefined,
): string {
  const normalized = parseExamDistributionMode(mode);
  if (normalized === "bloom") {
    return "Theo mức độ nhận thức";
  }
  if (normalized === "topic") {
    return "Theo chủ đề/từ khóa";
  }
  return "Không chia cấu trúc";
}

export function parseExamDistributionMode(
  value?: string | null,
): ExamDistributionMode {
  const normalized = (value ?? "").trim().toLowerCase();
  return normalized === "bloom" || normalized === "topic" ? normalized : "none";
}

/** Đọc JSON cấu trúc tỷ lệ đã lưu; bỏ qua dữ liệu hỏng thay vì làm sập trang. */
export function parseExamDistribution(
  raw?: string | null,
): ExamQuestionDistributionItem[] {
  if (!raw) {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    const items: ExamQuestionDistributionItem[] = [];
    const seen = new Set<string>();
    for (const entry of parsed) {
      if (!entry || typeof entry !== "object") {
        continue;
      }
      const record = entry as { key?: unknown; weight?: unknown };
      const key = String(record.key ?? "").replace(/\s+/g, " ").trim();
      const weight = Number(record.weight);
      if (!key || !Number.isFinite(weight) || weight < 0) {
        continue;
      }
      const dedupeKey = key.toLowerCase();
      if (seen.has(dedupeKey)) {
        continue;
      }
      seen.add(dedupeKey);
      items.push({ key, weight });
    }
    return items;
  } catch {
    return [];
  }
}

/** Chuyển cấu trúc tỷ lệ thành JSON để gửi lên máy chủ (bỏ dòng tỷ lệ 0). */
export function serializeExamDistribution(
  items: ExamQuestionDistributionItem[],
): string | null {
  const cleaned = items
    .map((item) => ({
      key: item.key.replace(/\s+/g, " ").trim(),
      weight: Number(item.weight),
    }))
    .filter(
      (item) => item.key !== "" && Number.isFinite(item.weight) && item.weight > 0,
    );

  return cleaned.length > 0 ? JSON.stringify(cleaned) : null;
}

/** Kiểm tra cấu trúc tỷ lệ trước khi lưu. Trả về thông báo lỗi hoặc "". */
export function validateExamDistribution(
  mode: string | null | undefined,
  items: ExamQuestionDistributionItem[],
): string {
  const normalizedMode = parseExamDistributionMode(mode);
  if (normalizedMode === "none") {
    return "";
  }

  if (items.length === 0) {
    return "Vui lòng thêm ít nhất một dòng tỷ lệ cho cấu trúc câu hỏi.";
  }

  const seen = new Set<string>();
  let totalWeight = 0;

  for (const item of items) {
    const key = item.key.replace(/\s+/g, " ").trim();
    if (!key) {
      return normalizedMode === "bloom"
        ? "Vui lòng chọn mức độ nhận thức cho mỗi dòng tỷ lệ."
        : "Chủ đề/từ khóa của mỗi dòng tỷ lệ không được để trống.";
    }

    if (
      normalizedMode === "bloom" &&
      !EXAM_BLOOM_LEVELS.includes(
        key.toLowerCase() as (typeof EXAM_BLOOM_LEVELS)[number],
      )
    ) {
      return `Mức độ nhận thức không hợp lệ: ${key}.`;
    }

    if (!Number.isFinite(item.weight) || item.weight < 0) {
      return "Tỷ lệ câu hỏi phải là số không âm.";
    }

    const dedupeKey = key.toLowerCase();
    if (seen.has(dedupeKey)) {
      return "Một mức độ nhận thức/chủ đề không được xuất hiện nhiều lần.";
    }
    seen.add(dedupeKey);
    totalWeight += item.weight;
  }

  if (totalWeight <= 0) {
    return "Tổng tỷ lệ câu hỏi phải lớn hơn 0.";
  }

  return "";
}

type DistributionSelectable = {
  bloom_level?: string | null;
  topic?: string | null;
};

function normalizeDistributionKey(value: string | null | undefined): string {
  return String(value ?? "").replace(/\s+/g, " ").trim().toLowerCase();
}

/**
 * Chọn câu hỏi cho một lượt làm bài theo cấu trúc tỷ lệ của bài kiểm tra.
 *
 * - `bloom`: chia nhóm theo `bloom_level` của câu hỏi.
 * - `topic`: chia nhóm theo `topic` (không phân biệt hoa thường, bỏ khoảng trắng thừa).
 * - Không cấu hình (hoặc dữ liệu hỏng): giữ cách chọn tự động theo tỷ lệ Bloom
 *   của toàn bộ kho câu hỏi như trước.
 *
 * Khi một nhóm không đủ câu, phần thiếu được bù từ các nhóm còn dư để vẫn đủ
 * số lượng câu hỏi của bài kiểm tra; `filledFromOtherGroups` cho biết đã bù
 * bao nhiêu câu như vậy.
 */
export function selectExamQuestionSubset<T extends DistributionSelectable>(
  pool: T[],
  targetCount: number,
  mode?: string | null,
  rawDistribution?: string | null,
): { selected: T[]; configured: boolean; filledFromOtherGroups: number } {
  const parsedMode = parseExamDistributionMode(mode);
  const distribution = parseExamDistribution(rawDistribution).filter(
    (item) => item.weight > 0,
  );

  if (
    parsedMode === "none" ||
    distribution.length === 0 ||
    targetCount <= 0 ||
    pool.length === 0
  ) {
    return {
      selected: selectQuestionsByProportions(pool, targetCount).selected,
      configured: false,
      filledFromOtherGroups: 0,
    };
  }

  if (targetCount >= pool.length) {
    return {
      selected: shuffleArray(pool),
      configured: true,
      filledFromOtherGroups: 0,
    };
  }

  const groups = new Map<string, T[]>();
  for (const question of pool) {
    const key =
      parsedMode === "bloom"
        ? normalizeDistributionKey(question.bloom_level || "remember")
        : normalizeDistributionKey(question.topic);
    const group = groups.get(key);
    if (group) {
      group.push(question);
    } else {
      groups.set(key, [question]);
    }
  }

  const totalWeight = distribution.reduce(
    (sum, item) => sum + item.weight,
    0,
  );
  const allocations = new Map<string, number>();
  const remainders: { key: string; fraction: number; capacity: number }[] = [];
  let allocatedTotal = 0;

  for (const item of distribution) {
    const key = normalizeDistributionKey(item.key);
    const capacity = groups.get(key)?.length ?? 0;
    const exact = (item.weight / totalWeight) * targetCount;
    const base = Math.min(Math.floor(exact), capacity);
    allocations.set(key, base);
    allocatedTotal += base;
    remainders.push({
      key,
      fraction: exact - Math.floor(exact),
      capacity: capacity - base,
    });
  }

  let remainder = targetCount - allocatedTotal;

  remainders.sort((left, right) => right.fraction - left.fraction);
  for (const item of remainders) {
    if (remainder <= 0) break;
    // Chỉ chia phần dư khi nhóm thực sự bị lẻ; nhóm đã tròn quota thì không
    // lấy thêm, để phần thiếu được bù từ nhóm khác theo đúng cấu trúc.
    if (item.capacity <= 0 || item.fraction <= 0) continue;
    allocations.set(item.key, (allocations.get(item.key) ?? 0) + 1);
    remainder -= 1;
  }

  const filledFromOtherGroups = Math.max(0, remainder);

  if (remainder > 0) {
    const spareGroups = [...groups.entries()]
      .map(([key, group]) => ({
        key,
        remaining: group.length - (allocations.get(key) ?? 0),
      }))
      .filter((item) => item.remaining > 0)
      .sort(
        (left, right) =>
          right.remaining - left.remaining || left.key.localeCompare(right.key),
      );

    for (const item of spareGroups) {
      if (remainder <= 0) break;
      const take = Math.min(remainder, item.remaining);
      allocations.set(item.key, (allocations.get(item.key) ?? 0) + take);
      remainder -= take;
    }
  }

  const selected: T[] = [];
  for (const [key, group] of groups) {
    const take = allocations.get(key) ?? 0;
    if (take <= 0) continue;
    selected.push(...shuffleArray(group).slice(0, take));
  }

  return {
    selected: shuffleArray(selected),
    configured: true,
    filledFromOtherGroups,
  };
}

/**
 * Xáo trộn thứ tự câu hỏi cho một lượt làm bài và đánh số lại `sequence`
 * thành 1..N theo đúng thứ tự mới. Chỉ áp dụng ở frontend cho lượt làm
 * hiện tại, không thay đổi dữ liệu trên máy chủ.
 */
export function shuffleExamQuestions(questions: ExamQuestion[]): ExamQuestion[] {
  return shuffleArray(questions).map((question, index) => ({
    ...question,
    sequence: index + 1,
  }));
}

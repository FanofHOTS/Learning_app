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
  is_active: boolean;
  pass_score: number;
  max_score: number;
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
  difficulty?: string;
  options?: ExamOption[];
};

export type ExamResult = {
  id: number;
  user_id: number;
  exam_id: number;
  score: number;
  total_questions: number;
  correct_answers: number;
  is_passed: boolean;
  submitted_at?: string | null;
  bloom_breakdown?: Record<string, { correct: number; total: number; score: number }> | null;
  difficulty_breakdown?: Record<string, { correct: number; total: number; score: number }> | null;
};

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

export type DifficultyAnalysisItem = {
  level: string;
  correct: number;
  total: number;
  score: number;
};

export type DifficultyAnalysisResult = {
  exam_id: number;
  exam_title: string;
  breakdown: DifficultyAnalysisItem[];
  overall_score: number;
};

export type DifficultyAnalysisResponse = {
  results: DifficultyAnalysisResult[];
};

const endpoints = {
  examById: (examId: number) => `${API_BASE_URL}/exam/${examId}`,
  questionsByExam: (examId: number) => `${API_BASE_URL}/question/exam/${examId}`,
  optionsByQuestion: (questionId: number) => `${API_BASE_URL}/option/question/${questionId}`,
  submitExamResult: `${API_BASE_URL}/exam_result/submit`,
  resultsByUser: (userId: number) => `${API_BASE_URL}/exam_result/user/${userId}`,
  bloomAnalysisByUser: (userId: number) => `${API_BASE_URL}/exam_result/bloom-analysis/${userId}`,
  bloomAnalysisByInstructor: (instructorId: number) => `${API_BASE_URL}/exam_result/bloom-analysis/instructor/${instructorId}`,
  difficultyAnalysisByUser: (userId: number) => `${API_BASE_URL}/exam_result/difficulty-analysis/${userId}`,
  difficultyAnalysisByInstructor: (instructorId: number) => `${API_BASE_URL}/exam_result/difficulty-analysis/instructor/${instructorId}`,
};

const mockExamTemplate: Omit<Exam, "id"> = {
  title: "Bài kiểm tra mô phỏng",
  description:
    "Đây là bài kiểm tra mô phỏng để sinh viên luyện tập và lưu kết quả về hệ thống.",
  module_id: 1,
  course_id: 1,
  duration_minutes: 20,
  total_questions: 4,
  is_active: true,
  pass_score: 50,
  max_score: 100,
};

const mockQuestionTemplates: MockQuestionTemplate[] = [
  {
    sequence: 1,
    content:
      "Ngôn ngữ lập trình nào sau đây thường được dùng để xây dựng giao diện web phía client?",
    question_type: "multiple_choice",
    score: 25,
    answer: "JavaScript",
    bloom_level: "remember",
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
    score: 25,
    answer: "class",
    bloom_level: "remember",
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
    score: 25,
    answer: "useRouter",
    bloom_level: "understand",
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
    score: 25,
    answer: "POST",
    bloom_level: "understand",
    difficulty: "medium",
    options: [
      { content: "GET", is_correct: false },
      { content: "POST", is_correct: true },
      { content: "PUT", is_correct: false },
      { content: "DELETE", is_correct: false },
    ],
  },
];

let mockExamResults: ExamResult[] = [
  {
    id: 1,
    user_id: 1,
    exam_id: 301,
    score: 75,
    total_questions: 4,
    correct_answers: 3,
    is_passed: true,
    submitted_at: "2026-05-02T08:15:00.000Z",
  },
  {
    id: 2,
    user_id: 1,
    exam_id: 301,
    score: 100,
    total_questions: 4,
    correct_answers: 4,
    is_passed: true,
    submitted_at: "2026-05-09T09:30:00.000Z",
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

export function isUsingMockExamData(): boolean {
  return USE_MOCK_EXAM_DATA;
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

export async function submitExamResult(
  result: Omit<ExamResult, "id">,
): Promise<ExamResult> {
  if (USE_MOCK_EXAM_DATA) {
    const newResult: ExamResult = {
      id: mockExamResults.length + 1,
      submitted_at: result.submitted_at ?? new Date().toISOString(),
      ...result,
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
    return { results: [] };
  }

  return getJson<BloomAnalysisResponse>(endpoints.bloomAnalysisByUser(userId));
}

export async function getDifficultyAnalysisByUser(
  userId: number,
): Promise<DifficultyAnalysisResponse> {
  if (USE_MOCK_EXAM_DATA) {
    return { results: [] };
  }

  return getJson<DifficultyAnalysisResponse>(endpoints.difficultyAnalysisByUser(userId));
}

export async function getBloomAnalysisByInstructor(
  instructorId: number,
): Promise<InstructorBloomResponse> {
  if (USE_MOCK_EXAM_DATA) {
    return { total_exam_results: 0, total_students: 0, courses: [] };
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

function getDifficultyLabel(difficulty: string): string {
  const labels: Record<string, string> = {
    easy: "Dễ",
    medium: "Trung bình",
    hard: "Khó",
  };
  return labels[difficulty] ?? difficulty;
}

function getDifficultyColor(difficulty: string): string {
  const colors: Record<string, string> = {
    easy: "#22c55e",
    medium: "#f59e0b",
    hard: "#ef4444",
  };
  return colors[difficulty] ?? "#64748b";
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

export { getLevelLabel, getLevelColor, getDifficultyLabel, getDifficultyColor };

export async function createRandomPassingExamResult(params: {
  userId: number;
  examId: number;
}): Promise<ExamResult> {
  const [exam, questions] = await Promise.all([
    getExamById(params.examId),
    getQuestionsByExam(params.examId),
  ]);

  const totalQuestions = questions.length || exam.total_questions || 1;
  const totalScore =
    questions.reduce((sum, question) => sum + question.score, 0) || exam.max_score;
  const averageQuestionScore = Math.max(1, Math.round(totalScore / totalQuestions));
  const minimumPassingScore =
    Math.ceil(exam.pass_score / averageQuestionScore) * averageQuestionScore;

  const possibleScores: number[] = [];
  for (
    let score = minimumPassingScore;
    score <= exam.max_score;
    score += averageQuestionScore
  ) {
    possibleScores.push(score);
  }

  if (possibleScores.length === 0) {
    possibleScores.push(exam.pass_score);
  }

  const randomScore =
    possibleScores[Math.floor(Math.random() * possibleScores.length)] ??
    exam.pass_score;
  const cappedScore = Math.min(exam.max_score, Math.max(exam.pass_score, randomScore));
  const correctAnswers = Math.min(
    totalQuestions,
    Math.max(1, Math.round(cappedScore / averageQuestionScore)),
  );

  return submitExamResult({
    user_id: params.userId,
    exam_id: params.examId,
    score: cappedScore,
    total_questions: totalQuestions,
    correct_answers: correctAnswers,
    is_passed: true,
    submitted_at: new Date().toISOString(),
  });
}

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
  max_score: number;
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
    max_score: 100,
    total_questions: 4,
    correct_answers: 3,
    is_passed: true,
    submitted_at: "2026-05-02T08:15:00.000Z",
    bloom_breakdown: {
      remember: { correct: 2, total: 2, score: 100 },
      understand: { correct: 1, total: 2, score: 50 },
    },
    difficulty_breakdown: {
      easy: { correct: 2, total: 2, score: 100 },
      medium: { correct: 1, total: 2, score: 50 },
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
    difficulty_breakdown: {
      easy: { correct: 2, total: 2, score: 100 },
      medium: { correct: 2, total: 2, score: 100 },
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

export type AnswerItem = {
  question_id: number;
  is_correct: boolean;
};

export async function submitExamResult(
  result: Omit<ExamResult, "id"> & { answers?: AnswerItem[] },
): Promise<ExamResult> {
  if (USE_MOCK_EXAM_DATA) {
    const { answers, ...resultWithoutAnswers } = result;

    // Tính bloom_breakdown và difficulty_breakdown từ answers
    let bloomBreakdown: Record<string, { correct: number; total: number; score: number }> | null = null;
    let difficultyBreakdown: Record<string, { correct: number; total: number; score: number }> | null = null;

    if (answers && answers.length > 0) {
      const questions = buildMockQuestionsForExam(result.exam_id);
      const questionMap = new Map(questions.map((q) => [q.id, q]));

      const bloomAcc: Record<string, { correct: number; total: number }> = {};
      const diffAcc: Record<string, { correct: number; total: number }> = {};

      for (const answer of answers) {
        const q = questionMap.get(answer.question_id);
        const bLevel = q?.bloom_level ?? "remember";
        const dLevel = q?.difficulty ?? "medium";

        if (!bloomAcc[bLevel]) bloomAcc[bLevel] = { correct: 0, total: 0 };
        if (!diffAcc[dLevel]) diffAcc[dLevel] = { correct: 0, total: 0 };

        bloomAcc[bLevel].total++;
        diffAcc[dLevel].total++;
        if (answer.is_correct) {
          bloomAcc[bLevel].correct++;
          diffAcc[dLevel].correct++;
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

      difficultyBreakdown = {};
      for (const [level, data] of Object.entries(diffAcc)) {
        difficultyBreakdown[level] = {
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
      difficulty_breakdown: difficultyBreakdown,
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

export async function getDifficultyAnalysisByUser(
  userId: number,
): Promise<DifficultyAnalysisResponse> {
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

    const results: DifficultyAnalysisResult[] = [];
    for (const [examId, examResults] of examGroups) {
      const exam = buildMockExam(examId);

      // Tổng hợp difficulty_breakdown qua các lần thi
      const combined: Record<string, { correct: number; total: number }> = {};
      for (const r of examResults) {
        if (!r.difficulty_breakdown) continue;
        for (const [level, data] of Object.entries(r.difficulty_breakdown)) {
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

      const breakdown: DifficultyAnalysisItem[] = Object.entries(combined)
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

  return getJson<DifficultyAnalysisResponse>(endpoints.difficultyAnalysisByUser(userId));
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

export { getLevelLabel, getLevelColor, getDifficultyLabel, getDifficultyColor };

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
 * Chọn một tập con câu hỏi từ bộ câu hỏi lớn dựa trên tỷ lệ nhận thức (Bloom)
 * và độ khó của toàn bộ bộ câu hỏi.
 *
 * Chiến lược:
 * 1. Đếm số lượng câu hỏi theo từng cặp (bloom_level, difficulty)
 * 2. Tính tỷ lệ phần trăm mỗi cặp so với tổng số
 * 3. Phân bổ số lượng cần chọn (targetCount) theo tỷ lệ đó
 * 4. Chọn ngẫu nhiên từ mỗi cặp
 * 5. Xáo trộn kết quả cuối cùng
 */
export function selectQuestionsByProportions<
  T extends { bloom_level?: string; difficulty?: string },
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

  // Bước 1: Nhóm câu hỏi theo (bloom_level, difficulty)
  const groups = new Map<string, T[]>();
  for (const q of allQuestions) {
    const key = `${q.bloom_level ?? "remember"}:${q.difficulty ?? "medium"}`;
    const group = groups.get(key);
    if (group) {
      group.push(q);
    } else {
      groups.set(key, [q]);
    }
  }

  const totalPool = allQuestions.length;

  // Bước 2 & 3: Tính số lượng cần chọn cho mỗi nhóm
  const allocations = new Map<string, number>();
  let allocatedTotal = 0;

  for (const [key, group] of groups) {
    const proportion = group.length / totalPool;
    let target = Math.round(proportion * targetCount);
    // Không lấy nhiều hơn số có trong nhóm
    target = Math.min(target, group.length);
    allocations.set(key, target);
    allocatedTotal += target;
  }

  // Bước 3b: Điều chỉnh nếu chưa đủ targetCount
  // Ưu tiên bổ sung cho nhóm có tỷ lệ dư cao nhất
  if (allocatedTotal < targetCount) {
    // Tạo danh sách nhóm còn có thể bổ sung
    const deficits: { key: string; remaining: number }[] = [];
    for (const [key, group] of groups) {
      const allocated = allocations.get(key) ?? 0;
      const remaining = group.length - allocated;
      if (remaining > 0) {
        deficits.push({ key, remaining });
      }
    }

    // Phân phối phần còn lại
    let deficit = targetCount - allocatedTotal;
    while (deficit > 0 && deficits.length > 0) {
      for (const item of deficits) {
        if (deficit <= 0) break;
        const currentAlloc = allocations.get(item.key) ?? 0;
        const canTake = Math.min(deficit, item.remaining);
        allocations.set(item.key, currentAlloc + canTake);
        deficit -= canTake;
        item.remaining -= canTake;
      }
      // Xóa nhóm đã hết
      for (let i = deficits.length - 1; i >= 0; i--) {
        if (deficits[i].remaining <= 0) {
          deficits.splice(i, 1);
        }
      }
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

  // Tạo mock answers phù hợp với số câu đúng
  // Xáo trộn câu hỏi, chọn correctAnswers câu làm đúng, sắp xếp lại theo sequence
  const shuffled = [...questions].sort(() => Math.random() - 0.5);
  const correctIds = new Set(
    shuffled.slice(0, correctAnswers).map((q) => q.id),
  );
const answers: AnswerItem[] = [...questions]
  .sort((a, b) => a.sequence - b.sequence)
    .map((q) => ({
      question_id: q.id,
      is_correct: correctIds.has(q.id),
    }));

  return submitExamResult({
    user_id: params.userId,
    exam_id: params.examId,
    score: cappedScore,
    max_score: totalScore,
    total_questions: totalQuestions,
    correct_answers: correctAnswers,
    is_passed: true,
    submitted_at: new Date().toISOString(),
    answers,
  });
}

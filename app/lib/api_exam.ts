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
  T extends { bloom_level?: string },
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

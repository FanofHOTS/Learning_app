
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
};

type FastApiError = {
  detail?: string;
};

const endpoints = {
  examById: (examId: number) => `${API_BASE_URL}/exam/${examId}`,
  questionsByExam: (examId: number) => `${API_BASE_URL}/question/exam/${examId}`,
  optionsByQuestion: (questionId: number) => `${API_BASE_URL}/option/question/${questionId}`,
  submitExamResult: `${API_BASE_URL}/exam_result/submit`,
};

const mockExam: Exam = {
  id: 1,
  title: "Bài kiểm tra mẫu",
  description:
    "Đây là một bài kiểm tra mẫu để học sinh thực hành câu hỏi trắc nghiệm và gửi kết quả về hệ thống.",
  module_id: 1,
  course_id: 1,
  duration_minutes: 20,
  total_questions: 4,
  is_active: true,
  pass_score: 50,
  max_score: 100,
};

const mockQuestions: ExamQuestion[] = [
  {
    id: 101,
    exam_id: 1,
    content: "Ngôn ngữ lập trình nào sau đây thường được dùng để xây dựng giao diện web phía client?",
    question_type: "multiple_choice",
    sequence: 1,
    score: 25,
    answer: "JavaScript",
  },
  {
    id: 102,
    exam_id: 1,
    content: "Thuộc tính nào của HTML dùng để gán lớp cho một phần tử?",
    question_type: "multiple_choice",
    sequence: 2,
    score: 25,
    answer: "class",
  },
  {
    id: 103,
    exam_id: 1,
    content: "Trong Next.js, thành phần nào dùng để chuyển hướng điều hướng trong client?",
    question_type: "multiple_choice",
    sequence: 3,
    score: 25,
    answer: "useRouter",
  },
  {
    id: 104,
    exam_id: 1,
    content: "Khi gửi dữ liệu lên FastAPI, phương thức HTTP nào thường dùng để tạo mới tài nguyên?",
    question_type: "multiple_choice",
    sequence: 4,
    score: 25,
    answer: "POST",
  },
];

const mockOptions: ExamOption[] = [
  { id: 1001, question_id: 101, content: "Java", is_correct: false },
  { id: 1002, question_id: 101, content: "Python", is_correct: false },
  { id: 1003, question_id: 101, content: "JavaScript", is_correct: true },
  { id: 1004, question_id: 101, content: "SQL", is_correct: false },
  { id: 1005, question_id: 102, content: "id", is_correct: false },
  { id: 1006, question_id: 102, content: "style", is_correct: false },
  { id: 1007, question_id: 102, content: "class", is_correct: true },
  { id: 1008, question_id: 102, content: "href", is_correct: false },
  { id: 1009, question_id: 103, content: "useState", is_correct: false },
  { id: 1010, question_id: 103, content: "useEffect", is_correct: false },
  { id: 1011, question_id: 103, content: "useRouter", is_correct: true },
  { id: 1012, question_id: 103, content: "useCallback", is_correct: false },
  { id: 1013, question_id: 104, content: "GET", is_correct: false },
  { id: 1014, question_id: 104, content: "POST", is_correct: true },
  { id: 1015, question_id: 104, content: "PUT", is_correct: false },
  { id: 1016, question_id: 104, content: "DELETE", is_correct: false },
];

let mockExamResults: ExamResult[] = [];

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
    return {
      ...mockExam,
      id: examId,
      course_id: mockExam.course_id,
      module_id: mockExam.module_id,
    };
  }

  return getJson<Exam>(endpoints.examById(examId));
}

export async function getQuestionsByExam(examId: number): Promise<ExamQuestion[]> {
  if (USE_MOCK_EXAM_DATA) {
    return mockQuestions
      .filter((question) => question.exam_id === examId)
      .map((question) => ({ ...question }));
  }

  return getJson<ExamQuestion[]>(endpoints.questionsByExam(examId));
}

export async function getOptionsByQuestion(questionId: number): Promise<ExamOption[]> {
  if (USE_MOCK_EXAM_DATA) {
    return mockOptions.filter((option) => option.question_id === questionId);
  }

  return getJson<ExamOption[]>(endpoints.optionsByQuestion(questionId));
}

export async function submitExamResult(
  result: Omit<ExamResult, "id">,
): Promise<ExamResult> {
  if (USE_MOCK_EXAM_DATA) {
    const newResult: ExamResult = {
      id: mockExamResults.length + 1,
      ...result,
    };
    mockExamResults.push(newResult);
    return newResult;
  }

  return postJson<ExamResult>(endpoints.submitExamResult, result);
}


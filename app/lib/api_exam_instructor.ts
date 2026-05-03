
import type { Exam, ExamQuestion, ExamOption } from "./api_exam";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";
const USE_MOCK_EXAM_DATA =
  process.env.NEXT_PUBLIC_USE_MOCK_DATA !== "false";

type FastApiError = {
  detail?: string;
};

const endpoints = {
  examById: (examId: number) => `${API_BASE_URL}/exam/${examId}`,
  questionsByExam: (examId: number) => `${API_BASE_URL}/question/exam/${examId}`,
  optionsByQuestion: (questionId: number) =>
    `${API_BASE_URL}/option/question/${questionId}`,
  createQuestion: `${API_BASE_URL}/question/create`,
  updateQuestion: (questionId: number) =>
    `${API_BASE_URL}/question/update/${questionId}`,
  deleteQuestion: (questionId: number) =>
    `${API_BASE_URL}/question/delete/${questionId}`,
  createOption: `${API_BASE_URL}/option/create`,
  updateOption: (optionId: number) =>
    `${API_BASE_URL}/option/update/${optionId}`,
  deleteOption: (optionId: number) =>
    `${API_BASE_URL}/option/delete/${optionId}`,
};

const mockExam: Exam = {
  id: 1,
  title: "Bài kiểm tra mẫu",
  description:
    "Đây là một bài kiểm tra mẫu cho giáo viên quản lý câu hỏi trắc nghiệm.",
  module_id: 1,
  course_id: 1,
  duration_minutes: 30,
  total_questions: 4,
  is_active: true,
  pass_score: 50,
  max_score: 100,
};

let mockQuestions: ExamQuestion[] = [
  {
    id: 101,
    exam_id: 1,
    content:
      "Ngôn ngữ lập trình nào thường dùng để xây dựng giao diện web phía client?",
    question_type: "multiple_choice",
    sequence: 1,
    score: 25,
    answer: "JavaScript",
  },
  {
    id: 102,
    exam_id: 1,
    content: "Thuộc tính HTML nào dùng để gán lớp cho phần tử?",
    question_type: "multiple_choice",
    sequence: 2,
    score: 25,
    answer: "class",
  },
  {
    id: 103,
    exam_id: 1,
    content: "Khi tạo mới tài nguyên trên FastAPI, phương thức HTTP nào được dùng?",
    question_type: "multiple_choice",
    sequence: 3,
    score: 25,
    answer: "POST",
  },
  {
    id: 104,
    exam_id: 1,
    content: "Trong React, hook nào dùng để quản lý trạng thái?",
    question_type: "multiple_choice",
    sequence: 4,
    score: 25,
    answer: "useState",
  },
];

let mockOptions: ExamOption[] = [
  { id: 1001, question_id: 101, content: "Java", is_correct: false },
  { id: 1002, question_id: 101, content: "Python", is_correct: false },
  { id: 1003, question_id: 101, content: "JavaScript", is_correct: true },
  { id: 1004, question_id: 101, content: "SQL", is_correct: false },
  { id: 1005, question_id: 102, content: "id", is_correct: false },
  { id: 1006, question_id: 102, content: "style", is_correct: false },
  { id: 1007, question_id: 102, content: "class", is_correct: true },
  { id: 1008, question_id: 102, content: "href", is_correct: false },
  { id: 1009, question_id: 103, content: "GET", is_correct: false },
  { id: 1010, question_id: 103, content: "POST", is_correct: true },
  { id: 1011, question_id: 103, content: "PUT", is_correct: false },
  { id: 1012, question_id: 103, content: "DELETE", is_correct: false },
  { id: 1013, question_id: 104, content: "useState", is_correct: true },
  { id: 1014, question_id: 104, content: "useEffect", is_correct: false },
  { id: 1015, question_id: 104, content: "useRouter", is_correct: false },
  { id: 1016, question_id: 104, content: "useMemo", is_correct: false },
];

async function parseError(response: Response): Promise<string> {
  try {
    const error = (await response.json()) as FastApiError;
    if (typeof error.detail === "string" && error.detail.trim()) {
      return error.detail;
    }
  } catch {
    // Ignore JSON parse failures.
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

async function putJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "PUT",
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

async function deleteJson(url: string): Promise<void> {
  const response = await fetch(url, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }
}

export async function getInstructorExamById(examId: number): Promise<Exam> {
  if (USE_MOCK_EXAM_DATA) {
    return Promise.resolve({
      ...mockExam,
      id: examId,
    });
  }

  return getJson<Exam>(endpoints.examById(examId));
}

export async function getInstructorExamQuestions(
  examId: number,
): Promise<ExamQuestion[]> {
  if (USE_MOCK_EXAM_DATA) {
    return Promise.resolve(
      mockQuestions.filter((question) => question.exam_id === examId),
    );
  }

  return getJson<ExamQuestion[]>(endpoints.questionsByExam(examId));
}

export async function getInstructorQuestionOptions(
  questionId: number,
): Promise<ExamOption[]> {
  if (USE_MOCK_EXAM_DATA) {
    return Promise.resolve(
      mockOptions.filter((option) => option.question_id === questionId),
    );
  }

  return getJson<ExamOption[]>(endpoints.optionsByQuestion(questionId));
}

export async function createInstructorQuestion(
  question: Omit<ExamQuestion, "id">,
): Promise<ExamQuestion> {
  if (USE_MOCK_EXAM_DATA) {
    const nextId = mockQuestions.length
      ? Math.max(...mockQuestions.map((question) => question.id)) + 1
      : 1;
    const newQuestion: ExamQuestion = {
      id: nextId,
      ...question,
    };
    mockQuestions.push(newQuestion);
    return Promise.resolve(newQuestion);
  }

  return postJson<ExamQuestion>(endpoints.createQuestion, question);
}

export async function updateInstructorQuestion(
  questionId: number,
  question: Partial<Omit<ExamQuestion, "id">>,
): Promise<ExamQuestion> {
  if (USE_MOCK_EXAM_DATA) {
    const index = mockQuestions.findIndex((question) => question.id === questionId);
    if (index === -1) {
      throw new Error("Câu hỏi không tồn tại.");
    }
    mockQuestions[index] = {
      ...mockQuestions[index],
      ...question,
    };
    return Promise.resolve(mockQuestions[index]);
  }

  return putJson<ExamQuestion>(endpoints.updateQuestion(questionId), question);
}

export async function deleteInstructorQuestion(
  questionId: number,
): Promise<void> {
  if (USE_MOCK_EXAM_DATA) {
    mockQuestions = mockQuestions.filter((question) => question.id !== questionId);
    mockOptions = mockOptions.filter((option) => option.question_id !== questionId);
    return Promise.resolve();
  }

  return deleteJson(endpoints.deleteQuestion(questionId));
}

export async function createInstructorOption(
  option: Omit<ExamOption, "id">,
): Promise<ExamOption> {
  if (USE_MOCK_EXAM_DATA) {
    const nextId = mockOptions.length
      ? Math.max(...mockOptions.map((option) => option.id)) + 1
      : 1;
    const newOption: ExamOption = {
      id: nextId,
      ...option,
    };
    mockOptions.push(newOption);
    return Promise.resolve(newOption);
  }

  return postJson<ExamOption>(endpoints.createOption, option);
}

export async function updateInstructorOption(
  optionId: number,
  option: Partial<Omit<ExamOption, "id">>,
): Promise<ExamOption> {
  if (USE_MOCK_EXAM_DATA) {
    const index = mockOptions.findIndex((option) => option.id === optionId);
    if (index === -1) {
      throw new Error("Lựa chọn không tồn tại.");
    }
    mockOptions[index] = {
      ...mockOptions[index],
      ...option,
    };
    return Promise.resolve(mockOptions[index]);
  }

  return putJson<ExamOption>(endpoints.updateOption(optionId), option);
}

export async function deleteInstructorOption(optionId: number): Promise<void> {
  if (USE_MOCK_EXAM_DATA) {
    mockOptions = mockOptions.filter((option) => option.id !== optionId);
    return Promise.resolve();
  }

  return deleteJson(endpoints.deleteOption(optionId));
}

export type {
  Exam,
  ExamQuestion,
  ExamOption,
};

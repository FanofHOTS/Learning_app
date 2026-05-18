
import type { Exam, ExamQuestion, ExamOption } from "./api_exam";
import { getInstructorCourseListRaw, type InstructorCourse } from "./api_course_instructor";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";
const USE_MOCK_EXAM_DATA =
  process.env.NEXT_PUBLIC_USE_MOCK_DATA !== "false";

export type InstructorExam = Exam & {
  course_name: string;
};

export type InstructorExamFilterState = {
  keyword: string;
  courseId: string;
  isActive: string;
  duration_minutes_min: number;
  duration_minutes_max: number;
  total_questions_min: number;
  total_questions_max: number;
};

export type InstructorExamUpdateInput = {
  title: string;
  description?: string | null;
  course_id: number;
  duration_minutes: number;
  total_questions: number;
  is_active: boolean;
  pass_score: number;
  max_score: number;
};

type FastApiError = {
  detail?: string;
};

type FastCourseLike = Pick<InstructorCourse, "id" | "title">;

const endpoints = {
  examList: `${API_BASE_URL}/exam/`,
  examById: (examId: number) => `${API_BASE_URL}/exam/${examId}`,
  questionsByExam: (examId: number) => `${API_BASE_URL}/question/exam/${examId}`,
  updateExam: (examId: number) => `${API_BASE_URL}/exam/update/${examId}`,
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

const mockExams: Exam[] = [
  {
    id: 1,
    title: "Bài kiểm tra kiến thức chung về website",
    description:
      "Đây là một bài kiểm tra để đánh giá kiến thức chung về website.",
    module_id: 1,
    course_id: 1,
    duration_minutes: 15,
    total_questions: 5,
    is_active: true,
    pass_score: 50,
    max_score: 100,    
  },
  {
    id: 2,
    title: "Bài kiểm tra kiến thức lập trình web",
    description:
      "Đây là một bài kiểm tra để đánh giá kiến thức chung về việc lập trình web.",
    module_id: 3,
    course_id: 1,
    duration_minutes: 30,
    total_questions: 10,
    is_active: true,
    pass_score: 50,
    max_score: 100,    
  },
  {
    id: 3,
    title: "Bài kiểm tra tổng hợp Xây dựng ứng dụng học tập với Next.js",
    description:
      "Đây là một bài kiểm tra tổng hợp của khóa học Xây dựng ứng dụng học tập với Next.js.",
    module_id: 6,
    course_id: 1,
    duration_minutes: 60,
    total_questions: 40,
    is_active: true,
    pass_score: 50,
    max_score: 100,    
  },
  {
    id: 4,
    title: "Bài kiểm tra kiến thức chung về AI",
    description:
      "Đây là một bài kiểm tra để đánh giá kiến thức chung về AI.",
    module_id: 1,
    course_id: 2,
    duration_minutes: 15,
    total_questions: 5,
    is_active: true,
    pass_score: 50,
    max_score: 100,    
  },
  {
    id: 5,
    title: "Bài kiểm tra kiến thức chung về xây dựng AI",
    description:
      "Đây là một bài kiểm tra để đánh giá kiến thức chung về việc xây dựng AI.",
    module_id: 3,
    course_id: 2,
    duration_minutes: 30,
    total_questions: 10,
    is_active: true,
    pass_score: 50,
    max_score: 100,    
  },
  {
    id: 6,
    title: "Bài kiểm tra tổng hợp Thiết kế ngân hàng câu hỏi bằng AI",
    description:
      "Đây là một bài kiểm tra tổng hợp của khóa học Thiết kế ngân hàng câu hỏi bằng AI.",
    module_id: 7,
    course_id: 2,
    duration_minutes: 60,
    total_questions: 40,
    is_active: false,
    pass_score: 50,
    max_score: 100,    
  },
]

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

async function getJsonListOrEmpty<T>(url: string): Promise<T[]> {
  const response = await fetch(url, {
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

  return (await response.json()) as T[];
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

export async function getExamList(): Promise<Exam[]>{
  if (USE_MOCK_EXAM_DATA) {
    return Promise.resolve(mockExams);
  }

  return getJson<Exam[]>(endpoints.examList);
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

export async function getInstructorExamList(
  instructorId: number,
): Promise<InstructorExam[]> {
  const [exams, courses] = await Promise.all([
    getExamList(),
    getInstructorCourseListRaw(instructorId),
  ]);

  const courseMap = new Map<number, FastCourseLike>(
    courses.map((course) => [course.id, course]),
  );

  return exams
    .filter((exam) => {
      if (!exam.course_id) {
        return false;
      }
      return courseMap.has(exam.course_id);
    })
    .map((exam) => ({
      ...exam,
      course_name:
        courseMap.get(exam.course_id ?? -1)?.title ??
        `Khóa học #${exam.course_id}`,
    }));
}

export async function updateInstructorExam(
  examId: number,
  exam: Partial<Omit<Exam, "id">>,
): Promise<Exam> {
  if (USE_MOCK_EXAM_DATA) {
    const index = mockExams.findIndex((exam) => exam.id === examId);
    if (index === -1) {
      throw new Error("Bài kiểm tra không tồn tại.");
    }
    mockExams[index] = {
      ...mockExams[index],
      ...exam,
    };
    return Promise.resolve(mockExams[index]);
  }

  return putJson<Exam>(endpoints.updateExam(examId), exam);
}

export function validateInstructorExamUpdate(
  exam: InstructorExamUpdateInput,
): string {
  if (!exam.title.trim()) {
    return "Tiêu đề bài kiểm tra không được để trống.";
  }

  if (!Number.isInteger(exam.course_id) || exam.course_id <= 0) {
    return "Vui lòng chọn khóa học hợp lệ cho bài kiểm tra.";
  }

  if (!Number.isFinite(exam.duration_minutes) || exam.duration_minutes <= 0) {
    return "Thời gian làm bài phải lớn hơn 0 phút.";
  }

  if (!Number.isFinite(exam.total_questions) || exam.total_questions <= 0) {
    return "Tổng số lượng câu hỏi phải lớn hơn 0.";
  }

  if (!Number.isFinite(exam.max_score) || exam.max_score <= 0) {
    return "Điểm tối đa phải lớn hơn 0.";
  }

  if (!Number.isFinite(exam.pass_score) || exam.pass_score < 0) {
    return "Điểm cần đạt không được nhỏ hơn 0.";
  }

  if (exam.pass_score > exam.max_score) {
    return "Điểm cần đạt không được lớn hơn điểm tối đa.";
  }

  return "";
}

export function filterInstructorExam(
  exams: InstructorExam[],
  filters: InstructorExamFilterState,
): InstructorExam[] {
  const keyword = filters.keyword.trim().toLowerCase();

  return exams.filter((exams) => {
    const matchesKeyword =
      keyword.length === 0 ||
      exams.title.toLowerCase().includes(keyword) ||
      exams.course_name.toLowerCase().includes(keyword) ||
      (exams.description ?? "").toLowerCase().includes(keyword);

    const matchesCourse =
      filters.courseId === "all" || `${exams.course_id}` === filters.courseId;

    const matchesActive =
      filters.isActive === "all" ||
      (filters.isActive === "active" && exams.is_active) ||
      (filters.isActive === "inactive" && !exams.is_active);

    const matchesDurationMin =
      filters.duration_minutes_min === 0 ||
      exams.duration_minutes >= filters.duration_minutes_min;

    const matchesDurationMax =
      filters.duration_minutes_max === 0 ||
      exams.duration_minutes <= filters.duration_minutes_max;

    const matchesTotalQuestionsMin =
      filters.total_questions_min === 0 ||
      exams.total_questions >= filters.total_questions_min;

    const matchesTotalQuestionsMax =
      filters.total_questions_max === 0 ||
      exams.total_questions <= filters.total_questions_max;

    return (
    matchesKeyword && 
    matchesCourse && 
    matchesActive && 
    matchesDurationMin && 
    matchesDurationMax &&
    matchesTotalQuestionsMin &&
    matchesTotalQuestionsMax
    );
  });
}

export async function getInstructorExamQuestions(
  examId: number,
): Promise<ExamQuestion[]> {
  if (USE_MOCK_EXAM_DATA) {
    return Promise.resolve(
      mockQuestions.filter((question) => question.exam_id === examId),
    );
  }

  return getJsonListOrEmpty<ExamQuestion>(endpoints.questionsByExam(examId));
}

export async function getInstructorQuestionOptions(
  questionId: number,
): Promise<ExamOption[]> {
  if (USE_MOCK_EXAM_DATA) {
    return Promise.resolve(
      mockOptions.filter((option) => option.question_id === questionId),
    );
  }

  return getJsonListOrEmpty<ExamOption>(endpoints.optionsByQuestion(questionId));
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

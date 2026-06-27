const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";
const USE_MOCK_DATA = process.env.NEXT_PUBLIC_USE_MOCK_DATA !== "false";

// ─── Types ────────────────────────────────────────────────

export type Survey = {
  id: number;
  course_id: number | null;
  title: string;
  description: string;
  is_active: boolean;
  is_public: boolean;
  end_at: string | null;
  created_at: string;
  updated_at: string;
};

export type SurveyQuestion = {
  id: number;
  survey_id: number;
  question_text: string;
  question_type: "text" | "multiple_choice" | "checkbox" | "rating";
  options: string; // JSON array string
  sequence: number;
  is_required: boolean;
};

export type SurveyResponse = {
  id: number;
  survey_id: number;
  question_id: number;
  user_id: number;
  answer: string;
  submitted_at: string;
};

export type SurveyAnswer = {
  question_id: number;
  answer: string;
};

export type SurveyResultStats = {
  question_id: number;
  question_text: string;
  question_type: string;
  options: string;
  total_responses: number;
  text_answers: string[];
  choice_counts: Record<string, number>;
  rating_avg: number;
  rating_count: number;
};

export type SurveyCreateInput = {
  course_id?: number | null;
  title: string;
  description: string;
  is_public: boolean;
  end_at?: string | null;
};

export type SurveyQuestionCreateInput = {
  survey_id: number;
  question_text: string;
  question_type: string;
  options: string;
  sequence: number;
  is_required: boolean;
};

export type SurveyUpdateInput = {
  title?: string;
  description?: string;
  is_active?: boolean;
  is_public?: boolean;
  end_at?: string | null;
};

// ─── Mock Data ────────────────────────────────────────────

const mockSurveys: Survey[] = [
  {
    id: 1,
    course_id: null,
    title: "Khảo sát nhu cầu học lập trình AI",
    description:
      "Chúng tôi đang lên kế hoạch mở khóa học về lập trình AI. Hãy cho chúng tôi biết nhu cầu của bạn!",
    is_active: true,
    is_public: true,
    end_at: new Date(Date.now() + 30 * 86400000).toISOString(),
    created_at: new Date(Date.now() - 7 * 86400000).toISOString(),
    updated_at: new Date(Date.now() - 7 * 86400000).toISOString(),
  },
  {
    id: 2,
    course_id: null,
    title: "Bạn muốn học môn gì tiếp theo?",
    description:
      "Gợi ý cho chúng tôi về chủ đề khóa học mà bạn quan tâm nhất trong học kỳ tới.",
    is_active: true,
    is_public: true,
    end_at: new Date(Date.now() + 60 * 86400000).toISOString(),
    created_at: new Date(Date.now() - 14 * 86400000).toISOString(),
    updated_at: new Date(Date.now() - 14 * 86400000).toISOString(),
  },
];

const mockQuestions: SurveyQuestion[] = [
  {
    id: 1,
    survey_id: 1,
    question_text: "Bạn quan tâm đến lĩnh vực nào nhất trong AI?",
    question_type: "multiple_choice",
    options: JSON.stringify([
      "Học máy (Machine Learning)",
      "Xử lý ngôn ngữ tự nhiên",
      "Thị giác máy tính",
      "AI tạo sinh (Generative AI)",
    ]),
    sequence: 1,
    is_required: true,
  },
  {
    id: 2,
    survey_id: 1,
    question_text: "Bạn đã có kiến thức nền tảng về lập trình chưa?",
    question_type: "multiple_choice",
    options: JSON.stringify([
      "Chưa biết gì",
      "Biết cơ bản",
      "Trình độ trung cấp",
      "Thành thạo",
    ]),
    sequence: 2,
    is_required: true,
  },
  {
    id: 3,
    survey_id: 1,
    question_text: "Bạn mong muốn thời lượng khóa học kéo dài bao lâu?",
    question_type: "multiple_choice",
    options: JSON.stringify([
      "1-2 tháng",
      "3-4 tháng",
      "5-6 tháng",
      "Trên 6 tháng",
    ]),
    sequence: 3,
    is_required: true,
  },
  {
    id: 4,
    survey_id: 1,
    question_text: "Bạn có gợi ý gì thêm cho khóa học?",
    question_type: "text",
    options: "[]",
    sequence: 4,
    is_required: false,
  },
  {
    id: 5,
    survey_id: 2,
    question_text: "Chủ đề khóa học bạn muốn học?",
    question_type: "text",
    options: "[]",
    sequence: 1,
    is_required: true,
  },
  {
    id: 6,
    survey_id: 2,
    question_text: "Đánh giá mức độ quan tâm của bạn",
    question_type: "rating",
    options: "[]",
    sequence: 2,
    is_required: true,
  },
];

// ─── Helpers ──────────────────────────────────────────────

export function parseSurveyOptions(optionsJson: string): string[] {
  try {
    const parsed = JSON.parse(optionsJson);
    if (Array.isArray(parsed)) return parsed;
  } catch {
    // ignore
  }
  return [];
}

export function getSurveyStatus(survey: Survey): {
  label: string;
  color: string;
} {
  if (!survey.is_active)
    return { label: "Đã đóng", color: "bg-red-100 text-red-700" };
  if (survey.end_at && new Date(survey.end_at) < new Date())
    return { label: "Đã kết thúc", color: "bg-amber-100 text-amber-700" };
  return { label: "Đang mở", color: "bg-emerald-100 text-emerald-700" };
}

export function getQuestionTypeLabel(type: string): string {
  switch (type) {
    case "text":
      return "Văn bản";
    case "multiple_choice":
      return "Chọn một";
    case "checkbox":
      return "Chọn nhiều";
    case "rating":
      return "Đánh giá sao";
    default:
      return type;
  }
}

// ─── API Calls ────────────────────────────────────────────

type FastApiError = { detail?: string };

async function parseError(response: Response): Promise<string> {
  try {
    const error = (await response.json()) as FastApiError;
    if (typeof error.detail === "string" && error.detail.trim())
      return error.detail;
  } catch {
    // ignore
  }
  return "Không thể kết nối tới máy chủ.";
}

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });
  if (!response.ok) throw new Error(await parseError(response));
  return (await response.json()) as T;
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(await parseError(response));
  return (await response.json()) as T;
}

async function putJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(await parseError(response));
  return (await response.json()) as T;
}

async function del<T>(url: string): Promise<T> {
  const response = await fetch(url, { method: "DELETE" });
  if (!response.ok) throw new Error(await parseError(response));
  return (await response.json()) as T;
}

// ─── Endpoints ────────────────────────────────────────────

// Public surveys — anyone can view
export async function getPublicSurveys(): Promise<Survey[]> {
  if (USE_MOCK_DATA) return Promise.resolve([...mockSurveys]);
  return getJson<Survey[]>(`${API_BASE_URL}/course_survey/public`);
}

export async function getPublicSurvey(surveyId: number): Promise<Survey> {
  if (USE_MOCK_DATA) {
    const survey = mockSurveys.find((s) => s.id === surveyId);
    if (!survey) throw new Error("Không tìm thấy khảo sát");
    return Promise.resolve({ ...survey });
  }
  return getJson<Survey>(`${API_BASE_URL}/course_survey/public/${surveyId}`);
}

// All surveys (instructor/admin)
export async function getSurveysByCourse(courseId: number): Promise<Survey[]> {
  if (USE_MOCK_DATA) return Promise.resolve([...mockSurveys]);
  return getJson<Survey[]>(
    `${API_BASE_URL}/course_survey/course/${courseId}`,
  );
}

export async function getSurvey(surveyId: number): Promise<Survey> {
  if (USE_MOCK_DATA) {
    const survey = mockSurveys.find((s) => s.id === surveyId);
    if (!survey) throw new Error("Không tìm thấy khảo sát");
    return Promise.resolve({ ...survey });
  }
  return getJson<Survey>(`${API_BASE_URL}/course_survey/${surveyId}`);
}

export async function createSurvey(
  input: SurveyCreateInput,
): Promise<Survey> {
  if (USE_MOCK_DATA) {
    const newSurvey: Survey = {
      id: mockSurveys.length + 1,
      course_id: input.course_id ?? null,
      title: input.title,
      description: input.description,
      is_active: true,
      is_public: input.is_public,
      end_at: input.end_at ?? null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    mockSurveys.push(newSurvey);
    return Promise.resolve(newSurvey);
  }
  return postJson<Survey>(`${API_BASE_URL}/course_survey/create`, input);
}

export async function updateSurvey(
  surveyId: number,
  input: SurveyUpdateInput,
): Promise<Survey> {
  if (USE_MOCK_DATA) {
    const idx = mockSurveys.findIndex((s) => s.id === surveyId);
    if (idx === -1) throw new Error("Không tìm thấy khảo sát");
    mockSurveys[idx] = {
      ...mockSurveys[idx],
      ...input,
      updated_at: new Date().toISOString(),
    };
    return Promise.resolve({ ...mockSurveys[idx] });
  }
  return putJson<Survey>(
    `${API_BASE_URL}/course_survey/update/${surveyId}`,
    input,
  );
}

export async function deleteSurvey(surveyId: number): Promise<void> {
  if (USE_MOCK_DATA) {
    const idx = mockSurveys.findIndex((s) => s.id === surveyId);
    if (idx === -1) throw new Error("Không tìm thấy khảo sát");
    mockSurveys.splice(idx, 1);
    // Also clean up mock questions
    let qi = mockQuestions.length;
    while (qi--) {
      if (mockQuestions[qi].survey_id === surveyId) mockQuestions.splice(qi, 1);
    }
    return Promise.resolve();
  }
  await del(`${API_BASE_URL}/course_survey/delete/${surveyId}`);
}

// Questions
export async function getSurveyQuestions(
  surveyId: number,
): Promise<SurveyQuestion[]> {
  if (USE_MOCK_DATA) {
    const questions = mockQuestions.filter((q) => q.survey_id === surveyId);
    return Promise.resolve([...questions]);
  }
  return getJson<SurveyQuestion[]>(
    `${API_BASE_URL}/course_survey/${surveyId}/questions`,
  );
}

export async function createSurveyQuestion(
  input: SurveyQuestionCreateInput,
): Promise<SurveyQuestion> {
  if (USE_MOCK_DATA) {
    const newQ: SurveyQuestion = {
      id: mockQuestions.length + 1,
      survey_id: input.survey_id,
      question_text: input.question_text,
      question_type: input.question_type as SurveyQuestion["question_type"],
      options: input.options,
      sequence: input.sequence,
      is_required: input.is_required,
    };
    mockQuestions.push(newQ);
    return Promise.resolve(newQ);
  }
  return postJson<SurveyQuestion>(
    `${API_BASE_URL}/course_survey/question/create`,
    input,
  );
}

export async function updateSurveyQuestion(
  questionId: number,
  input: Partial<SurveyQuestionCreateInput>,
): Promise<SurveyQuestion> {
  if (USE_MOCK_DATA) {
    const idx = mockQuestions.findIndex((q) => q.id === questionId);
    if (idx === -1) throw new Error("Không tìm thấy câu hỏi");
    const updated: SurveyQuestion = {
      ...mockQuestions[idx],
      question_text: input.question_text ?? mockQuestions[idx].question_text,
      question_type: (input.question_type ?? mockQuestions[idx].question_type) as SurveyQuestion["question_type"],
      options: input.options ?? mockQuestions[idx].options,
      sequence: input.sequence ?? mockQuestions[idx].sequence,
      is_required: input.is_required ?? mockQuestions[idx].is_required,
    };
    mockQuestions[idx] = updated;
    return Promise.resolve({ ...updated });
  }
  return putJson<SurveyQuestion>(
    `${API_BASE_URL}/course_survey/question/update/${questionId}`,
    input,
  );
}

export async function deleteSurveyQuestion(questionId: number): Promise<void> {
  if (USE_MOCK_DATA) {
    const idx = mockQuestions.findIndex((q) => q.id === questionId);
    if (idx === -1) throw new Error("Không tìm thấy câu hỏi");
    mockQuestions.splice(idx, 1);
    return Promise.resolve();
  }
  await del(`${API_BASE_URL}/course_survey/question/delete/${questionId}`);
}

// Notifications

export async function notifySurveyStudents(
  surveyId: number,
): Promise<{ message: string; sent_count: number }> {
  if (USE_MOCK_DATA) {
    return Promise.resolve({
      message: "Đã gửi thông báo đến 3 sinh viên (mock)",
      sent_count: 3,
    });
  }
  return postJson<{ message: string; sent_count: number }>(
    `${API_BASE_URL}/course_survey/${surveyId}/notify-students`,
    {},
  );
}

// Responses
export async function submitSurveyResponse(
  surveyId: number,
  userId: number,
  answers: SurveyAnswer[],
): Promise<void> {
  if (USE_MOCK_DATA) {
    return Promise.resolve();
  }
  await postJson(`${API_BASE_URL}/course_survey/response/submit`, {
    survey_id: surveyId,
    user_id: userId,
    answers,
  });
}

export async function checkUserSurveyResponse(
  surveyId: number,
  userId: number,
): Promise<boolean> {
  if (USE_MOCK_DATA) return Promise.resolve(false);
  const result = await getJson<{ responded: boolean }>(
    `${API_BASE_URL}/course_survey/response/check/${surveyId}/${userId}`,
  );
  return result.responded;
}

export async function getSurveyResults(
  surveyId: number,
): Promise<SurveyResultStats[]> {
  if (USE_MOCK_DATA) {
    const questions = mockQuestions.filter((q) => q.survey_id === surveyId);
    return Promise.resolve(
      questions.map((q) => ({
        question_id: q.id,
        question_text: q.question_text,
        question_type: q.question_type,
        options: q.options,
        total_responses: 0,
        text_answers: [],
        choice_counts: {},
        rating_avg: 0,
        rating_count: 0,
      })),
    );
  }
  return getJson<SurveyResultStats[]>(
    `${API_BASE_URL}/course_survey/response/results/${surveyId}`,
  );
}

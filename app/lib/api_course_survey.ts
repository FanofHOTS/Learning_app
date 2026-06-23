const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";
const USE_MOCK_DATA =
  process.env.NEXT_PUBLIC_USE_MOCK_DATA !== "false";

// ─── Types ───────────────────────────────────────────────

export type Survey = {
  id: number;
  course_id: number;
  title: string;
  description: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type SurveyQuestion = {
  id: number;
  survey_id: number;
  question_text: string;
  question_type: "text" | "multiple_choice" | "rating" | "checkbox";
  options: string; // JSON array
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

export type SurveyCreatePayload = {
  course_id: number;
  title: string;
  description: string;
};

export type QuestionCreatePayload = {
  survey_id: number;
  question_text: string;
  question_type: string;
  options: string;
  sequence: number;
  is_required: boolean;
};

export type ResponseSubmitPayload = {
  survey_id: number;
  user_id: number;
  answers: { question_id: number; answer: string }[];
};

type FastApiError = {
  detail?: string;
};

const endpoints = {
  byCourse: (courseId: number) =>
    `${API_BASE_URL}/course_survey/course/${courseId}`,
  byId: (surveyId: number) => `${API_BASE_URL}/course_survey/${surveyId}`,
  create: () => `${API_BASE_URL}/course_survey/create`,
  update: (surveyId: number) =>
    `${API_BASE_URL}/course_survey/update/${surveyId}`,
  delete: (surveyId: number) =>
    `${API_BASE_URL}/course_survey/delete/${surveyId}`,
  questions: (surveyId: number) =>
    `${API_BASE_URL}/course_survey/${surveyId}/questions`,
  createQuestion: () => `${API_BASE_URL}/course_survey/question/create`,
  updateQuestion: (questionId: number) =>
    `${API_BASE_URL}/course_survey/question/update/${questionId}`,
  deleteQuestion: (questionId: number) =>
    `${API_BASE_URL}/course_survey/question/delete/${questionId}`,
  submitResponse: () => `${API_BASE_URL}/course_survey/response/submit`,
  checkResponse: (surveyId: number, userId: number) =>
    `${API_BASE_URL}/course_survey/response/check/${surveyId}/${userId}`,
  results: (surveyId: number) =>
    `${API_BASE_URL}/course_survey/response/results/${surveyId}`,
};

// ─── Mock data store ──────────────────────────────────────

const mockSurveys: Map<number, Survey> = new Map();
const mockQuestions: Map<number, SurveyQuestion[]> = new Map();
const mockResponses: Map<string, SurveyResponse[]> = new Map(); // key: `${surveyId}_${userId}`
let mockSurveyId = 1;
let mockQuestionId = 1;
let mockResponseId = 1;

// ─── Helpers ─────────────────────────────────────────────

async function parseError(response: Response): Promise<string> {
  try {
    const error = (await response.json()) as FastApiError;
    if (typeof error.detail === "string" && error.detail.trim()) {
      return error.detail;
    }
  } catch {
    // ignore
  }
  return "Không thể kết nối tới máy chủ FastAPI.";
}

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });
  if (!response.ok) {
    throw new Error(await parseError(response));
  }
  return (await response.json()) as T;
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
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
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(await parseError(response));
  }
  return (await response.json()) as T;
}

async function deleteJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
  });
  if (!response.ok) {
    throw new Error(await parseError(response));
  }
  return (await response.json()) as T;
}

async function getJsonOrFallback<T>(url: string, fallback: T): Promise<T> {
  try {
    return await getJson<T>(url);
  } catch {
    return fallback;
  }
}

// ─── API Functions ───────────────────────────────────────

export async function getSurveysByCourse(
  courseId: number,
): Promise<Survey[]> {
  if (USE_MOCK_DATA) {
    const surveys = Array.from(mockSurveys.values()).filter(
      (s) => s.course_id === courseId,
    );
    return Promise.resolve(surveys.sort((a, b) => b.id - a.id));
  }
  return getJsonOrFallback<Survey[]>(endpoints.byCourse(courseId), []);
}

export async function getSurvey(surveyId: number): Promise<Survey | null> {
  if (USE_MOCK_DATA) {
    return Promise.resolve(mockSurveys.get(surveyId) ?? null);
  }
  try {
    return await getJson<Survey>(endpoints.byId(surveyId));
  } catch {
    return null;
  }
}

export async function createSurvey(
  payload: SurveyCreatePayload,
): Promise<Survey> {
  if (USE_MOCK_DATA) {
    const now = new Date().toISOString();
    const survey: Survey = {
      id: mockSurveyId++,
      course_id: payload.course_id,
      title: payload.title,
      description: payload.description,
      is_active: true,
      created_at: now,
      updated_at: now,
    };
    mockSurveys.set(survey.id, survey);
    return Promise.resolve(survey);
  }
  return postJson<Survey>(endpoints.create(), payload);
}

export async function updateSurvey(
  surveyId: number,
  payload: Partial<SurveyCreatePayload & { is_active: boolean }>,
): Promise<Survey> {
  if (USE_MOCK_DATA) {
    const existing = mockSurveys.get(surveyId);
    if (!existing) throw new Error("Không tìm thấy khảo sát");
    const updated: Survey = {
      ...existing,
      ...payload,
      updated_at: new Date().toISOString(),
    };
    mockSurveys.set(surveyId, updated);
    return Promise.resolve(updated);
  }
  return putJson<Survey>(endpoints.update(surveyId), payload);
}

export async function deleteSurvey(surveyId: number): Promise<void> {
  if (USE_MOCK_DATA) {
    mockSurveys.delete(surveyId);
    mockQuestions.delete(surveyId);
    return Promise.resolve();
  }
  await deleteJson(endpoints.delete(surveyId));
}

// ─── Questions ────────────────────────────────────────────

export async function getSurveyQuestions(
  surveyId: number,
): Promise<SurveyQuestion[]> {
  if (USE_MOCK_DATA) {
    return Promise.resolve(mockQuestions.get(surveyId) ?? []);
  }
  return getJsonOrFallback<SurveyQuestion[]>(
    endpoints.questions(surveyId),
    [],
  );
}

export async function createSurveyQuestion(
  payload: QuestionCreatePayload,
): Promise<SurveyQuestion> {
  if (USE_MOCK_DATA) {
    const question: SurveyQuestion = {
      id: mockQuestionId++,
      survey_id: payload.survey_id,
      question_text: payload.question_text,
      question_type: payload.question_type as "text" | "multiple_choice" | "rating" | "checkbox",
      options: payload.options,
      sequence: payload.sequence,
      is_required: payload.is_required,
    };
    const existing = mockQuestions.get(payload.survey_id) ?? [];
    mockQuestions.set(payload.survey_id, [...existing, question]);
    return Promise.resolve(question);
  }
  return postJson<SurveyQuestion>(endpoints.createQuestion(), payload);
}

export async function updateSurveyQuestion(
  questionId: number,
  payload: Partial<QuestionCreatePayload>,
): Promise<SurveyQuestion> {
  if (USE_MOCK_DATA) {
    for (const [surveyId, questions] of mockQuestions.entries()) {
      const idx = questions.findIndex((q) => q.id === questionId);
      if (idx !== -1) {
        const updated: SurveyQuestion = {
          ...questions[idx],
          ...payload,
          question_type: (payload.question_type ?? questions[idx].question_type) as SurveyQuestion["question_type"],
        };
        const newQuestions = [...questions];
        newQuestions[idx] = updated;
        mockQuestions.set(surveyId, newQuestions);
        return Promise.resolve(updated);
      }
    }
    throw new Error("Không tìm thấy câu hỏi");
  }
  return putJson<SurveyQuestion>(endpoints.updateQuestion(questionId), payload);
}

export async function deleteSurveyQuestion(
  questionId: number,
): Promise<void> {
  if (USE_MOCK_DATA) {
    for (const [surveyId, questions] of mockQuestions.entries()) {
      const idx = questions.findIndex((q) => q.id === questionId);
      if (idx !== -1) {
        mockQuestions.set(
          surveyId,
          questions.filter((_, i) => i !== idx),
        );
        return Promise.resolve();
      }
    }
    return Promise.resolve();
  }
  await deleteJson(endpoints.deleteQuestion(questionId));
}

// ─── Responses ────────────────────────────────────────────

export async function submitSurveyResponse(
  payload: ResponseSubmitPayload,
): Promise<void> {
  if (USE_MOCK_DATA) {
    const key = `${payload.survey_id}_${payload.user_id}`;
    const responses: SurveyResponse[] = payload.answers.map((a) => ({
      id: mockResponseId++,
      survey_id: payload.survey_id,
      question_id: a.question_id,
      user_id: payload.user_id,
      answer: a.answer,
      submitted_at: new Date().toISOString(),
    }));
    mockResponses.set(key, responses);
    return Promise.resolve();
  }
  await postJson(endpoints.submitResponse(), payload);
}

export async function checkSurveyResponded(
  surveyId: number,
  userId: number,
): Promise<boolean> {
  if (USE_MOCK_DATA) {
    const key = `${surveyId}_${userId}`;
    return Promise.resolve(mockResponses.has(key));
  }
  try {
    const result = await getJson<{ responded: boolean }>(
      endpoints.checkResponse(surveyId, userId),
    );
    return result.responded;
  } catch {
    return false;
  }
}

export async function getSurveyResults(
  surveyId: number,
): Promise<SurveyResultStats[]> {
  if (USE_MOCK_DATA) {
    // Generate mock results from stored responses
    const questions = mockQuestions.get(surveyId) ?? [];
    const results: SurveyResultStats[] = [];

    for (const question of questions) {
      const allResponses = Array.from(mockResponses.values()).flat();
      const qResponses = allResponses.filter(
        (r) => r.question_id === question.id,
      );

      if (question.question_type === "text") {
        results.push({
          question_id: question.id,
          question_text: question.question_text,
          question_type: question.question_type,
          options: question.options,
          total_responses: qResponses.length,
          text_answers: qResponses.map((r) => r.answer).filter(Boolean),
          choice_counts: {},
          rating_avg: 0,
          rating_count: 0,
        });
      } else if (question.question_type === "rating") {
        const scores = qResponses
          .map((r) => parseFloat(r.answer))
          .filter((n) => !Number.isNaN(n));
        const avg =
          scores.length > 0
            ? scores.reduce((s, n) => s + n, 0) / scores.length
            : 0;
        results.push({
          question_id: question.id,
          question_text: question.question_text,
          question_type: question.question_type,
          options: question.options,
          total_responses: qResponses.length,
          text_answers: [],
          choice_counts: {},
          rating_avg: avg,
          rating_count: scores.length,
        });
      } else {
        const counts: Record<string, number> = {};
        for (const r of qResponses) {
          for (const choice of r.answer.split("||")) {
            const c = choice.trim();
            if (c) counts[c] = (counts[c] ?? 0) + 1;
          }
        }
        results.push({
          question_id: question.id,
          question_text: question.question_text,
          question_type: question.question_type,
          options: question.options,
          total_responses: qResponses.length,
          text_answers: [],
          choice_counts: counts,
          rating_avg: 0,
          rating_count: 0,
        });
      }
    }

    return Promise.resolve(results);
  }
  return getJsonOrFallback<SurveyResultStats[]>(endpoints.results(surveyId), []);
}

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";
const USE_MOCK_DATA =
  process.env.NEXT_PUBLIC_USE_MOCK_DATA !== "false";

export type CourseExtraDataResponse = {
  course_id: number;
  objective: string;
  requirement: string;
  required_course_id: number | null;
  open_at: string;
  close_at: string;
  bloom_objectives: string;
  assessment_matrix: string;
  content_structure: string;
};

export type CourseExtraDataCreatePayload = {
  course_id: number;
  objective: string;
  requirement: string;
  required_course_id?: number | null;
  open_at?: string;
  close_at?: string;
  bloom_objectives?: string;
  assessment_matrix?: string;
  content_structure?: string;
};

type FastApiError = {
  detail?: string;
};

const endpoints = {
  list: () => `${API_BASE_URL}/course_extra_data/`,
  byCourseId: (courseId: number) => `${API_BASE_URL}/course_extra_data/${courseId}`,
  create: () => `${API_BASE_URL}/course_extra_data/create`,
  update: (courseId: number) => `${API_BASE_URL}/course_extra_data/update/${courseId}`,
};

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

// Mock extra data store
const mockExtraData: Map<number, CourseExtraDataResponse> = new Map();

function getDefaultExtraData(courseId: number): CourseExtraDataResponse {
  return {
    course_id: courseId,
    objective: "Mục tiêu khóa học",
    requirement: "Yêu cầu khóa học",
    required_course_id: null,
    open_at: new Date(Date.now() - 7 * 86400000).toISOString(),
    close_at: new Date(Date.now() + 365 * 86400000).toISOString(),
    bloom_objectives: "{}",
    assessment_matrix: "{}",
    content_structure: "{}",
  };
}

export async function getCourseExtraData(
  courseId: number,
): Promise<CourseExtraDataResponse | null> {
  if (USE_MOCK_DATA) {
    const data = mockExtraData.get(courseId);
    // Return default data if not found (like the backend default)
    return data ?? getDefaultExtraData(courseId);
  }

  try {
    return await getJson<CourseExtraDataResponse>(endpoints.byCourseId(courseId));
  } catch {
    // Return null if not found (consistent with backend 404)
    return null;
  }
}

export async function createCourseExtraData(
  payload: CourseExtraDataCreatePayload,
): Promise<CourseExtraDataResponse> {
  if (USE_MOCK_DATA) {
    const newData: CourseExtraDataResponse = {
      course_id: payload.course_id,
      objective: payload.objective,
      requirement: payload.requirement,
      required_course_id: payload.required_course_id ?? null,
      open_at: payload.open_at ?? new Date().toISOString(),
      close_at: payload.close_at ?? new Date().toISOString(),
      bloom_objectives: payload.bloom_objectives ?? "{}",
      assessment_matrix: payload.assessment_matrix ?? "{}",
      content_structure: payload.content_structure ?? "{}",
    };
    mockExtraData.set(payload.course_id, newData);
    return Promise.resolve(newData);
  }

  return postJson<CourseExtraDataResponse>(endpoints.create(), payload);
}

export async function updateCourseExtraData(
  courseId: number,
  payload: Partial<CourseExtraDataCreatePayload>,
): Promise<CourseExtraDataResponse> {
  if (USE_MOCK_DATA) {
    const existing = mockExtraData.get(courseId) ?? getDefaultExtraData(courseId);
    const updated: CourseExtraDataResponse = {
      ...existing,
      ...payload,
      course_id: courseId,
      required_course_id: payload.required_course_id ?? existing.required_course_id,
      open_at: payload.open_at ?? existing.open_at,
      close_at: payload.close_at ?? existing.close_at,
      bloom_objectives: payload.bloom_objectives ?? existing.bloom_objectives,
      assessment_matrix: payload.assessment_matrix ?? existing.assessment_matrix,
      content_structure: payload.content_structure ?? existing.content_structure,
    };
    mockExtraData.set(courseId, updated);
    return Promise.resolve(updated);
  }

  return putJson<CourseExtraDataResponse>(endpoints.update(courseId), payload);
}

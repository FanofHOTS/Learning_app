const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";
const USE_MOCK_COURSE_COMPONENT_DATA =
  process.env.NEXT_PUBLIC_USE_MOCK_DATA !== "false";

export type CourseComponentInfo = {
  id: number;
  course_id: number;
  module_id: number;
  title: string;
  component_sequence: number;
  component_type: string;
  ref_id: number | null;
  summary: string;
  estimated_minutes: number;
  is_preview: boolean;
};

type FastApiError = {
  detail?: string;
};

const endpoints = {
  byRef: (componentType: string, refId: number) =>
    `${API_BASE_URL}/course_component/by_ref/${componentType}/${refId}`,
};

const mockComponentsByRef: Record<string, CourseComponentInfo> = {
  "exam_1": {
    id: 1002,
    course_id: 1,
    module_id: 11,
    title: "Bài kiểm tra: Kiểm tra hiểu biết ban đầu",
    component_sequence: 2,
    component_type: "exam",
    ref_id: 1,
    summary: "Bài kiểm tra ngắn để xác nhận bạn đã nắm phần giới thiệu của khóa học.",
    estimated_minutes: 10,
    is_preview: false,
  },
};

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    let detail = "Không thể kết nối tới máy chủ FastAPI.";
    try {
      const error = (await response.json()) as FastApiError;
      if (error.detail) detail = error.detail;
    } catch {
      // fallback
    }
    throw new Error(detail);
  }

  return (await response.json()) as T;
}

export async function getCourseComponentByRef(
  componentType: string,
  refId: number,
): Promise<CourseComponentInfo | null> {
  if (USE_MOCK_COURSE_COMPONENT_DATA) {
    const key = `${componentType}_${refId}`;
    return mockComponentsByRef[key] ?? null;
  }

  try {
    return await getJson<CourseComponentInfo>(endpoints.byRef(componentType, refId));
  } catch {
    return null;
  }
}

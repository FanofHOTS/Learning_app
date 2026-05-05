const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";
const USE_MOCK_CATEGOGY_DATA =
  process.env.NEXT_PUBLIC_USE_MOCK_DATA !== "false";

export type Category = {
  id: number;
  name: string;
  description: string;
};

export type CourseCreatePayload = {
  title: string;
  category_id: number;
  instructor_id: number;
  introduction: string;
  description: string;
  level: string;
  total_module: number;
  image: string;
  is_active: boolean;
  is_public: boolean;
};

export type ModuleCreatePayload = {
  course_id: number;
  title: string;
  module_sequence: number;
  type: string;
  introduction: string;
  total_component: number;
};

export type CourseComponentCreatePayload = {
  course_id: number;
  module_id: number;
  title: string;
  component_sequence: number;
  component_type: string;
  ref_id?: number | null;
  summary: string;
  estimated_minutes: number;
  is_preview: boolean;
};

export type DocumentCreatePayload = {
  title: string;
  document_type: "pdf" | "video" | "other";
  content?: string;
  file_url: string;
  course_id?: number;
  module_id?: number;
};

export type ExamCreatePayload = {
  title: string;
  description?: string;
  course_id?: number;
  module_id?: number;
  duration_minutes: number;
  total_questions: number;
  pass_score: number;
  max_score: number;
  is_active: boolean;
};

export type UploadResponse = {
  file_url: string;
};

const endpoints = {
  categories: () => `${API_BASE_URL}/category/`,
  createCourse: () => `${API_BASE_URL}/course/create`,
  createModule: () => `${API_BASE_URL}/module/create`,
  createComponent: () => `${API_BASE_URL}/course_component/create`,
  createDocument: () => `${API_BASE_URL}/document/create`,
  uploadDocument: () => `${API_BASE_URL}/document/upload`,
  createExam: () => `${API_BASE_URL}/exam/create`,
};

const mockCaterogy: Category[] = [
    {
        id: 1,
        name: "Hướng dẫn sử dụng trang web",
        description: "Đây là phân loại liên quan tới việc hướng dẫn sử dụng trang web"
    },
    {
        id: 2,
        name: "Lập trình",
        description: "Đây là phân loại liên quan tới lập trình"
    },
    {
        id: 3,
        name: "Toán học",
        description: "Đây là phân loại liên quan tới toán học"
    },
    {
        id: 4,
        name: "Dữ liệu",
        description: "Đây là phân loại liên quan tới dữ liệu"
    }
]

async function parseError(response: Response): Promise<Error> {
  let errorDetail = "Lỗi kết nối đến máy chủ.";
  try {
    const json = await response.json();
    if (json?.detail) {
      errorDetail = json.detail;
    }
  } catch {
    // ignore parse errors
  }
  return new Error(errorDetail);
}

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options);
  if (!response.ok) {
    throw await parseError(response);
  }
  return (await response.json()) as T;
}

export async function getCategoryList(): Promise<Category[]> {
  if (USE_MOCK_CATEGOGY_DATA){
    return Promise.resolve(mockCaterogy)
  }  
  return fetchJson<Category[]>(endpoints.categories());
}

export async function createCourse(
  payload: CourseCreatePayload,
): Promise<{ id: number }> {
  return fetchJson<{ id: number }>(endpoints.createCourse(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

export async function createModule(
  payload: ModuleCreatePayload,
): Promise<{ id: number }> {
  return fetchJson<{ id: number }>(endpoints.createModule(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

export async function createCourseComponent(
  payload: CourseComponentCreatePayload,
): Promise<{ id: number }> {
  return fetchJson<{ id: number }>(endpoints.createComponent(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

export async function createDocument(
  payload: DocumentCreatePayload,
): Promise<{ id: number; file_url: string }> {
  return fetchJson<{ id: number; file_url: string }>(
    endpoints.createDocument(),
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
  );
}

export async function uploadDocumentFile(
  file: File,
  documentType: string,
): Promise<UploadResponse> {
  const form = new FormData();
  form.append("file", file);
  form.append("document_type", documentType);

  const response = await fetch(endpoints.uploadDocument(), {
    method: "POST",
    body: form,
  });

  if (!response.ok) {
    throw await parseError(response);
  }

  return (await response.json()) as UploadResponse;
}

export async function createExam(
  payload: ExamCreatePayload,
): Promise<{ id: number }> {
  return fetchJson<{ id: number }>(endpoints.createExam(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}
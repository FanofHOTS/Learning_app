const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";
const USE_MOCK_DOCUMENT_DATA = process.env.NEXT_PUBLIC_USE_MOCK_DATA !== "false";

export type DocumentType = "pdf" | "video" | "other";

export type CourseDocument = {
  id: number;
  title: string;
  document_type: DocumentType;
  content?: string | null;
  file_url: string;
  course_id?: number | null;
  module_id?: number | null;
  created_at?: string | null;
};

const endpoints = {
  documents: () => `${API_BASE_URL}/document/`,
  documentById: (documentId: number) => `${API_BASE_URL}/document/${documentId}`,
  documentsByCourse: (courseId: number) => `${API_BASE_URL}/document/course/${courseId}`,
};

const mockDocuments: CourseDocument[] = [
  {
    id: 1,
    course_id: 1,
    module_id: 3,
    title: "Giáo trình lập trình web",
    content: "Tài liệu hướng dẫn chi tiết về lập trình web.",
    document_type: "pdf",
    file_url: "/document/sample.pdf"
  },
  {
    id: 2,
    course_id: 1,
    module_id: 3,
    title: "Bài tập thực hành",
    content: "Các bài tập thực hành để củng cố kiến thức.",
    document_type: "pdf",
    file_url: "/document/sample.pdf"
  },
  {
    id: 3,
    course_id: 1,
    module_id: 4,
    title: "Video thực hành web",
    document_type: "video",
    content: "Video giúp bạn nắm bắt nhanh cách làm 1 trang web.",
    file_url: "/document/sample-video.mp4"
  },
  {
    id: 4,
    course_id: 2,
    module_id: 2,
    title: "Giáo trình trí tuệ nhân tạo",
    content: "Tài liệu hướng dẫn chi tiết về trí tuệ nhân tạo.",
    document_type: "pdf",
    file_url: "/document/sample.pdf",
  },
  {
    id: 5,
    course_id: 2,
    module_id: 3,
    title: "Tài liệu bổ sung về trí tuệ nhân tạo",
    document_type: "other",
    content: "Tải về tài liệu này để tham khảo thêm khi học.",
    file_url: "/document/sample-slide.pptx",
  }
];

function getJson<ResponseData>(response: Response): Promise<ResponseData> {
  return response.json();
}

async function parseError(response: Response): Promise<Error> {
  const data = await getJson<{ detail?: string }>(response);
  const message = data?.detail ?? "Lỗi máy chủ khi lấy dữ liệu tài liệu.";
  return new Error(message);
}

async function fetchDocument<ResponseData>(url: string): Promise<ResponseData> {
  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw await parseError(response);
  }

  return getJson<ResponseData>(response);
}

async function fetchDocumentOrFallback<ResponseData>(
  url: string,
  fallbackValue: ResponseData,
): Promise<ResponseData> {
  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    return fallbackValue;
  }

  return getJson<ResponseData>(response);
}

export async function getDocumentById(documentId: number): Promise<CourseDocument> {
  if (USE_MOCK_DOCUMENT_DATA) {
    const mockDocument = mockDocuments.find((item) => item.id === documentId);
    if (!mockDocument) {
      throw new Error("Tài liệu giả lập không tồn tại.");
    }
    return Promise.resolve(mockDocument);
  }

  return fetchDocument<CourseDocument>(endpoints.documentById(documentId));
}

export async function getDocumentsByCourse(courseId: number): Promise<CourseDocument[]> {
  if (USE_MOCK_DOCUMENT_DATA) {
    return Promise.resolve(
      mockDocuments.filter((item) => item.course_id === courseId),
    );
  }

  return fetchDocumentOrFallback<CourseDocument[]>(
    endpoints.documentsByCourse(courseId),
    [],
  );
}

export async function getDocumentList(): Promise<CourseDocument[]> {
  if (USE_MOCK_DOCUMENT_DATA) {
    return Promise.resolve(mockDocuments);
  }

  return fetchDocumentOrFallback<CourseDocument[]>(endpoints.documents(), []);
}

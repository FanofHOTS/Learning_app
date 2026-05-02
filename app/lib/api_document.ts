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
  documentById: (documentId: number) => `${API_BASE_URL}/document/${documentId}`,
  documentsByCourse: (courseId: number) => `${API_BASE_URL}/document/course/${courseId}`,
};

const mockDocuments: CourseDocument[] = [
  {
    id: 301,
    title: "Giới thiệu khóa học bằng PDF",
    document_type: "pdf",
    content: "Tài liệu PDF này trình bày các khái niệm chính và hướng dẫn học tập.",
    file_url: "/document/sample.pdf",
    course_id: 1,
    module_id: 11,
  },
  {
    id: 302,
    title: "Video hướng dẫn học tập",
    document_type: "video",
    content: "Video ngắn giúp bạn nắm bắt nhanh nội dung bài học.",
    file_url: "/document/sample-video.mp4",
    course_id: 1,
    module_id: 12,
  },
  {
    id: 303,
    title: "Tài liệu bổ sung",
    document_type: "other",
    content: "Tải về tài liệu này để tham khảo thêm khi học.",
    file_url: "/document/sample-slide.pptx",
    course_id: 1,
    module_id: 13,
  },
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

  return fetchDocument<CourseDocument[]>(endpoints.documentsByCourse(courseId));
}
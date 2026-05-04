import type { CourseDocument, DocumentType, getDocumentList } from "./api_document";
import type { FastAPICourse } from "./api_course";
import { getInstructorCourseListRaw } from "./api_course_instructor";
import { uploadDocumentFile } from "./api_create_course"

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";
const USE_MOCK_DOCUMENT_DATA =
  process.env.NEXT_PUBLIC_USE_MOCK_DATA !== "false";

export type InstructorDocument = CourseDocument & {
  course_name: string;
};

export type InstructorDocumentFilterState = {
  keyword: string;
  courseId: string;
  type: string;
};

const endpoints = {
  documents: () => `${API_BASE_URL}/document/`,
  coursesByInstructor: (instructorId: number) =>
    `${API_BASE_URL}/course/instructor/${instructorId}`,
  updateDocument: (documentId: number) => `${API_BASE_URL}/document/update/${documentId}`,
  documentsByCourse: (courseId: number) => `${API_BASE_URL}/document/course/${courseId}`,
};

const mockDocuments: CourseDocument[] =
[
  {
    id: 1,
    course_id: 1,
    title: "Giáo trình lập trình web",
    content: "Tài liệu hướng dẫn chi tiết về lập trình web.",
    document_type: "pdf",
    file_url: "/document/sample.pdf"
  },
  {
    id: 2,
    course_id: 1,
    title: "Bài tập thực hành",
    content: "Các bài tập thực hành để củng cố kiến thức.",
    document_type: "pdf",
    file_url: "/document/sample.pdf"
  },
  {
    id: 3,
    course_id: 1,
    title: "Video thực hành web",
    document_type: "video",
    content: "Video giúp bạn nắm bắt nhanh cách làm 1 trang web.",
    file_url: "/document/sample-video.mp4"
  },
  {
    id: 4,
    course_id: 2,
    title: "Giáo trình trí tuệ nhân tạo",
    content: "Tài liệu hướng dẫn chi tiết về trí tuệ nhân tạo.",
    document_type: "pdf",
    file_url: "/document/sample.pdf",
  },
  {
    id: 5,
    course_id: 2,
    title: "Tài liệu bổ sung về trí tuệ nhân tạo",
    document_type: "other",
    content: "Tải về tài liệu này để tham khảo thêm khi học.",
    file_url: "/document/sample-slide.pptx",
  }
];

const mockDocumentsInstructor: InstructorDocument[] = [
  {
    id: 1,
    course_id: 1,
    title: "Giáo trình lập trình web",
    content: "Tài liệu hướng dẫn chi tiết về lập trình web.",
    document_type: "pdf",
    file_url: "/document/sample.pdf",
    course_name: "Xây dựng ứng dụng học tập với Next.js",
  },
  {
    id: 2,
    course_id: 1,
    title: "Bài tập thực hành",
    content: "Các bài tập thực hành để củng cố kiến thức.",
    document_type: "pdf",
    file_url: "/document/sample.pdf",
    course_name: "Xây dựng ứng dụng học tập với Next.js",
  },
  {
    id: 3,
    course_id: 2,
    title: "Giáo trình trí tuệ nhân tạo",
    content: "Tài liệu hướng dẫn chi tiết về trí tuệ nhân tạo.",
    document_type: "pdf",
    file_url: "/document/sample.pdf",
    course_name: "Trí tuệ nhân tạo cơ bản",
  },
];

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

export async function updateInstructorQuestion(
  documentId: number,
  document: Partial<Omit<CourseDocument, "id">>,
): Promise<CourseDocument> {
  if (USE_MOCK_DOCUMENT_DATA){
    const index = mockDocuments.findIndex((document) => document.id === documentId);
    if (index === -1) {
      throw new Error("Học liệu không tồn tại.");
    }
    mockDocuments[index] = {
      ...mockDocuments[index],
      ...document,
    };
    return Promise.resolve(mockDocuments[index]);
  }
  return fetchJson<CourseDocument>(endpoints.updateDocument(documentId), {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(document),
  });
}

export function filterInstructorDocument(
  document: InstructorDocument[],
  filters: InstructorDocumentFilterState
): InstructorDocument[] {
  const keyword = filters.keyword.trim().toLowerCase();
  return document.filter((document) => {
    const matchesKeyword =
      keyword.length === 0 ||
      document.title.toLowerCase().includes(keyword) ||
      document.course_name.toLowerCase().includes(keyword);

    const matchesCourse =
      filters.courseId === "all" ||
      `${document.course_id}` === filters.courseId;

    const matchesType =
      filters.type === "all" ||
      document.document_type.toLowerCase() === filters.type.toLowerCase(); 
    
    return (
      matchesKeyword &&
      matchesCourse &&
      matchesType
    );
  });
}
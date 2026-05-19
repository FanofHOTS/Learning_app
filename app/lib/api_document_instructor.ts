import type { CourseDocument, DocumentType } from "./api_document";
import { getDocumentList } from "./api_document";
import { type UploadResponse } from "./api_create_course";
import { getInstructorCourseListRaw, type InstructorCourse } from "./api_course_instructor";

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

export type DeleteOldUploadResponse = {
  message: string;
};

type FastApiError = {
  detail?: string;
};

type FastCourseLike = Pick<InstructorCourse, "id" | "title">;

const endpoints = {
  updateDocument: (documentId: number) => `${API_BASE_URL}/document/update/${documentId}`,
  uploadDocument: () => `${API_BASE_URL}/document/upload`,
  deleteOldUpload: (fileUrl: string) =>
    `${API_BASE_URL}/document/delete_upload?file_url=${encodeURIComponent(fileUrl)}`,
};

const documentTypeOptions: Array<{ value: DocumentType; label: string }> = [
  { value: "pdf", label: "PDF" },
  { value: "video", label: "Video" },
  { value: "other", label: "Tài liệu khác" },
];

const fileTypeRules: Record<DocumentType, string[]> = {
  pdf: [".pdf"],
  video: [".mp4", ".webm", ".ogg"],
  other: [
    ".doc",
    ".docx",
    ".ppt",
    ".pptx",
    ".xls",
    ".xlsx",
    ".txt",
    ".zip",
    ".rar",
    ".png",
    ".jpg",
    ".jpeg",
  ],
};

const mockDocuments: CourseDocument[] = [
  {
    id: 1,
    course_id: 1,
    module_id: 3,
    title: "Giáo trình lập trình web",
    content: "Tài liệu hướng dẫn chi tiết về lập trình web.",
    document_type: "pdf",
    file_url: "/uploads/giao-trinh-web.pdf",
  },
  {
    id: 2,
    course_id: 1,
    module_id: 3,
    title: "Bài tập thực hành giao diện",
    content: "Tệp bài tập thực hành để học sinh tự làm sau khi học xong module.",
    document_type: "other",
    file_url: "/uploads/bai-tap-thuc-hanh.docx",
  },
  {
    id: 3,
    course_id: 1,
    module_id: 4,
    title: "Video thực hành web",
    document_type: "video",
    content: "Video hướng dẫn triển khai một giao diện học trực tuyến cơ bản.",
    file_url: "/uploads/video-thuc-hanh.mp4",
  },
  {
    id: 4,
    course_id: 2,
    module_id: 2,
    title: "Giáo trình trí tuệ nhân tạo",
    content: "Tài liệu nền tảng về trí tuệ nhân tạo cho giảng viên.",
    document_type: "pdf",
    file_url: "/uploads/giao-trinh-ai.pdf",
  },
  {
    id: 5,
    course_id: 2,
    module_id: 3,
    title: "Slide bổ sung về AI",
    document_type: "other",
    content: "Slide phục vụ giảng dạy và thảo luận trên lớp.",
    file_url: "/uploads/slide-ai.pptx",
  },
];

async function parseError(response: Response): Promise<Error> {
  let errorDetail = "Không thể kết nối đến máy chủ FastAPI.";
  try {
    const json = (await response.json()) as FastApiError;
    if (typeof json.detail === "string" && json.detail.trim()) {
      errorDetail = json.detail;
    }
  } catch {
    // Bỏ qua lỗi parse JSON để dùng thông báo mặc định.
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

function getExtension(fileNameOrUrl: string): string {
  const normalized = fileNameOrUrl.toLowerCase().split("?")[0];
  const lastDot = normalized.lastIndexOf(".");
  if (lastDot < 0) {
    return "";
  }
  return normalized.slice(lastDot);
}

export function getDocumentTypeOptions() {
  return documentTypeOptions;
}

export function getDocumentTypeLabel(documentType: DocumentType): string {
  const option = documentTypeOptions.find((item) => item.value === documentType);
  return option?.label ?? "Tài liệu";
}

export function validateDocumentFileMatchesType(
  documentType: DocumentType,
  fileNameOrUrl: string,
): string | null {
  const extension = getExtension(fileNameOrUrl);
  if (!extension) {
    return "Không xác định được định dạng tệp tải lên.";
  }

  if (documentType === "other") {
    if (fileTypeRules.other.includes(extension)) {
      return null;
    }
    if (fileTypeRules.pdf.includes(extension) || fileTypeRules.video.includes(extension)) {
      return "Loại tài liệu 'Tài liệu khác' không nên dùng tệp PDF hoặc video.";
    }
    return null;
  }

  if (fileTypeRules[documentType].includes(extension)) {
    return null;
  }

  if (documentType === "pdf") {
    return "Tài liệu PDF chỉ chấp nhận tệp có đuôi .pdf.";
  }

  return "Tài liệu video chỉ chấp nhận tệp .mp4, .webm hoặc .ogg.";
}

export async function getInstructorDocumentList(
  instructorId: number,
): Promise<InstructorDocument[]> {
  const [documents, courses] = await Promise.all([
    getDocumentList(),
    getInstructorCourseListRaw(instructorId),
  ]);

  const courseMap = new Map<number, FastCourseLike>(
    courses.map((course) => [course.id, course]),
  );

  return documents
    .filter((document) => {
      if (!document.course_id) {
        return false;
      }
      return courseMap.has(document.course_id);
    })
    .map((document) => ({
      ...document,
      course_name:
        courseMap.get(document.course_id ?? -1)?.title ??
        `Khóa học #${document.course_id}`,
    }));
}

export async function updateInstructorDocument(
  documentId: number,
  document: Partial<Omit<CourseDocument, "id">>,
): Promise<CourseDocument> {
  if (USE_MOCK_DOCUMENT_DATA) {
    const index = mockDocuments.findIndex((item) => item.id === documentId);
    if (index === -1) {
      throw new Error("Tài liệu không tồn tại.");
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

export async function uploadNewDocumentFile(
  file: File,
  documentType: DocumentType,
): Promise<UploadResponse> {
  const validationError = validateDocumentFileMatchesType(documentType, file.name);
  if (validationError) {
    throw new Error(validationError);
  }

  if (USE_MOCK_DOCUMENT_DATA) {
    return Promise.resolve({
      //file_url: `/uploads/${Date.now()}-${file.name}`,
      file_url: `/uploads/${file.name}`,
    });
  }

  const form = new FormData();
  form.append("file", file);
  form.append("document_type", documentType);

  return fetchJson<UploadResponse>(endpoints.uploadDocument(), {
    method: "POST",
    body: form,
  });
}

export async function deleteOldUploadedFile(
  fileUrl: string,
): Promise<DeleteOldUploadResponse> {
  if (USE_MOCK_DOCUMENT_DATA) {
    return Promise.resolve({
      message: "Tệp cũ đã được xóa thành công.",
    });
  }

  return fetchJson<DeleteOldUploadResponse>(endpoints.deleteOldUpload(fileUrl), {
    method: "POST",
  });
}

export function getInstructorDocumentTypeSummary(documents: InstructorDocument[]) {
  return {
    pdf: documents.filter((document) => document.document_type === "pdf").length,
    video: documents.filter((document) => document.document_type === "video").length,
    other: documents.filter((document) => document.document_type === "other").length,
  };
}

export function filterInstructorDocument(
  documents: InstructorDocument[],
  filters: InstructorDocumentFilterState,
): InstructorDocument[] {
  const keyword = filters.keyword.trim().toLowerCase();

  return documents.filter((document) => {
    const matchesKeyword =
      keyword.length === 0 ||
      document.title.toLowerCase().includes(keyword) ||
      document.course_name.toLowerCase().includes(keyword) ||
      (document.content ?? "").toLowerCase().includes(keyword);

    const matchesCourse =
      filters.courseId === "all" || `${document.course_id}` === filters.courseId;

    const matchesType =
      filters.type === "all" ||
      document.document_type.toLowerCase() === filters.type.toLowerCase();

    return matchesKeyword && matchesCourse && matchesType;
  });
}

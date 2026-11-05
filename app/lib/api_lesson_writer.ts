export type LessonWritingAction =
  | "continue_from_outline"
  | "rewrite_selection"
  | "learning_objectives"
  | "create_activity"
  | "create_questions"
  | "generate_from_document";

export type LessonWritingRequest = {
  action: LessonWritingAction;
  title?: string;
  outline?: string;
  selected_text?: string;
  document_id?: number;
  context?: string;
  instructions?: string;
};

export type LessonWritingResponse = {
  action: LessonWritingAction;
  generated_text: string;
  model_used: string;
};

type ApiErrorResponse = {
  detail?: string;
};

export class LessonWriterApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "LessonWriterApiError";
    this.status = status;
  }
}

export async function generateLessonText(
  payload: LessonWritingRequest,
  uploadFile?: File,
): Promise<LessonWritingResponse> {
  let body: BodyInit;
  const headers: Record<string, string> = {
    Accept: "application/json",
  };

  if (uploadFile) {
    const formData = new FormData();
    for (const [key, value] of Object.entries(payload)) {
      if (value !== undefined && key !== "document_id") {
        formData.append(key, String(value));
      }
    }
    formData.append("file", uploadFile);
    body = formData;
  } else {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(payload);
  }

  const response = await fetch("/api/instructor/lesson-writer", {
    body,
    cache: "no-store",
    headers,
    method: "POST",
  });

  if (!response.ok) {
    let message = "Không thể tạo nội dung bài giảng bằng AI.";
    try {
      const error = (await response.json()) as ApiErrorResponse;
      if (typeof error.detail === "string" && error.detail.trim()) {
        message = error.detail;
      }
    } catch {
      // Dùng thông báo mặc định nếu máy chủ không trả JSON.
    }
    throw new LessonWriterApiError(response.status, message);
  }

  return (await response.json()) as LessonWritingResponse;
}

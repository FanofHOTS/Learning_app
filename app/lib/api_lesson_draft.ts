import type { JSONContent } from "@tiptap/core";

export type LessonDraftSummary = {
  id: number;
  instructor_id: number;
  course_id: number | null;
  title: string;
  version: number;
  created_at: string;
  updated_at: string;
};

export type LessonDraft = LessonDraftSummary & {
  content: JSONContent;
};

type LessonDraftPayload = {
  title: string;
  content: JSONContent;
  version?: number;
};

type ApiErrorResponse = {
  detail?: string;
};

export class LessonDraftApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "LessonDraftApiError";
    this.status = status;
  }
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    cache: "no-store",
    headers: {
      Accept: "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    let message = "Không thể đồng bộ bản nháp với máy chủ.";
    try {
      const error = (await response.json()) as ApiErrorResponse;
      if (typeof error.detail === "string" && error.detail.trim()) {
        message = error.detail;
      }
    } catch {
      // Dùng thông báo mặc định nếu máy chủ không trả JSON.
    }
    throw new LessonDraftApiError(response.status, message);
  }

  return (await response.json()) as T;
}

export function getLessonDraftList(): Promise<LessonDraftSummary[]> {
  return requestJson("/api/instructor/lesson-drafts");
}

export function getLessonDraft(draftId: number): Promise<LessonDraft> {
  return requestJson(`/api/instructor/lesson-drafts/${draftId}`);
}

export function createLessonDraft(
  payload: Omit<LessonDraftPayload, "version">,
): Promise<LessonDraft> {
  return requestJson("/api/instructor/lesson-drafts", {
    body: JSON.stringify(payload),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });
}

export function updateLessonDraft(
  draftId: number,
  payload: LessonDraftPayload & { version: number },
): Promise<LessonDraft> {
  return requestJson(`/api/instructor/lesson-drafts/${draftId}`, {
    body: JSON.stringify(payload),
    headers: { "Content-Type": "application/json" },
    method: "PUT",
  });
}

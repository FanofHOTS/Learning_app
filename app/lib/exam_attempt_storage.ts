import type { ExamAnswerSelection } from "./api_exam";

/**
 * Bản lưu dự phòng trên trình duyệt.
 *
 * Máy chủ vẫn là nguồn sự thật; bản lưu này chỉ để cứu bài khi mất mạng hoặc
 * đóng tab trước khi lần lưu gần nhất lên được máy chủ. Khi mở lại, bản lưu nào
 * mới hơn (theo `savedAt`) sẽ được dùng và đẩy lên máy chủ ngay sau đó.
 */
export type ExamAttemptDraft = {
  attemptId: number;
  answers: Record<number, ExamAnswerSelection>;
  savedAt: number;
};

const DRAFT_KEY_PREFIX = "exam-attempt-draft:v1";

function draftKey(userId: number, examId: number): string {
  return `${DRAFT_KEY_PREFIX}:${userId}:${examId}`;
}

function isSelection(value: unknown): value is ExamAnswerSelection {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as {
    kind?: unknown;
    optionId?: unknown;
    optionIds?: unknown;
    values?: unknown;
  };

  if (record.kind === "single") {
    return typeof record.optionId === "number";
  }
  if (record.kind === "multiple") {
    return (
      Array.isArray(record.optionIds) &&
      record.optionIds.every((optionId) => typeof optionId === "number")
    );
  }
  if (record.kind === "blanks") {
    return (
      Array.isArray(record.values) &&
      record.values.every((entry) => typeof entry === "string")
    );
  }
  return false;
}

function normalizeDraft(value: unknown): ExamAttemptDraft | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as {
    attemptId?: unknown;
    answers?: unknown;
    savedAt?: unknown;
  };

  if (typeof record.attemptId !== "number" || !Number.isFinite(record.attemptId)) {
    return null;
  }
  if (!record.answers || typeof record.answers !== "object") {
    return null;
  }

  const answers: Record<number, ExamAnswerSelection> = {};
  for (const [key, selection] of Object.entries(
    record.answers as Record<string, unknown>,
  )) {
    const questionId = Number(key);
    if (!Number.isFinite(questionId) || !isSelection(selection)) {
      continue;
    }
    answers[questionId] =
      selection.kind === "single"
        ? {
            kind: "single",
            optionId: selection.optionId,
            content: selection.content ?? "",
          }
        : selection;
  }

  return {
    attemptId: record.attemptId,
    answers,
    savedAt:
      typeof record.savedAt === "number" && Number.isFinite(record.savedAt)
        ? record.savedAt
        : 0,
  };
}

export function loadExamAttemptDraft(
  userId: number,
  examId: number,
): ExamAttemptDraft | null {
  if (typeof window === "undefined" || userId <= 0 || examId <= 0) {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(draftKey(userId, examId));
    if (!raw) {
      return null;
    }
    return normalizeDraft(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function saveExamAttemptDraft(
  userId: number,
  examId: number,
  draft: ExamAttemptDraft,
): void {
  if (typeof window === "undefined" || userId <= 0 || examId <= 0) {
    return;
  }

  try {
    window.localStorage.setItem(draftKey(userId, examId), JSON.stringify(draft));
  } catch {
    // localStorage bị chặn/quá dung lượng — vẫn còn bản lưu trên máy chủ.
  }
}

export function clearExamAttemptDraft(userId: number, examId: number): void {
  if (typeof window === "undefined" || userId <= 0 || examId <= 0) {
    return;
  }

  try {
    window.localStorage.removeItem(draftKey(userId, examId));
  } catch {
    // Bỏ qua khi localStorage bị chặn.
  }
}

/** Bản nháp cũ hơn mốc này (7 ngày) được coi là bỏ dở và bị dọn. */
export const EXAM_ATTEMPT_DRAFT_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Dọn bản nháp trên trình duyệt của các lượt làm bài bỏ dở từ lâu.
 *
 * Xóa cả bản nháp hỏng/không đọc được. Chỉ chạm vào các key do module này
 * tạo, không đụng dữ liệu localStorage khác. Trả về số key đã xóa.
 */
export function pruneExamAttemptDrafts(
  maxAgeMs: number = EXAM_ATTEMPT_DRAFT_RETENTION_MS,
): number {
  if (typeof window === "undefined") {
    return 0;
  }

  const effectiveMaxAgeMs =
    Number.isFinite(maxAgeMs) && maxAgeMs > 0
      ? maxAgeMs
      : EXAM_ATTEMPT_DRAFT_RETENTION_MS;
  const now = Date.now();
  const keysToRemove: string[] = [];

  try {
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if (!key || !key.startsWith(`${DRAFT_KEY_PREFIX}:`)) {
        continue;
      }

      let draft: ExamAttemptDraft | null = null;
      try {
        const raw = window.localStorage.getItem(key);
        draft = raw ? normalizeDraft(JSON.parse(raw)) : null;
      } catch {
        draft = null;
      }

      if (
        !draft ||
        !Number.isFinite(draft.savedAt) ||
        now - draft.savedAt > effectiveMaxAgeMs
      ) {
        keysToRemove.push(key);
      }
    }

    for (const key of keysToRemove) {
      window.localStorage.removeItem(key);
    }
  } catch {
    return 0;
  }

  return keysToRemove.length;
}

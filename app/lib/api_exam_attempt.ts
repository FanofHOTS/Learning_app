import {
  type AnswerItem,
  type ExamResult,
  submitExamResult,
} from "./api_exam";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";
const USE_MOCK_EXAM_DATA =
  process.env.NEXT_PUBLIC_USE_MOCK_DATA !== "false";

export type ExamAttemptStatus = "in_progress" | "submitted";

/** Trạng thái một lượt làm bài do máy chủ quản lý (kể cả hạn nộp). */
export type ExamAttemptRead = {
  id: number;
  user_id: number;
  exam_id: number;
  status: ExamAttemptStatus;
  question_ids: number[];
  answers: AnswerItem[];
  version: number;
  started_at: string;
  deadline_at?: string | null;
  remaining_seconds?: number | null;
  last_saved_at?: string | null;
  submitted_at?: string | null;
  result?: ExamResult | null;
};

export type ExamAttemptStartParams = {
  userId: number;
  examId: number;
  questionIds: number[];
  /** Chỉ dùng cho chế độ mô phỏng để tính hạn nộp. */
  durationMinutes?: number;
};

/**
 * Điểm số client đã tính, chỉ dùng cho chế độ mô phỏng.
 *
 * Ở chế độ thật, máy chủ tự chấm từ `answers`, nên không gửi dữ liệu này lên.
 */
export type ExamAttemptSubmitMetrics = {
  score: number;
  maxScore: number;
  totalQuestions: number;
  correctAnswers: number;
  isPassed: boolean;
};

export type ExamAttemptErrorKind =
  | "network"
  | "not_found"
  | "already_submitted"
  | "server";

export class ExamAttemptError extends Error {
  readonly kind: ExamAttemptErrorKind;
  readonly status: number;

  constructor(
    message: string,
    options: { kind?: ExamAttemptErrorKind; status?: number } = {},
  ) {
    super(message);
    this.name = "ExamAttemptError";
    this.kind = options.kind ?? "server";
    this.status = options.status ?? 0;
  }
}

/**
 * Mốc thời gian máy chủ trả về có thể không kèm timezone (SQLite) — coi là UTC
 * để so sánh với bản lưu trên trình duyệt mà không lệch múi giờ.
 */
export function parseServerTimestamp(value?: string | null): number {
  if (!value) {
    return 0;
  }
  const hasTimezone = /[zZ]$|[+-]\d{2}:?\d{2}$/.test(value);
  const parsed = Date.parse(hasTimezone ? value : `${value}Z`);
  return Number.isFinite(parsed) ? parsed : 0;
}

const endpoints = {
  start: `${API_BASE_URL}/exam_attempt/start`,
  autosave: (attemptId: number) =>
    `${API_BASE_URL}/exam_attempt/${attemptId}/autosave`,
  submit: (attemptId: number) =>
    `${API_BASE_URL}/exam_attempt/${attemptId}/submit`,
};

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as { detail?: unknown };
    if (typeof payload.detail === "string" && payload.detail.trim()) {
      return payload.detail;
    }
  } catch {
    // Bỏ qua lỗi parse JSON để dùng thông báo mặc định.
  }
  return "Không thể kết nối tới máy chủ.";
}

async function requestAttempt(
  url: string,
  init: RequestInit,
): Promise<ExamAttemptRead> {
  let response: Response;
  try {
    response = await fetch(url, init);
  } catch {
    throw new ExamAttemptError(
      "Không kết nối được máy chủ. Bài làm vẫn được giữ trên trình duyệt và sẽ được lưu lại khi có mạng.",
      { kind: "network" },
    );
  }

  if (!response.ok) {
    const detail = await readErrorMessage(response);
    throw new ExamAttemptError(detail, {
      status: response.status,
      kind:
        response.status === 404
          ? "not_found"
          : response.status === 409
            ? "already_submitted"
            : "server",
    });
  }

  return (await response.json()) as ExamAttemptRead;
}

// ── Chế độ mô phỏng ──────────────────────────────────────

const MOCK_STORE_KEY = "mock-exam-attempts:v1";

type MockAttemptStore = Record<string, ExamAttemptRead>;

function readMockStore(): MockAttemptStore {
  if (typeof window === "undefined") {
    return {};
  }
  try {
    const raw = window.localStorage.getItem(MOCK_STORE_KEY);
    if (!raw) {
      return {};
    }
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === "object"
      ? (parsed as MockAttemptStore)
      : {};
  } catch {
    return {};
  }
}

function writeMockStore(store: MockAttemptStore): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(MOCK_STORE_KEY, JSON.stringify(store));
  } catch {
    // localStorage bị chặn — bỏ qua.
  }
}

function mockRemainingSeconds(deadlineAt?: string | null): number | null {
  if (!deadlineAt) {
    return null;
  }
  return Math.max(
    0,
    Math.ceil((Date.parse(deadlineAt) - Date.now()) / 1000),
  );
}

export async function startExamAttempt(
  params: ExamAttemptStartParams,
): Promise<ExamAttemptRead> {
  if (USE_MOCK_EXAM_DATA) {
    const store = readMockStore();
    const existing = Object.values(store)
      .filter(
        (attempt) =>
          attempt.user_id === params.userId &&
          attempt.exam_id === params.examId &&
          attempt.status === "in_progress",
      )
      .sort((left, right) => right.id - left.id)[0];

    if (existing) {
      return {
        ...existing,
        remaining_seconds: mockRemainingSeconds(existing.deadline_at),
      };
    }

    const nextId =
      Math.max(0, ...Object.keys(store).map((key) => Number(key))) + 1;
    const duration = Math.max(0, Math.floor(params.durationMinutes ?? 0));
    const startedAt = Date.now();
    const attempt: ExamAttemptRead = {
      id: nextId,
      user_id: params.userId,
      exam_id: params.examId,
      status: "in_progress",
      question_ids: [...params.questionIds],
      answers: [],
      version: 0,
      started_at: new Date(startedAt).toISOString(),
      deadline_at:
        duration > 0
          ? new Date(startedAt + duration * 60_000).toISOString()
          : null,
      remaining_seconds: duration > 0 ? duration * 60 : null,
      last_saved_at: null,
      submitted_at: null,
      result: null,
    };

    store[String(attempt.id)] = attempt;
    writeMockStore(store);
    return attempt;
  }

  return requestAttempt(endpoints.start, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      user_id: params.userId,
      exam_id: params.examId,
      question_ids: params.questionIds,
    }),
  });
}

export async function autosaveExamAttempt(
  attemptId: number,
  answers: AnswerItem[],
  options: { keepalive?: boolean } = {},
): Promise<ExamAttemptRead> {
  if (USE_MOCK_EXAM_DATA) {
    const store = readMockStore();
    const attempt = store[String(attemptId)];
    if (!attempt) {
      throw new ExamAttemptError("Không tìm thấy lượt làm bài.", {
        kind: "not_found",
        status: 404,
      });
    }
    if (attempt.status === "submitted") {
      return attempt;
    }

    const saved: ExamAttemptRead = {
      ...attempt,
      answers: [...answers],
      version: attempt.version + 1,
      last_saved_at: new Date().toISOString(),
      remaining_seconds: mockRemainingSeconds(attempt.deadline_at),
    };
    store[String(attemptId)] = saved;
    writeMockStore(store);
    return saved;
  }

  return requestAttempt(endpoints.autosave(attemptId), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ answers }),
    keepalive: options.keepalive ?? false,
  });
}

export async function submitExamAttempt(
  attemptId: number,
  answers: AnswerItem[],
  metrics?: ExamAttemptSubmitMetrics,
): Promise<ExamAttemptRead> {
  if (USE_MOCK_EXAM_DATA) {
    const store = readMockStore();
    const attempt = store[String(attemptId)];
    if (!attempt) {
      throw new ExamAttemptError("Không tìm thấy lượt làm bài.", {
        kind: "not_found",
        status: 404,
      });
    }
    // Đã nộp rồi thì trả lại kết quả cũ, không tạo kết quả trùng.
    if (attempt.status === "submitted" && attempt.result) {
      return attempt;
    }

    const correctAnswers = answers.filter((answer) => answer.is_correct).length;
    const submittedAt = new Date().toISOString();
    const result = await submitExamResult({
      user_id: attempt.user_id,
      exam_id: attempt.exam_id,
      score: metrics?.score ?? 0,
      max_score: metrics?.maxScore ?? 0,
      total_questions: metrics?.totalQuestions ?? answers.length,
      correct_answers: metrics?.correctAnswers ?? correctAnswers,
      is_passed: metrics?.isPassed ?? false,
      submitted_at: submittedAt,
      answers,
    });

    const submitted: ExamAttemptRead = {
      ...attempt,
      status: "submitted",
      answers: [...answers],
      remaining_seconds: 0,
      last_saved_at: submittedAt,
      submitted_at: submittedAt,
      result,
    };
    store[String(attemptId)] = submitted;
    writeMockStore(store);
    return submitted;
  }

  return requestAttempt(endpoints.submit(attemptId), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ answers }),
  });
}

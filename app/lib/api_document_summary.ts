const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";
const USE_MOCK_DOCUMENT_DATA = process.env.NEXT_PUBLIC_USE_MOCK_DATA !== "false";

export type DocumentSummaryLength = "short" | "medium" | "detailed";

export type DocumentSummary = {
  document_id: number;
  length: DocumentSummaryLength;
  overview: string;
  key_points: string[];
  keywords: string[];
  model_used: string;
  cached: boolean;
  generated_at?: string | null;
};

export type DocumentSummaryMockInput = {
  title: string;
  content?: string | null;
};

type ApiErrorResponse = {
  detail?: string;
};

const MOCK_SUMMARY_MODEL = "mock-document-summary";

const MOCK_LENGTH_LIMITS: Record<
  DocumentSummaryLength,
  { points: number; overviewSentences: number; extraSentences: number }
> = {
  short: { points: 3, overviewSentences: 1, extraSentences: 0 },
  medium: { points: 4, overviewSentences: 2, extraSentences: 0 },
  detailed: { points: 6, overviewSentences: 2, extraSentences: 2 },
};

export const DOCUMENT_SUMMARY_LENGTH_OPTIONS: Array<{
  value: DocumentSummaryLength;
  label: string;
}> = [
  { value: "short", label: "Ngắn" },
  { value: "medium", label: "Vừa" },
  { value: "detailed", label: "Chi tiết" },
];

function splitIntoStatements(text: string): string[] {
  return text
    .split(/[.!?]\s+|\n+/)
    .map((part) => part.trim())
    .filter((part) => part.length >= 12);
}

function buildMockSummary(
  documentId: number,
  length: DocumentSummaryLength,
  input?: DocumentSummaryMockInput,
): DocumentSummary {
  const title = input?.title?.trim() || "Tài liệu học tập";
  const content = (input?.content ?? "").trim();
  const statements = splitIntoStatements(content);
  const limits = MOCK_LENGTH_LIMITS[length];
  const overviewParts = statements.slice(0, limits.overviewSentences);
  const detailParts = statements.slice(
    limits.overviewSentences,
    limits.overviewSentences + limits.extraSentences,
  );

  let overview =
    overviewParts.length > 0
      ? `Tài liệu “${title}” tập trung vào ${overviewParts.join(". ")}.`
      : `Tài liệu “${title}” được tóm tắt tự động để sinh viên nắm nhanh mục đích và nội dung cốt lõi.`;

  if (detailParts.length > 0) {
    overview += ` Nội dung cũng đề cập ${detailParts.join(". ")}.`;
  }

  overview +=
    length === "short"
      ? " Đây là bản tóm tắt ngắn gọn trong chế độ dữ liệu mẫu."
      : length === "detailed"
        ? " Bản tóm tắt chi tiết trong chế độ dữ liệu mẫu giữ thêm các ý phụ và thuật ngữ để tiện ôn tập."
        : " Đây là bản tóm tắt mô phỏng để xem trước cách hiển thị ý chính.";

  const fallbackPoints = [
    `Xác định mục tiêu và phạm vi kiến thức của tài liệu “${title}”.`,
    "Ghi chú các khái niệm và thuật ngữ quan trọng để ôn tập.",
    "Liên hệ nội dung tài liệu với bài giảng và bài kiểm tra của khóa học.",
    "Đối chiếu lại các ý chính với phần nội dung gốc trước khi ghi chú.",
    "Tự đặt câu hỏi ngắn sau mỗi phần để kiểm tra mức độ hiểu.",
    "Lập dàn ý ôn tập theo thứ tự các chủ đề trong tài liệu.",
  ];

  const keyPoints =
    statements.length > 0
      ? statements.slice(0, limits.points)
      : fallbackPoints.slice(0, limits.points);

  const keywords = Array.from(
    new Set(
      title
        .split(/[^0-9a-zA-ZÀ-ỹ]+/)
        .map((word) => word.trim())
        .filter((word) => word.length >= 4),
    ),
  ).slice(0, length === "detailed" ? 8 : 5);

  return {
    document_id: documentId,
    length,
    overview,
    key_points: keyPoints,
    keywords: keywords.length > 0 ? keywords : ["Tài liệu", "Ôn tập", "Ý chính"],
    model_used: MOCK_SUMMARY_MODEL,
    cached: false,
    generated_at: new Date().toISOString(),
  };
}

/**
 * Yêu cầu AI tóm tắt một tài liệu. Backend lưu bản tóm tắt vào cơ sở dữ liệu
 * theo tài liệu và mức độ dài, nên mở lại trang không phải gọi lại AI;
 * `refresh: true` dùng khi người dùng muốn tạo lại bản tóm tắt.
 */
export async function summarizeDocument(
  documentId: number,
  options?: {
    refresh?: boolean;
    length?: DocumentSummaryLength;
    mockInput?: DocumentSummaryMockInput;
  },
): Promise<DocumentSummary> {
  if (!Number.isFinite(documentId) || documentId <= 0) {
    throw new Error("Mã tài liệu không hợp lệ.");
  }

  const length = options?.length ?? "medium";

  if (USE_MOCK_DOCUMENT_DATA) {
    await new Promise((resolve) => setTimeout(resolve, 450));
    return buildMockSummary(documentId, length, options?.mockInput);
  }

  const params = new URLSearchParams();
  params.set("length", length);
  if (options?.refresh) {
    params.set("refresh", "true");
  }

  let response: Response;
  try {
    response = await fetch(
      `${API_BASE_URL}/document/${documentId}/summary?${params.toString()}`,
      {
        method: "POST",
        headers: { Accept: "application/json" },
        cache: "no-store",
      },
    );
  } catch {
    throw new Error("Không thể kết nối tới máy chủ để tóm tắt tài liệu.");
  }

  if (!response.ok) {
    let message = "Không thể tóm tắt tài liệu lúc này.";
    try {
      const error = (await response.json()) as ApiErrorResponse;
      if (typeof error.detail === "string" && error.detail.trim()) {
        message = error.detail;
      }
    } catch {
      // Máy chủ không trả JSON: dùng thông báo mặc định.
    }
    throw new Error(message);
  }

  return (await response.json()) as DocumentSummary;
}

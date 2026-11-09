const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";
const USE_MOCK_DOCUMENT_DATA = process.env.NEXT_PUBLIC_USE_MOCK_DATA !== "false";

export type SubtitleCue = {
  start: number;
  end: number;
  text: string;
};

export type DocumentSubtitle = {
  id: number;
  document_id: number;
  language: string;
  label: string;
  file_url: string;
  cues?: SubtitleCue[];
  is_published: boolean;
  created_at?: string | null;
  updated_at?: string | null;
};

export type SaveDocumentSubtitle = {
  subtitle_id?: number;
  language: string;
  label: string;
  cues: SubtitleCue[];
  is_published: boolean;
};

const mockSubtitles = new Map<number, DocumentSubtitle[]>();
let nextMockSubtitleId = 1;

function assertDocumentId(documentId: number) {
  if (!Number.isSafeInteger(documentId) || documentId <= 0) {
    throw new Error("Mã tài liệu không hợp lệ.");
  }
}

function formatVttTime(seconds: number): string {
  const milliseconds = Math.round(seconds * 1000);
  const hours = Math.floor(milliseconds / 3_600_000);
  const minutes = Math.floor((milliseconds % 3_600_000) / 60_000);
  const wholeSeconds = Math.floor((milliseconds % 60_000) / 1000);
  const remainder = milliseconds % 1000;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(wholeSeconds).padStart(2, "0")}.${String(remainder).padStart(3, "0")}`;
}

function buildMockVtt(cues: SubtitleCue[]): string {
  const lines = ["WEBVTT", ""];
  [...cues]
    .sort((left, right) => left.start - right.start)
    .forEach((cue, index) => {
      lines.push(
        `${index + 1}`,
        `${formatVttTime(cue.start)} --> ${formatVttTime(cue.end)}`,
        cue.text,
        "",
      );
    });
  return lines.join("\n");
}

async function parseResponse<T>(response: Response): Promise<T> {
  if (response.ok) {
    return (await response.json()) as T;
  }

  let message = "Không thể xử lý phụ đề.";
  try {
    const body = (await response.json()) as { detail?: string };
    if (typeof body.detail === "string" && body.detail.trim()) {
      message = body.detail;
    }
  } catch {
    // Keep the request-specific error if the server response is not JSON.
  }
  throw new Error(message);
}

export async function getPublishedDocumentSubtitles(
  documentId: number,
): Promise<DocumentSubtitle[]> {
  assertDocumentId(documentId);
  if (USE_MOCK_DOCUMENT_DATA) {
    return (mockSubtitles.get(documentId) ?? []).filter(
      (subtitle) => subtitle.is_published,
    );
  }

  const response = await fetch(
    `${API_BASE_URL}/document/${documentId}/subtitles`,
    { headers: { Accept: "application/json" }, cache: "no-store" },
  );
  return parseResponse<DocumentSubtitle[]>(response);
}

export async function getManageableDocumentSubtitles(
  documentId: number,
): Promise<DocumentSubtitle[]> {
  assertDocumentId(documentId);
  if (USE_MOCK_DOCUMENT_DATA) {
    return mockSubtitles.get(documentId) ?? [];
  }

  const response = await fetch(
    `/api/instructor/documents/${documentId}/subtitles`,
    { headers: { Accept: "application/json" }, cache: "no-store" },
  );
  return parseResponse<DocumentSubtitle[]>(response);
}

export async function saveDocumentSubtitle(
  documentId: number,
  subtitle: SaveDocumentSubtitle,
): Promise<DocumentSubtitle> {
  assertDocumentId(documentId);
  if (USE_MOCK_DOCUMENT_DATA) {
    const existing = mockSubtitles.get(documentId) ?? [];
    const saved: DocumentSubtitle = {
      ...subtitle,
      id: subtitle.subtitle_id ?? nextMockSubtitleId++,
      document_id: documentId,
      file_url: `data:text/vtt;charset=utf-8,${encodeURIComponent(buildMockVtt(subtitle.cues))}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const next = existing.filter(
      (item) =>
        item.id !== saved.id &&
        (subtitle.subtitle_id !== undefined ||
          item.language !== saved.language),
    );
    next.push(saved);
    mockSubtitles.set(documentId, next);
    return saved;
  }

  const response = await fetch(
    `/api/instructor/documents/${documentId}/subtitles`,
    {
      method: "PUT",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(subtitle),
    },
  );
  return parseResponse<DocumentSubtitle>(response);
}

export async function deleteDocumentSubtitle(
  documentId: number,
  subtitleId: number,
): Promise<void> {
  assertDocumentId(documentId);
  if (!Number.isSafeInteger(subtitleId) || subtitleId <= 0) {
    throw new Error("Mã phụ đề không hợp lệ.");
  }
  if (USE_MOCK_DOCUMENT_DATA) {
    mockSubtitles.set(
      documentId,
      (mockSubtitles.get(documentId) ?? []).filter(
        (subtitle) => subtitle.id !== subtitleId,
      ),
    );
    return;
  }

  const response = await fetch(
    `/api/instructor/documents/${documentId}/subtitles?subtitle_id=${subtitleId}`,
    { method: "DELETE", headers: { Accept: "application/json" } },
  );
  await parseResponse<{ message: string }>(response);
}

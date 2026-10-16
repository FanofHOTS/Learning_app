"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ExternalLink,
  FileText,
  LoaderCircle,
  TriangleAlert,
} from "lucide-react";
import VideoEmbed, { isEmbeddableVideoUrl } from "./video-embed";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";

const PdfDocumentViewer = dynamic(() => import("./pdf-document-viewer"), {
  ssr: false,
  loading: () => (
    <ViewerNotice variant="loading" message="Đang tải trình xem PDF..." />
  ),
});

export type ViewableDocumentKind =
  | "pdf"
  | "image"
  | "word"
  | "text"
  | "video"
  | "unsupported";

const WORD_EXTENSIONS = [".docx", ".doc"];
const IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp", ".svg"];
const TEXT_EXTENSIONS = [
  ".txt",
  ".md",
  ".markdown",
  ".csv",
  ".json",
  ".log",
  ".xml",
  ".html",
  ".htm",
  ".rtf",
  ".yaml",
  ".yml",
  ".ini",
  ".conf",
  ".sql",
];

function getExtension(fileUrl: string): string {
  const normalized = (fileUrl.split("?")[0] ?? "").toLowerCase();
  const lastDot = normalized.lastIndexOf(".");
  return lastDot < 0 ? "" : normalized.slice(lastDot);
}

/**
 * Tệp tải lên được lưu ở backend (`/uploads/...`), còn tệp mẫu nằm trong
 * frontend (`/document/...`). Hàm này ghép tiền tố API cho tệp tải lên để
 * trình duyệt đọc được mà không cần proxy.
 */
export function resolveDocumentFileUrl(fileUrl: string | null | undefined): string {
  const url = (fileUrl ?? "").trim();
  if (!url) {
    return "";
  }
  if (/^(https?:|blob:|data:)/i.test(url)) {
    return url;
  }
  if (url.startsWith("/uploads/")) {
    return `${API_BASE_URL}${url}`;
  }
  return url;
}

export function getViewableDocumentKind(
  fileUrl: string,
  documentType?: string | null,
): ViewableDocumentKind {
  const normalizedType = (documentType ?? "").toLowerCase();
  const extension = getExtension(fileUrl);

  if (normalizedType === "video" || isEmbeddableVideoUrl(fileUrl)) {
    return "video";
  }
  if (extension === ".pdf" || normalizedType === "pdf") {
    return "pdf";
  }
  if (WORD_EXTENSIONS.includes(extension)) {
    return "word";
  }
  if (IMAGE_EXTENSIONS.includes(extension)) {
    return "image";
  }
  if (TEXT_EXTENSIONS.includes(extension)) {
    return "text";
  }
  return "unsupported";
}

const VIEWABLE_KIND_LABELS: Record<ViewableDocumentKind, string> = {
  pdf: "PDF",
  image: "Hình ảnh",
  word: "Word",
  text: "Văn bản",
  video: "Video",
  unsupported: "Tải về",
};

/** Nhãn loại tài liệu hiển thị trên thẻ, phản ánh đúng cách xem trong trang. */
export function getDocumentBadgeLabel(
  fileUrl: string | null | undefined,
  documentType?: string | null,
): string {
  return VIEWABLE_KIND_LABELS[
    getViewableDocumentKind(resolveDocumentFileUrl(fileUrl), documentType)
  ];
}

type DocumentViewerProps = {
  fileUrl: string | null | undefined;
  title?: string;
  documentType?: string | null;
};

/**
 * Trình đọc tài liệu dùng chung: PDF (react-pdf),
 * Word .docx (docx-preview), tệp văn bản thuần (fetch + hiển thị),
 * ảnh (hiển thị trực tiếp) và video (nhúng).
 */
export default function DocumentViewer({
  fileUrl,
  title,
  documentType,
}: DocumentViewerProps) {
  const resolvedUrl = useMemo(() => resolveDocumentFileUrl(fileUrl), [fileUrl]);
  const kind = useMemo(
    () => getViewableDocumentKind(resolvedUrl, documentType),
    [resolvedUrl, documentType],
  );

  if (!resolvedUrl) {
    return (
      <ViewerNotice variant="error" message="Tài liệu này chưa có tệp đính kèm." />
    );
  }

  if (kind === "video") {
    return <VideoEmbed url={resolvedUrl} title={title} />;
  }

  if (kind === "pdf") {
    return <PdfDocumentViewer fileUrl={resolvedUrl} title={title} />;
  }

  if (kind === "image") {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={resolvedUrl}
        alt={title?.trim() || "Tài liệu hình ảnh"}
        className="mx-auto max-h-[75vh] rounded-2xl border border-slate-200 bg-slate-50 object-contain"
      />
    );
  }

  if (kind === "word") {
    return <WordDocumentViewer fileUrl={resolvedUrl} />;
  }

  if (kind === "text") {
    return <TextDocumentViewer fileUrl={resolvedUrl} />;
  }

  return (
    <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-5 py-10 text-center">
      <FileText className="mx-auto h-10 w-10 text-slate-400" />
      <h4 className="mt-4 text-lg font-semibold text-slate-900">
        Không xem trước được
      </h4>
      <p className="mt-2 text-sm text-slate-600">
        Định dạng tài liệu này chưa hỗ trợ xem trực tiếp. Bạn có thể tải về để mở bằng
        ứng dụng phù hợp.
      </p>
      <div className="mt-4 flex justify-center">
        <OpenDocumentLink fileUrl={resolvedUrl} label="Mở hoặc tải tài liệu" />
      </div>
    </div>
  );
}

function WordDocumentViewer({ fileUrl }: { fileUrl: string }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    const container = containerRef.current;

    async function renderWordDocument() {
      setStatus("loading");
      try {
        const response = await fetch(fileUrl);
        if (!response.ok) {
          throw new Error(`Không tải được tệp (mã ${response.status}).`);
        }
        const blob = await response.blob();
        const { renderAsync } = await import("docx-preview");

        if (cancelled || !container) {
          return;
        }

        container.innerHTML = "";
        await renderAsync(blob, container, undefined, {
          inWrapper: true,
          breakPages: true,
          ignoreLastRenderedPageBreak: false,
          renderHeaders: false,
          renderFooters: false,
          className: "docx-preview",
        });

        if (!cancelled) {
          setStatus("ready");
        }
      } catch (error) {
        if (cancelled) {
          return;
        }
        setMessage(
          error instanceof Error ? error.message : "Không thể đọc tệp Word này.",
        );
        setStatus("error");
      }
    }

    void renderWordDocument();

    return () => {
      cancelled = true;
    };
  }, [fileUrl]);

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-500">Xem trước tài liệu Word</p>
      {status === "loading" ? (
        <ViewerNotice variant="loading" message="Đang đọc tài liệu Word..." />
      ) : null}
      {status === "error" ? (
        <ViewerNotice variant="error" message={message} />
      ) : null}
      <div
        ref={containerRef}
        className="docx-preview-host max-h-[75vh] overflow-auto rounded-2xl border border-slate-200 bg-slate-50 p-2"
      />
    </div>
  );
}

function TextDocumentViewer({ fileUrl }: { fileUrl: string }) {
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [content, setContent] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadTextDocument() {
      setStatus("loading");
      try {
        const response = await fetch(fileUrl);
        if (!response.ok) {
          throw new Error(`Không tải được tệp (mã ${response.status}).`);
        }
        const text = await response.text();
        if (cancelled) {
          return;
        }
        setContent(text);
        setStatus("ready");
      } catch (error) {
        if (cancelled) {
          return;
        }
        setMessage(
          error instanceof Error ? error.message : "Không thể đọc tệp văn bản này.",
        );
        setStatus("error");
      }
    }

    void loadTextDocument();

    return () => {
      cancelled = true;
    };
  }, [fileUrl]);

  if (status === "loading") {
    return <ViewerNotice variant="loading" message="Đang đọc tệp văn bản..." />;
  }

  if (status === "error") {
    return <ViewerNotice variant="error" message={message} />;
  }

  return (
    <pre className="max-h-[75vh] overflow-auto whitespace-pre-wrap break-words rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-7 text-slate-800">
      {content}
    </pre>
  );
}

function ViewerNotice({
  variant,
  message,
}: {
  variant: "loading" | "error";
  message: string;
}) {
  const isError = variant === "error";
  return (
    <div
      className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm ${
        isError
          ? "border-amber-200 bg-amber-50 text-amber-800"
          : "border-slate-200 bg-slate-50 text-slate-600"
      }`}
    >
      {isError ? (
        <TriangleAlert className="h-5 w-5 shrink-0" />
      ) : (
        <LoaderCircle className="h-5 w-5 shrink-0 animate-spin" />
      )}
      <span>{message}</span>
    </div>
  );
}

function OpenDocumentLink({
  fileUrl,
  label,
}: {
  fileUrl: string;
  label: string;
}) {
  return (
    <a
      href={fileUrl}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-700"
    >
      <ExternalLink className="h-4 w-4" />
      <span>{label}</span>
    </a>
  );
}

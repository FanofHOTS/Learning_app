"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  LoaderCircle,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import {
  DOCUMENT_SUMMARY_LENGTH_OPTIONS,
  summarizeDocument,
  type DocumentSummary,
  type DocumentSummaryLength,
} from "../lib/api_document_summary";
import type { DocumentType } from "../lib/api_document";

type DocumentSummaryPanelProps = {
  documentId: number;
  title: string;
  content?: string | null;
  documentType?: DocumentType;
  /** Sinh viên: tự tải ngay khi mở. Giảng viên: chỉ tải khi bấm nút. */
  autoLoad?: boolean;
  variant?: "student" | "instructor";
  className?: string;
};

function formatGeneratedAt(value?: string | null): string {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toLocaleString("vi-VN");
}

/**
 * Tự động xin bản tóm tắt cho sinh viên khi tài liệu được mở, hoặc chờ giảng
 * viên bấm nút. Bản tóm tắt được backend lưu vào cơ sở dữ liệu theo tài liệu
 * và mức độ dài; nút "Tạo lại" yêu cầu model tạo bản mới.
 */
export default function DocumentSummaryPanel({
  documentId,
  title,
  content,
  documentType = "other",
  autoLoad = true,
  variant = "student",
  className = "",
}: DocumentSummaryPanelProps) {
  const [summary, setSummary] = useState<DocumentSummary | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const isVideo = documentType === "video";
  const [isLoading, setIsLoading] = useState(autoLoad && !isVideo);
  const [hasStarted, setHasStarted] = useState(autoLoad && !isVideo);
  const [length, setLength] = useState<DocumentSummaryLength>("medium");
  const [requestVersion, setRequestVersion] = useState(0);
  const forceRefreshRef = useRef(false);

  useEffect(() => {
    if (!hasStarted || isVideo) {
      return;
    }

    let isActive = true;
    const forceRefresh = forceRefreshRef.current;
    forceRefreshRef.current = false;

    async function loadSummary() {
      setIsLoading(true);
      setErrorMessage("");

      try {
        const result = await summarizeDocument(documentId, {
          refresh: forceRefresh,
          length,
          mockInput: { title, content },
        });
        if (isActive) {
          setSummary(result);
        }
      } catch (error) {
        if (isActive) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "Không thể tóm tắt tài liệu này.",
          );
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    void loadSummary();

    return () => {
      isActive = false;
    };
  }, [content, documentId, hasStarted, isVideo, length, requestVersion, title]);

  function startOrRegenerateSummary() {
    forceRefreshRef.current = hasStarted;
    if (!hasStarted) {
      setHasStarted(true);
      return;
    }
    setRequestVersion((version) => version + 1);
  }

  const isInstructor = variant === "instructor";
  const heading = isInstructor ? "Tóm tắt AI của tài liệu" : "Tóm tắt nhanh bằng AI";
  const description = isInstructor
    ? "Xem lại các ý chính đã lưu hoặc tạo bản tóm tắt mới để rà soát nội dung tài liệu."
    : "Nắm ý chính của tài liệu trước khi đọc chi tiết. Bản tóm tắt chỉ dựa trên nội dung của tài liệu này.";

  if (isVideo) {
    return (
      <section
        className={`rounded-3xl border border-amber-200 bg-amber-50 p-6 ${className}`.trim()}
        role="note"
      >
        <div className="flex items-start gap-3 text-amber-800">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <h3 className="font-semibold">Tóm tắt AI chưa hỗ trợ video</h3>
            <p className="mt-1 text-sm">
              Tính năng tóm tắt hiện chỉ áp dụng cho tài liệu văn bản và PDF.
              Bạn vẫn có thể xem video trong trình phát.
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      className={`rounded-3xl border border-sky-200 bg-linear-to-br from-sky-50 via-white to-white p-6 shadow-sm ${className}`.trim()}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="rounded-2xl bg-sky-100 p-2 text-sky-700">
            <Sparkles className="h-5 w-5" />
          </span>
          <div>
            <h3 className="text-lg font-semibold text-slate-900">{heading}</h3>
            <p className="mt-1 text-sm text-slate-600">{description}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={startOrRegenerateSummary}
          disabled={isLoading}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl border border-sky-200 bg-white px-4 py-2 text-sm font-semibold text-sky-700 transition hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isLoading ? (
            <LoaderCircle className="h-4 w-4 animate-spin" />
          ) : hasStarted ? (
            <RefreshCw className="h-4 w-4" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          {isLoading
            ? "Đang tóm tắt..."
            : hasStarted
              ? "Tạo lại"
              : "Tạo tóm tắt"}
        </button>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
          Độ dài
        </span>
        <div className="inline-flex rounded-full border border-slate-200 bg-white p-1">
          {DOCUMENT_SUMMARY_LENGTH_OPTIONS.map((option) => {
            const isActive = option.value === length;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setLength(option.value)}
                disabled={isLoading}
                aria-pressed={isActive}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition disabled:cursor-not-allowed ${
                  isActive
                    ? "bg-sky-600 text-white"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      {isLoading && !summary ? (
        <div className="mt-5 space-y-2" role="status">
          <div className="h-3 w-11/12 animate-pulse rounded-full bg-sky-100" />
          <div className="h-3 w-10/12 animate-pulse rounded-full bg-sky-100" />
          <div className="h-3 w-8/12 animate-pulse rounded-full bg-sky-100" />
          <p className="pt-2 text-sm text-slate-500">
            AI đang đọc tài liệu và rút ra các ý chính...
          </p>
        </div>
      ) : null}

      {!hasStarted && !summary ? (
        <p className="mt-5 text-sm text-slate-500">
          Bấm “Tạo tóm tắt” để xem nhanh các ý chính. Nếu tài liệu đã có bản tóm
          tắt, hệ thống sẽ dùng lại bản đã lưu thay vì gọi AI.
        </p>
      ) : null}

      {errorMessage ? (
        <div className="mt-5 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-semibold">Chưa tạo được bản tóm tắt</p>
            <p className="mt-1">{errorMessage}</p>
            <p className="mt-1 text-amber-700">
              Bạn vẫn có thể đọc toàn bộ tài liệu ở phần bên dưới.
            </p>
          </div>
        </div>
      ) : null}

      {summary ? (
        <div className="mt-5 space-y-4">
          <p className="text-sm leading-7 text-slate-700">{summary.overview}</p>

          {summary.key_points.length > 0 ? (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Ý chính
              </p>
              <ol className="mt-2 space-y-2">
                {summary.key_points.map((point, index) => (
                  <li
                    key={`${index}-${point}`}
                    className="flex items-start gap-3 text-sm leading-6 text-slate-700"
                  >
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sky-100 text-xs font-semibold text-sky-700">
                      {index + 1}
                    </span>
                    <span>{point}</span>
                  </li>
                ))}
              </ol>
            </div>
          ) : null}

          {summary.keywords.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {summary.keywords.map((keyword) => (
                <span
                  key={keyword}
                  className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600"
                >
                  {keyword}
                </span>
              ))}
            </div>
          ) : null}

          <p className="text-xs text-slate-400">
            Tạo bởi {summary.model_used}
            {summary.generated_at
              ? ` • ${formatGeneratedAt(summary.generated_at)}`
              : ""}
            {summary.cached ? " • dùng lại bản tóm tắt đã lưu" : ""}
          </p>
        </div>
      ) : null}
    </section>
  );
}

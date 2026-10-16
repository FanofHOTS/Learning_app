"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { ChevronLeft, ChevronRight, Download, ZoomIn, ZoomOut } from "lucide-react";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

const MIN_ZOOM = 0.6;
const MAX_ZOOM = 2.4;
const ZOOM_STEP = 0.2;

function getDownloadFilename(fileUrl: string, title?: string): string {
  const urlFilename = (() => {
    try {
      return decodeURIComponent(new URL(fileUrl).pathname.split("/").pop() ?? "");
    } catch {
      return "";
    }
  })();
  const baseName = title?.trim() || urlFilename || "document.pdf";
  const safeName = baseName.replace(/[<>:"/\\|?*\u0000-\u001F]/g, "_");
  return safeName.toLowerCase().endsWith(".pdf") ? safeName : `${safeName}.pdf`;
}

export default function PdfDocumentViewer({
  fileUrl,
  title,
}: {
  fileUrl: string;
  title?: string;
}) {
  const viewerRef = useRef<HTMLDivElement | null>(null);
  const [viewerWidth, setViewerWidth] = useState(0);
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState("");

  useEffect(() => {
    setNumPages(0);
    setCurrentPage(1);
    setDownloadError("");
  }, [fileUrl]);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) {
      return;
    }

    const resizeObserver = new ResizeObserver(([entry]) => {
      if (entry) {
        setViewerWidth(Math.max(0, Math.floor(entry.contentRect.width)));
      }
    });
    resizeObserver.observe(viewer);

    return () => resizeObserver.disconnect();
  }, []);

  const handleDownload = useCallback(async () => {
    setIsDownloading(true);
    setDownloadError("");
    try {
      const response = await fetch(fileUrl);
      if (!response.ok) {
        throw new Error(`Không tải được tệp (mã ${response.status}).`);
      }

      const fileBlob = await response.blob();
      const objectUrl = URL.createObjectURL(fileBlob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = getDownloadFilename(fileUrl, title);
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
    } catch (error) {
      setDownloadError(
        error instanceof Error ? error.message : "Không thể tải tệp PDF.",
      );
    } finally {
      setIsDownloading(false);
    }
  }, [fileUrl, title]);

  return (
    <section className="space-y-3" aria-label="Trình xem PDF">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3">
        <p className="min-w-0 flex-1 truncate text-sm font-medium text-slate-700">
          {title?.trim() || "Tài liệu PDF"}
          {numPages > 0 ? (
            <span className="ml-2 font-normal text-slate-500">
              Trang {currentPage} / {numPages}
            </span>
          ) : null}
        </p>

        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Trang trước"
            title="Trang trước"
            disabled={currentPage <= 1}
            onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            aria-label="Trang tiếp theo"
            title="Trang tiếp theo"
            disabled={numPages === 0 || currentPage >= numPages}
            onClick={() =>
              setCurrentPage((page) => Math.min(numPages, page + 1))
            }
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
          <button
            type="button"
            aria-label="Thu nhỏ PDF"
            title="Thu nhỏ"
            disabled={zoom <= MIN_ZOOM}
            onClick={() =>
              setZoom((current) =>
                Math.max(MIN_ZOOM, Number((current - ZOOM_STEP).toFixed(1))),
              )
            }
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ZoomOut className="h-5 w-5" />
          </button>
          <span
            className="w-12 text-center text-sm tabular-nums text-slate-600"
            aria-live="polite"
          >
            {Math.round(zoom * 100)}%
          </span>
          <button
            type="button"
            aria-label="Phóng to PDF"
            title="Phóng to"
            disabled={zoom >= MAX_ZOOM}
            onClick={() =>
              setZoom((current) =>
                Math.min(MAX_ZOOM, Number((current + ZOOM_STEP).toFixed(1))),
              )
            }
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ZoomIn className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => void handleDownload()}
            disabled={isDownloading}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-slate-900 px-3 text-sm font-semibold text-white hover:bg-slate-700 disabled:cursor-wait disabled:opacity-60"
          >
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">
              {isDownloading ? "Đang tải..." : "Tải về"}
            </span>
          </button>
        </div>
      </div>

      {downloadError ? (
        <p role="alert" className="text-sm text-red-700">
          {downloadError}
        </p>
      ) : null}

      <div
        ref={viewerRef}
        className="max-h-[75vh] overflow-auto rounded-2xl border border-slate-200 bg-slate-100 p-3"
      >
        <Document
          file={fileUrl}
          onLoadSuccess={({ numPages: loadedPageCount }) => {
            setNumPages(loadedPageCount);
            setCurrentPage(1);
          }}
          loading={
            <p className="py-8 text-center text-sm text-slate-600">
              Đang tải tài liệu PDF...
            </p>
          }
          error={
            <p role="alert" className="py-8 text-center text-sm text-red-700">
              Không thể hiển thị tệp PDF. Hãy thử tải tệp về để mở bằng ứng dụng
              đọc PDF.
            </p>
          }
          noData={
            <p className="py-8 text-center text-sm text-slate-600">
              Không tìm thấy dữ liệu PDF.
            </p>
          }
          suspense={false}
        >
          <div className="flex min-w-full flex-col items-center gap-4">
            {numPages > 0 ? (
              <Page
                key={`page_${currentPage}`}
                pageNumber={currentPage}
                width={viewerWidth > 0 ? Math.round(viewerWidth * zoom) : undefined}
                loading={
                  <div className="h-48 w-full animate-pulse rounded bg-white" />
                }
                error={
                  <p role="alert" className="py-8 text-sm text-red-700">
                    Không thể hiển thị trang {currentPage}.
                  </p>
                }
                className="max-w-none bg-white shadow-sm"
                suspense={false}
              />
            ) : null}
          </div>
        </Document>
      </div>
    </section>
  );
}

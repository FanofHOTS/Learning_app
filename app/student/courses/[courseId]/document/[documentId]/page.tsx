"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, LoaderCircle, Menu, XCircle } from "lucide-react";
import { UserAccountMenu } from "../../../../../components/user-account-menu";
import { NotificationBell } from "../../../../../components/notification-bell";
import { ShowNavigation } from "../../../../../lib/app_nav";
import type { User } from "../../../../../lib/api_user";
import { type CourseDocument, getDocumentById } from "../../../../../lib/api_document";
import { completeCourseComponentAndSyncProgress } from "../../../../../lib/api_course_learning";
import DiscussionSection from "../../../../../components/discussion-section";
import VideoEmbed, { isEmbeddableVideoUrl } from "../../../../../components/video-embed";
import {
  STUDENT_DEFAULT_USER,
  useStudentSession,
} from "../../../../_lib/use-student-session";

const initialUser: User = STUDENT_DEFAULT_USER;

export default function DocumentPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const params = useParams<{ courseId: string; documentId: string }>();
  const courseId = Number(params.courseId ?? "0");
  const documentId = Number(params.documentId ?? "0");
  const componentId = Number(searchParams.get("componentId") ?? "0");
  const moduleId = Number(searchParams.get("moduleId") ?? "0");

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [document, setDocument] = useState<CourseDocument | null>(null);
  const [isRecordingProgress, setIsRecordingProgress] = useState(false);
  const [progressNotice, setProgressNotice] = useState("");
  const { currentUser, isCheckingAuth } = useStudentSession();

  useEffect(() => {
    let isMounted = true;

    async function loadPageData() {
      if (!currentUser) {
        return;
      }

      if (Number.isNaN(documentId) || documentId <= 0) {
        setErrorMessage("Mã tài liệu không hợp lệ.");
        setIsLoading(false);
        return;
      }

      try {
        const fetchedDocument = await getDocumentById(documentId);

        if (!isMounted) {
          return;
        }

        setDocument(fetchedDocument);
        setErrorMessage("");
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Không thể tải nội dung tài liệu.",
        );
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadPageData();

    return () => {
      isMounted = false;
    };
  }, [currentUser, documentId]);

  useEffect(() => {
    let isMounted = true;

    async function recordProgress() {
      if (!currentUser || !document) {
        return;
      }

      if (componentId <= 0 || moduleId <= 0 || courseId <= 0) {
        return;
      }

      try {
        setIsRecordingProgress(true);
        await completeCourseComponentAndSyncProgress({
          userId: currentUser.id,
          courseId,
          moduleId,
          courseComponentId: componentId,
        });

        if (!isMounted) {
          return;
        }

        setProgressNotice("Đã ghi nhận thành phần tài liệu này là hoàn thành.");
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setProgressNotice(
          error instanceof Error
            ? error.message
            : "Không thể ghi nhận tiến trình học tập cho tài liệu này.",
        );
      } finally {
        if (isMounted) {
          setIsRecordingProgress(false);
        }
      }
    }

    void recordProgress();

    return () => {
      isMounted = false;
    };
  }, [componentId, courseId, currentUser, document, moduleId]);

  const isAuthPending = isCheckingAuth || !currentUser;
  const user = currentUser ?? initialUser;

  const documentType = useMemo(() => {
    if (!document) return "other";
    const type = document.document_type?.toLowerCase();
    if (type === "pdf") return "pdf";
    if (type === "video") return "video";
    if (document.file_url?.toLowerCase().endsWith(".pdf")) return "pdf";
    if (isEmbeddableVideoUrl(document.file_url ?? "")) return "video";
    return "other";
  }, [document]);

  const isPdf = documentType === "pdf";
  const isVideo = documentType === "video";

  if (isAuthPending) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4 text-slate-700">
        <div className="flex items-center gap-3 rounded-3xl bg-white px-5 py-4 shadow-sm">
          <LoaderCircle className="h-5 w-5 animate-spin" />
          <span>Đang kiểm tra phiên đăng nhập...</span>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <ShowNavigation
        user={user}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      {isSidebarOpen ? (
        <button
          type="button"
          aria-label="Đóng lớp nền điều hướng"
          className="fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-[2px]"
          onClick={() => setIsSidebarOpen(false)}
        />
      ) : null}

      <header className="fixed top-0 left-0 z-30 flex w-full items-center justify-between border-b border-slate-200 bg-white/95 px-4 py-3 shadow-sm backdrop-blur">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setIsSidebarOpen(true)}
            className="rounded-xl p-2 text-slate-700 hover:bg-slate-100"
            aria-label="Mở thanh điều hướng"
          >
            <Menu className="h-5 w-5" />
          </button>
          <Image
            src="/logo.png"
            alt="Logo"
            width={40}
            height={40}
            className="cursor-pointer"
            onClick={() => router.push(`/${user.role}`)}
          />
          <div>
            <h1 className="text-lg font-semibold">Xem tài liệu</h1>
            <p className="text-sm text-slate-500">
              Mở nội dung tài liệu và tự động ghi nhận hoàn thành khi tải trang thành công
            </p>
          </div>
        </div>

        <div className="hidden items-center gap-2 md:flex">
          <NotificationBell userId={user.id} />
          <UserAccountMenu user={user} variant="dashboard" />
        </div>
      </header>

      <section className="mx-auto mt-24 max-w-7xl px-4 pb-16">
        {isLoading ? (
          <div className="flex min-h-[60vh] items-center justify-center">
            <LoaderCircle className="h-10 w-10 animate-spin text-slate-500" />
          </div>
        ) : errorMessage ? (
          <div className="rounded-3xl border border-red-200 bg-red-50 p-5 text-red-700">
            <div className="flex items-start gap-3">
              <XCircle className="mt-1 h-5 w-5 shrink-0" />
              <div>
                <p className="font-semibold">Lỗi tải tài liệu</p>
                <p className="mt-1 text-sm">{errorMessage}</p>
              </div>
            </div>
          </div>
        ) : document ? (
          <div className="space-y-6">
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm text-slate-500">Tài liệu #{document.id}</p>
                  <h2 className="text-2xl font-semibold text-slate-900">
                    {document.title}
                  </h2>
                </div>
                <div className="rounded-3xl bg-slate-100 px-4 py-3 text-center text-slate-700">
                  <p className="text-xs uppercase text-slate-500">Loại tài liệu</p>
                  <p className="mt-2 text-sm font-semibold">
                    {isPdf ? "PDF" : isVideo ? "Video" : "Tải về"}
                  </p>
                </div>
              </div>

              {document.content ? (
                <p className="mt-4 text-sm leading-7 text-slate-600">
                  {document.content}
                </p>
              ) : null}

              <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-700">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
                  <div>
                    <p className="font-semibold">Ghi nhận tiến trình học tập</p>
                    <p className="mt-1">
                      {isRecordingProgress
                        ? "Hệ thống đang ghi nhận thành phần tài liệu này là đã hoàn thành..."
                        : progressNotice || "Khi trang này mở thành công, tiến trình tài liệu sẽ được cập nhật."}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              {isPdf ? (
                <div className="space-y-4">
                  <p className="text-sm text-slate-500">Xem PDF trực tiếp</p>
                  <div className="overflow-hidden rounded-3xl border border-slate-200">
                    <iframe
                      src={document.file_url}
                      className="h-[calc(200vh-260px)] w-full"
                      title={document.title}
                    />
                  </div>
                </div>
              ) : isVideo ? (
                <div className="space-y-4">
                  <p className="text-sm text-slate-500">Xem video ngay trên trang</p>
                  <VideoEmbed url={document.file_url} title={document.title} />
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-slate-500">
                    Mở tệp gốc trong tab mới để tải về hoặc xem bằng ứng dụng phù hợp
                  </p>
                  <a
                    href={document.file_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center justify-center rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-700"
                  >
                    Mở hoặc tải tài liệu
                  </a>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <Link
                href={`/student/courses/${courseId}`}
                className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
              >
                Quay lại chi tiết khóa học
              </Link>
              {document.file_url ? (
                <a
                  href={document.file_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center rounded-2xl bg-sky-100 px-5 py-3 text-sm font-semibold text-sky-700 transition hover:bg-sky-200"
                >
                  Mở tài liệu trong tab mới
                </a>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center text-slate-500">
            Không tìm thấy tài liệu.
          </div>
        )}

        {document && componentId > 0 ? (
          <div className="mt-6">
            <DiscussionSection
              courseComponentId={componentId}
              currentUser={user}
            />
          </div>
        ) : null}
      </section>
    </main>
  );
}
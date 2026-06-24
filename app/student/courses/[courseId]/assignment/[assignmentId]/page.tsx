"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  CheckCircle2,
  ChevronLeft,
  ClipboardList,
  FileUp,
  LoaderCircle,
  Menu,
  Upload,
  XCircle,
} from "lucide-react";
import { UserAccountMenu } from "../../../../../components/user-account-menu";
import { NotificationBell } from "../../../../../components/notification-bell";
import { ShowNavigation } from "../../../../../lib/app_nav";
import type { User } from "../../../../../lib/api_user";
import {
  type Assignment,
  type AssignmentSubmission,
  getAssignmentById,
  getAssignmentSubmission,
  createAssignmentSubmission,
  updateAssignmentSubmission,
  uploadAssignmentFile,
} from "../../../../../lib/api_assignment";
import { completeCourseComponentAndSyncProgress } from "../../../../../lib/api_course_learning";
import DiscussionSection from "../../../../../components/discussion-section";
import {
  STUDENT_DEFAULT_USER,
  useStudentSession,
} from "../../../../_lib/use-student-session";

const initialUser: User = STUDENT_DEFAULT_USER;

function getAssignmentTypeLabel(type: string): string {
  switch (type) {
    case "Bài tập tự luận":
      return "Tự luận";
    case "Bài tập nộp tệp":
      return "Nộp tệp";
    case "Bài tập lập trình":
      return "Lập trình";
    default:
      return type;
  }
}

function isEssayType(type: string): boolean {
  return type === "Bài tập tự luận";
}

function isUploadType(type: string): boolean {
  return type === "Bài tập nộp tệp";
}

function isCodeType(type: string): boolean {
  return type === "Bài tập lập trình";
}

export default function AssignmentPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const params = useParams<{ courseId: string; assignmentId: string }>();
  const courseId = Number(params.courseId ?? "0");
  const assignmentId = Number(params.assignmentId ?? "0");
  const componentId = Number(searchParams.get("componentId") ?? "0");
  const moduleId = Number(searchParams.get("moduleId") ?? "0");

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [progressNotice, setProgressNotice] = useState("");
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [submission, setSubmission] = useState<AssignmentSubmission | null>(null);
  const [content, setContent] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { currentUser, isCheckingAuth } = useStudentSession();

  useEffect(() => {
    let isMounted = true;

    async function loadPageData() {
      if (!currentUser) {
        return;
      }

      if (Number.isNaN(assignmentId) || assignmentId <= 0) {
        setErrorMessage("Mã bài tập không hợp lệ.");
        setIsLoading(false);
        return;
      }

      try {
        const [fetchedAssignment, existingSubmission] = await Promise.all([
          getAssignmentById(assignmentId),
          getAssignmentSubmission(assignmentId, currentUser.id),
        ]);

        if (!isMounted) {
          return;
        }

        setAssignment(fetchedAssignment);
        setSubmission(existingSubmission);

        if (existingSubmission?.submission_content) {
          setContent(existingSubmission.submission_content);
        }

        setErrorMessage("");
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Không thể tải dữ liệu bài tập.",
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
  }, [assignmentId, currentUser]);

  async function handleSubmit() {
    if (!assignment || !currentUser) {
      return;
    }

    if (isEssayType(assignment.assignment_type) && !content.trim()) {
      setErrorMessage("Vui lòng nhập nội dung bài tập.");
      return;
    }

    if (isUploadType(assignment.assignment_type) && !selectedFile && !submission?.submission_file) {
      setErrorMessage("Vui lòng chọn tệp để nộp.");
      return;
    }

    if (isCodeType(assignment.assignment_type) && !content.trim()) {
      setErrorMessage("Vui lòng nhập mã nguồn.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");

    try {
      let fileUrl = submission?.submission_file ?? null;

      if (selectedFile) {
        setIsUploading(true);
        const uploadResult = await uploadAssignmentFile(selectedFile);
        fileUrl = uploadResult.file_url;
        setIsUploading(false);
      }

      const submissionPayload = {
        assignment_id: assignment.id,
        user_id: currentUser.id,
        submission_content:
          isEssayType(assignment.assignment_type) || isCodeType(assignment.assignment_type)
            ? content.trim()
            : undefined,
        submission_file: fileUrl ?? undefined,
        is_final_submission: true,
      };

      let result: AssignmentSubmission;

      if (submission) {
        result = await updateAssignmentSubmission(
          assignment.id,
          currentUser.id,
          submissionPayload,
        );
      } else {
        result = await createAssignmentSubmission(submissionPayload);
      }

      setSubmission(result);

      if (componentId > 0 && moduleId > 0 && courseId > 0) {
        await completeCourseComponentAndSyncProgress({
          userId: currentUser.id,
          courseId,
          moduleId,
          courseComponentId: componentId,
        });
        setProgressNotice(
          "Đã ghi nhận hoàn thành thành phần bài tập và đồng bộ tiến trình khóa học.",
        );
      } else {
        setProgressNotice("Đã nộp bài tập thành công.");
      }

      setContent("");
      setSelectedFile(null);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Không thể nộp bài tập.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  const isAuthPending = isCheckingAuth || !currentUser;
  const user = currentUser ?? initialUser;

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
            <h1 className="text-lg font-semibold">Làm bài tập</h1>
            <p className="text-sm text-slate-500">
              Nộp bài tập và theo dõi kết quả đánh giá từ giảng viên
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
        ) : (
          <div className="space-y-6">
            {/* Thông tin bài tập */}
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm text-slate-500">
                    Bài tập #{assignment?.id ?? assignmentId}
                  </p>
                  <h2 className="text-2xl font-semibold text-slate-900">
                    {assignment?.title ?? "Bài tập không xác định"}
                  </h2>
                </div>
                <div className="grid gap-2 sm:grid-cols-3">
                  <div className="rounded-2xl bg-slate-100 px-4 py-3 text-center">
                    <p className="text-xs uppercase text-slate-500">Loại</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">
                      {assignment
                        ? getAssignmentTypeLabel(assignment.assignment_type)
                        : "---"}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-slate-100 px-4 py-3 text-center">
                    <p className="text-xs uppercase text-slate-500">Điểm đạt</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">
                      {assignment?.pass_score ?? "---"}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-slate-100 px-4 py-3 text-center">
                    <p className="text-xs uppercase text-slate-500">Tối đa</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">
                      {assignment?.max_score ?? "---"}
                    </p>
                  </div>
                </div>
              </div>

              {assignment?.description ? (
                <p className="mt-4 text-sm leading-7 text-slate-600">
                  {assignment.description}
                </p>
              ) : null}
            </div>

            {/* Nội dung bài tập */}
            {assignment?.assignment_content ? (
              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-4 flex items-center gap-3">
                  <ClipboardList className="h-5 w-5 text-sky-600" />
                  <h3 className="text-base font-semibold text-slate-900">
                    Yêu cầu bài tập
                  </h3>
                </div>
                <div className="whitespace-pre-wrap text-sm leading-7 text-slate-700">
                  {assignment.assignment_content}
                </div>

                {assignment.assignment_file ? (
                  <div className="mt-4">
                    <a
                      href={assignment.assignment_file}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 rounded-2xl bg-sky-50 px-4 py-2.5 text-sm font-medium text-sky-700 transition hover:bg-sky-100"
                    >
                      <FileUp className="h-4 w-4" />
                      Tải tệp đính kèm bài tập
                    </a>
                  </div>
                ) : null}
              </div>
            ) : null}

            {/* Thông báo lỗi */}
            {errorMessage ? (
              <div className="rounded-3xl border border-red-200 bg-red-50 p-5 text-red-700">
                <div className="flex items-start gap-3">
                  <XCircle className="mt-1 h-5 w-5 shrink-0" />
                  <div>
                    <p className="font-semibold">Lỗi</p>
                    <p className="mt-1 text-sm">{errorMessage}</p>
                  </div>
                </div>
              </div>
            ) : null}

            {/* Thông báo tiến trình */}
            {progressNotice ? (
              <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-700">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="mt-1 h-5 w-5 shrink-0" />
                  <div>
                    <p className="font-semibold">Thành công</p>
                    <p className="mt-1 text-sm">{progressNotice}</p>
                  </div>
                </div>
              </div>
            ) : null}

            {/* Kết quả đã chấm */}
            {submission?.is_graded && submission.score !== null ? (
              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm text-slate-500">Kết quả bài tập</p>
                    <h3 className="text-2xl font-semibold text-slate-900">
                      {submission.is_passed ? "Đạt yêu cầu" : "Chưa đạt"}
                    </h3>
                  </div>
                  <div className="rounded-3xl bg-slate-100 px-5 py-4 text-center">
                    <p className="text-xs uppercase text-slate-500">Điểm</p>
                    <p className="text-3xl font-semibold text-slate-900">
                      {submission.score}
                    </p>
                    <p className="text-sm text-slate-500">
                      / {assignment?.max_score ?? 100}
                    </p>
                  </div>
                </div>

                {submission.feedback ? (
                  <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-sm font-semibold text-slate-700">
                      Phản hồi từ giảng viên
                    </p>
                    <p className="mt-2 text-sm leading-7 text-slate-600">
                      {submission.feedback}
                    </p>
                  </div>
                ) : null}

                <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
                  <button
                    type="button"
                    className="inline-flex items-center justify-center rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-700"
                    onClick={() =>
                      router.push(`/student/courses/${courseId}`)
                    }
                  >
                    <ChevronLeft className="mr-2 h-4 w-4" />
                    Quay lại chi tiết khóa học
                  </button>
                  <button
                type="button"
                className="inline-flex items-center justify-center rounded-2xl bg-sky-100 px-4 py-3 text-sm font-semibold text-sky-700 transition hover:bg-sky-200"
                onClick={() => {
                  setSubmission(null);
                  setContent(submission.submission_content ?? "");
                  setProgressNotice("");
                  setSelectedFile(null);
                }}
              >
                Nộp lại bài tập
              </button>
                </div>
              </div>
            ) : submission && !submission.is_graded ? (
              /* Đã nộp nhưng chưa chấm */
              <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-amber-700">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="mt-1 h-5 w-5 shrink-0" />
                  <div>
                    <p className="font-semibold">Đã nộp bài tập</p>
                    <p className="mt-1 text-sm">
                      Bài tập của bạn đã được nộp thành công. Giảng viên sẽ chấm
                      điểm và phản hồi sớm nhất.
                    </p>
                    <p className="mt-1 text-xs text-amber-500">
                      Nộp lúc:{" "}
                      {new Date(submission.submitted_at).toLocaleString("vi-VN")}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  className="mt-4 inline-flex items-center justify-center rounded-2xl bg-white px-4 py-2.5 text-sm font-semibold text-amber-700 shadow-sm transition hover:bg-amber-100"
                  onClick={() => {
                    setSubmission(null);
                    setContent(submission.submission_content ?? "");
                    setProgressNotice("");
                    setSelectedFile(null);
                  }}
                >
                  Nộp lại bài tập
                </button>
              </div>
            ) : (
              /* Form nộp bài */
              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-6 flex items-center gap-3">
                  <Upload className="h-5 w-5 text-sky-600" />
                  <h3 className="text-base font-semibold text-slate-900">
                    Nộp bài tập
                  </h3>
                </div>

                {assignment ? (
                  <div className="space-y-5">
                    {/* Bài tập tự luận */}
                    {isEssayType(assignment.assignment_type) ? (
                      <div className="space-y-5">
                        <div>
                          <label className="mb-2 block text-sm font-medium text-slate-700">
                            Nội dung bài làm
                          </label>
                          <textarea
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            rows={12}
                            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 placeholder-slate-400 transition focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-200"
                            placeholder="Nhập nội dung bài làm của bạn..."
                            disabled={isSubmitting}
                          />
                          <p className="mt-2 text-xs text-slate-400">
                            {content.length} ký tự
                          </p>
                        </div>

                        <div>
                          <label className="mb-2 block text-sm font-medium text-slate-700">
                            Tệp đính kèm (không bắt buộc)
                          </label>
                          <div
                            className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 px-6 py-8 transition hover:border-sky-400 hover:bg-sky-50"
                            onClick={() => fileInputRef.current?.click()}
                          >
                            <FileUp className="mb-3 h-8 w-8 text-slate-400" />
                            <p className="text-sm font-medium text-slate-700">
                              {selectedFile
                                ? selectedFile.name
                                : "Nhấn để đính kèm tệp"}
                            </p>
                            <p className="mt-1 text-xs text-slate-400">
                              Hỗ trợ PDF, DOCX, hình ảnh và các định dạng khác
                            </p>
                          </div>
                          <input
                            ref={fileInputRef}
                            type="file"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                setSelectedFile(file);
                              }
                            }}
                            disabled={isSubmitting}
                          />
                          {selectedFile ? (
                            <button
                              type="button"
                              className="mt-2 text-xs text-red-500 hover:text-red-700"
                              onClick={() => {
                                setSelectedFile(null);
                                if (fileInputRef.current) {
                                  fileInputRef.current.value = "";
                                }
                              }}
                            >
                              Xóa tệp đã chọn
                            </button>
                          ) : null}
                          {submission?.submission_file && !selectedFile ? (
                            <p className="mt-2 text-xs text-slate-500">
                              Đã nộp tệp trước đó:{" "}
                              <a
                                href={submission.submission_file}
                                target="_blank"
                                rel="noreferrer"
                                className="text-sky-600 underline"
                              >
                                Xem tệp
                              </a>
                            </p>
                          ) : null}
                        </div>
                      </div>
                    ) : null}

                    {/* Bài tập nộp tệp */}
                    {isUploadType(assignment.assignment_type) ? (
                      <div>
                        <label className="mb-2 block text-sm font-medium text-slate-700">
                          Chọn tệp để nộp
                        </label>
                        <div
                          className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 px-6 py-10 transition hover:border-sky-400 hover:bg-sky-50"
                          onClick={() => fileInputRef.current?.click()}
                        >
                          <FileUp className="mb-3 h-10 w-10 text-slate-400" />
                          <p className="text-sm font-medium text-slate-700">
                            {selectedFile
                              ? selectedFile.name
                              : "Nhấn để chọn tệp hoặc kéo thả vào đây"}
                          </p>
                          <p className="mt-1 text-xs text-slate-400">
                            Hỗ trợ PDF, DOCX, ZIP, hình ảnh và các định dạng khác
                          </p>
                        </div>
                        <input
                          ref={fileInputRef}
                          type="file"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              setSelectedFile(file);
                            }
                          }}
                          disabled={isSubmitting}
                        />
                        {selectedFile ? (
                          <button
                            type="button"
                            className="mt-2 text-xs text-red-500 hover:text-red-700"
                            onClick={() => {
                              setSelectedFile(null);
                              if (fileInputRef.current) {
                                fileInputRef.current.value = "";
                              }
                            }}
                          >
                            Xóa tệp đã chọn
                          </button>
                        ) : null}
                        {submission?.submission_file && !selectedFile ? (
                          <p className="mt-2 text-xs text-slate-500">
                            Đã nộp tệp trước đó:{" "}
                            <a
                              href={submission.submission_file}
                              target="_blank"
                              rel="noreferrer"
                              className="text-sky-600 underline"
                            >
                              Xem tệp
                            </a>
                          </p>
                        ) : null}
                      </div>
                    ) : null}

                    {/* Bài tập lập trình */}
                    {isCodeType(assignment.assignment_type) ? (
                      <div>
                        <label className="mb-2 block text-sm font-medium text-slate-700">
                          Mã nguồn
                        </label>
                        <textarea
                          value={content}
                          onChange={(e) => setContent(e.target.value)}
                          rows={16}
                          className="w-full rounded-2xl border border-slate-200 bg-slate-900 px-4 py-3 font-mono text-sm text-green-400 placeholder-green-700 transition focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-600"
                          placeholder="// Nhập mã nguồn của bạn tại đây..."
                          disabled={isSubmitting}
                          spellCheck={false}
                        />
                        <p className="mt-2 text-xs text-slate-400">
                          {content.length} ký tự
                        </p>
                      </div>
                    ) : null}

                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <button
                        type="button"
                        className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
                        onClick={() =>
                          router.push(`/student/courses/${courseId}`)
                        }
                      >
                        <ChevronLeft className="mr-2 h-4 w-4" />
                        Quay lại
                      </button>

                      <button
                        type="button"
                        disabled={isSubmitting}
                        onClick={handleSubmit}
                        className="inline-flex items-center justify-center rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
                      >
                        {isSubmitting ? (
                          <span className="flex items-center gap-2">
                            <LoaderCircle className="h-5 w-5 animate-spin" />
                            {isUploading
                              ? "Đang tải tệp lên..."
                              : "Đang nộp bài..."}
                          </span>
                        ) : (
                          <span className="flex items-center gap-2">
                            <Upload className="h-4 w-4" />
                            {submission ? "Nộp lại bài tập" : "Nộp bài tập"}
                          </span>
                        )}
                      </button>
                    </div>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <Link
                        href={`/student/courses/${courseId}`}
                        className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
                        >
                        Quay lại chi tiết khóa học
                        </Link>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-3xl border border-dashed border-slate-300 p-8 text-center text-slate-500">
                    Không tìm thấy thông tin bài tập.
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {componentId > 0 ? (
          <DiscussionSection
            courseComponentId={componentId}
            currentUser={user}
          />
        ) : null}
      </section>
    </main>
  );
}

"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  CheckCircle2,
  ChevronLeft,
  ClipboardList,
  FileText,
  LoaderCircle,
  Menu,
  Save,
  Sparkles,
  XCircle,
} from "lucide-react";
import { UserAccountMenu } from "../../../../components/user-account-menu";
import { NotificationBell } from "../../../../components/notification-bell";
import { ShowNavigation } from "../../../../lib/app_nav";
import type { User } from "../../../../lib/api_user";
import { useInstructorSession } from "../../../_lib/use-instructor-session";
import {
  type InstructorAssignment,
  type InstructorSubmission,
  type GradePayload,
  getInstructorAssignmentById,
  getSubmissionById,
  gradeSubmission,
} from "../../../../lib/api_assignment_instructor";

const initialUser: User = {
  id: 0,
  username: "Giảng viên",
  email: "giao_vien@example.com",
  icon: "/icon.png",
  role: "instructor",
};

function formatDateTime(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleString("vi-VN");
  } catch {
    return dateStr;
  }
}

export default function InstructorGradeSingleSubmissionPage() {
  const router = useRouter();
  const params = useParams<{ submittedId: string }>();
  const submittedId = Number(params.submittedId ?? "0");

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);
  const { currentUser, isCheckingAuth } = useInstructorSession();
  const [assignment, setAssignment] = useState<InstructorAssignment | null>(null);
  const [submission, setSubmission] = useState<InstructorSubmission | null>(null);
  const [gradeScore, setGradeScore] = useState<number>(0);
  const [gradeFeedback, setGradeFeedback] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      if (!currentUser) return;

      if (!submittedId || Number.isNaN(submittedId)) {
        setErrorMessage("ID bài nộp không hợp lệ.");
        setIsLoading(false);
        return;
      }

      try {
        const fetchedSubmission = await getSubmissionById(submittedId);

        if (!isMounted) return;

        if (!fetchedSubmission) {
          setErrorMessage("Không tìm thấy bài nộp.");
          setIsLoading(false);
          return;
        }

        setSubmission(fetchedSubmission);

        const fetchedAssignment = await getInstructorAssignmentById(
          fetchedSubmission.assignment_id,
        );

        if (!isMounted) return;

        setAssignment(fetchedAssignment);
        setGradeScore(fetchedSubmission.score ?? fetchedAssignment.pass_score);
        setGradeFeedback(fetchedSubmission.feedback ?? "");
        setErrorMessage("");
      } catch (error) {
        if (!isMounted) return;
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Không thể tải dữ liệu bài nộp.",
        );
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadData();

    return () => {
      isMounted = false;
    };
  }, [submittedId, currentUser]);

  const user = currentUser ?? initialUser;

  async function handleGrade() {
    if (!submission || !assignment) return;

    if (gradeScore === undefined || gradeScore === null) {
      setErrorMessage("Vui lòng nhập điểm.");
      return;
    }

    if (gradeScore < 0 || gradeScore > assignment.max_score) {
      setErrorMessage(
        `Điểm phải nằm trong khoảng 0 đến ${assignment.max_score}.`,
      );
      return;
    }

    setShowConfirm(true);
  }

  async function confirmGrade() {
    if (!submission || !assignment) return;
    setShowConfirm(false);
    setIsSaving(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const payload: GradePayload = {
        score: gradeScore,
        feedback: gradeFeedback ?? "",
        is_passed: gradeScore >= assignment.pass_score,
        is_graded: true,
      };

      const updated = await gradeSubmission(
        submission.assignment_id,
        submission.user_id,
        payload,
      );

      setSubmission(updated);
      setSuccessMessage(
        `Đã lưu điểm cho ${updated.user_name ?? `sinh viên #${updated.user_id}`}.`,
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Không thể lưu điểm.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  if (isCheckingAuth || !currentUser) {
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
          <button
            type="button"
            className="rounded-xl p-2 text-slate-700 hover:bg-slate-100"
            onClick={() => router.push("/instructor/assignment")}
            aria-label="Quay lại danh sách bài tập"
          >
            <ChevronLeft className="h-5 w-5" />
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
            <h1 className="text-lg font-semibold">Chấm bài nộp</h1>
            <p className="text-sm text-slate-500">
              Xem bài làm và chấm điểm cho từng sinh viên
            </p>
          </div>
        </div>

        <div className="hidden items-center gap-2 md:flex">
          <NotificationBell userId={user.id} />
          <UserAccountMenu user={user} variant="dashboard" />
        </div>
      </header>

      <section className="mx-auto max-w-4xl px-4 pb-16 pt-24">
        {isLoading ? (
          <div className="flex min-h-[50vh] items-center justify-center rounded-3xl bg-white shadow-sm">
            <div className="flex items-center gap-3 text-slate-600">
              <LoaderCircle className="h-5 w-5 animate-spin" />
              <span>Đang tải bài nộp...</span>
            </div>
          </div>
        ) : null}

        {!isLoading && errorMessage ? (
          <div className="rounded-3xl border border-red-200 bg-red-50 px-5 py-4 text-red-700">
            {errorMessage}
          </div>
        ) : null}

        {!isLoading && successMessage ? (
          <div className="rounded-3xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-emerald-700">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
              <p className="text-sm font-medium">{successMessage}</p>
            </div>
          </div>
        ) : null}

        {!isLoading && assignment && submission ? (
          <div className="space-y-6">
            {/* Thông tin bài tập */}
            <section className="rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-slate-200">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium uppercase tracking-[0.2em] text-sky-600">
                    Bài tập
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold text-slate-900">
                    {assignment.title}
                  </h2>
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-slate-500">
                    <span className="inline-flex items-center gap-1">
                      <ClipboardList className="h-4 w-4" />
                      {assignment.assignment_type}
                    </span>
                    <span>Điểm đạt: {assignment.pass_score}</span>
                    <span>Tối đa: {assignment.max_score}</span>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  {submission.is_graded ? (
                    <span
                      className={`inline-flex items-center rounded-full px-3 py-1.5 text-sm font-medium ${
                        submission.is_passed
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      {submission.is_passed ? "Đạt" : "Chưa đạt"} — {submission.score}đ
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-full bg-amber-100 px-3 py-1.5 text-sm font-medium text-amber-700">
                      Chưa chấm
                    </span>
                  )}
                </div>
              </div>
            </section>

            {/* Thông tin sinh viên */}
            <section className="rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-slate-200">
              <h3 className="text-base font-semibold text-slate-900">
                Sinh viên
              </h3>
              <p className="mt-2 text-lg font-semibold text-slate-900">
                {submission.user_name ?? `Sinh viên #${submission.user_id}`}
              </p>
              {submission.user_email ? (
                <p className="mt-1 text-sm text-slate-500">
                  {submission.user_email}
                </p>
              ) : null}
              <div className="mt-2 flex items-center gap-3 text-xs text-slate-400">
                <span>Nộp: {formatDateTime(submission.submitted_at)}</span>
                {submission.is_resubmitted ? (
                  <span className="inline-flex items-center rounded-full bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-700">
                    Nộp lại
                  </span>
                ) : null}
              </div>
            </section>

            {/* Bài làm */}
            <section className="rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-slate-200">
              <h3 className="text-base font-semibold text-slate-900">
                Nội dung bài làm
              </h3>

              {submission.submission_content ? (
                <div className="mt-4 whitespace-pre-wrap rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm leading-7 text-slate-700">
                  {submission.submission_content}
                </div>
              ) : (
                <p className="mt-4 text-sm text-slate-500 italic">
                  Sinh viên không nhập nội dung.
                </p>
              )}

              {submission.submission_file ? (
                <div className="mt-4">
                  <a
                    href={submission.submission_file}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-2xl bg-sky-50 px-4 py-2.5 text-sm font-medium text-sky-700 transition hover:bg-sky-100"
                  >
                    <FileText className="h-4 w-4" />
                    Xem tệp đính kèm
                  </a>
                </div>
              ) : null}

              {assignment.assignment_content ? (
                <details className="mt-4">
                  <summary className="cursor-pointer text-sm font-medium text-sky-600 hover:text-sky-700">
                    Xem yêu cầu bài tập
                  </summary>
                  <div className="mt-3 whitespace-pre-wrap rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-7 text-slate-600">
                    {assignment.assignment_content}
                  </div>
                </details>
              ) : null}
            </section>

            {/* Form chấm điểm */}
            <section className="rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-slate-200">
              <div className="flex items-center gap-3">
                <Sparkles className="h-5 w-5 text-sky-600" />
                <h3 className="text-lg font-semibold text-slate-900">
                  {submission.is_graded ? "Chỉnh sửa điểm" : "Chấm điểm"}
                </h3>
              </div>

              <div className="mt-6 space-y-5">
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Điểm số (0 - {assignment.max_score})
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={assignment.max_score}
                    value={gradeScore}
                    onChange={(e) => setGradeScore(Number(e.target.value))}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Phản hồi
                  </label>
                  <textarea
                    value={gradeFeedback}
                    onChange={(e) => setGradeFeedback(e.target.value)}
                    rows={5}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                    placeholder="Nhập nhận xét, góp ý cho sinh viên..."
                  />
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm font-medium text-slate-700">
                    Kết quả dự kiến
                  </p>
                  <p className="mt-1 text-sm text-slate-600">
                    {gradeScore >= assignment.pass_score
                      ? "Sinh viên sẽ đạt yêu cầu"
                      : "Sinh viên sẽ không đạt"}
                  </p>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row">                    <button
                    type="button"
                    onClick={() => setShowConfirm(true)}
                    disabled={isSaving}
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-sky-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSaving ? (
                      <LoaderCircle className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    <span>
                      {submission.is_graded ? "Cập nhật điểm" : "Lưu điểm"}
                    </span>
                  </button>
                  <Link
                    href={`/instructor/assignment/${submission.assignment_id}`}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    <ClipboardList className="h-4 w-4" />
                    <span>Xem tất cả bài nộp của bài tập này</span>
                  </Link>
                </div>
              </div>
            </section>
          </div>
        ) : null}
      </section>

      {/* Confirm dialog */}
      {showConfirm && submission && assignment ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-[28px] bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-semibold text-slate-900">
              Xác nhận lưu điểm
            </h3>
            <div className="mt-4 space-y-3">
              <div className="rounded-2xl bg-slate-50 px-4 py-3">
                <p className="text-xs text-slate-500">Sinh viên</p>
                <p className="mt-0.5 text-sm font-semibold text-slate-900">
                  {submission.user_name ?? `Sinh viên #${submission.user_id}`}
                </p>
              </div>
              <div className="rounded-2xl bg-slate-50 px-4 py-3">
                <p className="text-xs text-slate-500">Điểm số</p>
                <p className="mt-0.5 text-sm font-semibold text-slate-900">
                  {gradeScore} / {assignment.max_score}
                </p>
              </div>
              <div className="rounded-2xl bg-slate-50 px-4 py-3">
                <p className="text-xs text-slate-500">Kết quả</p>
                <p
                  className={`mt-0.5 text-sm font-semibold ${
                    gradeScore >= assignment.pass_score
                      ? "text-emerald-700"
                      : "text-red-700"
                  }`}
                >
                  {gradeScore >= assignment.pass_score
                    ? "Đạt yêu cầu"
                    : "Không đạt yêu cầu"}
                </p>
              </div>
              {gradeFeedback.trim() ? (
                <div className="rounded-2xl bg-slate-50 px-4 py-3">
                  <p className="text-xs text-slate-500">Phản hồi</p>
                  <p className="mt-0.5 text-sm text-slate-700 line-clamp-3">
                    {gradeFeedback}
                  </p>
                </div>
              ) : null}
            </div>
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                className="flex-1 rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={confirmGrade}
                className="flex-1 rounded-2xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-700"
              >
                Xác nhận
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

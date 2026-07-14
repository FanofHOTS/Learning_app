"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import {
  CheckCircle2,
  ChevronLeft,
  ClipboardList,
  Edit3,
  FileText,
  FileUp,
  LoaderCircle,
  Menu,
  Save,
  Sparkles,
  Trash2,
  Upload,
  UserCheck,
  X,
  XCircle,
} from "lucide-react";
import { UserAccountMenu } from "../../../components/user-account-menu";
import { NotificationBell } from "../../../components/notification-bell";
import { ShowNavigation } from "../../../lib/app_nav";
import type { User } from "../../../lib/api_user";
import { useInstructorSession } from "../../_lib/use-instructor-session";
import DiscussionSection from "../../../components/discussion-section";
import { getCourseComponentByRef } from "../../../lib/api_course_component";
import {
  type InstructorAssignment,
  type InstructorSubmission,
  type GradePayload,
  getInstructorAssignmentById,
  getSubmissionsByAssignment,
  gradeSubmission,
} from "../../../lib/api_assignment_instructor";
import {
  updateAssignment,
  uploadAssignmentFile,
  deleteAssignmentUploadedFile,
  isManagedUploadedFile,
} from "../../../lib/api_assignment";

const initialUser: User = {
  id: 0,
  username: "Giảng viên",
  email: "giao_vien@example.com",
  icon: "/icon.png",
  role: "instructor",
};

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

function formatDateTime(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleString("vi-VN");
  } catch {
    return dateStr;
  }
}

export default function InstructorAssignmentGradingPage() {
  const router = useRouter();
  const params = useParams();
  const assignmentId = Number(params?.assignmentId ?? "0");

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [confirmSubmission, setConfirmSubmission] = useState<InstructorSubmission | null>(null);
  const [courseComponentId, setCourseComponentId] = useState<number | null>(null);
  const { currentUser, isCheckingAuth } = useInstructorSession();
  const [assignment, setAssignment] = useState<InstructorAssignment | null>(null);
  const [submissions, setSubmissions] = useState<InstructorSubmission[]>([]);
  const [selectedSubmissionId, setSelectedSubmissionId] = useState<number | null>(null);
  const [gradeScores, setGradeScores] = useState<Record<number, number>>({});
  const [gradeFeedbacks, setGradeFeedbacks] = useState<Record<number, string>>({});
  const [isEditingAssignment, setIsEditingAssignment] = useState(false);
  const [editForm, setEditForm] = useState<{
    title: string;
    description: string;
    assignment_type: string;
    assignment_content: string;
    pass_score: number;
    max_score: number;
    is_active: boolean;
    assignment_file: string | null;
  } | null>(null);
  const [editAssignmentFile, setEditAssignmentFile] = useState<File | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      if (!currentUser) return;

      if (!assignmentId || Number.isNaN(assignmentId)) {
        setErrorMessage("ID bài tập không hợp lệ.");
        setIsLoading(false);
        return;
      }

      try {
        const [fetchedAssignment, fetchedSubmissions] = await Promise.all([
          getInstructorAssignmentById(assignmentId),
          getSubmissionsByAssignment(assignmentId),
        ]);

        if (!isMounted) return;

        const refComponent = await getCourseComponentByRef("assignment", assignmentId);

        if (!isMounted) return;

        setAssignment(fetchedAssignment);
        setEditForm({
          title: fetchedAssignment.title,
          description: fetchedAssignment.description ?? "",
          assignment_type: fetchedAssignment.assignment_type,
          assignment_content: fetchedAssignment.assignment_content ?? "",
          pass_score: fetchedAssignment.pass_score,
          max_score: fetchedAssignment.max_score,
          is_active: fetchedAssignment.is_active,
          assignment_file: fetchedAssignment.assignment_file ?? null,
        });
        setSubmissions(fetchedSubmissions);
        setCourseComponentId(refComponent?.id ?? null);
        setSelectedSubmissionId(fetchedSubmissions[0]?.id ?? null);

        // Initialize grade forms
        const scores: Record<number, number> = {};
        const feedbacks: Record<number, string> = {};
        for (const sub of fetchedSubmissions) {
          scores[sub.id] = sub.score ?? fetchedAssignment.pass_score;
          feedbacks[sub.id] = sub.feedback ?? "";
        }
        setGradeScores(scores);
        setGradeFeedbacks(feedbacks);

        setErrorMessage("");
      } catch (error) {
        if (!isMounted) return;
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Không thể tải dữ liệu bài tập.",
        );
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadData();

    return () => {
      isMounted = false;
    };
  }, [assignmentId, currentUser]);

  const user = currentUser ?? initialUser;

  const selectedSubmission = submissions.find(
    (s) => s.id === selectedSubmissionId,
  );

  const ungradedCount = submissions.filter((s) => !s.is_graded).length;
  const gradedCount = submissions.filter((s) => s.is_graded).length;
  const passedCount = submissions.filter((s) => s.is_passed).length;

  async function handleGrade(submission: InstructorSubmission) {
    const score = gradeScores[submission.id];
    if (score === undefined || score === null) {
      setErrorMessage("Vui lòng nhập điểm.");
      return;
    }

    if (!assignment) return;
    if (score < 0 || score > assignment.max_score) {
      setErrorMessage(
        `Điểm phải nằm trong khoảng 0 đến ${assignment.max_score}.`,
      );
      return;
    }

    setConfirmSubmission(submission);
  }

  async function confirmGrade() {
    if (!confirmSubmission || !assignment) return;
    const submission = confirmSubmission;
    const score = gradeScores[submission.id];
    setConfirmSubmission(null);
    setIsSaving(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const payload: GradePayload = {
        score,
        feedback: gradeFeedbacks[submission.id] ?? "",
        is_passed: score >= assignment.pass_score,
        is_graded: true,
      };

      const updated = await gradeSubmission(
        submission.assignment_id,
        submission.user_id,
        payload,
      );

      setSubmissions((current) =>
        current.map((s) =>
          s.id === submission.id ? updated : s,
        ),
      );
      setSuccessMessage(
        `Đã chấm bài của ${updated.user_name ?? `sinh viên #${updated.user_id}`}.`,
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

  function handleStartEditAssignment() {
    if (!assignment) return;
    setIsEditingAssignment(true);
    setEditForm({
      title: assignment.title,
      description: assignment.description ?? "",
      assignment_type: assignment.assignment_type,
      assignment_content: assignment.assignment_content ?? "",
      pass_score: assignment.pass_score,
      max_score: assignment.max_score,
      is_active: assignment.is_active,
      assignment_file: assignment.assignment_file ?? null,
    });
    setEditAssignmentFile(null);
    setErrorMessage("");
    setSuccessMessage("");
  }

  function handleCancelEditAssignment() {
    setIsEditingAssignment(false);
    if (assignment) {
      setEditForm({
        title: assignment.title,
        description: assignment.description ?? "",
        assignment_type: assignment.assignment_type,
        assignment_content: assignment.assignment_content ?? "",
        pass_score: assignment.pass_score,
        max_score: assignment.max_score,
        is_active: assignment.is_active,
        assignment_file: assignment.assignment_file ?? null,
      });
    }
    setEditAssignmentFile(null);
    setErrorMessage("");
  }

  async function handleSaveAssignment() {
    if (!assignment || !editForm) return;

    if (!editForm.title.trim()) {
      setErrorMessage("Tiêu đề bài tập không được để trống.");
      return;
    }
    if (editForm.max_score <= 0) {
      setErrorMessage("Điểm tối đa phải lớn hơn 0.");
      return;
    }
    if (editForm.pass_score < 0 || editForm.pass_score > editForm.max_score) {
      setErrorMessage("Điểm đạt phải nằm trong khoảng 0 đến điểm tối đa.");
      return;
    }

    setIsSaving(true);
    setErrorMessage("");
    setSuccessMessage("");

    // Remember old file URL so we can clean up after
    const oldFileUrl = editForm.assignment_file;

    try {
      // Upload file if a new one is selected
      let assignmentFileUrl = editForm.assignment_file;
      if (editAssignmentFile) {
        const uploadResult = await uploadAssignmentFile(editAssignmentFile);
        assignmentFileUrl = uploadResult.file_url;

        // Delete old managed file if it was replaced
        if (oldFileUrl && isManagedUploadedFile(oldFileUrl)) {
          deleteAssignmentUploadedFile(oldFileUrl).catch(() => {});
        }
      }

      const updated = await updateAssignment(assignment.id, {
        title: editForm.title,
        description: editForm.description || null,
        assignment_type: editForm.assignment_type,
        assignment_content: editForm.assignment_content || null,
        pass_score: editForm.pass_score,
        max_score: editForm.max_score,
        is_active: editForm.is_active,
        assignment_file: assignmentFileUrl,
      });

      setAssignment((prev) =>
        prev
          ? {
              ...prev,
              title: updated.title,
              description: updated.description,
              assignment_type: updated.assignment_type,
              assignment_content: updated.assignment_content,
              assignment_file: updated.assignment_file,
              pass_score: updated.pass_score,
              max_score: updated.max_score,
              is_active: updated.is_active,
            }
          : prev,
      );
      setIsEditingAssignment(false);
      setEditAssignmentFile(null);
      setSuccessMessage("✅ Đã cập nhật thông tin bài tập.");
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Không thể cập nhật bài tập.",
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
            onClick={() => router.push("/instructor/courses")}
            aria-label="Quay lại danh sách khóa học"
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
            <h1 className="text-lg font-semibold">Chấm bài tập</h1>
            <p className="text-sm text-slate-500">
              Xem bài nộp của sinh viên, chấm điểm và phản hồi
            </p>
          </div>
        </div>

        <div className="hidden items-center gap-2 md:flex">
          <NotificationBell userId={user.id} />
          <UserAccountMenu user={user} variant="dashboard" />
        </div>
      </header>

      <section className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-4 pb-8 pt-24 sm:px-6 lg:px-8">
        {isLoading ? (
          <div className="flex min-h-[50vh] items-center justify-center rounded-3xl bg-white shadow-sm">
            <div className="flex items-center gap-3 text-slate-600">
              <LoaderCircle className="h-5 w-5 animate-spin" />
              <span>Đang tải bài tập...</span>
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

        {!isLoading && assignment ? (
          <>
            {/* Thông tin bài tập */}
            <section className="rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-slate-200">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium uppercase tracking-[0.2em] text-sky-600">
                    Bài tập giảng dạy
                  </p>
                  {isEditingAssignment && editForm ? (
                    <div className="mt-4 space-y-4">
                      <label className="block text-sm font-medium text-slate-700">
                        Tiêu đề bài tập
                        <input
                          type="text"
                          value={editForm.title}
                          onChange={(e) =>
                            setEditForm((prev) =>
                              prev ? { ...prev, title: e.target.value } : prev,
                            )
                          }
                          className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                        />
                      </label>
                    </div>
                  ) : (
                    <h2 className="mt-2 text-3xl font-semibold text-slate-900">
                      {assignment.title}
                    </h2>
                  )}
                </div>

                {!isEditingAssignment ? (
                  <button
                    type="button"
                    onClick={handleStartEditAssignment}
                    className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 shrink-0"
                  >
                    <Edit3 className="h-4 w-4" />
                    Chỉnh sửa
                  </button>
                ) : (
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={handleCancelEditAssignment}
                      className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100"
                    >
                      <X className="h-4 w-4" />
                      Hủy
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveAssignment}
                      disabled={isSaving}
                      className="inline-flex items-center gap-2 rounded-2xl bg-sky-600 px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isSaving ? (
                        <LoaderCircle className="h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4" />
                      )}
                      Lưu
                    </button>
                  </div>
                )}
              </div>

              {isEditingAssignment && editForm ? (
                <div className="mt-6 space-y-5">
                  <label className="block text-sm font-medium text-slate-700">
                    Mô tả
                    <textarea
                      value={editForm.description}
                      onChange={(e) =>
                        setEditForm((prev) =>
                          prev ? { ...prev, description: e.target.value } : prev,
                        )
                      }
                      rows={3}
                      className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                    />
                  </label>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block text-sm font-medium text-slate-700">
                      Loại bài tập
                      <select
                        value={editForm.assignment_type}
                        onChange={(e) =>
                          setEditForm((prev) =>
                            prev ? { ...prev, assignment_type: e.target.value } : prev,
                          )
                        }
                        className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                      >
                        <option value="Bài tập tự luận">Tự luận</option>
                        <option value="Bài tập nộp tệp">Nộp tệp</option>
                        <option value="Bài tập lập trình">Lập trình</option>
                      </select>
                    </label>

                    <label className="block text-sm font-medium text-slate-700">
                      Trạng thái
                      <select
                        value={editForm.is_active ? "active" : "inactive"}
                        onChange={(e) =>
                          setEditForm((prev) =>
                            prev
                              ? { ...prev, is_active: e.target.value === "active" }
                              : prev,
                          )
                        }
                        className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                      >
                        <option value="active">Kích hoạt</option>
                        <option value="inactive">Chưa kích hoạt</option>
                      </select>
                    </label>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block text-sm font-medium text-slate-700">
                      Điểm đạt
                      <input
                        type="number"
                        min={0}
                        max={editForm.max_score}
                        value={editForm.pass_score}
                        onChange={(e) =>
                          setEditForm((prev) =>
                            prev
                              ? { ...prev, pass_score: Number(e.target.value) }
                              : prev,
                          )
                        }
                        className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                      />
                    </label>
                    <label className="block text-sm font-medium text-slate-700">
                      Điểm tối đa
                      <input
                        type="number"
                        min={1}
                        value={editForm.max_score}
                        onChange={(e) =>
                          setEditForm((prev) =>
                            prev
                              ? { ...prev, max_score: Number(e.target.value) }
                              : prev,
                          )
                        }
                        className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                      />
                    </label>
                  </div>

                  <label className="block text-sm font-medium text-slate-700">
                    Nội dung yêu cầu
                    <textarea
                      value={editForm.assignment_content}
                      onChange={(e) =>
                        setEditForm((prev) =>
                          prev
                            ? { ...prev, assignment_content: e.target.value }
                            : prev,
                        )
                      }
                      rows={5}
                      className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                      placeholder="Mô tả yêu cầu bài tập, hướng dẫn làm bài..."
                    />
                  </label>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
                    <p className="mb-3 text-sm font-medium text-slate-700">
                      Tệp đính kèm
                    </p>

                    {editForm.assignment_file && !editAssignmentFile ? (
                      <div className="mb-3 flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <FileText className="h-4 w-4 shrink-0 text-sky-600" />
                          <span className="truncate text-sm text-slate-700">
                            {editForm.assignment_file.split("/").pop()}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={async () => {
                            const currentUrl = editForm?.assignment_file;
                            setEditForm((prev) =>
                              prev ? { ...prev, assignment_file: null } : prev,
                            );
                            // Delete from server immediately
                            if (isManagedUploadedFile(currentUrl)) {
                              try {
                                await deleteAssignmentUploadedFile(currentUrl!);
                              } catch {
                                // Silent — file cleanup is best-effort
                              }
                            }
                          }}
                          className="inline-flex items-center gap-1 rounded-xl border border-red-200 px-2.5 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50 shrink-0"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Xóa tệp
                        </button>
                      </div>
                    ) : null}

                    <label className="block">
                      <span className="inline-flex cursor-pointer items-center gap-2 rounded-2xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50">
                        <Upload className="h-4 w-4" />
                        {editAssignmentFile
                          ? "Thay đổi tệp..."
                          : "Tải tệp lên"}
                      </span>
                      <input
                        type="file"
                        accept=".pdf,.docx,.zip,.rar,.txt,.jpg,.png"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) setEditAssignmentFile(file);
                        }}
                        className="hidden"
                      />
                    </label>

                    {editAssignmentFile ? (
                      <div className="mt-2 flex items-center gap-2 text-sm text-sky-700">
                        <Upload className="h-4 w-4" />
                        <span className="truncate">{editAssignmentFile.name}</span>
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : (
                <>
                  <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                        {assignment.description ?? "Không có mô tả."}
                      </p>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="rounded-3xl bg-slate-50 p-4 text-center">
                        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Loại</p>
                        <p className="mt-2 text-xl font-semibold text-slate-900">
                          {getAssignmentTypeLabel(assignment.assignment_type)}
                        </p>
                      </div>
                      <div className="rounded-3xl bg-slate-50 p-4 text-center">
                        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Điểm đạt</p>
                        <p className="mt-2 text-xl font-semibold text-slate-900">{assignment.pass_score}</p>
                      </div>
                      <div className="rounded-3xl bg-slate-50 p-4 text-center">
                        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Tối đa</p>
                        <p className="mt-2 text-xl font-semibold text-slate-900">{assignment.max_score}</p>
                      </div>
                    </div>
                  </div>

                  {assignment.assignment_content ? (
                    <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                        Nội dung yêu cầu
                      </p>
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-slate-700">
                        {assignment.assignment_content}
                      </p>
                    </div>
                  ) : null}
                </>
              )}
            </section>

            {/* Thống kê */}
            <section className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-slate-500">Tổng nộp</p>
                  <ClipboardList className="h-5 w-5 text-sky-600" />
                </div>
                <p className="mt-3 text-3xl font-semibold text-slate-900">{submissions.length}</p>
              </div>
              <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-slate-500">Chưa chấm</p>
                  <XCircle className="h-5 w-5 text-amber-600" />
                </div>
                <p className="mt-3 text-3xl font-semibold text-amber-600">{ungradedCount}</p>
              </div>
              <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-slate-500">Đạt yêu cầu</p>
                  <UserCheck className="h-5 w-5 text-emerald-600" />
                </div>
                <p className="mt-3 text-3xl font-semibold text-emerald-600">{passedCount}/{gradedCount}</p>
              </div>
            </section>

            {/* Danh sách bài nộp + Chi tiết */}
            <div className="grid gap-6 xl:grid-cols-[1fr_1.2fr]">
              {/* Danh sách sinh viên */}
              <section className="space-y-3">
                <h3 className="text-lg font-semibold text-slate-900">Danh sách bài nộp</h3>

                {submissions.length === 0 ? (
                  <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center shadow-sm">
                    <p className="text-sm font-medium text-slate-500">
                      Chưa có sinh viên nào nộp bài tập này.
                    </p>
                  </div>
                ) : (
                  submissions.map((submission) => {
                    const isSelected = selectedSubmissionId === submission.id;
                    return (
                      <button
                        key={submission.id}
                        type="button"
                        onClick={() => setSelectedSubmissionId(submission.id)}
                        className={`w-full rounded-3xl border p-5 text-left transition-colors ${
                          isSelected
                            ? "border-sky-300 bg-sky-50 ring-2 ring-sky-200"
                            : "border-slate-200 bg-white hover:border-sky-200 hover:bg-sky-50/50"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-900">
                              {submission.user_name ?? `Sinh viên #${submission.user_id}`}
                            </p>
                            {submission.user_email ? (
                              <p className="mt-0.5 text-xs text-slate-500">
                                {submission.user_email}
                              </p>
                            ) : null}
                            <p className="mt-2 text-xs text-slate-400">
                              Nộp: {formatDateTime(submission.submitted_at)}
                            </p>
                          </div>
                          <div className="shrink-0">
                            {submission.is_graded ? (
                              <span
                                className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${
                                  submission.is_passed
                                    ? "bg-emerald-100 text-emerald-700"
                                    : "bg-red-100 text-red-700"
                                }`}
                              >
                                {submission.score}đ
                                {submission.is_passed ? " ✓" : " ✗"}
                              </span>
                            ) : (
                              <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-700">
                                Chưa chấm
                              </span>
                            )}
                          </div>
                        </div>

                        {submission.submission_content ? (
                          <p className="mt-3 line-clamp-2 text-sm text-slate-600">
                            {submission.submission_content}
                          </p>
                        ) : null}

                        {submission.submission_file ? (
                          <div className="mt-2 flex items-center gap-1.5 text-xs text-sky-600">
                            <FileUp className="h-3.5 w-3.5" />
                            <span>Có tệp đính kèm</span>
                          </div>
                        ) : null}
                      </button>
                    );
                  })
                )}
              </section>

              {/* Chi tiết bài nộp + Chấm điểm */}
              <section className="space-y-6">
                {selectedSubmission ? (
                  <>
                    {/* Nội dung bài nộp */}
                    <article className="rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-slate-200">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold text-slate-900">
                          Bài làm của{" "}
                          {selectedSubmission.user_name ??
                            `sinh viên #${selectedSubmission.user_id}`}
                        </h3>
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                          {selectedSubmission.is_resubmitted
                            ? "Nộp lại"
                            : "Nộp lần đầu"}
                        </span>
                      </div>

                      <div className="mt-4 text-xs text-slate-400">
                        Nộp lúc: {formatDateTime(selectedSubmission.submitted_at)}
                      </div>

                      {selectedSubmission.submission_content ? (
                        <div className="mt-4 whitespace-pre-wrap rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-7 text-slate-700">
                          {selectedSubmission.submission_content}
                        </div>
                      ) : null}

                      {selectedSubmission.submission_file ? (
                        <div className="mt-4">
                          <a
                            href={selectedSubmission.submission_file}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-2 rounded-2xl bg-sky-50 px-4 py-2.5 text-sm font-medium text-sky-700 transition hover:bg-sky-100"
                          >
                            <FileText className="h-4 w-4" />
                            Xem tệp đính kèm
                          </a>
                        </div>
                      ) : null}

                      {!selectedSubmission.submission_content &&
                      !selectedSubmission.submission_file ? (
                        <p className="mt-4 text-sm text-slate-500">
                          Sinh viên chưa nhập nội dung.
                        </p>
                      ) : null}
                    </article>

                    {/* Form chấm điểm */}
                    <article className="rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-slate-200">
                      <div className="flex items-center gap-3">
                        <Sparkles className="h-5 w-5 text-sky-600" />
                        <h3 className="text-lg font-semibold text-slate-900">
                          {selectedSubmission.is_graded
                            ? "Chỉnh sửa điểm"
                            : "Chấm điểm"}
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
                            value={gradeScores[selectedSubmission.id] ?? assignment.pass_score}
                            onChange={(e) =>
                              setGradeScores((prev) => ({
                                ...prev,
                                [selectedSubmission.id]: Number(e.target.value),
                              }))
                            }
                            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                          />
                        </div>

                        <div>
                          <label className="mb-2 block text-sm font-medium text-slate-700">
                            Phản hồi
                          </label>
                          <textarea
                            value={gradeFeedbacks[selectedSubmission.id] ?? ""}
                            onChange={(e) =>
                              setGradeFeedbacks((prev) => ({
                                ...prev,
                                [selectedSubmission.id]: e.target.value,
                              }))
                            }
                            rows={4}
                            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                            placeholder="Nhập nhận xét, góp ý cho sinh viên..."
                          />
                        </div>

                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                          <p className="text-sm font-medium text-slate-700">
                            Kết quả dự kiến
                          </p>
                          <p className="mt-1 text-sm text-slate-600">
                            {(gradeScores[selectedSubmission.id] ?? 0) >=
                            assignment.pass_score
                              ? "Sinh viên sẽ đạt yêu cầu"
                              : "Sinh viên sẽ không đạt"}
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => setConfirmSubmission(selectedSubmission)}
                          disabled={isSaving}
                          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-sky-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {isSaving ? (
                            <LoaderCircle className="h-4 w-4 animate-spin" />
                          ) : (
                            <Save className="h-4 w-4" />
                          )}
                          <span>
                            {selectedSubmission.is_graded
                              ? "Cập nhật điểm"
                              : "Lưu điểm"}
                          </span>
                        </button>
                      </div>
                    </article>
                  </>
                ) : submissions.length > 0 ? (
                  <div className="rounded-[28px] border border-dashed border-slate-300 bg-white p-8 text-center shadow-sm">
                    <p className="text-sm text-slate-500">
                      Chọn một bài nộp từ danh sách bên trái để chấm điểm.
                    </p>
                  </div>
                ) : null}
              </section>
            </div>
          </>
        ) : null}

        {!isLoading && courseComponentId ? (
          <DiscussionSection
            courseComponentId={courseComponentId}
            currentUser={user}
          />
        ) : null}
      </section>

      {/* Confirm dialog */}
      {confirmSubmission && assignment ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-[28px] bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-semibold text-slate-900">
              Xác nhận lưu điểm
            </h3>
            <div className="mt-4 space-y-3">
              <div className="rounded-2xl bg-slate-50 px-4 py-3">
                <p className="text-xs text-slate-500">Sinh viên</p>
                <p className="mt-0.5 text-sm font-semibold text-slate-900">
                  {confirmSubmission.user_name ??
                    `Sinh viên #${confirmSubmission.user_id}`}
                </p>
              </div>
              <div className="rounded-2xl bg-slate-50 px-4 py-3">
                <p className="text-xs text-slate-500">Điểm số</p>
                <p className="mt-0.5 text-sm font-semibold text-slate-900">
                  {gradeScores[confirmSubmission.id] ?? "?"} /{" "}
                  {assignment.max_score}
                </p>
              </div>
              <div className="rounded-2xl bg-slate-50 px-4 py-3">
                <p className="text-xs text-slate-500">Kết quả</p>
                <p
                  className={`mt-0.5 text-sm font-semibold ${
                    (gradeScores[confirmSubmission.id] ?? 0) >=
                    assignment.pass_score
                      ? "text-emerald-700"
                      : "text-red-700"
                  }`}
                >
                  {(gradeScores[confirmSubmission.id] ?? 0) >=
                  assignment.pass_score
                    ? "Đạt yêu cầu"
                    : "Không đạt yêu cầu"}
                </p>
              </div>
              {gradeFeedbacks[confirmSubmission.id]?.trim() ? (
                <div className="rounded-2xl bg-slate-50 px-4 py-3">
                  <p className="text-xs text-slate-500">Phản hồi</p>
                  <p className="mt-0.5 text-sm text-slate-700 line-clamp-3">
                    {gradeFeedbacks[confirmSubmission.id]}
                  </p>
                </div>
              ) : null}
            </div>
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setConfirmSubmission(null)}
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

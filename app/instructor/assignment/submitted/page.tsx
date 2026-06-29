"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  EyeOff,
  Filter,
  LoaderCircle,
  Menu,
  Search,
  SlidersHorizontal,
  UserCheck,
  XCircle,
} from "lucide-react";
import { UserAccountMenu } from "../../../components/user-account-menu";
import { NotificationBell } from "../../../components/notification-bell";
import { ShowNavigation } from "../../../lib/app_nav";
import { useInstructorSession } from "../../_lib/use-instructor-session";
import { getInstructorCourseListRaw } from "../../../lib/api_course_instructor";
import type { User } from "../../../lib/api_user";
import {
  type InstructorAssignment,
  type EnrichedSubmission,
  getInstructorAssignmentList,
  getAllInstructorSubmissions,
} from "../../../lib/api_assignment_instructor";

const initialUser: User = {
  id: 7,
  username: "Giảng viên",
  email: "giang_vien@example.com",
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

function getSubmissionStatusLabel(submission: EnrichedSubmission): {
  label: string;
  color: string;
} {
  if (!submission.is_graded) {
    return { label: "Chưa chấm", color: "bg-amber-100 text-amber-700" };
  }
  if (submission.is_passed) {
    return { label: `Đạt (${submission.score}đ)`, color: "bg-emerald-100 text-emerald-700" };
  }
  return { label: `Chưa đạt (${submission.score}đ)`, color: "bg-red-100 text-red-700" };
}

export default function InstructorSubmittedPage() {
  const router = useRouter();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const { currentUser, isCheckingAuth } = useInstructorSession();
  const [submissions, setSubmissions] = useState<EnrichedSubmission[]>([]);
  const [assignments, setAssignments] = useState<InstructorAssignment[]>([]);
  const [keyword, setKeyword] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [assignmentFilter, setAssignmentFilter] = useState("all");

  useEffect(() => {
    let isMounted = true;

    async function loadPageData() {
      if (!currentUser) return;

      try {
        const courses = await getInstructorCourseListRaw(currentUser.id);

        if (!isMounted) return;

        const courseList = courses.map((c) => ({ id: c.id, title: c.title }));
        const assignmentList = await getInstructorAssignmentList(
          currentUser.id,
          courseList,
        );

        if (!isMounted) return;

        setAssignments(assignmentList);

        const allSubmissions = await getAllInstructorSubmissions(assignmentList);

        if (!isMounted) return;

        setSubmissions(allSubmissions);
        setErrorMessage("");
      } catch (error) {
        if (!isMounted) return;
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Không thể tải danh sách bài nộp.",
        );
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadPageData();

    return () => {
      isMounted = false;
    };
  }, [currentUser]);

  const user = currentUser ?? initialUser;

  const filteredSubmissions = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    return submissions.filter((sub) => {
      const matchesKeyword =
        !kw ||
        (sub.user_name ?? "").toLowerCase().includes(kw) ||
        (sub.assignment_title ?? "").toLowerCase().includes(kw) ||
        (sub.course_name ?? "").toLowerCase().includes(kw);

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "graded" && sub.is_graded) ||
        (statusFilter === "ungraded" && !sub.is_graded) ||
        (statusFilter === "passed" && sub.is_passed) ||
        (statusFilter === "failed" && sub.is_graded && !sub.is_passed);

      const matchesAssignment =
        assignmentFilter === "all" ||
        `${sub.assignment_id}` === assignmentFilter;

      return matchesKeyword && matchesStatus && matchesAssignment;
    });
  }, [submissions, keyword, statusFilter, assignmentFilter]);

  const ungradedCount = useMemo(
    () => submissions.filter((s) => !s.is_graded).length,
    [submissions],
  );
  const passedCount = useMemo(
    () => submissions.filter((s) => s.is_passed).length,
    [submissions],
  );
  const gradedCount = useMemo(
    () => submissions.filter((s) => s.is_graded).length,
    [submissions],
  );

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
          <Image
            src="/logo.png"
            alt="Logo"
            width={40}
            height={40}
            className="cursor-pointer"
            onClick={() => router.push("/instructor")}
          />
          <div>
            <h1 className="text-lg font-semibold">Tất cả bài nộp</h1>
            <p className="text-sm text-slate-500">
              Xem tất cả bài tập đã nộp từ sinh viên trên các khóa học
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
          <div className="flex min-h-[55vh] items-center justify-center rounded-[28px] bg-white shadow-sm">
            <div className="flex items-center gap-3 text-slate-600">
              <LoaderCircle className="h-5 w-5 animate-spin" />
              <span>Đang tải danh sách bài nộp...</span>
            </div>
          </div>
        ) : null}

        {!isLoading && errorMessage ? (
          <div className="rounded-3xl border border-red-200 bg-red-50 px-5 py-4 text-red-700">
            {errorMessage}
          </div>
        ) : null}

        {!isLoading ? (
          <>
            <section className="rounded-[28px] bg-linear-to-r from-rose-700 via-pink-700 to-fuchsia-600 px-6 py-7 text-white shadow-xl">
              <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                <div className="max-w-3xl">
                  <p className="text-sm font-medium text-rose-100">
                    Tổng quan bài nộp
                  </p>
                  <h2 className="mt-2 text-3xl font-semibold">
                    Tất cả bài nộp của sinh viên
                  </h2>
                  <p className="mt-3 text-sm leading-6 text-rose-50">
                    Theo dõi toàn bộ bài tập đã nộp từ sinh viên. Dễ dàng lọc theo
                    trạng thái chấm điểm, bài tập hoặc tìm kiếm theo tên sinh viên.
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl bg-white/14 px-4 py-3">
                    <p className="text-sm text-rose-100">Tổng bài nộp</p>
                    <p className="mt-2 text-base font-semibold">{submissions.length}</p>
                  </div>
                  <div className="rounded-2xl bg-white/14 px-4 py-3">
                    <p className="text-sm text-rose-100">Chưa chấm</p>
                    <p className="mt-2 text-base font-semibold">{ungradedCount}</p>
                  </div>
                  <div className="rounded-2xl bg-white/14 px-4 py-3">
                    <p className="text-sm text-rose-100">Đã đạt</p>
                    <p className="mt-2 text-base font-semibold">{passedCount}/{gradedCount}</p>
                  </div>
                </div>
              </div>
            </section>

            <section className="grid gap-4 md:grid-cols-4">
              <article className="rounded-3xl bg-white px-5 py-5 shadow-sm ring-1 ring-slate-200">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-slate-500">Kết quả hiển thị</p>
                  <BookOpen className="h-5 w-5 text-rose-600" />
                </div>
                <p className="mt-3 text-3xl font-semibold text-slate-900">
                  {filteredSubmissions.length}
                </p>
                <p className="mt-2 text-sm text-slate-600">
                  Số bài nộp khớp với bộ lọc.
                </p>
              </article>

              <article className="rounded-3xl bg-white px-5 py-5 shadow-sm ring-1 ring-slate-200">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-slate-500">Chưa chấm</p>
                  <XCircle className="h-5 w-5 text-amber-600" />
                </div>
                <p className="mt-3 text-3xl font-semibold text-amber-600">
                  {ungradedCount}
                </p>
                <p className="mt-2 text-sm text-slate-600">
                  Cần được chấm điểm và phản hồi.
                </p>
              </article>

              <article className="rounded-3xl bg-white px-5 py-5 shadow-sm ring-1 ring-slate-200">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-slate-500">Đã đạt</p>
                  <UserCheck className="h-5 w-5 text-emerald-600" />
                </div>
                <p className="mt-3 text-3xl font-semibold text-emerald-600">
                  {passedCount}
                </p>
                <p className="mt-2 text-sm text-slate-600">
                  Sinh viên đáp ứng yêu cầu bài tập.
                </p>
              </article>

              <article className="rounded-3xl bg-white px-5 py-5 shadow-sm ring-1 ring-slate-200">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-slate-500">Số bài tập</p>
                  <ClipboardList className="h-5 w-5 text-purple-600" />
                </div>
                <p className="mt-3 text-3xl font-semibold text-slate-900">
                  {assignments.length}
                </p>
                <p className="mt-2 text-sm text-slate-600">
                  Bài tập có bài nộp từ sinh viên.
                </p>
              </article>
            </section>

            <section className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h3 className="text-xl font-semibold">Bộ lọc bài nộp</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    Lọc theo từ khóa, trạng thái chấm điểm và bài tập.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setKeyword("");
                    setStatusFilter("all");
                    setAssignmentFilter("all");
                  }}
                  className="inline-flex items-center gap-2 self-start rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  <SlidersHorizontal className="h-4 w-4" />
                  <span>Đặt lại bộ lọc</span>
                </button>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-3">
                <label className="block">
                  <span className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-700">
                    <Search className="h-4 w-4" />
                    <span>Tìm kiếm</span>
                  </span>
                  <input
                    type="text"
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value)}
                    placeholder="Tìm theo tên sinh viên, bài tập..."
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-rose-400"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-700">
                    <Filter className="h-4 w-4" />
                    <span>Trạng thái</span>
                  </span>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-rose-400"
                  >
                    <option value="all">Tất cả trạng thái</option>
                    <option value="ungraded">Chưa chấm</option>
                    <option value="graded">Đã chấm</option>
                    <option value="passed">Đạt yêu cầu</option>
                    <option value="failed">Chưa đạt</option>
                  </select>
                </label>

                <label className="block">
                  <span className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-700">
                    <ClipboardList className="h-4 w-4" />
                    <span>Bài tập</span>
                  </span>
                  <select
                    value={assignmentFilter}
                    onChange={(e) => setAssignmentFilter(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-rose-400"
                  >
                    <option value="all">Tất cả bài tập</option>
                    {assignments.map((a) => (
                      <option key={a.id} value={`${a.id}`}>
                        {a.title}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </section>

            <section className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <div className="flex items-center justify-between border-b border-slate-200 pb-4">
                <div>
                  <h3 className="text-xl font-semibold">Danh sách bài nộp</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    Chọn một bài nộp để xem chi tiết và chấm điểm.
                  </p>
                </div>
              </div>

              {filteredSubmissions.length === 0 ? (
                <div className="mt-5 rounded-3xl border border-dashed border-slate-300 px-5 py-10 text-center">
                  <EyeOff className="mx-auto h-8 w-8 text-slate-400" />
                  <h4 className="mt-4 text-lg font-semibold text-slate-900">
                    Không có bài nộp phù hợp
                  </h4>
                  <p className="mt-2 text-sm text-slate-600">
                    {submissions.length === 0
                      ? "Chưa có sinh viên nào nộp bài tập."
                      : "Hãy thử thay đổi bộ lọc để xem thêm kết quả."}
                  </p>
                </div>
              ) : (
                <div className="mt-5 space-y-4">
                  {filteredSubmissions.map((submission) => {
                    const status = getSubmissionStatusLabel(submission);
                    return (
                      <article
                        key={`${submission.assignment_id}-${submission.user_id}-${submission.id}`}
                        className="rounded-3xl border border-slate-200 bg-slate-50/60 p-4 transition-colors hover:border-rose-300 hover:bg-rose-50/70"
                      >
                        <div className="flex flex-col gap-4">
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="rounded-full bg-violet-100 px-2.5 py-1 text-xs font-medium text-violet-700">
                                  {submission.course_name ?? `Khóa học #${assignments.find(a => a.id === submission.assignment_id)?.course_id ?? "?"}`}
                                </span>
                                <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${status.color}`}>
                                  {status.label}
                                </span>
                                {submission.is_resubmitted ? (
                                  <span className="rounded-full bg-sky-100 px-2.5 py-1 text-xs font-medium text-sky-700">
                                    Nộp lại
                                  </span>
                                ) : null}
                              </div>

                              <h4 className="mt-3 text-base font-semibold text-slate-900">
                                {submission.user_name ?? `Sinh viên #${submission.user_id}`}
                              </h4>
                              <p className="mt-1 text-sm text-slate-500">
                                {submission.assignment_title ?? `Bài tập #${submission.assignment_id}`}
                              </p>

                              {submission.submission_content ? (
                                <p className="mt-2 line-clamp-2 text-sm text-slate-600">
                                  {submission.submission_content}
                                </p>
                              ) : null}

                              <p className="mt-2 text-xs text-slate-400">
                                Nộp: {formatDateTime(submission.submitted_at)}
                              </p>
                            </div>

                            <Link
                              href={`/instructor/assignment/submitted/${submission.id}`}
                              className="inline-flex items-center gap-2 self-start rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                            >
                              <ClipboardList className="h-4 w-4" />
                              <span>Chấm bài</span>
                            </Link>
                          </div>

                          {submission.is_graded && submission.feedback ? (
                            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                              <p className="text-xs font-medium text-slate-500">
                                Phản hồi
                              </p>
                              <p className="mt-1 text-sm text-slate-700 line-clamp-2">
                                {submission.feedback}
                              </p>
                            </div>
                          ) : null}

                          <div className="flex justify-end">
                            <Link
                              href={`/instructor/assignment/submitted/${submission.id}`}
                              className="inline-flex items-center gap-1 text-sm font-semibold text-rose-700"
                            >
                              <span>Đi tới trang chấm bài</span>
                              <ChevronRight className="h-4 w-4" />
                            </Link>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        ) : null}
      </section>
    </main>
  );
}

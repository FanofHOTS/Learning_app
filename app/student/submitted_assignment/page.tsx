"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  FileArchive,
  LoaderCircle,
  Menu,
  Search,
  XCircle,
} from "lucide-react";
import { ShowNavigation } from "../../lib/app_nav";
import type { User } from "../../lib/api_user";
import {
  type EnrichedStudentSubmission,
  getStudentSubmissionsWithDetails,
} from "../../lib/api_assignment";
import {
  STUDENT_DEFAULT_USER,
  useStudentSession,
} from "../_lib/use-student-session";
import { UserAccountMenu } from "../../components/user-account-menu";
import { NotificationBell } from "../../components/notification-bell";

const initialUser: User = STUDENT_DEFAULT_USER;

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString("vi-VN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dateStr;
  }
}

function getStatusInfo(submission: EnrichedStudentSubmission): {
  label: string;
  class: string;
} {
  if (submission.is_graded) {
    return submission.is_passed
      ? { label: "Đạt", class: "bg-emerald-100 text-emerald-700" }
      : { label: "Chưa đạt", class: "bg-red-100 text-red-700" };
  }
  return {
    label: "Chờ chấm",
    class: "bg-amber-100 text-amber-700",
  };
}

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

export default function SubmittedAssignmentPage() {
  const router = useRouter();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [submissions, setSubmissions] = useState<EnrichedStudentSubmission[]>(
    [],
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [courseFilter, setCourseFilter] = useState<string>("all");
  const { currentUser, isCheckingAuth } = useStudentSession();

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      if (!currentUser) {
        return;
      }

      try {
        const data = await getStudentSubmissionsWithDetails(currentUser.id);

        if (!isMounted) {
          return;
        }

        setSubmissions(data);
        setErrorMessage("");
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Không thể tải danh sách bài tập đã nộp.",
        );
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadData();

    return () => {
      isMounted = false;
    };
  }, [currentUser]);

  const uniqueCourses = useMemo(() => {
    const courseMap = new Map<number, string>();
    submissions.forEach((sub) => {
      if (sub.course_id && sub.course_name) {
        courseMap.set(sub.course_id, sub.course_name);
      }
    });
    return Array.from(courseMap.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [submissions]);

  const filteredSubmissions = useMemo(() => {
    return submissions.filter((sub) => {
      const matchesSearch =
        !searchTerm.trim() ||
        (sub.assignment_title ?? "")
          .toLowerCase()
          .includes(searchTerm.trim().toLowerCase()) ||
        (sub.course_name ?? "")
          .toLowerCase()
          .includes(searchTerm.trim().toLowerCase());

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "graded" && sub.is_graded) ||
        (statusFilter === "ungraded" && !sub.is_graded) ||
        (statusFilter === "passed" && sub.is_passed) ||
        (statusFilter === "failed" && sub.is_graded && !sub.is_passed);

      const matchesCourse =
        courseFilter === "all" ||
        `${sub.course_id}` === courseFilter;

      return matchesSearch && matchesStatus && matchesCourse;
    });
  }, [submissions, searchTerm, statusFilter, courseFilter]);

  const sortedSubmissions = useMemo(() => {
    return [...filteredSubmissions].sort((a, b) => {
      return (
        new Date(b.submitted_at).getTime() -
        new Date(a.submitted_at).getTime()
      );
    });
  }, [filteredSubmissions]);

  const stats = useMemo(() => {
    const total = submissions.length;
    const graded = submissions.filter((s) => s.is_graded).length;
    const passed = submissions.filter((s) => s.is_passed).length;
    const failed = graded - passed;
    return { total, graded, passed, failed };
  }, [submissions]);

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
            <h1 className="text-lg font-semibold">Bài tập đã nộp</h1>
            <p className="text-sm text-slate-500">
              Xem lại các bài tập bạn đã nộp và kết quả đánh giá từ giảng viên
            </p>
          </div>
        </div>

        <div className="hidden items-center gap-2 md:flex">
          <NotificationBell userId={user.id} />
          <UserAccountMenu user={user} variant="dashboard" />
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-4 pb-16 pt-24">
        {/* Banner */}
        <div className="rounded-[28px] bg-linear-to-r from-violet-700 via-purple-700 to-fuchsia-800 px-6 py-7 text-white shadow-xl">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-sm font-medium text-violet-200">
                Tổng quan bài tập
              </p>
              <h2 className="mt-2 text-3xl font-semibold">
                Danh sách bài tập đã nộp
              </h2>
              <p className="mt-3 text-sm leading-6 text-violet-100">
                Theo dõi tất cả bài tập bạn đã nộp trên các khóa học, xem kết
                quả chấm điểm và phản hồi từ giảng viên.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-4">
              <div className="rounded-2xl bg-white/14 px-4 py-3">
                <p className="text-sm text-violet-200">Đã nộp</p>
                <p className="mt-2 text-base font-semibold">{stats.total}</p>
              </div>
              <div className="rounded-2xl bg-white/14 px-4 py-3">
                <p className="text-sm text-violet-200">Đã chấm</p>
                <p className="mt-2 text-base font-semibold">{stats.graded}</p>
              </div>
              <div className="rounded-2xl bg-white/14 px-4 py-3">
                <p className="text-sm text-violet-200">Đạt yêu cầu</p>
                <p className="mt-2 text-base font-semibold">{stats.passed}</p>
              </div>
              <div className="rounded-2xl bg-white/14 px-4 py-3">
                <p className="text-sm text-violet-200">Chưa đạt</p>
                <p className="mt-2 text-base font-semibold">{stats.failed}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Error */}
        {errorMessage ? (
          <div className="mt-6 rounded-3xl border border-red-200 bg-red-50 p-5 text-red-700">
            <div className="flex items-start gap-3">
              <XCircle className="mt-1 h-5 w-5 shrink-0" />
              <div>
                <p className="font-semibold">Lỗi</p>
                <p className="mt-1 text-sm">{errorMessage}</p>
              </div>
            </div>
          </div>
        ) : null}

        {/* Filters & List */}
        <div className="mt-6 rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <FileArchive className="h-5 w-5 text-sky-600" />
              <h3 className="text-base font-semibold text-slate-900">
                Tất cả bài nộp
              </h3>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              {/* Search */}
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Tìm kiếm bài tập..."
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-4 text-sm text-slate-900 placeholder-slate-400 transition focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-200 sm:w-56"
                />
              </div>

              {/* Course filter */}
              <select
                value={courseFilter}
                onChange={(e) => setCourseFilter(e.target.value)}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-700 transition focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-200"
              >
                <option value="all">Tất cả khóa học</option>
                {uniqueCourses.map((course) => (
                  <option key={course.id} value={`${course.id}`}>
                    {course.name}
                  </option>
                ))}
              </select>

              {/* Status filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-700 transition focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-200"
              >
                <option value="all">Tất cả trạng thái</option>
                <option value="graded">Đã chấm</option>
                <option value="ungraded">Chờ chấm</option>
                <option value="passed">Đạt</option>
                <option value="failed">Chưa đạt</option>
              </select>
            </div>
          </div>

          {isLoading ? (
            <div className="mt-8 flex items-center justify-center py-12 text-slate-500">
              <LoaderCircle className="mr-3 h-5 w-5 animate-spin" />
              Đang tải danh sách bài tập...
            </div>
          ) : sortedSubmissions.length === 0 ? (
            <div className="mt-8 rounded-2xl border border-dashed border-slate-200 px-6 py-10 text-center">
              <ClipboardList className="mx-auto h-10 w-10 text-slate-300" />
              <p className="mt-3 text-sm font-medium text-slate-600">
                {searchTerm || statusFilter !== "all" || courseFilter !== "all"
                  ? "Không có bài tập nào phù hợp với bộ lọc."
                  : "Bạn chưa nộp bài tập nào."}
              </p>
              <p className="mt-1 text-xs text-slate-400">
                {searchTerm || statusFilter !== "all" || courseFilter !== "all"
                  ? "Hãy thử thay đổi từ khóa hoặc bộ lọc."
                  : "Hoàn thành các bài tập trong khóa học để theo dõi kết quả tại đây."}
              </p>
            </div>
          ) : (
            <div className="mt-6 space-y-3">
              {sortedSubmissions.map((sub) => {
                const status = getStatusInfo(sub);
                const hasFeedback =
                  sub.is_graded && sub.feedback && sub.feedback.trim().length > 0;

                return (
                  <Link
                    key={`${sub.assignment_id}-${sub.user_id}`}
                    href={`/student/submitted_assignment/${sub.assignment_id}`}
                    className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 transition hover:-translate-y-0.5 hover:border-sky-300 hover:bg-sky-50/60 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${status.class}`}
                        >
                          {status.label}
                        </span>
                        {sub.is_resubmitted ? (
                          <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                            Đã nộp lại
                          </span>
                        ) : null}
                        {sub.is_graded && sub.score !== null ? (
                          <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                            {sub.score}đ
                          </span>
                        ) : null}
                      </div>

                      <p className="mt-1.5 text-sm font-semibold text-slate-900 truncate">
                        {sub.assignment_title}
                      </p>

                      <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                        <span>{sub.course_name}</span>
                        <span>{formatDate(sub.submitted_at)}</span>
                        {hasFeedback ? (
                          <span className="inline-flex items-center gap-1 text-emerald-600">
                            <CheckCircle2 className="h-3 w-3" />
                            Có phản hồi
                          </span>
                        ) : sub.is_graded ? (
                          <span className="text-slate-400">
                            Chưa có phản hồi
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-2 text-sm text-sky-600">
                      <span className="hidden sm:inline">Xem chi tiết</span>
                      <ChevronRight className="h-4 w-4" />
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

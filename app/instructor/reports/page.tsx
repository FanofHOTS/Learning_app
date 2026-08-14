"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  ChartColumnIncreasing,
  CircleCheckBig,
  FileChartColumn,
  Filter,
  GraduationCap,
  LoaderCircle,
  Menu,
  Search,
  Sparkles,
  Users,
} from "lucide-react";
import AddieEvaluation from "./_addie-evaluation";
import InstructorBloomChart from "./_bloom-chart-instructor";
import InstructorBloomDistributionSummary from "./_bloom-distribution-summary";
import { UserAccountMenu } from "../../components/user-account-menu";
import { NotificationBell } from "../../components/notification-bell";
import { ShowNavigation } from "../../lib/app_nav";
import type { User } from "../../lib/api_user";
import { useInstructorSession } from "../_lib/use-instructor-session";
import {
  filterInstructorReportCourses,
  getDefaultInstructorReportFilters,
  getInstructorReportData,
  type InstructorReportCourse,
  type InstructorReportData,
  type InstructorReportMetric,
  type InstructorReportTheme,
} from "../../lib/api_instructor_reports";
import type {
  CourseCategoryOption,
  InstructorCourseFilterState,
} from "../../lib/api_course_instructor";

const COURSES_PER_PAGE = 5;

const initialUser: User = {
  id: 0,
  username: "Giảng viên",
  email: "giang_vien@example.com",
  icon: "/icon.png",
  role: "instructor",
};

function formatPercent(value: number): string {
  return `${value.toFixed(Number.isInteger(value) ? 0 : 1)}%`;
}

function formatGeneratedTime(value: string): string {
  return new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}

function getMetricClasses(theme: InstructorReportTheme): string {
  switch (theme) {
    case "emerald":
      return "border-emerald-200 bg-emerald-50/80 text-emerald-700";
    case "amber":
      return "border-amber-200 bg-amber-50/80 text-amber-700";
    case "rose":
      return "border-rose-200 bg-rose-50/80 text-rose-700";
    case "sky":
    default:
      return "border-sky-200 bg-sky-50/80 text-sky-700";
  }
}

function getScoreTone(value: number): string {
  if (value >= 85) {
    return "text-emerald-700";
  }

  if (value >= 70) {
    return "text-sky-700";
  }

  return "text-amber-700";
}

function getProgressBarClasses(value: number): string {
  if (value >= 80) {
    return "from-emerald-500 via-teal-500 to-cyan-500";
  }

  if (value >= 50) {
    return "from-sky-500 via-cyan-500 to-emerald-500";
  }

  return "from-amber-500 via-orange-500 to-rose-500";
}

function MetricCard({ metric }: { metric: InstructorReportMetric }) {
  return (
    <article className="rounded-[26px] border border-slate-200 bg-white/95 p-5 shadow-sm shadow-slate-200/70 backdrop-blur">
      <div
        className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${getMetricClasses(metric.theme)}`}
      >
        {metric.label}
      </div>
      <p className="mt-4 text-3xl font-semibold tracking-tight text-slate-950">
        {metric.value}
      </p>
      <p className="mt-2 text-sm leading-6 text-slate-600">{metric.note}</p>
    </article>
  );
}

function CourseReportCard({ course }: { course: InstructorReportCourse }) {
  return (
    <article className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/70 transition-transform hover:-translate-y-0.5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="max-w-2xl">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-700">
              {course.category_name}
            </span>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
              {course.level}
            </span>
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                course.is_public
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-slate-200 text-slate-700"
              }`}
            >
              {course.is_public ? "Đang công bố" : "Chưa công bố"}
            </span>
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                course.is_active
                  ? "bg-amber-100 text-amber-700"
                  : "bg-rose-100 text-rose-700"
              }`}
            >
              {course.is_active ? "Đang kích hoạt" : "Đã tạm dừng"}
            </span>
          </div>

          <h3 className="mt-3 text-xl font-semibold text-slate-950">
            {course.title}
          </h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            {course.introduction}
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Khóa học có {course.total_module} module, chỉ tiêu {course.total_student}
            {` `}
            sinh viên và đang ghi nhận {course.totalProgressRecords} bản ghi tiến độ.
          </p>
        </div>

        <div className="grid min-w-full gap-3 sm:grid-cols-2 xl:min-w-95 xl:max-w-105">
          <div className="rounded-2xl bg-slate-50 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Sinh viên tham gia
            </p>
            <p className="mt-2 text-2xl font-semibold text-slate-950">
              {course.uniqueStudents}
            </p>
          </div>
          <div className="rounded-2xl bg-slate-50 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Sinh viên hoàn thành
            </p>
            <p className="mt-2 text-2xl font-semibold text-slate-950">
              {course.completedProgressRecords}
            </p>
          </div>
          <div className="rounded-2xl bg-slate-50 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Điểm trung bình
            </p>
            <p className={`mt-2 text-2xl font-semibold ${getScoreTone(course.averageCourseScore)}`}>
              {course.averageCourseScore.toFixed(1)}
            </p>
          </div>
          <div className="rounded-2xl bg-slate-50 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Tỉ lệ hoàn thành
            </p>
            <p className="mt-2 text-2xl font-semibold text-slate-950">
              {formatPercent(course.completionRate)}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_1fr]">
        <div className="rounded-3xl border border-slate-200 bg-slate-50 px-4 py-4">
          <div className="flex items-center justify-between text-sm text-slate-500">
            <span>Tiến độ hoàn thành khóa học</span>
            <span>{formatPercent(course.completionRate)}</span>
          </div>
          <div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-200">
            <div
              className={`h-full rounded-full bg-linear-to-r ${getProgressBarClasses(course.completionRate)}`}
              style={{ width: `${course.completionRate}%` }}
            />
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-slate-50 px-4 py-4">
          <div className="flex items-center justify-between text-sm text-slate-500">
            <span>Tỉ lệ đạt bài kiểm tra</span>
            <span>{formatPercent(course.examPassRate)}</span>
          </div>
          <div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-200">
            <div
              className={`h-full rounded-full bg-linear-to-r ${getProgressBarClasses(course.examPassRate)}`}
              style={{ width: `${course.examPassRate}%` }}
            />
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Số lần kiểm tra
          </p>
          <p className="mt-2 text-2xl font-semibold text-slate-950">
            {course.totalExamAttempts}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Số lần kiểm tra đạt
          </p>
          <p className="mt-2 text-2xl font-semibold text-slate-950">
            {course.passedExamAttempts}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Tỉ lệ đạt kiểm tra
          </p>
          <p className="mt-2 text-2xl font-semibold text-slate-950">
            {formatPercent(course.examPassRate)}
          </p>
        </div>
      </div>
    </article>
  );
}

export default function InstructorReportsPage() {
  const router = useRouter();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const { currentUser, isCheckingAuth } = useInstructorSession();
  const [reportData, setReportData] = useState<InstructorReportData | null>(null);
  const [filters, setFilters] = useState<InstructorCourseFilterState>(
    getDefaultInstructorReportFilters(),
  );
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    let isMounted = true;

    async function loadReportPage() {
      if (!currentUser) {
        return;
      }
      try {
        const report = await getInstructorReportData(currentUser.id);

        if (!isMounted) {
          return;
        }
        setReportData(report);
        setFilters(getDefaultInstructorReportFilters());
        setCurrentPage(1);
        setErrorMessage("");
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Không thể tải báo cáo kết quả giảng dạy của giảng viên.",
        );
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadReportPage();

    return () => {
      isMounted = false;
    };
  }, [currentUser]);

  const user = currentUser ?? initialUser;
  const categories = reportData?.categories ?? [];
  const levels = reportData?.levels ?? [];
  const summary = reportData?.summary;
  const mainMetrics = reportData?.mainMetrics ?? [];
  const secondaryMetrics = reportData?.secondaryMetrics ?? [];
  const highlights = reportData?.highlights ?? [];
  const filteredCourses = filterInstructorReportCourses(
    reportData?.courses ?? [],
    filters,
  );
  const totalPages = Math.max(
    1,
    Math.ceil(filteredCourses.length / COURSES_PER_PAGE),
  );
  const startIndex = (currentPage - 1) * COURSES_PER_PAGE;
  const visibleCourses = filteredCourses.slice(
    startIndex,
    startIndex + COURSES_PER_PAGE,
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [filters]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

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
  function updateFilter<K extends keyof InstructorCourseFilterState>(
    key: K,
    value: InstructorCourseFilterState[K],
  ) {
    setFilters((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function resetFilters() {
    setFilters(getDefaultInstructorReportFilters());
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.18),transparent_28%),linear-gradient(180deg,#f8fbff_0%,#eef5ff_48%,#f8fafc_100%)] text-slate-900">
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

      <header className="fixed top-0 left-0 z-30 flex w-full items-center justify-between border-b border-slate-200/80 bg-white/90 px-4 py-3 shadow-sm shadow-slate-200/60 backdrop-blur md:px-6">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setIsSidebarOpen(true)}
            className="rounded-xl p-2 text-slate-700 transition-colors hover:bg-slate-100"
            aria-label="Mở thanh điều hướng"
          >
            <Menu className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => router.push(`/${user.role}`)}
            className="rounded-2xl transition-transform hover:scale-[1.02]"
            aria-label="Về trang chủ giảng viên"
          >
            <Image src="/logo.png" alt="Logo" width={42} height={42} />
          </button>
          <div>
            <h1 className="text-lg font-semibold">Báo cáo kết quả giảng dạy</h1>
            <p className="text-sm text-slate-500">
              Theo dõi chất lượng học tập trên các khóa học do bạn mở
            </p>
          </div>
        </div>

        <div className="hidden items-center gap-2 md:flex">
          <NotificationBell userId={user.id} />
          <UserAccountMenu user={user} variant="dashboard" />
        </div>
      </header>

      <section className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-4 pb-10 pt-24 sm:px-6 lg:px-8">
        {isLoading ? (
          <div className="flex min-h-[55vh] items-center justify-center rounded-4xl border border-white/60 bg-white/80 shadow-xl shadow-slate-200/60 backdrop-blur">
            <div className="flex items-center gap-3 text-slate-600">
              <LoaderCircle className="h-5 w-5 animate-spin" />
              <span>Đang tải báo cáo kết quả giảng dạy...</span>
            </div>
          </div>
        ) : null}

        {!isLoading && errorMessage ? (
          <div className="rounded-[28px] border border-rose-200 bg-rose-50 px-5 py-4 text-rose-700 shadow-sm">
            {errorMessage}
          </div>
        ) : null}

        {!isLoading && !errorMessage && reportData && summary ? (
          <>
            <section className="overflow-hidden rounded-[34px] border border-slate-200/70 bg-slate-950 text-white shadow-2xl shadow-slate-300/40">
              <div className="grid gap-8 px-6 py-7 lg:grid-cols-[1.2fr_0.8fr] lg:px-8">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-sm text-sky-100">
                    <Sparkles className="h-4 w-4" />
                    <span>Bản tổng hợp kết quả giảng dạy theo dữ liệu hệ thống</span>
                  </div>
                  <h2 className="mt-4 max-w-3xl text-3xl font-semibold tracking-tight sm:text-4xl">
                    {user.username} đang theo dõi {summary.totalCourseCount} khóa học với{" "}
                    {formatPercent(summary.examPassRate)} lượt kiểm tra đạt.
                  </h2>
                  <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">
                    Trang này tổng hợp dữ liệu từ khóa học, tiến độ học tập và kết
                    quả kiểm tra để giảng viên nhìn nhanh bức tranh chất lượng giảng
                    dạy trên các khóa học do mình mở.
                  </p>

                  <div className="mt-6 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-3xl border border-white/12 bg-white/8 px-4 py-4">
                      <p className="text-sm text-slate-300">Sinh viên thực sự tham gia</p>
                      <p className="mt-2 text-3xl font-semibold">
                        {summary.uniqueStudentsCount}
                      </p>
                    </div>
                    <div className="rounded-3xl border border-white/12 bg-white/8 px-4 py-4">
                      <p className="text-sm text-slate-300">Tiến độ đã hoàn thành</p>
                      <p className="mt-2 text-3xl font-semibold">
                        {summary.completedCourseProgressCount}
                      </p>
                    </div>
                    <div className="rounded-3xl border border-white/12 bg-white/8 px-4 py-4">
                      <p className="text-sm text-slate-300">Điểm trung bình khóa học</p>
                      <p className="mt-2 text-3xl font-semibold">
                        {summary.averageCourseScore.toFixed(1)}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-[30px] border border-white/10 bg-white/8 p-5 backdrop-blur">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-300">
                        Cập nhật gần nhất
                      </p>
                      <p className="mt-1 text-xl font-semibold">
                        {formatGeneratedTime(reportData.generatedAt)}
                      </p>
                    </div>
                    <FileChartColumn className="h-7 w-7 text-cyan-300" />
                  </div>

                  <div className="mt-5 space-y-3">
                    {highlights.map((highlight) => (
                      <div
                        key={highlight}
                        className="rounded-2xl border border-white/10 bg-slate-900/50 px-4 py-3 text-sm leading-6 text-slate-200"
                      >
                        {highlight}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            <section className="grid gap-4 lg:grid-cols-4">
              {mainMetrics.map((metric) => (
                <MetricCard key={metric.id} metric={metric} />
              ))}
            </section>

            {/* ADDIE Model Evaluation */}
            <AddieEvaluation data={reportData} />

            <section className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
              <article className="rounded-4xl border border-slate-200 bg-white/95 p-6 shadow-lg shadow-slate-200/60">
                <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">
                      <BookOpen className="h-4 w-4" />
                      Theo từng khóa học
                    </div>
                    <h3 className="mt-3 text-2xl font-semibold text-slate-950">
                      Danh sách khóa học do giảng viên mở
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      Mỗi khóa học hiển thị số sinh viên tham gia, sinh viên hoàn
                      thành, điểm trung bình, tỉ lệ hoàn thành và kết quả kiểm tra.
                    </p>
                  </div>

                  <div className="rounded-2xl bg-slate-100 px-4 py-3 text-sm text-slate-600">
                    Đang xem{" "}
                    <span className="font-semibold text-slate-950">
                      {visibleCourses.length}
                    </span>{" "}
                    / {filteredCourses.length} khóa học sau lọc
                  </div>
                </div>

                <div className="mt-6 space-y-4">
                  {visibleCourses.length > 0 ? (
                    visibleCourses.map((course) => (
                      <CourseReportCard key={course.id} course={course} />
                    ))
                  ) : (
                    <div className="rounded-[28px] border border-dashed border-slate-300 bg-slate-50 px-5 py-10 text-center text-slate-600">
                      Không có khóa học nào khớp với bộ lọc hiện tại.
                    </div>
                  )}
                </div>

                {filteredCourses.length > COURSES_PER_PAGE ? (
                  <div className="mt-6 flex flex-col gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-slate-500">
                      Trang {currentPage}/{totalPages}
                    </p>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                        disabled={currentPage === 1}
                        className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-45"
                      >
                        <ArrowLeft className="h-4 w-4" />
                        Trang trước
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setCurrentPage((page) => Math.min(totalPages, page + 1))
                        }
                        disabled={currentPage === totalPages}
                        className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-45"
                      >
                        Trang sau
                        <ArrowRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ) : null}
              </article>

              <aside className="space-y-6">
                <article className="rounded-4xl border border-slate-200 bg-white/95 p-6 shadow-lg shadow-slate-200/60">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
                        <Filter className="h-4 w-4" />
                        Bộ lọc báo cáo
                      </div>
                      <h3 className="mt-3 text-2xl font-semibold text-slate-950">
                        Lọc danh sách khóa học
                      </h3>
                    </div>
                    <Search className="h-7 w-7 text-emerald-600" />
                  </div>

                  <div className="mt-5 space-y-4">
                    <label className="block">
                      <span className="mb-2 block text-sm font-medium text-slate-700">
                        Từ khóa
                      </span>
                      <input
                        type="text"
                        value={filters.keyword}
                        onChange={(event) =>
                          updateFilter("keyword", event.target.value)
                        }
                        placeholder="Tìm theo tên, mô tả hoặc phân loại"
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
                      />
                    </label>

                    <label className="block">
                      <span className="mb-2 block text-sm font-medium text-slate-700">
                        Phân loại
                      </span>
                      <select
                        value={filters.categoryId}
                        onChange={(event) =>
                          updateFilter("categoryId", event.target.value)
                        }
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
                      >
                        <option value="all">Tất cả phân loại</option>
                        {categories.map((category: CourseCategoryOption) => (
                          <option key={category.id} value={`${category.id}`}>
                            {category.name}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="block">
                      <span className="mb-2 block text-sm font-medium text-slate-700">
                        Tình trạng công bố
                      </span>
                      <select
                        value={filters.isPublic}
                        onChange={(event) =>
                          updateFilter("isPublic", event.target.value)
                        }
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
                      >
                        <option value="all">Tất cả trạng thái công bố</option>
                        <option value="public">Đang công bố</option>
                        <option value="private">Chưa công bố</option>
                      </select>
                    </label>

                    <label className="block">
                      <span className="mb-2 block text-sm font-medium text-slate-700">
                        Tình trạng kích hoạt
                      </span>
                      <select
                        value={filters.isActive}
                        onChange={(event) =>
                          updateFilter("isActive", event.target.value)
                        }
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
                      >
                        <option value="all">Tất cả trạng thái kích hoạt</option>
                        <option value="active">Đang kích hoạt</option>
                        <option value="inactive">Đã tạm dừng</option>
                      </select>
                    </label>

                    <label className="block">
                      <span className="mb-2 block text-sm font-medium text-slate-700">
                        Mức độ
                      </span>
                      <select
                        value={filters.level}
                        onChange={(event) =>
                          updateFilter("level", event.target.value)
                        }
                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
                      >
                        <option value="all">Tất cả mức độ</option>
                        {levels.map((level) => (
                          <option key={level} value={level}>
                            {level}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <div className="mt-5 flex items-center gap-3">
                    <button
                      type="button"
                      onClick={resetFilters}
                      className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100"
                    >
                      Đặt lại bộ lọc
                    </button>
                    <div className="rounded-full bg-slate-100 px-4 py-2 text-sm text-slate-600">
                      {filteredCourses.length} khóa học phù hợp
                    </div>
                  </div>
                </article>

                <article className="rounded-4xl border border-slate-200 bg-white/95 p-6 shadow-lg shadow-slate-200/60">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">
                        <CircleCheckBig className="h-4 w-4" />
                        Chỉ số bổ sung
                      </div>
                      <h3 className="mt-3 text-2xl font-semibold text-slate-950">
                        Góc nhìn nhanh cho giảng viên
                      </h3>
                    </div>
                    <ChartColumnIncreasing className="h-7 w-7 text-amber-600" />
                  </div>

                  <div className="mt-5 space-y-4">
                    {secondaryMetrics.map((metric) => (
                      <div
                        key={metric.id}
                        className="rounded-[26px] border border-slate-200 bg-slate-50 px-4 py-4"
                      >
                        <p className="text-sm font-semibold text-slate-900">
                          {metric.label}
                        </p>
                        <p className="mt-3 text-2xl font-semibold text-slate-950">
                          {metric.value}
                        </p>
                        <p className="mt-2 text-sm leading-6 text-slate-600">
                          {metric.note}
                        </p>
                      </div>
                    ))}
                  </div>
                </article>

                <InstructorBloomDistributionSummary instructorId={user.id} />

                <InstructorBloomChart instructorId={user.id} />

                <article className="rounded-4xl border border-slate-200 bg-linear-to-br from-sky-600 via-cyan-600 to-emerald-600 p-6 text-white shadow-xl shadow-cyan-200/60">
                  <div className="flex items-center gap-3">
                    <Users className="h-7 w-7" />
                    <div>
                      <h3 className="text-xl font-semibold">Tín hiệu hành động</h3>
                      <p className="mt-1 text-sm text-sky-50">
                        Một vài gợi ý để cải thiện chất lượng giảng dạy
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 space-y-3">
                    <div className="rounded-2xl bg-white/14 px-4 py-3 text-sm leading-6 text-sky-50">
                      Ưu tiên xem các khóa học có tỉ lệ hoàn thành thấp nhưng số học
                      sinh tham gia cao để tìm đúng điểm nghẽn nội dung.
                    </div>
                    <div className="rounded-2xl bg-white/14 px-4 py-3 text-sm leading-6 text-sky-50">
                      Khi tỉ lệ đạt kiểm tra thấp hơn tỉ lệ hoàn thành, nên rà soát
                      lại cấu trúc bài kiểm tra và nội dung học phần trước đó.
                    </div>
                    <div className="rounded-2xl bg-white/14 px-4 py-3 text-sm leading-6 text-sky-50">
                      Bộ lọc theo phân loại, công bố, kích hoạt và mức độ giúp bạn
                      tập trung nhanh vào đúng nhóm khóa học cần theo dõi.
                    </div>
                  </div>
                </article>

                <article className="rounded-4xl border border-slate-200 bg-white/95 p-6 shadow-lg shadow-slate-200/60">
                  <div className="flex items-center gap-3">
                    <GraduationCap className="h-6 w-6 text-slate-700" />
                    <div>
                      <h3 className="text-xl font-semibold text-slate-950">
                        Nguồn dữ liệu đang bám theo cho báo cáo này
                      </h3>
                      <p className="mt-1 text-sm text-slate-500">
                        Việc báo cáo dữ liệu về khóa học được lấy từ những 
                        dữ liệu sau.
                      </p>
                    </div>
                  </div>
                  <ul className="mt-4 space-y-2 text-sm leading-6 text-slate-600">
                    <li>
                      Danh sách khóa học do giảng viên mở.
                    </li>
                    <li>
                      Tiến độ học tập theo khóa học.
                    </li>
                    <li>
                      Các bài kiểm tra nằm trong khóa học.
                    </li>
                    <li>
                      Số lượt làm bài và kết quả đạt.
                    </li>
                  </ul>
                </article>
              </aside>
            </section>
          </>
        ) : null}
      </section>
    </main>
  );
}

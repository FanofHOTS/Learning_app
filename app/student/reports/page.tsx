"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  BookCheck,
  BookOpen,
  ChartColumnIncreasing,
  CircleCheckBig,
  ClipboardCheck,
  FileChartColumn,
  GraduationCap,
  LoaderCircle,
  Menu,
  Sparkles,
} from "lucide-react";
import { UserAccountMenu } from "../../components/user-account-menu";
import { NotificationBell } from "../../components/notification-bell";
import { ShowNavigation } from "../../lib/app_nav";
import BloomChart from "./bloom-chart";
import type { User } from "../../lib/api_user";
import {
  getStudentReportData,
  type StudentReportCourse,
  type StudentReportData,
  type StudentReportMetric,
  type StudentReportTheme,
} from "../../lib/api_student_reports";
import {
  STUDENT_DEFAULT_USER,
  useStudentSession,
} from "../_lib/use-student-session";

const REPORTS_PER_PAGE = 5;

const initialUser: User = STUDENT_DEFAULT_USER;

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

function getMetricClasses(theme: StudentReportTheme): string {
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

function getProgressBarClasses(progressPercent: number): string {
  if (progressPercent >= 80) {
    return "from-emerald-500 via-teal-500 to-cyan-500";
  }

  if (progressPercent >= 50) {
    return "from-sky-500 via-cyan-500 to-emerald-500";
  }

  return "from-amber-500 via-orange-500 to-rose-500";
}

function ReportMetricCard({ metric }: { metric: StudentReportMetric }) {
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

function ActiveCourseCard({ course }: { course: StudentReportCourse }) {
  return (
    <article className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/70 transition-transform hover:-translate-y-0.5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-2xl">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-700">
              {course.level}
            </span>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
              Mã khóa học #{course.courseId}
            </span>
          </div>
          <h3 className="mt-3 text-xl font-semibold text-slate-950">{course.title}</h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Đã hoàn thành {course.completedModules}/{course.totalModules} module,
            {` `}
            {course.completedComponents}/{course.totalComponents} học phần và đạt
            {` `}
            {course.passedExamAttempts}/{Math.max(course.totalExamAttempts, course.totalCourseExams)}
            {` `}
            lượt kiểm tra liên quan.
          </p>
        </div>

        <div className="grid min-w-full gap-3 sm:grid-cols-3 lg:min-w-[320px] lg:max-w-90">
          <div className="rounded-2xl bg-slate-50 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Tiến độ
            </p>
            <p className="mt-2 text-2xl font-semibold text-slate-950">
              {formatPercent(course.progressPercent)}
            </p>
          </div>
          <div className="rounded-2xl bg-slate-50 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Điểm cuối khóa
            </p>
            <p className="mt-2 text-2xl font-semibold text-slate-950">
              {course.finalScore}
            </p>
          </div>
          <div className="rounded-2xl bg-slate-50 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Kiểm tra
            </p>
            <p className="mt-2 text-2xl font-semibold text-slate-950">
              {course.totalExamAttempts}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-5">
        <div className="flex items-center justify-between text-sm text-slate-500">
          <span>Mức độ hoàn thành hiện tại</span>
          <span>{formatPercent(course.progressPercent)}</span>
        </div>
        <div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-200">
          <div
            className={`h-full rounded-full bg-linear-to-r ${getProgressBarClasses(course.progressPercent)}`}
            style={{ width: `${course.progressPercent}%` }}
          />
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Link
          href={`/student/courses/${course.courseId}`}
          className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-800"
        >
          Tiếp tục học
          <ArrowRight className="h-4 w-4" />
        </Link>
        <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm text-slate-600">
          <ClipboardCheck className="h-4 w-4 text-emerald-600" />
          <span>
            {course.passedExamAttempts}/{course.totalExamAttempts} lượt kiểm tra đạt
          </span>
        </div>
      </div>
    </article>
  );
}

export default function StudentReportsPage() {
  const router = useRouter();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [reportData, setReportData] = useState<StudentReportData | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const { currentUser, isCheckingAuth } = useStudentSession();

  useEffect(() => {
    let isMounted = true;

    async function loadReportPage() {
      if (!currentUser) {
        return;
      }

      try {
        const report = await getStudentReportData(currentUser.id);

        if (!isMounted) {
          return;
        }

        setReportData(report);
        setCurrentPage(1);
        setErrorMessage("");
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Không thể tải báo cáo kết quả học tập của sinh viên.",
        );
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadReportPage();

    return () => {
      isMounted = false;
    };
  }, [currentUser]);

  const user = currentUser ?? initialUser;
  const mainMetrics = reportData?.mainMetrics ?? [];
  const secondaryMetrics = reportData?.secondaryMetrics ?? [];
  const activeCourses = reportData?.activeCourses ?? [];
  const highlights = reportData?.highlights ?? [];
  const summary = reportData?.summary;
  const totalPages = Math.max(1, Math.ceil(activeCourses.length / REPORTS_PER_PAGE));
  const startIndex = (currentPage - 1) * REPORTS_PER_PAGE;
  const visibleCourses = activeCourses.slice(
    startIndex,
    startIndex + REPORTS_PER_PAGE,
  );

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
            aria-label="Về trang chủ sinh viên"
          >
            <Image src="/logo.png" alt="Logo" width={42} height={42} />
          </button>
          <div>
            <h1 className="text-lg font-semibold">Báo cáo kết quả học tập</h1>
            <p className="text-sm text-slate-500">
              Theo dõi tiến độ khóa học và chất lượng làm bài kiểm tra
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
              <span>Đang tải báo cáo kết quả học tập...</span>
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
              <div className="grid gap-8 px-6 py-7 lg:grid-cols-[1.15fr_0.85fr] lg:px-8">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-sm text-sky-100">
                    <Sparkles className="h-4 w-4" />
                    <span>Bản tổng hợp tiến độ và kết quả học tập</span>
                  </div>
                  <h2 className="mt-4 max-w-3xl text-3xl font-semibold tracking-tight sm:text-4xl">
                    {user.username} đang giữ nhịp học khá tốt với{" "}
                    {formatPercent(summary.examPassRate)} lượt kiểm tra đạt.
                  </h2>
                  <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">
                    Trang này tổng hợp dữ liệu từ các tiến độ khóa học,
                    module, học phần và kết quả kiểm tra để sinh viên nhìn nhanh
                    bức tranh học tập hiện tại của mình.
                  </p>

                  <div className="mt-6 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-3xl border border-white/12 bg-white/8 px-4 py-4">
                      <p className="text-sm text-slate-300">Khóa học đang học</p>
                      <p className="mt-2 text-3xl font-semibold">
                        {summary.activeCourses}
                      </p>
                    </div>
                    <div className="rounded-3xl border border-white/12 bg-white/8 px-4 py-4">
                      <p className="text-sm text-slate-300">Module đã hoàn thành</p>
                      <p className="mt-2 text-3xl font-semibold">
                        {summary.totalCompletedModules}
                      </p>
                    </div>
                    <div className="rounded-3xl border border-white/12 bg-white/8 px-4 py-4">
                      <p className="text-sm text-slate-300">Điểm cuối khóa trung bình</p>
                      <p className="mt-2 text-3xl font-semibold">
                        {summary.averageFinalScore.toFixed(1)}
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
                <ReportMetricCard key={metric.id} metric={metric} />
              ))}
            </section>

            <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
              <article className="rounded-4xl border border-slate-200 bg-white/95 p-6 shadow-lg shadow-slate-200/60">
                <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">
                      <BookOpen className="h-4 w-4" />
                      Danh sách ưu tiên
                    </div>
                    <h3 className="mt-3 text-2xl font-semibold text-slate-950">
                      Các khóa học đang học nhưng chưa hoàn thành
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      Danh sách được sắp xếp theo mức độ hoàn thành giảm dần và chỉ
                      hiển thị tối đa 5 khóa học mỗi lần.
                    </p>
                  </div>

                  <div className="rounded-2xl bg-slate-100 px-4 py-3 text-sm text-slate-600">
                    Đang xem{" "}
                    <span className="font-semibold text-slate-950">
                      {visibleCourses.length}
                    </span>{" "}
                    / {activeCourses.length} khóa học đang học
                  </div>
                </div>

                <div className="mt-6 space-y-4">
                  {visibleCourses.length > 0 ? (
                    visibleCourses.map((course) => (
                      <ActiveCourseCard key={course.courseId} course={course} />
                    ))
                  ) : (
                    <div className="rounded-[28px] border border-dashed border-slate-300 bg-slate-50 px-5 py-10 text-center text-slate-600">
                      Hiện chưa có khóa học nào ở trạng thái đang học.
                    </div>
                  )}
                </div>

                {activeCourses.length > REPORTS_PER_PAGE ? (
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
                <BloomChart userId={user.id} />

                <article className="rounded-4xl border border-slate-200 bg-white/95 p-6 shadow-lg shadow-slate-200/60">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
                        <CircleCheckBig className="h-4 w-4" />
                        Chỉ số bổ sung
                      </div>
                      <h3 className="mt-3 text-2xl font-semibold text-slate-950">
                        Dữ liệu hỗ trợ phân tích
                      </h3>
                    </div>
                    <ChartColumnIncreasing className="h-7 w-7 text-emerald-600" />
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

                <article className="rounded-4xl border border-slate-200 bg-linear-to-br from-sky-600 via-cyan-600 to-emerald-600 p-6 text-white shadow-xl shadow-cyan-200/60">
                  <div className="flex items-center gap-3">
                    <GraduationCap className="h-7 w-7" />
                    <div>
                      <h3 className="text-xl font-semibold">Nhịp học hiện tại</h3>
                      <p className="mt-1 text-sm text-sky-50">
                        Gợi ý để giữ tiến độ ổn định trong tuần này
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 space-y-3">
                    <div className="rounded-2xl bg-white/14 px-4 py-3 text-sm leading-6 text-sky-50">
                      Ưu tiên hoàn thành thêm một module ở khóa học có tiến độ cao
                      nhất để sớm tăng tỉ lệ hoàn thành khóa học tổng thể.
                    </div>
                    <div className="rounded-2xl bg-white/14 px-4 py-3 text-sm leading-6 text-sky-50">
                      Duy trì số lượt kiểm tra đạt cao hơn số lượt chưa đạt để bảo
                      toàn mặt bằng điểm số hiện tại.
                    </div>
                    <div className="rounded-2xl bg-white/14 px-4 py-3 text-sm leading-6 text-sky-50">
                      Khi cần xem chi tiết từng khóa học, có thể mở trực tiếp từ
                      danh sách ưu tiên ở cột bên trái.
                    </div>
                  </div>
                </article>

                <article className="rounded-4xl border border-slate-200 bg-white/95 p-6 shadow-lg shadow-slate-200/60">
                  <div className="flex items-center gap-3">
                    <BookCheck className="h-6 w-6 text-slate-700" />
                    <div>
                      <h3 className="text-xl font-semibold text-slate-950">
                        Nguồn dữ liệu để báo cáo tiến độ học tập
                      </h3>
                      <p className="mt-1 text-sm text-slate-500">
                        Trang web sử dụng những dữ liệu sau để báo cáo tiến độ học
                        tập
                      </p>
                    </div>
                  </div>
                  <ul className="mt-4 space-y-2 text-sm leading-6 text-slate-600">
                    <li>
                      Tiến độ khóa học.
                    </li>
                    <li>
                      Tiến độ module.
                    </li>
                    <li>
                      Học phần theo từng khóa học.
                    </li>
                    <li>
                      Kết quả bài kiểm tra.
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

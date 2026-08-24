"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  BarChart3,
  BookOpen,
  ClipboardCheck,
  FileChartColumn,
  FileText,
  LoaderCircle,
  Menu,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  UserRoundPlus,
  Users,
} from "lucide-react";
import { UserAccountMenu } from "../../components/user-account-menu";
import { NotificationBell } from "../../components/notification-bell";
import { ShowNavigation } from "../../lib/app_nav";
import {
  getAdminReportsData,
  type AdminMonthlyMetric,
  type AdminMonthlyMetricKey,
  type AdminMonthlySeriesPoint,
  type AdminReportMetric,
  type AdminReportTheme,
  type AdminReportsData,
} from "../../lib/api_admin_reports";
import { ADMIN_DEFAULT_USER, useAdminSession } from "../_lib/use-admin-session";

const monthlyMetricIcons: Record<AdminMonthlyMetricKey, typeof UserRoundPlus> = {
  accountsCreated: UserRoundPlus,
  coursesCreated: BookOpen,
  examAttempts: ClipboardCheck,
  completedCourseProgresses: TrendingUp,
};

function formatGeneratedTime(value: string): string {
  return new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}

function getMetricClasses(theme: AdminReportTheme): string {
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

function getChartColors(theme: AdminReportTheme) {
  switch (theme) {
    case "emerald":
      return {
        stroke: "#059669",
        fill: "rgba(16, 185, 129, 0.18)",
        bar: "#10b981",
        label: "text-emerald-700",
        tab: "border-emerald-200 bg-emerald-50 text-emerald-700",
      };
    case "amber":
      return {
        stroke: "#d97706",
        fill: "rgba(245, 158, 11, 0.18)",
        bar: "#f59e0b",
        label: "text-amber-700",
        tab: "border-amber-200 bg-amber-50 text-amber-700",
      };
    case "rose":
      return {
        stroke: "#e11d48",
        fill: "rgba(244, 63, 94, 0.18)",
        bar: "#f43f5e",
        label: "text-rose-700",
        tab: "border-rose-200 bg-rose-50 text-rose-700",
      };
    case "sky":
    default:
      return {
        stroke: "#0284c7",
        fill: "rgba(14, 165, 233, 0.18)",
        bar: "#0ea5e9",
        label: "text-sky-700",
        tab: "border-sky-200 bg-sky-50 text-sky-700",
      };
  }
}

function MetricCard({ metric }: { metric: AdminReportMetric }) {
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

function MonthlySummaryCard({ metric }: { metric: AdminMonthlyMetric }) {
  const Icon = monthlyMetricIcons[metric.id];
  const colors = getChartColors(metric.theme);

  return (
    <article className="rounded-3xl border border-slate-200 bg-white/90 p-4 shadow-sm shadow-slate-200/70">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div
            className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${getMetricClasses(metric.theme)}`}
          >
            {metric.shortLabel}
          </div>
          <p className="mt-3 text-3xl font-semibold text-slate-950">
            {metric.summaryValue}
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-600">{metric.summaryNote}</p>
        </div>
        <div className={`rounded-2xl bg-slate-50 p-3 ${colors.label}`}>
          <Icon className="h-6 w-6" />
        </div>
      </div>
    </article>
  );
}

function SingleMetricChart({ metric }: { metric: AdminMonthlyMetric }) {
  if (metric.data.length === 0) {
    return (
      <div className="rounded-[30px] border border-dashed border-slate-300 bg-white/95 px-5 py-12 text-center shadow-lg shadow-slate-200/60">
        <TrendingUp className="mx-auto h-10 w-10 text-slate-400" />
        <h3 className="mt-4 text-xl font-semibold text-slate-950">
          Chưa có dữ liệu theo tháng
        </h3>
        <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-600">
          Biểu đồ sẽ xuất hiện sau khi hệ thống ghi nhận hoạt động trong các tháng
          tiếp theo.
        </p>
      </div>
    );
  }

  const chartWidth = 760;
  const chartHeight = 320;
  const paddingLeft = 50;
  const paddingRight = 24;
  const paddingTop = 24;
  const paddingBottom = 52;
  const innerWidth = chartWidth - paddingLeft - paddingRight;
  const innerHeight = chartHeight - paddingTop - paddingBottom;
  const maxValue = Math.max(...metric.data.map((point) => point.value), 1);
  const colors = getChartColors(metric.theme);

  const points = metric.data.map((point, index) => {
    const x =
      paddingLeft +
      (metric.data.length === 1 ? 0 : (index * innerWidth) / (metric.data.length - 1));
    const y =
      paddingTop + innerHeight - (point.value / maxValue) * innerHeight;

    return { ...point, x, y };
  });

  const linePath = points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");
  const areaPath = `${linePath} L ${points.at(-1)?.x ?? paddingLeft} ${
    paddingTop + innerHeight
  } L ${points[0]?.x ?? paddingLeft} ${paddingTop + innerHeight} Z`;

  const bars = metric.data.map((point, index) => {
    const barWidth = innerWidth / Math.max(metric.data.length * 1.8, 1);
    const x = paddingLeft + index * (innerWidth / metric.data.length) + barWidth * 0.2;
    const barHeight = (point.value / maxValue) * innerHeight;
    const y = paddingTop + innerHeight - barHeight;

    return { ...point, x, y, barWidth, barHeight };
  });

  const yAxisValues = Array.from({ length: 5 }, (_, index) =>
    Math.round((maxValue / 4) * (4 - index)),
  );

  return (
    <div className="rounded-[30px] border border-slate-200 bg-white/95 p-5 shadow-lg shadow-slate-200/60">
      <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div
            className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${getMetricClasses(metric.theme)}`}
          >
            {metric.label}
          </div>
          <h3 className="mt-3 text-2xl font-semibold text-slate-950">
            Biểu đồ 12 tháng gần nhất
          </h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            {metric.description}
          </p>
        </div>
        <div className="rounded-2xl bg-slate-100 px-4 py-3 text-sm text-slate-600">
          Giá trị tháng này:{" "}
          <span className="font-semibold text-slate-950">{metric.summaryValue}</span>
        </div>
      </div>

      <div className="mt-5 overflow-x-auto">
        <svg
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          className="min-w-180"
          role="img"
          aria-label={metric.label}
        >
          <defs>
            <linearGradient id={`area-${metric.id}`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={colors.stroke} stopOpacity="0.35" />
              <stop offset="100%" stopColor={colors.stroke} stopOpacity="0.02" />
            </linearGradient>
          </defs>

          {yAxisValues.map((value, index) => {
            const y = paddingTop + (innerHeight / (yAxisValues.length - 1)) * index;

            return (
              <g key={`${metric.id}-grid-${value}`}>
                <line
                  x1={paddingLeft}
                  x2={chartWidth - paddingRight}
                  y1={y}
                  y2={y}
                  stroke="#e2e8f0"
                  strokeDasharray="4 6"
                />
                <text
                  x={paddingLeft - 12}
                  y={y + 4}
                  textAnchor="end"
                  fontSize="11"
                  fill="#64748b"
                >
                  {value}
                </text>
              </g>
            );
          })}

          <path d={areaPath} fill={`url(#area-${metric.id})`} />
          <path
            d={linePath}
            fill="none"
            stroke={colors.stroke}
            strokeWidth="3"
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {bars.map((bar) => (
            <g key={`${metric.id}-bar-${bar.monthKey}`}>
              <rect
                x={bar.x}
                y={bar.y}
                width={bar.barWidth}
                height={bar.barHeight}
                rx="8"
                fill={colors.bar}
                fillOpacity="0.16"
              />
            </g>
          ))}

          {points.map((point) => (
            <g key={`${metric.id}-point-${point.monthKey}`}>
              <circle cx={point.x} cy={point.y} r="5" fill={colors.stroke} />
              <circle cx={point.x} cy={point.y} r="10" fill={colors.stroke} fillOpacity="0.12" />
              <text
                x={point.x}
                y={point.y - 14}
                textAnchor="middle"
                fontSize="11"
                fill="#334155"
              >
                {point.value}
              </text>
              <text
                x={point.x}
                y={chartHeight - 18}
                textAnchor="middle"
                fontSize="11"
                fill="#64748b"
              >
                {point.monthLabel}
              </text>
            </g>
          ))}
        </svg>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metric.data.map((point: AdminMonthlySeriesPoint) => (
          <div
            key={`${metric.id}-summary-${point.monthKey}`}
            className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              {point.monthLabel}
            </p>
            <p className="mt-2 text-xl font-semibold text-slate-950">{point.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AdminReportsPage() {
  const router = useRouter();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [reportsData, setReportsData] = useState<AdminReportsData | null>(null);
  const [activeChartKey, setActiveChartKey] =
    useState<AdminMonthlyMetricKey>("accountsCreated");
  const { currentUser, isCheckingAuth } = useAdminSession();

  useEffect(() => {
    let isMounted = true;

    async function loadReports() {
      if (!currentUser) {
        return;
      }

      try {
        const data = await getAdminReportsData();

        if (!isMounted) {
          return;
        }

        setReportsData(data);
        setActiveChartKey("accountsCreated");
        setErrorMessage("");
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Không thể tải báo cáo tình hình hoạt động chung của trang web.",
        );
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadReports();

    return () => {
      isMounted = false;
    };
  }, [currentUser]);

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

  const user = currentUser ?? ADMIN_DEFAULT_USER;
  const summary = reportsData?.summary;
  const mainMetrics = reportsData?.mainMetrics ?? [];
  const monthlyMetrics = reportsData?.monthlyMetrics ?? [];
  const activeChartMetric =
    monthlyMetrics.find((metric) => metric.id === activeChartKey) ?? monthlyMetrics[0];
  const highlights = reportsData?.highlights ?? [];

  const monthlySummaryMetrics = monthlyMetrics.slice(0, 4);

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
            aria-label="Về trang chủ quản trị viên"
          >
            <Image src="/logo.png" alt="Logo" width={42} height={42} />
          </button>
          <div>
            <h1 className="text-lg font-semibold">Báo cáo tình hình hoạt động chung</h1>
            <p className="text-sm text-slate-500">
              Theo dõi bức tranh tổng quan của hệ thống học tập trực tuyến
            </p>
          </div>
        </div>

        <div className="hidden items-center gap-2 md:flex">
          <NotificationBell userId={user.id} />
          <UserAccountMenu user={user} variant="dashboard" />
        </div>

        <div className="hidden items-center gap-3">
          <div className="rounded-full bg-sky-100 px-3 py-1 text-sm font-medium text-sky-700">
            Quản trị viên
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold">{user.username}</p>
            <p className="text-xs text-slate-500">{user.email}</p>
          </div>
        </div>
      </header>

      <section className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-4 pb-10 pt-24 sm:px-6 lg:px-8">
        {isLoading ? (
          <div className="flex min-h-[55vh] items-center justify-center rounded-4xl border border-white/60 bg-white/80 shadow-xl shadow-slate-200/60 backdrop-blur">
            <div className="flex items-center gap-3 text-slate-600">
              <LoaderCircle className="h-5 w-5 animate-spin" />
              <span>Đang tải báo cáo quản trị hệ thống...</span>
            </div>
          </div>
        ) : null}

        {!isLoading && errorMessage ? (
          <div className="rounded-[28px] border border-rose-200 bg-rose-50 px-5 py-4 text-rose-700 shadow-sm">
            {errorMessage}
          </div>
        ) : null}

        {!isLoading && !errorMessage && (!reportsData || !summary) ? (
          <div className="rounded-[28px] border border-dashed border-slate-300 bg-white px-6 py-12 text-center shadow-lg shadow-slate-200/60">
            <FileChartColumn className="mx-auto h-10 w-10 text-slate-400" />
            <h2 className="mt-4 text-2xl font-semibold text-slate-950">
              Chưa có dữ liệu báo cáo hệ thống
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-slate-600">
              Báo cáo sẽ hiển thị sau khi hệ thống có dữ liệu người dùng, khóa học
              hoặc hoạt động học tập để tổng hợp.
            </p>
          </div>
        ) : null}

        {!isLoading && !errorMessage && reportsData && summary ? (
          <>
            <section className="overflow-hidden rounded-[34px] border border-slate-200/70 bg-slate-950 text-white shadow-2xl shadow-slate-300/40">
              <div className="grid gap-8 px-6 py-7 lg:grid-cols-[1.15fr_0.85fr] lg:px-8">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-sm text-sky-100">
                    <Sparkles className="h-4 w-4" />
                    <span>Báo cáo điều hành dành cho quản trị viên</span>
                  </div>
                  <h2 className="mt-4 max-w-3xl text-3xl font-semibold tracking-tight sm:text-4xl">
                    Hệ thống hiện phục vụ {summary.totalUsers} người dùng và đang quản
                    lý {summary.totalCourses} khóa học.
                  </h2>
                  <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">
                    Trang này tập trung vào bức tranh tổng thể của toàn bộ nền tảng:
                    người dùng, khóa học, tài liệu, bài kiểm tra và nhịp tăng trưởng
                    trong 12 tháng gần nhất.
                  </p>

                  <div className="mt-6 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-3xl border border-white/12 bg-white/8 px-4 py-4">
                      <p className="text-sm text-slate-300">Người dùng hiện có</p>
                      <p className="mt-2 text-3xl font-semibold">{summary.totalUsers}</p>
                    </div>
                    <div className="rounded-3xl border border-white/12 bg-white/8 px-4 py-4">
                      <p className="text-sm text-slate-300">Khóa học được công bố</p>
                      <p className="mt-2 text-3xl font-semibold">
                        {summary.totalPublishedCourses}
                      </p>
                    </div>
                    <div className="rounded-3xl border border-white/12 bg-white/8 px-4 py-4">
                      <p className="text-sm text-slate-300">Tài liệu và bài kiểm tra</p>
                      <p className="mt-2 text-3xl font-semibold">
                        {summary.totalMaterialsAndExams}
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
                        {formatGeneratedTime(reportsData.generatedAt)}
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

                  <div className="mt-5 rounded-2xl border border-white/10 bg-slate-900/50 px-4 py-4 text-sm leading-6 text-slate-200">
                    {reportsData.chartLibraryNote}
                  </div>
                </div>
              </div>
            </section>

            <section className="grid gap-4 lg:grid-cols-4">
              {mainMetrics.map((metric) => (
                <MetricCard key={metric.id} metric={metric} />
              ))}
            </section>

            <section className="rounded-4xl border border-slate-200 bg-white/95 p-6 shadow-lg shadow-slate-200/60">
              <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">
                    <BarChart3 className="h-4 w-4" />
                    Tóm tắt tháng này
                  </div>
                  <h3 className="mt-3 text-2xl font-semibold text-slate-950">
                    Nhịp vận hành của tháng hiện tại
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    Bốn tín hiệu quan trọng nhất trong tháng này gồm tài khoản mới,
                    khóa học mới, lượt kiểm tra và tiến độ học khóa học hoàn thành.
                  </p>
                </div>
                <div className="rounded-2xl bg-slate-100 px-4 py-3 text-sm text-slate-600">
                  Các giá trị này cũng được theo dõi theo 12 tháng gần nhất ở khu vực biểu đồ.
                </div>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {monthlySummaryMetrics.map((metric) => (
                  <MonthlySummaryCard key={metric.id} metric={metric} />
                ))}
              </div>
            </section>

            <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
              <div className="space-y-6">
                <div className="rounded-4xl border border-slate-200 bg-white/95 p-6 shadow-lg shadow-slate-200/60">
                  <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                      <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600">
                        <TrendingUp className="h-4 w-4" />
                        Biểu đồ theo tháng
                      </div>
                      <h3 className="mt-3 text-2xl font-semibold text-slate-950">
                        Theo dõi từng tín hiệu trong 12 tháng gần nhất
                      </h3>
                      <p className="mt-2 text-sm leading-6 text-slate-600">
                        Trang hiện mỗi lần hiển thị một biểu đồ và bạn có thể đổi loại
                        dữ liệu đang xem ngay bên dưới.
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 flex flex-wrap gap-3">
                    {monthlyMetrics.map((metric) => {
                      const colors = getChartColors(metric.theme);
                      const isActive = metric.id === activeChartKey;

                      return (
                        <button
                          key={metric.id}
                          type="button"
                          onClick={() => setActiveChartKey(metric.id)}
                          className={`rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${
                            isActive
                              ? colors.tab
                              : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                          }`}
                        >
                          {metric.shortLabel}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {activeChartMetric ? <SingleMetricChart metric={activeChartMetric} /> : null}
              </div>

              <aside className="space-y-6">
                <article className="rounded-4xl border border-slate-200 bg-white/95 p-6 shadow-lg shadow-slate-200/60">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
                        <Users className="h-4 w-4" />
                        Cơ cấu người dùng
                      </div>
                      <h3 className="mt-3 text-2xl font-semibold text-slate-950">
                        Phân bố vai trò trên hệ thống
                      </h3>
                    </div>
                    <ShieldCheck className="h-7 w-7 text-emerald-600" />
                  </div>

                  <div className="mt-5 space-y-4">
                    <div className="rounded-[26px] border border-slate-200 bg-slate-50 px-4 py-4">
                      <p className="text-sm font-semibold text-slate-900">Sinh viên</p>
                      <p className="mt-3 text-2xl font-semibold text-slate-950">
                        {summary.totalStudents}
                      </p>
                      <p className="mt-2 text-sm leading-6 text-slate-600">
                        Nhóm người dùng học tập trực tiếp trên nền tảng.
                      </p>
                    </div>
                    <div className="rounded-[26px] border border-slate-200 bg-slate-50 px-4 py-4">
                      <p className="text-sm font-semibold text-slate-900">Giảng viên</p>
                      <p className="mt-3 text-2xl font-semibold text-slate-950">
                        {summary.totalInstructors}
                      </p>
                      <p className="mt-2 text-sm leading-6 text-slate-600">
                        Nhóm phụ trách nội dung khóa học và hoạt động giảng dạy.
                      </p>
                    </div>
                    <div className="rounded-[26px] border border-slate-200 bg-slate-50 px-4 py-4">
                      <p className="text-sm font-semibold text-slate-900">Quản trị viên</p>
                      <p className="mt-3 text-2xl font-semibold text-slate-950">
                        {summary.totalAdmins}
                      </p>
                      <p className="mt-2 text-sm leading-6 text-slate-600">
                        Nhóm điều hành, giám sát và quản trị toàn bộ hệ thống.
                      </p>
                    </div>
                  </div>
                </article>

                <article className="rounded-4xl border border-slate-200 bg-white/95 p-6 shadow-lg shadow-slate-200/60">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">
                        <FileText className="h-4 w-4" />
                        Nội dung học tập
                      </div>
                      <h3 className="mt-3 text-2xl font-semibold text-slate-950">
                        Tài nguyên đang được quản lý
                      </h3>
                    </div>
                    <BookOpen className="h-7 w-7 text-amber-600" />
                  </div>

                  <div className="mt-5 space-y-4">
                    <div className="rounded-[26px] border border-slate-200 bg-slate-50 px-4 py-4">
                      <p className="text-sm font-semibold text-slate-900">Tài liệu</p>
                      <p className="mt-3 text-2xl font-semibold text-slate-950">
                        {summary.totalDocuments}
                      </p>
                      <p className="mt-2 text-sm leading-6 text-slate-600">
                        Tổng số học liệu đã được đưa lên hệ thống để phục vụ học tập.
                      </p>
                    </div>
                    <div className="rounded-[26px] border border-slate-200 bg-slate-50 px-4 py-4">
                      <p className="text-sm font-semibold text-slate-900">Bài kiểm tra</p>
                      <p className="mt-3 text-2xl font-semibold text-slate-950">
                        {summary.totalExams}
                      </p>
                      <p className="mt-2 text-sm leading-6 text-slate-600">
                        Tổng số bài kiểm tra dùng để đánh giá tiến độ của người học.
                      </p>
                    </div>
                  </div>
                </article>

                <article className="rounded-4xl border border-slate-200 bg-linear-to-br from-sky-600 via-cyan-600 to-emerald-600 p-6 text-white shadow-xl shadow-cyan-200/60">
                  <div className="flex items-center gap-3">
                    <BarChart3 className="h-7 w-7" />
                    <div>
                      <h3 className="text-xl font-semibold">Gợi ý triển khai biểu đồ</h3>
                      <p className="mt-1 text-sm text-sky-50">
                        Không bắt buộc phải cài thêm thư viện ở phiên bản hiện tại
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 space-y-3">
                    <div className="rounded-2xl bg-white/14 px-4 py-3 text-sm leading-6 text-sky-50">
                      Phiên bản hiện tại đang dùng SVG thuần trong React nên không cần
                      thêm package nào để hiển thị biểu đồ.
                    </div>
                    <div className="rounded-2xl bg-white/14 px-4 py-3 text-sm leading-6 text-sky-50">
                      Nếu muốn có tooltip, legend, responsive chart và animation tốt hơn,
                      bạn có thể cài <code>recharts</code> bằng lệnh{" "}
                      <code>npm install recharts</code>.
                    </div>
                    <div className="rounded-2xl bg-white/14 px-4 py-3 text-sm leading-6 text-sky-50">
                      Với dữ liệu thật, nên bổ sung thêm trường thời gian tạo ở backend
                      cho khóa học, lượt kiểm tra và các bản ghi cần thống kê theo tháng.
                    </div>
                  </div>
                </article>
              </aside>
            </section>
          </>
        ) : null}
      </section>
    </main>
  );
}

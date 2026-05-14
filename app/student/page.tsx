"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  ChartColumn,
  LoaderCircle,
  MapPin,
  Menu,
  School,
} from "lucide-react";

import { ShowNavigation } from "../lib/app_nav";
import {
  getStudentDashboardData,
  StudentDashboardCard,
  StudentDashboardData,
} from "../lib/student_dashboard_api";
import {
  STUDENT_DEFAULT_USER,
  useStudentSession,
} from "./_lib/use-student-session";

export default function Home() {
  const router = useRouter();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [dashboardData, setDashboardData] =
    useState<StudentDashboardData | null>(null);
  const { currentUser, isCheckingAuth } = useStudentSession();

  useEffect(() => {
    let isMounted = true;

    async function loadDashboard() {
      if (!currentUser) {
        return;
      }

      try {
        const data = await getStudentDashboardData(currentUser.id);

        if (!isMounted) {
          return;
        }

        setDashboardData(data);
        setErrorMessage("");
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Không thể tải dữ liệu bảng điều khiển.",
        );
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadDashboard();

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

  const user = currentUser ?? STUDENT_DEFAULT_USER;
  const summaryCards = dashboardData?.summaryCards ?? [];
  const quickActions = dashboardData?.quickActions ?? [];
  const profile = dashboardData?.profile;
  const courseProgresses = dashboardData?.courseProgresses ?? [];

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
            <h1 className="text-lg font-semibold">Bảng điều khiển học sinh</h1>
            <p className="text-sm text-slate-500">
              Theo dõi tiến độ và quay lại bài học
            </p>
          </div>
        </div>

        <div className="hidden items-center gap-3 md:flex">
          <div className="rounded-full bg-sky-100 px-3 py-1 text-sm font-medium text-sky-700">
            {user.role === "student" ? "Học sinh" : user.role}
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold">{user.username}</p>
            <p className="text-xs text-slate-500">{user.email}</p>
          </div>
        </div>
      </header>

      <section className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 px-4 pb-8 pt-24 sm:px-6 lg:px-8">
        {isLoading ? (
          <div className="flex min-h-[50vh] items-center justify-center rounded-3xl bg-white shadow-sm">
            <div className="flex items-center gap-3 text-slate-600">
              <LoaderCircle className="h-5 w-5 animate-spin" />
              <span>Đang tải dữ liệu học sinh...</span>
            </div>
          </div>
        ) : null}

        {!isLoading && errorMessage ? (
          <div className="rounded-3xl border border-red-200 bg-red-50 px-5 py-4 text-red-700">
            {errorMessage}
          </div>
        ) : null}

        {!isLoading && !errorMessage ? (
          <>
            <section className="rounded-[28px] bg-linear-to-r from-sky-700 via-cyan-700 to-emerald-600 px-6 py-7 text-white shadow-xl">
              <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                <div className="max-w-2xl">
                  <p className="text-sm font-medium text-sky-100">Xin chào trở lại</p>
                  <h2 className="mt-2 text-3xl font-semibold">{user.username}</h2>
                  <p className="mt-3 text-sm leading-6 text-sky-50">
                    {profile?.description ??
                      "Bạn đang ở trung tâm học tập cá nhân. Hãy tiếp tục các khóa học đang theo dõi và kiểm tra tiến độ mới nhất."}
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl bg-white/14 px-4 py-3">
                    <div className="flex items-center gap-2 text-sm text-sky-100">
                      <School className="h-4 w-4" />
                      <span>Đơn vị học tập</span>
                    </div>
                    <p className="mt-2 text-base font-semibold">
                      {profile?.organization ?? "Chưa cập nhật"}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-white/14 px-4 py-3">
                    <div className="flex items-center gap-2 text-sm text-sky-100">
                      <MapPin className="h-4 w-4" />
                      <span>Khu vực</span>
                    </div>
                    <p className="mt-2 text-base font-semibold">
                      {profile?.location ?? "Chưa cập nhật"}
                    </p>
                  </div>
                </div>
              </div>
            </section>

            <section className="grid gap-4 md:grid-cols-3">
              {summaryCards.map((card: StudentDashboardCard) => (
                <article
                  key={card.id}
                  className="rounded-3xl bg-white px-5 py-5 shadow-sm ring-1 ring-slate-200"
                >
                  <p className="text-sm text-slate-500">{card.label}</p>
                  <p className="mt-3 text-3xl font-semibold text-slate-900">
                    {card.value}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {card.note}
                  </p>
                </article>
              ))}
            </section>

            <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
              <article className="rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-slate-200">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-semibold">Tiến trình khóa học</h3>
                    <p className="mt-1 text-sm text-slate-500">
                      Dữ liệu này đang bám theo các route FastAPI `user`,
                      `profile` và `course_progress`.
                    </p>
                  </div>
                  <BookOpen className="h-6 w-6 text-sky-600" />
                </div>

                <div className="mt-6 space-y-4">
                  {courseProgresses.map((courseProgress) => {
                    const progressPercent = Math.min(
                      100,
                      Math.max(8, courseProgress.module_completed * 8),
                    );

                    return (
                      <div
                        key={`${courseProgress.course_id}-${courseProgress.user_id}`}
                        className="rounded-2xl border border-slate-200 px-4 py-4"
                      >
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <p className="text-sm font-semibold text-slate-900">
                              Khóa học #{courseProgress.course_id}
                            </p>
                            <p className="mt-1 text-sm text-slate-500">
                              Đã hoàn thành {courseProgress.module_completed} mô-đun
                            </p>
                          </div>
                          <div className="flex items-center gap-2 text-sm font-medium">
                            <span
                              className={`rounded-full px-3 py-1 ${
                                courseProgress.is_complete
                                  ? "bg-emerald-100 text-emerald-700"
                                  : "bg-amber-100 text-amber-700"
                              }`}
                            >
                              {courseProgress.is_complete
                                ? "Đã hoàn thành"
                                : "Đang học"}
                            </span>
                            <span className="text-slate-600">
                              Điểm {courseProgress.final_score}
                            </span>
                          </div>
                        </div>

                        <div className="mt-4">
                          <div className="h-2.5 overflow-hidden rounded-full bg-slate-200">
                            <div
                              className="h-full rounded-full bg-linear-to-r from-sky-500 to-emerald-500"
                              style={{ width: `${progressPercent}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </article>

              <aside className="space-y-6">
                <article className="rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-slate-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xl font-semibold">Lối tắt</h3>
                      <p className="mt-1 text-sm text-slate-500">
                        Đi nhanh tới những khu vực bạn hay dùng.
                      </p>
                    </div>
                    <ChartColumn className="h-6 w-6 text-cyan-600" />
                  </div>

                  <div className="mt-5 space-y-3">
                    {quickActions.map((action) => (
                      <Link
                        key={action.id}
                        href={action.href}
                        className="block rounded-2xl border border-slate-200 px-4 py-4 hover:border-sky-300 hover:bg-sky-50"
                      >
                        <p className="text-sm font-semibold text-slate-900">
                          {action.label}
                        </p>
                        <p className="mt-1 text-sm leading-6 text-slate-600">
                          {action.description}
                        </p>
                      </Link>
                    ))}
                  </div>
                </article>

                <article className="rounded-[28px] bg-slate-900 px-6 py-6 text-white shadow-sm">
                  <h3 className="text-lg font-semibold">Gợi ý hôm nay</h3>
                  <p className="mt-3 text-sm leading-6 text-slate-300">
                    Hãy hoàn thành thêm một mô-đun hoặc xem lại phần báo cáo để giữ
                    nhịp học ổn định trong tuần này.
                  </p>
                </article>
              </aside>
            </section>
          </>
        ) : null}
      </section>
    </main>
  );
}

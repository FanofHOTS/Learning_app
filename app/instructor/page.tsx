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
  School,
  Menu
} from "lucide-react";

import { UserAccountMenu } from "../components/user-account-menu";
import { ShowNavigation } from "../lib/app_nav";
import {
  getInstructorDashboardData,
  InstructorDashboardCard,
  InstructorDashboardData,
} from "../lib/instructor_dashboard_api";
import type { User } from "../lib/api_user";
import { useInstructorSession } from "./_lib/use-instructor-session";

const initialUser: User = {
  id: 0,
  username: "Giảng viên",
  email: "giao_vien@example.com",
  icon: "/icon.png",
  role: "instructor",
};

export default function Home() {
  const router = useRouter();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const { currentUser, isCheckingAuth } = useInstructorSession();
  const [dashboardData, setDashboardData] = useState<InstructorDashboardData | null>(null);


  const user = currentUser ?? initialUser;

  useEffect(() => {
    let isMounted = true;

    async function loadDashboard() {
      if (!currentUser) {
        return;
      }
      try {
        const data = await getInstructorDashboardData(currentUser.id);

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
            : "Không thể tải dữ liệu bảng điều khiển giảng viên.",
        );
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadDashboard();

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

  const summaryCards = dashboardData?.summaryCards ?? [];
  const quickActions = dashboardData?.quickActions ?? [];
  const profile = dashboardData?.profile;
  const courses = dashboardData?.courses ?? [];

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
            <h1 className="text-xl font-semibold">Bảng điều khiển giảng viên</h1>
            <p className="text-sm text-slate-500">
              Theo dõi khóa học và tiến độ học sinh
            </p>
          </div>
        </div>

        <div className="hidden md:block">
          <UserAccountMenu user={user} variant="dashboard" />
        </div>

        <div className="hidden items-center gap-3">
          <div className="rounded-full bg-sky-100 px-3 py-1 text-sm font-medium text-sky-700">
            {user.role === "instructor" ? "Giảng viên" : user.role}
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
              <span>Đang tải dữ liệu giảng viên...</span>
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
                      "Bạn đang ở trung tâm quản lý khóa học. Hãy theo dõi tiến độ học sinh, quản lý tài liệu và tạo đánh giá."}
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl bg-white/14 px-4 py-3">
                    <div className="flex items-center gap-2 text-sm text-sky-100">
                      <School className="h-4 w-4" />
                      <span>Chuyên môn</span>
                    </div>
                    <p className="mt-2 text-base font-semibold">
                      {profile?.specialization ?? "Chưa cập nhật"}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-white/14 px-4 py-3">
                    <div className="flex items-center gap-2 text-sm text-sky-100">
                      <MapPin className="h-4 w-4" />
                      <span>Đơn vị</span>
                    </div>
                    <p className="mt-2 text-base font-semibold">
                      {profile?.organization ?? "Chưa cập nhật"}
                    </p>
                  </div>
                </div>
              </div>
            </section>

            <section className="grid gap-4 md:grid-cols-3">
              {summaryCards.map((card: InstructorDashboardCard) => (
                <article
                  key={card.id}
                  className="rounded-3xl bg-white px-5 py-5 shadow-sm ring-1 ring-slate-200"
                >
                  <p className="text-sm text-slate-500">{card.label}</p>
                  <p className="mt-3 text-3xl font-semibold text-slate-900">
                    {card.value}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{card.note}</p>
                </article>
              ))}
            </section>

            <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
              <article className="rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-slate-200">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-semibold">Khóa học của tôi</h3>
                    <p className="mt-1 text-sm text-slate-500">
                      Quản lý và theo dõi khóa học đang giảng dạy. Dữ liệu từ FastAPI routes: `user`, `profile` và `course/instructor/[instructorId]`.
                    </p>
                  </div>
                  <BookOpen className="h-6 w-6 text-sky-600" />
                </div>

                <div className="mt-6 space-y-4">
                  {courses.map((course) => {
                    const totalCapacity = course.total_students;
                    const enrollmentPercent = totalCapacity > 0 
                      ? (course.active_students / totalCapacity) * 100 
                      : 0;

                    return (
                      <div
                        key={`${course.course_id}-${course.instructor_id}`}
                        className="rounded-2xl border border-slate-200 px-4 py-4"
                      >
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <p className="text-sm font-semibold text-slate-900">
                              {course.course_name}
                            </p>
                            <p className="mt-1 text-sm text-slate-500">
                              {course.total_modules} mô-đun • {course.active_students}/{course.total_students} học sinh
                            </p>
                          </div>
                          <div className="flex items-center gap-2 text-sm font-medium">
                            <span className="rounded-full bg-blue-100 px-3 py-1 text-blue-700">
                              Đang dạy
                            </span>
                            <span className="text-slate-600">
                              Điểm TB: {course.avg_student_score}
                            </span>
                          </div>
                        </div>

                        <div className="mt-4">
                          <p className="text-xs text-slate-500 mb-2">Tỷ lệ tham gia</p>
                          <div className="h-2.5 overflow-hidden rounded-full bg-slate-200">
                            <div
                              className="h-full rounded-full bg-linear-to-r from-sky-500 to-cyan-500"
                              style={{ width: `${enrollmentPercent}%` }}
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
                      <h3 className="text-xl font-semibold">Thao tác nhanh</h3>
                      <p className="mt-1 text-sm text-slate-500">
                        Truy cập nhanh các chức năng thường dùng.
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
                    Kiểm tra tiến độ học sinh, cập nhật tài liệu khóa học và tạo các bài đánh giá để giữ học sinh tập trung.
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

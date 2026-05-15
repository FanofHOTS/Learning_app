"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  LoaderCircle,
  Menu,
  School,
  Users,
  ArrowRight,
} from "lucide-react";

import { UserAccountMenu } from "../components/user-account-menu";
import { ShowNavigation } from "../lib/app_nav";
import {
  getAdminDashboardData,
  type AdminDashboardData,
} from "../lib/api_admin_dashboard";
import { ADMIN_DEFAULT_USER, useAdminSession } from "./_lib/use-admin-session";

export default function AdminDashboard() {
  const router = useRouter();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [dashboardData, setDashboardData] = useState<AdminDashboardData | null>(
    null,
  );
  const { currentUser, isCheckingAuth } = useAdminSession();

  useEffect(() => {
    let isMounted = true;

    async function loadDashboard() {
      if (!currentUser) {
        return;
      }

      try {
        const data = await getAdminDashboardData(currentUser.id);

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

  const user = currentUser ?? ADMIN_DEFAULT_USER;
  const summaryCards = dashboardData?.summaryCards ?? [];
  const quickActions = dashboardData?.quickActions ?? [];
  const profile = dashboardData?.profile;

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
            <h1 className="text-lg font-semibold">Bảng điều khiển quản trị viên</h1>
            <p className="text-sm text-slate-500">
              Theo dõi tình hình của trang web, quản lý trang web và xem thống kê
            </p>
          </div>
        </div>

        <div className="hidden md:block">
          <UserAccountMenu user={user} variant="dashboard" />
        </div>

        <div className="hidden items-center gap-3">
          <div className="rounded-full bg-sky-100 px-3 py-1 text-sm font-medium text-sky-700">
            {user.role === "admin" ? "Quản trị viên" : user.role}
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
              <span>Đang tải bảng điều khiển...</span>
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
            {/* Thông tin quản trị viên */}
            <section className="rounded-[28px] bg-linear-to-r from-sky-700 via-cyan-700 to-emerald-600 px-6 py-7 text-white shadow-xl">
              <div className="flex flex-col justify-between gap-6 md:flex-row md:items-center">
                <div>
                  <p className="text-sm font-medium uppercase tracking-widest opacity-90">
                    Chào mừng quản trị viên
                  </p>
                  <h2 className="mt-2 text-3xl font-bold">{profile?.name ?? user.username}</h2>
                  <p className="mt-2 text-sm leading-6 opacity-90">
                    {profile?.description}
                  </p>
                </div>
                <div className="rounded-3xl bg-white/20 backdrop-blur p-6 text-center">
                  <p className="text-sm uppercase tracking-wider opacity-90">Tổng khóa học hoạt động</p>
                  <p className="mt-2 text-4xl font-bold">
                    {dashboardData?.activeAndPublicCourseCount ?? 0}
                  </p>
                </div>
              </div>
            </section>

            {/* Thẻ thống kê */}
            <section className="grid gap-4 md:grid-cols-3">
              {summaryCards.map((card) => (
                <div
                  key={card.id}
                  className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 transition-all hover:shadow-lg hover:ring-slate-300"
                >
                  <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
                    {card.label}
                  </p>
                  <p className="mt-3 text-3xl font-bold text-sky-600">{card.value}</p>
                  <p className="mt-2 text-xs text-slate-600">{card.note}</p>
                </div>
              ))}
            </section>

            {/* Hành động nhanh */}
            <section className="rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-slate-200">
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-semibold text-slate-900">
                    Hành động nhanh
                  </h3>
                  <p className="mt-1 text-sm text-slate-500">
                    Quản lý các khía cạnh chính của hệ thống
                  </p>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {quickActions.map((action) => (
                  <Link
                    key={action.id}
                    href={action.href}
                    className="group rounded-[20px] border border-slate-200 p-5 transition-all hover:border-sky-400 hover:bg-sky-50 hover:shadow-md"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="font-semibold text-slate-900">
                          {action.label}
                        </h4>
                        <p className="mt-2 text-sm text-slate-600">
                          {action.description}
                        </p>
                      </div>
                      <ArrowRight className="mt-1 h-5 w-5 text-slate-400 transition-all group-hover:translate-x-1 group-hover:text-sky-600" />
                    </div>
                  </Link>
                ))}
              </div>
            </section>

            {/* Thông tin bổ sung */}
            <section className="grid gap-6 lg:grid-cols-2">
              {/* Tổng quan hệ thống */}
              <div className="rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-slate-200">
                <h3 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
                  <School className="h-5 w-5 text-sky-600" />
                  Tổng quan khóa học
                </h3>
                <div className="mt-6 space-y-4">
                  <div className="flex items-center justify-between rounded-2xl bg-slate-50 p-4">
                    <span className="text-sm font-medium text-slate-700">Tổng khóa học</span>
                    <span className="text-2xl font-bold text-slate-900">
                      {dashboardData?.courseCount ?? 0}
                    </span>
                  </div>
                  <div className="flex items-center justify-between rounded-2xl bg-slate-50 p-4">
                    <span className="text-sm font-medium text-slate-700">Khóa học công khai</span>
                    <span className="text-2xl font-bold text-sky-600">
                      {dashboardData?.activeAndPublicCourseCount ?? 0}
                    </span>
                  </div>
                </div>
              </div>

              {/* Thống kê người dùng */}
              <div className="rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-slate-200">
                <h3 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
                  <Users className="h-5 w-5 text-emerald-600" />
                  Thống kê người dùng
                </h3>
                <div className="mt-6 space-y-4">
                  <div className="flex items-center justify-between rounded-2xl bg-slate-50 p-4">
                    <span className="text-sm font-medium text-slate-700">Tổng người dùng</span>
                    <span className="text-2xl font-bold text-slate-900">
                      {dashboardData?.userCount ?? 0}
                    </span>
                  </div>
                  <div className="flex items-center justify-between rounded-2xl bg-slate-50 p-4">
                    <span className="text-sm font-medium text-slate-700">Giáo viên/Giảng viên</span>
                    <span className="text-2xl font-bold text-emerald-600">
                      {dashboardData?.instuctorUserCount ?? 0}
                    </span>
                  </div>
                </div>
              </div>
            </section>
          </>
        ) : null}
      </section>
    </main>
  );
}

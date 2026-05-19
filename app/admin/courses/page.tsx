"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  CheckCircle2,
  ChevronRight,
  EyeOff,
  Filter,
  LoaderCircle,
  Menu,
  Search,
  SlidersHorizontal,
  Users,
} from "lucide-react";
import { UserAccountMenu } from "../../components/user-account-menu";
import { ShowNavigation } from "../../lib/app_nav";
import {
  filterAdminCourses,
  getAdminCourseCategories,
  getAdminCourseLevels,
  getAdminCourseList,
  type AdminCourse,
  type AdminCourseCategoryOption,
  type AdminCourseFilterState,
} from "../../lib/api_course_admin";
import { ADMIN_DEFAULT_USER, useAdminSession } from "../_lib/use-admin-session";

const defaultFilters: AdminCourseFilterState = {
  keyword: "",
  categoryId: "all",
  isPublic: "all",
  isActive: "all",
  level: "all",
};

export default function AdminCoursesPage() {
  const router = useRouter();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [courses, setCourses] = useState<AdminCourse[]>([]);
  const [categories, setCategories] = useState<AdminCourseCategoryOption[]>([]);
  const [filters, setFilters] = useState<AdminCourseFilterState>(defaultFilters);
  const { currentUser, isCheckingAuth } = useAdminSession();

  useEffect(() => {
    let isMounted = true;

    async function loadPageData() {
      if (!currentUser) {
        return;
      }

      try {
        const [courseList, categoryList] = await Promise.all([
          getAdminCourseList(),
          getAdminCourseCategories(),
        ]);

        if (!isMounted) {
          return;
        }

        setCourses(courseList);
        setCategories(categoryList);
        setErrorMessage("");
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Không thể tải danh sách khóa học trên hệ thống.",
        );
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadPageData();

    return () => {
      isMounted = false;
    };
  }, [currentUser]);

  const user = currentUser ?? ADMIN_DEFAULT_USER;
  const filteredCourses = useMemo(
    () => filterAdminCourses(courses, filters),
    [courses, filters],
  );
  const levelOptions = useMemo(() => getAdminCourseLevels(courses), [courses]);
  const publicCount = courses.filter((course) => course.is_public).length;
  const activeCount = courses.filter((course) => course.is_active).length;

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

  function updateFilter(key: keyof AdminCourseFilterState, value: string) {
    setFilters((currentFilters) => ({
      ...currentFilters,
      [key]: value,
    }));
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
          className="fixed inset-0 z-40 bg-slate-950/40"
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
            onClick={() => router.push("/admin")}
          />
          <div>
            <h1 className="text-lg font-semibold">Khóa học trên hệ thống</h1>
            <p className="text-sm text-slate-500">
              Theo dõi danh sách khóa học, giảng viên phụ trách và lượng học sinh tham gia
            </p>
          </div>
        </div>

        <div className="hidden md:block">
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

      <section className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-4 pb-8 pt-24 sm:px-6 lg:px-8">
        {isLoading ? (
          <div className="flex min-h-[55vh] items-center justify-center rounded-[28px] bg-white shadow-sm">
            <div className="flex items-center gap-3 text-slate-600">
              <LoaderCircle className="h-5 w-5 animate-spin" />
              <span>Đang tải danh sách khóa học của hệ thống...</span>
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
                <div className="max-w-3xl">
                  <p className="text-sm font-medium text-sky-100">Trang quản trị khóa học</p>
                  <h2 className="mt-2 text-3xl font-semibold">
                    Danh sách khóa học trên toàn hệ thống
                  </h2>
                  <p className="mt-3 text-sm leading-6 text-sky-50">
                    Dữ liệu trang đang bám theo FastAPI với route `course/`, `course/{'{course_id}'}`,
                    `module/course/{'{course_id}'}`, `course_component/course/{'{course_id}'}` và `category/`.
                    Hiện tại mình dùng dữ liệu mẫu để hoàn thiện giao diện và luồng xem chi tiết.
                  </p>
                </div>
              </div>
            </section>

            <section className="grid gap-4 md:grid-cols-3">
              <article className="rounded-3xl bg-white px-5 py-5 shadow-sm ring-1 ring-slate-200">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-slate-500">Tổng số khóa học</p>
                  <BookOpen className="h-5 w-5 text-sky-600" />
                </div>
                <p className="mt-3 text-3xl font-semibold text-slate-900">
                  {courses.length}
                </p>
                <p className="mt-2 text-sm text-slate-600">
                  Bao gồm cả khóa đang hoạt động, khóa nháp và khóa chưa công bố.
                </p>
              </article>

              <article className="rounded-3xl bg-white px-5 py-5 shadow-sm ring-1 ring-slate-200">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-slate-500">Đã công bố</p>
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                </div>
                <p className="mt-3 text-3xl font-semibold text-slate-900">
                  {publicCount}
                </p>
                <p className="mt-2 text-sm text-slate-600">
                  Những khóa học đang mở công khai cho người học truy cập.
                </p>
              </article>

              <article className="rounded-3xl bg-white px-5 py-5 shadow-sm ring-1 ring-slate-200">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-slate-500">Đang kích hoạt</p>
                  <Users className="h-5 w-5 text-cyan-600" />
                </div>
                <p className="mt-3 text-3xl font-semibold text-slate-900">
                  {activeCount}
                </p>
                <p className="mt-2 text-sm text-slate-600">
                  Những khóa đang vận hành và sẵn sàng phục vụ quá trình học tập.
                </p>
              </article>
            </section>

            <section className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h3 className="text-xl font-semibold">Bộ lọc khóa học</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    Lọc theo từ khóa, phân loại, công bố, kích hoạt và mức độ.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setFilters(defaultFilters)}
                  className="inline-flex items-center gap-2 self-start rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  <SlidersHorizontal className="h-4 w-4" />
                  <span>Đặt lại bộ lọc</span>
                </button>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                <label className="block">
                  <span className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-700">
                    <Search className="h-4 w-4" />
                    <span>Từ khóa</span>
                  </span>
                  <input
                    type="text"
                    value={filters.keyword}
                    onChange={(event) => updateFilter("keyword", event.target.value)}
                    placeholder="Tìm theo tên, mô tả hoặc giảng viên"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-sky-400"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-700">
                    <Filter className="h-4 w-4" />
                    <span>Phân loại</span>
                  </span>
                  <select
                    value={filters.categoryId}
                    onChange={(event) => updateFilter("categoryId", event.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-sky-400"
                  >
                    <option value="all">Tất cả phân loại</option>
                    {categories.map((category) => (
                      <option key={category.id} value={`${category.id}`}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-700">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Công bố</span>
                  </span>
                  <select
                    value={filters.isPublic}
                    onChange={(event) => updateFilter("isPublic", event.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-sky-400"
                  >
                    <option value="all">Tất cả trạng thái</option>
                    <option value="public">Đã công bố</option>
                    <option value="private">Chưa công bố</option>
                  </select>
                </label>

                <label className="block">
                  <span className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-700">
                    <Users className="h-4 w-4" />
                    <span>Kích hoạt</span>
                  </span>
                  <select
                    value={filters.isActive}
                    onChange={(event) => updateFilter("isActive", event.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-sky-400"
                  >
                    <option value="all">Tất cả trạng thái</option>
                    <option value="active">Đang kích hoạt</option>
                    <option value="inactive">Chưa kích hoạt</option>
                  </select>
                </label>

                <label className="block">
                  <span className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-700">
                    <BookOpen className="h-4 w-4" />
                    <span>Mức độ</span>
                  </span>
                  <select
                    value={filters.level}
                    onChange={(event) => updateFilter("level", event.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-sky-400"
                  >
                    <option value="all">Tất cả mức độ</option>
                    {levelOptions.map((level) => (
                      <option key={level} value={level}>
                        {level}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </section>

            <section className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <div className="flex items-center justify-between border-b border-slate-200 pb-4">
                <div>
                  <h3 className="text-xl font-semibold">Danh sách khóa học</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    Hiển thị {filteredCourses.length} khóa học theo bộ lọc hiện tại.
                  </p>
                </div>
              </div>

              {filteredCourses.length === 0 ? (
                <div className="mt-5 rounded-3xl border border-dashed border-slate-300 px-5 py-10 text-center">
                  <EyeOff className="mx-auto h-8 w-8 text-slate-400" />
                  <h4 className="mt-4 text-lg font-semibold text-slate-900">
                    Không có khóa học phù hợp
                  </h4>
                  <p className="mt-2 text-sm text-slate-600">
                    Mình chưa tìm thấy khóa học nào khớp với bộ lọc hiện tại.
                  </p>
                </div>
              ) : (
                <div className="mt-5 grid gap-4 xl:grid-cols-2">
                  {filteredCourses.map((course) => (
                    <Link
                      key={course.id}
                      href={`/admin/courses/${course.id}`}
                      className="group rounded-3xl border border-slate-200 bg-slate-50/60 p-4 transition-colors hover:border-sky-300 hover:bg-sky-50/70"
                    >
                      <div className="flex flex-col gap-4 sm:flex-row">
                        <div className="shrink-0">
                          <Image
                            src={course.image || "/logo.png"}
                            alt={course.title}
                            width={180}
                            height={120}
                            className="h-32 w-full rounded-2xl object-cover sm:w-44"
                          />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full bg-sky-100 px-2.5 py-1 text-xs font-medium text-sky-700">
                              {course.category_name}
                            </span>
                            <span className="rounded-full bg-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700">
                              {course.level}
                            </span>
                            <span
                              className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                                course.is_public
                                  ? "bg-emerald-100 text-emerald-700"
                                  : "bg-amber-100 text-amber-700"
                              }`}
                            >
                              {course.is_public ? "Đã công bố" : "Chưa công bố"}
                            </span>
                            <span
                              className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                                course.is_active
                                  ? "bg-cyan-100 text-cyan-700"
                                  : "bg-slate-200 text-slate-700"
                              }`}
                            >
                              {course.is_active ? "Đang kích hoạt" : "Chưa kích hoạt"}
                            </span>
                          </div>

                          <h4 className="mt-3 text-xl font-semibold text-slate-900">
                            {course.title}
                          </h4>
                          <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-600">
                            {course.introduction}
                          </p>

                          <div className="mt-4 grid gap-3 sm:grid-cols-3">
                            <div className="rounded-2xl bg-white px-3 py-3 ring-1 ring-slate-200">
                              <p className="text-xs text-slate-500">Giảng viên</p>
                              <p className="mt-1 text-base font-semibold text-slate-900">
                                {course.instructor_name}
                              </p>
                            </div>
                            <div className="rounded-2xl bg-white px-3 py-3 ring-1 ring-slate-200">
                              <p className="text-xs text-slate-500">Học sinh</p>
                              <p className="mt-1 text-base font-semibold text-slate-900">
                                {course.total_student}
                              </p>
                            </div>
                            <div className="rounded-2xl bg-white px-3 py-3 ring-1 ring-slate-200">
                              <p className="text-xs text-slate-500">Cập nhật</p>
                              <p className="mt-1 text-base font-semibold text-slate-900">
                                {course.updated_at_text}
                              </p>
                            </div>
                          </div>

                          <div className="mt-4 flex items-center justify-between">
                            <p className="text-sm text-slate-500">
                              Nhấn để xem chi tiết khóa học ở chế độ chỉ đọc.
                            </p>
                            <span className="inline-flex items-center gap-1 text-sm font-semibold text-sky-700">
                              <span>Xem chi tiết</span>
                              <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                            </span>
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </section>
          </>
        ) : null}
      </section>
    </main>
  );
}

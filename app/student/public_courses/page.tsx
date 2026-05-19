"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  ChevronRight,
  Filter,
  GraduationCap,
  LoaderCircle,
  Menu,
  Search,
  Sparkles,
  Tags,
  Users,
} from "lucide-react";
import { UserAccountMenu } from "../../components/user-account-menu";
import { ShowNavigation } from "../../lib/app_nav";
import {
  filterStudentPublicCourses,
  getStudentPublicCourseCatalog,
  type StudentPublicCourse,
  type StudentPublicCourseCatalog,
  type StudentPublicCourseFilterState,
} from "../../lib/api_course";
import type { User } from "../../lib/api_user";
import {
  STUDENT_DEFAULT_USER,
  useStudentSession,
} from "../_lib/use-student-session";

const initialUser: User = STUDENT_DEFAULT_USER;

const initialFilters: StudentPublicCourseFilterState = {
  keyword: "",
  categoryId: "all",
  enrollment: "all",
  level: "all",
};

function getEnrollmentBadgeClass(isEnrolled: boolean): string {
  return isEnrolled
    ? "bg-emerald-100 text-emerald-700"
    : "bg-amber-100 text-amber-700";
}

export default function StudentPublicCoursesPage() {
  const router = useRouter();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [catalog, setCatalog] = useState<StudentPublicCourseCatalog | null>(null);
  const [filters, setFilters] =
    useState<StudentPublicCourseFilterState>(initialFilters);
  const { currentUser, isCheckingAuth } = useStudentSession();

  const deferredKeyword = useDeferredValue(filters.keyword);

  useEffect(() => {
    let isMounted = true;

    async function loadPageData() {
      if (!currentUser) {
        return;
      }

      try {
        const courseCatalog = await getStudentPublicCourseCatalog(currentUser.id);

        if (!isMounted) {
          return;
        }

        setCatalog(courseCatalog);
        setErrorMessage("");
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Không thể tải danh sách khóa học công khai.",
        );
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadPageData();

    return () => {
      isMounted = false;
    };
  }, [currentUser]);

  const isAuthPending = isCheckingAuth || !currentUser;
  const user = currentUser ?? initialUser;
  const filteredCourses = useMemo(() => {
    return filterStudentPublicCourses(catalog?.courses ?? [], {
      ...filters,
      keyword: deferredKeyword,
    });
  }, [catalog?.courses, deferredKeyword, filters]);

  const enrolledCourseCount = useMemo(
    () => (catalog?.courses ?? []).filter((course) => course.is_enrolled).length,
    [catalog?.courses],
  );

  const categoryCount = catalog?.categories.length ?? 0;

  function handleOpenCourse(course: StudentPublicCourse) {
    if (course.is_enrolled) {
      router.push(`/student/courses/${course.id}`);
      return;
    }

    router.push(`/student/public_courses/${course.id}`);
  }

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
            <h1 className="text-lg font-semibold">Khóa học công khai</h1>
            <p className="text-sm text-slate-500">
              Tìm khóa học đang được công bố và kích hoạt cho học sinh
            </p>
          </div>
        </div>

        <div className="hidden md:block">
          <UserAccountMenu user={user} variant="dashboard" />
        </div>

        <div className="hidden items-center gap-3">
          <div className="rounded-full bg-sky-100 px-3 py-1 text-sm font-medium text-sky-700">
            {user.role === "student" ? "Học sinh" : user.role}
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
              <span>Đang tải danh sách khóa học công khai...</span>
            </div>
          </div>
        ) : null}

        {!isLoading && errorMessage ? (
          <div className="rounded-3xl border border-red-200 bg-red-50 px-5 py-4 text-red-700">
            {errorMessage}
          </div>
        ) : null}

        {!isLoading && !errorMessage && catalog ? (
          <>
            <section className="rounded-[30px] bg-linear-to-r from-sky-700 via-cyan-700 to-emerald-600 px-6 py-7 text-white shadow-xl">
              <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                <div className="max-w-3xl">
                  <p className="text-sm font-medium uppercase tracking-[0.24em] text-sky-100">
                    Không gian khám phá khóa học
                  </p>
                  <h2 className="mt-3 text-3xl font-semibold">
                    Chọn khóa học phù hợp với mục tiêu học tập của bạn
                  </h2>
                  <p className="mt-3 max-w-2xl text-sm leading-6 text-sky-50">
                    Chỉ các khóa học đã được công bố và đang kích hoạt mới xuất hiện
                    ở đây. Nếu bạn đã đăng ký, chọn khóa học sẽ đi thẳng vào trang
                    học; nếu chưa đăng ký, hệ thống sẽ mở trang xem thông tin trước
                    khi tham gia.
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-3xl bg-white/15 px-5 py-4 backdrop-blur">
                    <p className="text-sm text-sky-100">Khóa học công khai</p>
                    <p className="mt-2 text-3xl font-semibold">
                      {catalog.courses.length}
                    </p>
                  </div>
                  <div className="rounded-3xl bg-white/15 px-5 py-4 backdrop-blur">
                    <p className="text-sm text-sky-100">Đã đăng ký</p>
                    <p className="mt-2 text-3xl font-semibold">
                      {enrolledCourseCount}
                    </p>
                  </div>
                  <div className="rounded-3xl bg-white/15 px-5 py-4 backdrop-blur">
                    <p className="text-sm text-sky-100">Phân loại đang có</p>
                    <p className="mt-2 text-3xl font-semibold">{categoryCount}</p>
                  </div>
                </div>
              </div>
            </section>

            <section className="grid gap-4 md:grid-cols-3">
              <article className="rounded-3xl bg-white px-5 py-5 shadow-sm ring-1 ring-slate-200">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-slate-500">Kết quả đang hiển thị</p>
                  <BookOpen className="h-5 w-5 text-sky-600" />
                </div>
                <p className="mt-3 text-3xl font-semibold text-slate-900">
                  {filteredCourses.length}
                </p>
                <p className="mt-2 text-sm text-slate-600">
                  Sau khi áp dụng các bộ lọc tìm kiếm hiện tại
                </p>
              </article>

              <article className="rounded-3xl bg-white px-5 py-5 shadow-sm ring-1 ring-slate-200">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-slate-500">Mức độ học vấn</p>
                  <GraduationCap className="h-5 w-5 text-emerald-600" />
                </div>
                <p className="mt-3 text-3xl font-semibold text-slate-900">
                  {catalog.levels.length}
                </p>
                <p className="mt-2 text-sm text-slate-600">
                  Bao gồm các mức như cơ bản, trung cấp và nâng cao
                </p>
              </article>

              <article className="rounded-3xl bg-white px-5 py-5 shadow-sm ring-1 ring-slate-200">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-slate-500">Khóa học có tiến độ</p>
                  <Sparkles className="h-5 w-5 text-amber-600" />
                </div>
                <p className="mt-3 text-3xl font-semibold text-slate-900">
                  {
                    catalog.courses.filter((course) => course.progress_percentage > 0)
                      .length
                  }
                </p>
                <p className="mt-2 text-sm text-slate-600">
                  Các khóa mà bạn đã bắt đầu học hoặc đã hoàn thành
                </p>
              </article>
            </section>

            <section className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <h3 className="text-xl font-semibold">Bộ lọc khóa học</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    Lọc theo từ khóa, tình trạng đăng ký, phân loại và mức độ học
                    vấn để tìm khóa học phù hợp.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setFilters(initialFilters)}
                  className="inline-flex items-center gap-2 self-start rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  <Filter className="h-4 w-4" />
                  Xóa bộ lọc
                </button>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <label className="block">
                  <span className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-700">
                    <Search className="h-4 w-4" />
                    Từ khóa
                  </span>
                  <input
                    value={filters.keyword}
                    onChange={(event) =>
                      setFilters((previous) => ({
                        ...previous,
                        keyword: event.target.value,
                      }))
                    }
                    placeholder="Nhập tên khóa học, mô tả hoặc giảng viên"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-sky-400"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-700">
                    <Users className="h-4 w-4" />
                    Tình trạng đăng ký
                  </span>
                  <select
                    value={filters.enrollment}
                    onChange={(event) =>
                      setFilters((previous) => ({
                        ...previous,
                        enrollment: event.target.value as
                          | "all"
                          | "enrolled"
                          | "not_enrolled",
                      }))
                    }
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-sky-400"
                  >
                    <option value="all">Tất cả khóa học</option>
                    <option value="enrolled">Đã đăng ký học</option>
                    <option value="not_enrolled">Chưa đăng ký học</option>
                  </select>
                </label>

                <label className="block">
                  <span className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-700">
                    <Tags className="h-4 w-4" />
                    Phân loại
                  </span>
                  <select
                    value={filters.categoryId}
                    onChange={(event) =>
                      setFilters((previous) => ({
                        ...previous,
                        categoryId: event.target.value,
                      }))
                    }
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-sky-400"
                  >
                    <option value="all">Tất cả phân loại</option>
                    {catalog.categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-700">
                    <GraduationCap className="h-4 w-4" />
                    Mức độ học vấn
                  </span>
                  <select
                    value={filters.level}
                    onChange={(event) =>
                      setFilters((previous) => ({
                        ...previous,
                        level: event.target.value,
                      }))
                    }
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-sky-400"
                  >
                    <option value="all">Tất cả mức độ</option>
                    {catalog.levels.map((level) => (
                      <option key={level} value={level}>
                        {level}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </section>

            <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {filteredCourses.length === 0 ? (
                <div className="col-span-full rounded-[28px] border border-dashed border-slate-300 bg-white px-6 py-12 text-center text-slate-500 shadow-sm">
                  Không tìm thấy khóa học phù hợp với bộ lọc hiện tại.
                </div>
              ) : (
                filteredCourses.map((course) => (
                  <button
                    key={course.id}
                    type="button"
                    onClick={() => handleOpenCourse(course)}
                    className="group overflow-hidden rounded-[28px] bg-white text-left shadow-sm ring-1 ring-slate-200 transition-all hover:-translate-y-1 hover:shadow-lg hover:ring-sky-300"
                  >
                    <div className="relative h-52 w-full overflow-hidden bg-slate-100">
                      <Image
                        src={course.image}
                        alt={course.title}
                        fill
                        className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                      />
                      <div className="absolute inset-x-0 top-0 flex items-center justify-between p-4">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${getEnrollmentBadgeClass(
                            course.is_enrolled,
                          )}`}
                        >
                          {course.enrollment_status_label}
                        </span>
                        <span className="rounded-full bg-slate-950/70 px-3 py-1 text-xs font-medium text-white">
                          {course.level}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-4 p-5">
                      <div>
                        <p className="text-xs font-medium uppercase tracking-[0.24em] text-sky-700">
                          {course.category_name}
                        </p>
                        <h3 className="mt-2 text-xl font-semibold text-slate-900">
                          {course.title}
                        </h3>
                        <p className="mt-3 text-sm leading-6 text-slate-600">
                          {course.introduction}
                        </p>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="rounded-2xl bg-slate-50 px-4 py-3">
                          <p className="text-xs text-slate-500">Giảng viên</p>
                          <p className="mt-1 text-sm font-semibold text-slate-900">
                            {course.instructor_name}
                          </p>
                        </div>
                        <div className="rounded-2xl bg-slate-50 px-4 py-3">
                          <p className="text-xs text-slate-500">Số module</p>
                          <p className="mt-1 text-sm font-semibold text-slate-900">
                            {course.total_module}
                          </p>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-slate-200 px-4 py-4">
                        <div className="mb-2 flex items-center justify-between text-sm">
                          <span className="text-slate-600">Tiến độ của bạn</span>
                          <span className="font-semibold text-slate-900">
                            {course.progress_percentage}%
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-slate-100">
                          <div
                            className="h-2 rounded-full bg-linear-to-r from-sky-500 to-emerald-500"
                            style={{ width: `${course.progress_percentage}%` }}
                          />
                        </div>
                        <p className="mt-2 text-xs text-slate-500">
                          {course.is_enrolled
                            ? `Đã hoàn thành ${course.module_completed}/${course.total_module} module`
                            : "Chưa đăng ký nên chưa có tiến độ học"}
                        </p>
                      </div>

                      <div className="flex items-center justify-between border-t border-slate-100 pt-1">
                        <p className="text-sm text-slate-500">
                          {course.is_enrolled
                            ? "Đi tới trang học nội dung khóa học"
                            : "Xem thông tin khóa học trước khi đăng ký"}
                        </p>
                        <span className="inline-flex items-center gap-1 text-sm font-semibold text-sky-700">
                          Mở khóa học
                          <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                        </span>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </section>
          </>
        ) : null}
      </section>
    </main>
  );
}

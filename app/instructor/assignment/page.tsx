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
} from "lucide-react";
import { UserAccountMenu } from "../../components/user-account-menu";
import { NotificationBell } from "../../components/notification-bell";
import { ShowNavigation } from "../../lib/app_nav";
import { useInstructorSession } from "../_lib/use-instructor-session";
import { getInstructorCourseListRaw } from "../../lib/api_course_instructor";
import type { User } from "../../lib/api_user";
import {
  type InstructorAssignment,
  type InstructorAssignmentFilterState,
  getInstructorAssignmentList,
  filterInstructorAssignment,
  defaultFilters,
} from "../../lib/api_assignment_instructor";

const initialUser: User = {
  id: 7,
  username: "Giảng viên",
  email: "giang_vien@example.com",
  icon: "/icon.png",
  role: "instructor",
};

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

function getAssignmentTypeColor(type: string): string {
  switch (type) {
    case "Bài tập tự luận":
      return "bg-violet-100 text-violet-700";
    case "Bài tập nộp tệp":
      return "bg-cyan-100 text-cyan-700";
    case "Bài tập lập trình":
      return "bg-emerald-100 text-emerald-700";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

export default function InstructorAssignmentPage() {
  const router = useRouter();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const { currentUser, isCheckingAuth } = useInstructorSession();
  const [assignments, setAssignments] = useState<InstructorAssignment[]>([]);
  const [filters, setFilters] = useState<InstructorAssignmentFilterState>(defaultFilters);
  const [instructorCourses, setInstructorCourses] = useState<
    Array<{ id: number; title: string }>
  >([]);

  useEffect(() => {
    let isMounted = true;

    async function loadPageData() {
      if (!currentUser) return;

      try {
        const [courseList] = await Promise.all([
          getInstructorCourseListRaw(currentUser.id),
        ]);

        if (!isMounted) return;

        setInstructorCourses(
          courseList.map((course) => ({ id: course.id, title: course.title })),
        );

        const assignmentList = await getInstructorAssignmentList(
          currentUser.id,
          courseList.map((course) => ({ id: course.id, title: course.title })),
        );

        if (!isMounted) return;

        setAssignments(assignmentList);
        setErrorMessage("");
      } catch (error) {
        if (!isMounted) return;
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Không thể tải danh sách bài tập.",
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

  const filteredAssignments = useMemo(
    () => filterInstructorAssignment(assignments, filters),
    [assignments, filters],
  );

  const activeCount = useMemo(
    () => assignments.filter((a) => a.is_active).length,
    [assignments],
  );

  const usedCourseCount = useMemo(
    () => new Set(assignments.map((a) => a.course_id).filter(Boolean)).size,
    [assignments],
  );

  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const a of assignments) {
      counts[a.assignment_type] = (counts[a.assignment_type] ?? 0) + 1;
    }
    return counts;
  }, [assignments]);

  const uniqueTypes = useMemo(
    () => [...new Set(assignments.map((a) => a.assignment_type))],
    [assignments],
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
            <h1 className="text-lg font-semibold">Bài tập của giảng viên</h1>
            <p className="text-sm text-slate-500">
              Quản lý bài tập và chấm điểm bài nộp từ sinh viên
            </p>
          </div>
        </div>

        <div className="hidden items-center gap-2 md:flex">
          <NotificationBell userId={user.id} />
          <UserAccountMenu user={user} variant="dashboard" />
        </div>

        <div className="hidden items-center gap-3">
          <div className="rounded-full bg-sky-100 px-3 py-1 text-sm font-medium text-sky-700">
            Giảng viên
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
              <span>Đang tải danh sách bài tập...</span>
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
            <section className="rounded-[28px] bg-linear-to-r from-violet-700 via-purple-700 to-indigo-600 px-6 py-7 text-white shadow-xl">
              <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                <div className="max-w-3xl">
                  <p className="text-sm font-medium text-violet-100">
                    Quản lý bài tập học tập
                  </p>
                  <h2 className="mt-2 text-3xl font-semibold">
                    Danh sách bài tập của {user.username}
                  </h2>
                  <p className="mt-3 text-sm leading-6 text-violet-50">
                    Đây là danh sách các bài tập trong khóa học của bạn. Chọn một
                    bài tập để xem bài nộp của sinh viên, chấm điểm và phản hồi.
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl bg-white/14 px-4 py-3">
                    <p className="text-sm text-violet-100">Tổng bài tập</p>
                    <p className="mt-2 text-base font-semibold">{assignments.length}</p>
                  </div>
                  <div className="rounded-2xl bg-white/14 px-4 py-3">
                    <p className="text-sm text-violet-100">Đang kích hoạt</p>
                    <p className="mt-2 text-base font-semibold">{activeCount}</p>
                  </div>
                  <div className="rounded-2xl bg-white/14 px-4 py-3">
                    <p className="text-sm text-violet-100">Khóa học có bài tập</p>
                    <p className="mt-2 text-base font-semibold">{usedCourseCount}</p>
                  </div>
                </div>
              </div>
            </section>

            <section className="grid gap-4 md:grid-cols-4">
              <article className="rounded-3xl bg-white px-5 py-5 shadow-sm ring-1 ring-slate-200">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-slate-500">Kết quả hiển thị</p>
                  <BookOpen className="h-5 w-5 text-violet-600" />
                </div>
                <p className="mt-3 text-3xl font-semibold text-slate-900">
                  {filteredAssignments.length}
                </p>
                <p className="mt-2 text-sm text-slate-600">
                  Số bài tập khớp với bộ lọc hiện tại.
                </p>
              </article>

              <article className="rounded-3xl bg-white px-5 py-5 shadow-sm ring-1 ring-slate-200">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-slate-500">Đang kích hoạt</p>
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                </div>
                <p className="mt-3 text-3xl font-semibold text-slate-900">
                  {activeCount}
                </p>
                <p className="mt-2 text-sm text-slate-600">
                  Bài tập đang được kích hoạt cho sinh viên.
                </p>
              </article>

              <article className="rounded-3xl bg-white px-5 py-5 shadow-sm ring-1 ring-slate-200">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-slate-500">Loại bài tập</p>
                  <ClipboardList className="h-5 w-5 text-purple-600" />
                </div>
                <p className="mt-3 text-3xl font-semibold text-slate-900">
                  {uniqueTypes.length}
                </p>
                <p className="mt-2 text-sm text-slate-600">
                  {Object.entries(typeCounts)
                    .map(([type, count]) => `${getAssignmentTypeLabel(type)}: ${count}`)
                    .join(", ")}
                </p>
              </article>

              <article className="rounded-3xl bg-white px-5 py-5 shadow-sm ring-1 ring-slate-200">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-slate-500">Khóa học đang dùng</p>
                  <Filter className="h-5 w-5 text-cyan-600" />
                </div>
                <p className="mt-3 text-3xl font-semibold text-slate-900">
                  {usedCourseCount}
                </p>
                <p className="mt-2 text-sm text-slate-600">
                  Số khóa học có bài tập.
                </p>
              </article>
            </section>

            <section className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h3 className="text-xl font-semibold">Bộ lọc bài tập</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    Lọc theo từ khóa, khóa học, trạng thái kích hoạt và loại bài tập.
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

              <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <label className="block">
                  <span className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-700">
                    <Search className="h-4 w-4" />
                    <span>Từ khóa</span>
                  </span>
                  <input
                    type="text"
                    value={filters.keyword}
                    onChange={(e) =>
                      setFilters((prev) => ({ ...prev, keyword: e.target.value }))
                    }
                    placeholder="Tìm theo tiêu đề, mô tả hoặc khóa học"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-violet-400"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-700">
                    <BookOpen className="h-4 w-4" />
                    <span>Khóa học</span>
                  </span>
                  <select
                    value={filters.courseId}
                    onChange={(e) =>
                      setFilters((prev) => ({ ...prev, courseId: e.target.value }))
                    }
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-violet-400"
                  >
                    <option value="all">Tất cả khóa học</option>
                    {instructorCourses.map((course) => (
                      <option key={course.id} value={`${course.id}`}>
                        {course.title}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-700">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Kích hoạt</span>
                  </span>
                  <select
                    value={filters.isActive}
                    onChange={(e) =>
                      setFilters((prev) => ({ ...prev, isActive: e.target.value }))
                    }
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-violet-400"
                  >
                    <option value="all">Tất cả trạng thái</option>
                    <option value="active">Đang kích hoạt</option>
                    <option value="inactive">Chưa kích hoạt</option>
                  </select>
                </label>

                <label className="block">
                  <span className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-700">
                    <ClipboardList className="h-4 w-4" />
                    <span>Loại bài tập</span>
                  </span>
                  <select
                    value={filters.assignment_type}
                    onChange={(e) =>
                      setFilters((prev) => ({
                        ...prev,
                        assignment_type: e.target.value,
                      }))
                    }
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-violet-400"
                  >
                    <option value="all">Tất cả loại</option>
                    {uniqueTypes.map((type) => (
                      <option key={type} value={type}>
                        {getAssignmentTypeLabel(type)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </section>

            <section className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <div className="flex items-center justify-between border-b border-slate-200 pb-4">
                <div>
                  <h3 className="text-xl font-semibold">Danh sách bài tập</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    Chọn một bài tập để xem bài nộp và chấm điểm.
                  </p>
                </div>
              </div>

              {filteredAssignments.length === 0 ? (
                <div className="mt-5 rounded-3xl border border-dashed border-slate-300 px-5 py-10 text-center">
                  <EyeOff className="mx-auto h-8 w-8 text-slate-400" />
                  <h4 className="mt-4 text-lg font-semibold text-slate-900">
                    Không có bài tập phù hợp
                  </h4>
                  <p className="mt-2 text-sm text-slate-600">
                    Hãy thử thay đổi bộ lọc để xem thêm bài tập từ các khóa học.
                  </p>
                </div>
              ) : (
                <div className="mt-5 space-y-4">
                  {filteredAssignments.map((assignment) => (
                    <article
                      key={assignment.id}
                      className="rounded-3xl border border-slate-200 bg-slate-50/60 p-4 transition-colors hover:border-violet-300 hover:bg-violet-50/70"
                    >
                      <div className="flex flex-col gap-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="rounded-full bg-violet-100 px-2.5 py-1 text-xs font-medium text-violet-700">
                                {assignment.course_name ?? `Khóa học #${assignment.course_id}`}
                              </span>
                              <span
                                className={`rounded-full px-2.5 py-1 text-xs font-medium ${getAssignmentTypeColor(assignment.assignment_type)}`}
                              >
                                {getAssignmentTypeLabel(assignment.assignment_type)}
                              </span>
                              <span
                                className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                                  assignment.is_active
                                    ? "bg-emerald-100 text-emerald-700"
                                    : "bg-slate-200 text-slate-700"
                                }`}
                              >
                                {assignment.is_active ? "Đang kích hoạt" : "Chưa kích hoạt"}
                              </span>
                            </div>

                            <h4 className="mt-3 text-xl font-semibold text-slate-900">
                              {assignment.title}
                            </h4>
                            <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-600">
                              {assignment.description ?? "Bài tập này chưa có mô tả chi tiết."}
                            </p>
                          </div>

                          <Link
                            href={`/instructor/assignment/${assignment.id}`}
                            className="inline-flex items-center gap-2 self-start rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                          >
                            <ClipboardList className="h-4 w-4" />
                            <span>Chấm bài</span>
                          </Link>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-3">
                          <div className="rounded-2xl bg-white px-3 py-3 ring-1 ring-slate-200">
                            <p className="text-xs text-slate-500">Điểm tối đa</p>
                            <p className="mt-1 text-base font-semibold text-slate-900">
                              {assignment.max_score}
                            </p>
                          </div>
                          <div className="rounded-2xl bg-white px-3 py-3 ring-1 ring-slate-200">
                            <p className="text-xs text-slate-500">Điểm cần đạt</p>
                            <p className="mt-1 text-base font-semibold text-slate-900">
                              {assignment.pass_score}
                            </p>
                          </div>
                          <div className="rounded-2xl bg-white px-3 py-3 ring-1 ring-slate-200">
                            <p className="text-xs text-slate-500">Ngày tạo</p>
                            <p className="mt-1 text-base font-semibold text-slate-900">
                              {assignment.created_at
                                ? new Date(assignment.created_at).toLocaleDateString("vi-VN")
                                : "---"}
                            </p>
                          </div>
                        </div>

                        <div className="flex justify-end">
                          <Link
                            href={`/instructor/assignment/${assignment.id}`}
                            className="inline-flex items-center gap-1 text-sm font-semibold text-violet-700"
                          >
                            <span>Đi tới trang chấm bài</span>
                            <ChevronRight className="h-4 w-4" />
                          </Link>
                        </div>
                      </div>
                    </article>
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

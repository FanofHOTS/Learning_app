"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Clock3,
  FileText,
  Layers3,
  LoaderCircle,
  Menu,
  NotebookPen,
  School,
  Sparkles,
  UserPlus,
} from "lucide-react";

import { ShowNavigation } from "../../../lib/app_nav";
import {
  getStudentJoinCourseDetail,
  joinCourseForStudent,
  updateCourseTotalStudent,
  type JoinCourseComponent,
  type JoinCourseModule,
  type StudentJoinCourseDetail,
} from "../../../lib/api_join_course";
import type { User } from "../../../lib/api_user";
import {
  STUDENT_DEFAULT_USER,
  useStudentSession,
} from "../../_lib/use-student-session";

const initialUser: User = STUDENT_DEFAULT_USER;

function getComponentTypeLabel(
  componentType: JoinCourseComponent["component_type"],
) {
  return componentType === "exam" ? "Bài kiểm tra" : "Tài liệu";
}

function getComponentIcon(componentType: JoinCourseComponent["component_type"]) {
  return componentType === "exam" ? NotebookPen : FileText;
}

export default function StudentJoinCoursePage() {
  const router = useRouter();
  const params = useParams<{ courseId: string }>();
  const courseId = Number(params.courseId ?? "0");

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isJoining, setIsJoining] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [courseDetail, setCourseDetail] =
    useState<StudentJoinCourseDetail | null>(null);
  const [selectedModuleId, setSelectedModuleId] = useState<number | null>(null);
  const [selectedComponentId, setSelectedComponentId] = useState<number | null>(
    null,
  );
  const [showSuccessActions, setShowSuccessActions] = useState(false);
  const { currentUser, isCheckingAuth } = useStudentSession();

  useEffect(() => {
    let isMounted = true;

    async function loadPageData() {
      if (!currentUser) {
        return;
      }

      try {
        if (Number.isNaN(courseId) || courseId <= 0) {
          throw new Error("Mã khóa học không hợp lệ.");
        }

        const detail = await getStudentJoinCourseDetail(courseId, currentUser.id);

        if (!isMounted) {
          return;
        }

        if (detail.is_enrolled) {
          router.replace(`/student/courses/${courseId}`);
          return;
        }

        const firstModule = detail.modules[0] ?? null;
        const firstComponent = detail.components.find((component) =>
          firstModule ? component.module_id === firstModule.id : true,
        );

        setCourseDetail(detail);
        setSelectedModuleId(firstModule?.id ?? null);
        setSelectedComponentId(firstComponent?.id ?? null);
        setErrorMessage("");
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Không thể tải thông tin khóa học trước khi đăng ký.",
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
  }, [courseId, currentUser, router]);

  const isAuthPending = isCheckingAuth || !currentUser;
  const user = currentUser ?? initialUser;

  const modules = useMemo(() => {
    return [...(courseDetail?.modules ?? [])].sort(
      (left, right) => left.module_sequence - right.module_sequence,
    );
  }, [courseDetail?.modules]);

  const components = useMemo(() => {
    return [...(courseDetail?.components ?? [])].sort((left, right) => {
      if (left.module_id !== right.module_id) {
        return left.module_id - right.module_id;
      }
      return left.component_sequence - right.component_sequence;
    });
  }, [courseDetail?.components]);

  const selectedModule =
    modules.find((module) => module.id === selectedModuleId) ?? modules[0] ?? null;

  const selectedComponent =
    components.find((component) => component.id === selectedComponentId) ?? null;

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

  function handleSelectModule(module: JoinCourseModule) {
    setSelectedModuleId(module.id);
    const firstComponentOfModule = components.find(
      (component) => component.module_id === module.id,
    );
    setSelectedComponentId(firstComponentOfModule?.id ?? null);
  }

  async function handleJoinCourse() {
    if (!currentUser || !courseDetail) {
      return;
    }

    setIsJoining(true);
    setErrorMessage("");
    setSuccessMessage("");
    setShowSuccessActions(false);

    try {
      await joinCourseForStudent({
        courseId: courseDetail.course.id,
        userId: currentUser.id,
      });

      // Cập nhật số lượng học viên của khóa học sau khi đăng ký thành công
      await updateCourseTotalStudent(courseDetail.course.id, courseDetail.course.total_student + 1);

      setSuccessMessage(
        "Đăng ký khóa học thành công. Hệ thống đã khởi tạo tiến trình khóa học, tiến trình module và tiến trình các thành phần học tập cho bạn.",
      );
      setShowSuccessActions(true);
      setCourseDetail((currentDetail) =>
        currentDetail
          ? {
              ...currentDetail,
              is_enrolled: true,
              progress_percentage: 0,
            }
          : currentDetail,
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Không thể đăng ký khóa học ở thời điểm hiện tại.",
      );
    } finally {
      setIsJoining(false);
    }
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
            className="rounded-xl p-2 text-slate-700 hover:bg-slate-100"
            onClick={() => setIsSidebarOpen(true)}
            aria-label="Mở thanh điều hướng"
          >
            <Menu className="h-5 w-5" />
          </button>
          <button
            type="button"
            className="rounded-xl p-2 text-slate-700 hover:bg-slate-100"
            onClick={() => router.push("/student/public_courses")}
            aria-label="Quay lại danh sách khóa học công khai"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <Image
            src="/logo.png"
            alt="Logo"
            width={40}
            height={40}
            className="cursor-pointer"
            onClick={() => router.push("/student")}
          />
          <div>
            <h1 className="text-lg font-semibold">Thông tin khóa học</h1>
            <p className="text-sm text-slate-500">
              Xem nội dung trước khi quyết định đăng ký học
            </p>
          </div>
        </div>

        <div className="hidden items-center gap-3 md:flex">
          <div className="rounded-full bg-sky-100 px-3 py-1 text-sm font-medium text-sky-700">
            Học sinh
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
              <span>Đang tải thông tin khóa học...</span>
            </div>
          </div>
        ) : null}

        {!isLoading && errorMessage ? (
          <div className="rounded-3xl border border-red-200 bg-red-50 px-5 py-4 text-red-700">
            {errorMessage}
          </div>
        ) : null}

        {!isLoading && successMessage ? (
          <div className="rounded-3xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-emerald-700">
            {successMessage}
          </div>
        ) : null}

        {!isLoading && !errorMessage && courseDetail ? (
          <>
            <section className="overflow-hidden rounded-4xl bg-linear-to-r from-cyan-700 via-sky-700 to-indigo-800 text-white shadow-xl">
              <div className="grid gap-0 lg:grid-cols-[1.1fr_0.9fr]">
                <div className="px-6 py-7">
                  <p className="text-sm font-medium text-sky-100">
                    Xem trước khi đăng ký
                  </p>
                  <h2 className="mt-2 text-3xl font-semibold">
                    {courseDetail.course.title}
                  </h2>
                  <p className="mt-3 max-w-3xl text-sm leading-6 text-sky-50">
                    {courseDetail.course.description}
                  </p>

                  <div className="mt-6 grid gap-3 sm:grid-cols-4">
                    <div className="rounded-2xl bg-white/14 px-4 py-3">
                      <p className="text-sm text-sky-100">Phân loại</p>
                      <p className="mt-2 text-base font-semibold">
                        {courseDetail.course.category_name}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-white/14 px-4 py-3">
                      <p className="text-sm text-sky-100">Trình độ</p>
                      <p className="mt-2 text-base font-semibold">
                        {courseDetail.course.level}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-white/14 px-4 py-3">
                      <p className="text-sm text-sky-100">Số module</p>
                      <p className="mt-2 text-base font-semibold">
                        {courseDetail.modules.length}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-white/14 px-4 py-3">
                      <p className="text-sm text-sky-100">Học viên đang học</p>
                      <p className="mt-2 text-base font-semibold">
                        {courseDetail.course.total_student}
                      </p>
                    </div>
                  </div>

                  <div className="mt-6 flex flex-wrap gap-3">
                    <span className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-medium text-emerald-800">
                      Đang công bố và kích hoạt
                    </span>
                    <span className="rounded-full bg-white/14 px-3 py-1 text-sm font-medium text-white">
                      Giảng viên: {courseDetail.course.instructor_name}
                    </span>
                    <span className="rounded-full bg-white/14 px-3 py-1 text-sm font-medium text-white">
                      Học thử được {components.filter((item) => item.is_preview).length}{" "}
                      thành phần
                    </span>
                  </div>
                </div>

                <div className="relative min-h-65 bg-slate-950/15">
                  <Image
                    src={courseDetail.course.image || "/logo.png"}
                    alt={courseDetail.course.title}
                    fill
                    className="object-cover"
                  />
                  <div className="absolute inset-0 bg-linear-to-t from-slate-950/70 via-slate-950/20 to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-6">
                    <p className="text-sm font-medium text-sky-100">
                      Giới thiệu ngắn
                    </p>
                    <p className="mt-2 text-lg font-semibold">
                      {courseDetail.course.introduction}
                    </p>
                  </div>
                </div>
              </div>
            </section>

            <section className="grid gap-4 md:grid-cols-4">
              <article className="rounded-3xl bg-white px-5 py-5 shadow-sm ring-1 ring-slate-200">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-slate-500">Tổng module</p>
                  <Layers3 className="h-5 w-5 text-sky-600" />
                </div>
                <p className="mt-3 text-3xl font-semibold text-slate-900">
                  {courseDetail.modules.length}
                </p>
                <p className="mt-2 text-sm text-slate-600">
                  Các chặng học tập bạn sẽ đi qua sau khi đăng ký.
                </p>
              </article>

              <article className="rounded-3xl bg-white px-5 py-5 shadow-sm ring-1 ring-slate-200">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-slate-500">Tài liệu học</p>
                  <BookOpen className="h-5 w-5 text-cyan-600" />
                </div>
                <p className="mt-3 text-3xl font-semibold text-slate-900">
                  {courseDetail.total_documents}
                </p>
                <p className="mt-2 text-sm text-slate-600">
                  Bao gồm các tài liệu hướng dẫn và phần đọc trước bài kiểm tra.
                </p>
              </article>

              <article className="rounded-3xl bg-white px-5 py-5 shadow-sm ring-1 ring-slate-200">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-slate-500">Bài kiểm tra</p>
                  <NotebookPen className="h-5 w-5 text-emerald-600" />
                </div>
                <p className="mt-3 text-3xl font-semibold text-slate-900">
                  {courseDetail.total_exams}
                </p>
                <p className="mt-2 text-sm text-slate-600">
                  Các thành phần đánh giá sẽ được mở theo đúng thứ tự học tập.
                </p>
              </article>

              <article className="rounded-3xl bg-white px-5 py-5 shadow-sm ring-1 ring-slate-200">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-slate-500">Thời lượng ước tính</p>
                  <Clock3 className="h-5 w-5 text-amber-600" />
                </div>
                <p className="mt-3 text-3xl font-semibold text-slate-900">
                  {courseDetail.estimated_total_minutes}
                </p>
                <p className="mt-2 text-sm text-slate-600">
                  Phút học tập dự kiến cho toàn bộ tài liệu và bài kiểm tra.
                </p>
              </article>
            </section>

            <section className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
              <article className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-slate-200">
                <div className="flex items-center justify-between border-b border-slate-200 pb-4">
                  <div>
                    <h3 className="text-xl font-semibold">Cấu trúc khóa học</h3>
                    <p className="mt-1 text-sm text-slate-500">
                      Xem trước từng module và các thành phần học tập trước khi đăng ký.
                    </p>
                  </div>
                  <School className="h-6 w-6 text-sky-600" />
                </div>

                <div className="mt-5 space-y-4">
                  {modules.map((module) => {
                    const items = components.filter(
                      (component) => component.module_id === module.id,
                    );
                    const isSelected = selectedModuleId === module.id;

                    return (
                      <section
                        key={module.id}
                        className={`rounded-3xl border p-4 transition-colors ${
                          isSelected
                            ? "border-sky-300 bg-sky-50/70"
                            : "border-slate-200 bg-slate-50/70"
                        }`}
                      >
                        <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <p className="text-sm font-semibold text-sky-700">
                              Module {module.module_sequence}
                            </p>
                            <h4 className="mt-1 text-lg font-semibold text-slate-900">
                              {module.title}
                            </h4>
                            <p className="mt-2 text-sm leading-6 text-slate-600">
                              {module.introduction}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleSelectModule(module)}
                            className="inline-flex items-center gap-2 self-start rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                          >
                            <span>Xem module</span>
                            <ChevronRight className="h-4 w-4" />
                          </button>
                        </div>

                        <div className="mt-4 grid gap-3 sm:grid-cols-3">
                          <div className="rounded-2xl bg-white px-3 py-3 ring-1 ring-slate-200">
                            <p className="text-xs text-slate-500">Loại module</p>
                            <p className="mt-1 text-base font-semibold text-slate-900">
                              {module.type}
                            </p>
                          </div>
                          <div className="rounded-2xl bg-white px-3 py-3 ring-1 ring-slate-200">
                            <p className="text-xs text-slate-500">Số thành phần</p>
                            <p className="mt-1 text-base font-semibold text-slate-900">
                              {items.length}
                            </p>
                          </div>
                          <div className="rounded-2xl bg-white px-3 py-3 ring-1 ring-slate-200">
                            <p className="text-xs text-slate-500">Cho xem trước</p>
                            <p className="mt-1 text-base font-semibold text-slate-900">
                              {items.filter((item) => item.is_preview).length}
                            </p>
                          </div>
                        </div>

                        <div className="mt-4 space-y-3">
                          {items.map((component) => {
                            const Icon = getComponentIcon(component.component_type);
                            const isSelectedComponent =
                              selectedComponentId === component.id;

                            return (
                              <button
                                key={component.id}
                                type="button"
                                onClick={() => {
                                  setSelectedModuleId(module.id);
                                  setSelectedComponentId(component.id);
                                }}
                                className={`flex w-full items-start gap-4 rounded-2xl border px-4 py-4 text-left transition-colors ${
                                  isSelectedComponent
                                    ? "border-sky-400 bg-sky-50"
                                    : "border-slate-200 bg-white hover:border-sky-300 hover:bg-sky-50/50"
                                }`}
                              >
                                <Icon className="mt-0.5 h-5 w-5 text-slate-500" />
                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                                      Bước {component.component_sequence}
                                    </span>
                                    <span className="rounded-full bg-sky-100 px-2.5 py-1 text-xs font-medium text-sky-700">
                                      {getComponentTypeLabel(component.component_type)}
                                    </span>
                                    {component.is_preview ? (
                                      <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700">
                                        Có thể xem thử
                                      </span>
                                    ) : null}
                                  </div>
                                  <p className="mt-3 text-sm font-semibold text-slate-900">
                                    {component.title}
                                  </p>
                                  <p className="mt-1 text-sm leading-6 text-slate-600">
                                    {component.summary}
                                  </p>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </section>
                    );
                  })}
                </div>
              </article>

              <aside className="space-y-6">
                <article className="rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-slate-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xl font-semibold">Đăng ký khóa học</h3>
                      <p className="mt-1 text-sm text-slate-500">
                        Khi đăng ký, hệ thống sẽ tạo tiến trình khóa học, tiến trình
                        các module và tiến trình của từng thành phần học tập.
                      </p>
                    </div>
                    <Sparkles className="h-6 w-6 text-sky-600" />
                  </div>

                  <div className="mt-5 space-y-5">
                    <div className="rounded-3xl bg-slate-50 p-5">
                      <p className="text-sm text-slate-500">Giới thiệu ngắn</p>
                      <h4 className="mt-2 text-2xl font-semibold text-slate-900">
                        {courseDetail.course.title}
                      </h4>
                      <p className="mt-3 text-sm leading-6 text-slate-600">
                        {courseDetail.course.introduction}
                      </p>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-2xl border border-slate-200 px-4 py-4">
                        <p className="text-sm text-slate-500">Giảng viên phụ trách</p>
                        <p className="mt-2 text-lg font-semibold text-slate-900">
                          {courseDetail.course.instructor_name}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-slate-200 px-4 py-4">
                        <p className="text-sm text-slate-500">Trình độ phù hợp</p>
                        <p className="mt-2 text-lg font-semibold text-slate-900">
                          {courseDetail.course.level}
                        </p>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-4 text-sm leading-6 text-slate-600">
                      Sau khi đăng ký thành công, bạn có thể đi thẳng tới trang học
                      nội dung khóa học hoặc quay về danh sách khóa học công khai để
                      tiếp tục xem thêm các lựa chọn khác.
                    </div>

                    <button
                      type="button"
                      onClick={handleJoinCourse}
                      disabled={isJoining || showSuccessActions}
                      className={`inline-flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold text-white ${
                        isJoining || showSuccessActions
                          ? "cursor-not-allowed bg-slate-400"
                          : "bg-sky-600 hover:bg-sky-700"
                      }`}
                    >
                      {isJoining ? (
                        <LoaderCircle className="h-4 w-4 animate-spin" />
                      ) : (
                        <UserPlus className="h-4 w-4" />
                      )}
                      <span>
                        {isJoining
                          ? "Đang đăng ký khóa học..."
                          : "Đăng ký học khóa học này"}
                      </span>
                    </button>

                    {showSuccessActions ? (
                      <div className="grid gap-3 sm:grid-cols-2">
                        <button
                          type="button"
                          onClick={() =>
                            router.push(`/student/courses/${courseDetail.course.id}`)
                          }
                          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700"
                        >
                          <BookOpen className="h-4 w-4" />
                          Vào học ngay
                        </button>
                        <button
                          type="button"
                          onClick={() => router.push("/student/public_courses")}
                          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-800 hover:bg-slate-50"
                        >
                          <ChevronLeft className="h-4 w-4" />
                          Quay về danh sách
                        </button>
                      </div>
                    ) : null}
                  </div>
                </article>

                <article className="rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-slate-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xl font-semibold">Chi tiết thành phần</h3>
                      <p className="mt-1 text-sm text-slate-500">
                        Xem thử cấu trúc học tập trước khi tham gia.
                      </p>
                    </div>
                    {selectedComponent ? (
                      (() => {
                        const Icon = getComponentIcon(selectedComponent.component_type);
                        return <Icon className="h-6 w-6 text-sky-600" />;
                      })()
                    ) : null}
                  </div>

                  {selectedComponent ? (
                    <div className="mt-5 space-y-5">
                      <div className="rounded-3xl bg-slate-50 p-5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-medium text-sky-700">
                            {getComponentTypeLabel(selectedComponent.component_type)}
                          </span>
                          <span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-medium text-slate-700">
                            Mã tham chiếu: {selectedComponent.ref_id ?? "Chưa có"}
                          </span>
                        </div>
                        <h4 className="mt-4 text-2xl font-semibold text-slate-900">
                          {selectedComponent.title}
                        </h4>
                        <p className="mt-3 text-sm leading-6 text-slate-600">
                          {selectedComponent.summary}
                        </p>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="rounded-2xl border border-slate-200 px-4 py-4">
                          <p className="text-sm text-slate-500">Thuộc module</p>
                          <p className="mt-2 text-lg font-semibold text-slate-900">
                            {selectedModule?.title ?? "Không xác định"}
                          </p>
                        </div>
                        <div className="rounded-2xl border border-slate-200 px-4 py-4">
                          <p className="text-sm text-slate-500">Thời lượng dự kiến</p>
                          <p className="mt-2 text-lg font-semibold text-slate-900">
                            {selectedComponent.estimated_minutes} phút
                          </p>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-4 text-sm leading-6 text-slate-600">
                        Đây là trang xem trước khóa học nên chưa mở tài liệu hoặc bài
                        kiểm tra thật. Sau khi đăng ký thành công, bạn sẽ học theo đúng
                        trình tự ở trang học nội dung khóa học dành cho học sinh.
                      </div>
                    </div>
                  ) : (
                    <div className="mt-5 rounded-2xl border border-slate-200 px-4 py-5 text-sm text-slate-600">
                      Chọn một thành phần ở cột bên trái để xem chi tiết.
                    </div>
                  )}
                </article>

                <article className="rounded-[28px] bg-slate-900 px-6 py-6 text-white shadow-sm">
                  <h3 className="text-lg font-semibold">Điều gì xảy ra khi đăng ký?</h3>
                  <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-300">
                    <li>Tiến trình khóa học của bạn sẽ được tạo ngay khi đăng ký.</li>
                    <li>Mỗi module sẽ có một bản ghi tiến trình riêng để theo dõi.</li>
                    <li>
                      Mỗi tài liệu hoặc bài kiểm tra cũng sẽ có tiến trình học riêng.
                    </li>
                    <li>
                      Nếu bạn đã đăng ký từ trước mà vẫn vào trang này, hệ thống sẽ tự
                      đưa bạn đến trang học nội dung khóa học.
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

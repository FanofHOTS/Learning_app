"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import {
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
  FileText,
  LoaderCircle,
  Lock,
  Menu,
  NotebookPen,
  Trophy,
} from "lucide-react";

import { ShowNavigation } from "../../../lib/app_nav";
import type { User } from "../../../lib/api_user";
import {
  getCourseLearningData,
  type CourseLearningData,
  type LearningComponent,
  type LearningComponentExamSummary,
  type LearningModule,
} from "../../../lib/api_course_learning";
import { isUsingMockExamData } from "../../../lib/api_exam";
import {
  STUDENT_DEFAULT_USER,
  useStudentSession,
} from "../../_lib/use-student-session";

const initialUser: User = STUDENT_DEFAULT_USER;

function getComponentTypeLabel(componentType: LearningComponent["component_type"]) {
  return componentType === "exam" ? "Bài kiểm tra" : "Tài liệu";
}

function getComponentIcon(componentType: LearningComponent["component_type"]) {
  return componentType === "exam" ? NotebookPen : FileText;
}

function getStatusBadgeClass(isCompleted: boolean): string {
  return isCompleted
    ? "bg-emerald-100 text-emerald-700"
    : "bg-amber-100 text-amber-700";
}

export default function LearningCoursePage() {
  const router = useRouter();
  const params = useParams<{ courseId: string }>();
  const courseId = Number(params.courseId ?? "0");

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [learningData, setLearningData] = useState<CourseLearningData | null>(null);
  const { currentUser, isCheckingAuth } = useStudentSession();

  useEffect(() => {
    let isMounted = true;

    async function loadPageData() {
      if (!currentUser) {
        return;
      }

      if (Number.isNaN(courseId) || courseId <= 0) {
        setErrorMessage("Mã khóa học không hợp lệ.");
        setIsLoading(false);
        return;
      }

      try {
        const learning = await getCourseLearningData(courseId, currentUser.id);

        if (!isMounted) {
          return;
        }

        setLearningData(learning);
        setErrorMessage("");
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Không thể tải dữ liệu học của khóa học.",
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
  }, [courseId, currentUser]);

  const isAuthPending = isCheckingAuth || !currentUser;
  const user = currentUser ?? initialUser;

  const modules = useMemo(() => {
    return [...(learningData?.modules ?? [])].sort(
      (left, right) => left.module_sequence - right.module_sequence,
    );
  }, [learningData?.modules]);

  const orderedComponents = useMemo(() => {
    if (!learningData) {
      return [];
    }

    const moduleOrder = new Map<number, number>();
    modules.forEach((module) => {
      moduleOrder.set(module.id, module.module_sequence);
    });

    return [...learningData.components].sort((left, right) => {
      const leftModuleOrder = moduleOrder.get(left.module_id) ?? 0;
      const rightModuleOrder = moduleOrder.get(right.module_id) ?? 0;

      if (leftModuleOrder !== rightModuleOrder) {
        return leftModuleOrder - rightModuleOrder;
      }

      return left.component_sequence - right.component_sequence;
    });
  }, [learningData, modules]);

  const completedComponentIds = useMemo(() => {
    return new Set(
      (learningData?.progressRecords ?? [])
        .filter((record) => record.is_completed)
        .map((record) => record.course_component_id),
    );
  }, [learningData?.progressRecords]);

  const examSummaryMap = useMemo(() => {
    const map = new Map<number, LearningComponentExamSummary>();
    (learningData?.examSummaries ?? []).forEach((summary) => {
      map.set(summary.component_id, summary);
    });
    return map;
  }, [learningData?.examSummaries]);

  const componentStateMap = useMemo(() => {
    const stateMap = new Map<
      number,
      { isCompleted: boolean; isUnlocked: boolean; order: number }
    >();

    orderedComponents.forEach((component, index) => {
      const isCompleted = completedComponentIds.has(component.id);
      const previousComponent = orderedComponents[index - 1];
      const isUnlocked =
        component.is_preview ||
        index === 0 ||
        (previousComponent ? completedComponentIds.has(previousComponent.id) : true);

      stateMap.set(component.id, {
        isCompleted,
        isUnlocked,
        order: index + 1,
      });
    });

    return stateMap;
  }, [completedComponentIds, orderedComponents]);

  const nextAvailableComponent =
    orderedComponents.find((component) => {
      const state = componentStateMap.get(component.id);
      return state?.isUnlocked && !state.isCompleted;
    }) ?? null;

  const completedModuleCount = useMemo(() => {
    return (learningData?.moduleProgressRecords ?? []).filter(
      (record) => record.is_complete,
    ).length;
  }, [learningData?.moduleProgressRecords]);

  const courseProgressPercent =
    orderedComponents.length > 0
      ? Math.round((completedComponentIds.size / orderedComponents.length) * 100)
      : 0;

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

  function getModuleProgress(module: LearningModule) {
    const moduleComponents = orderedComponents.filter(
      (component) => component.module_id === module.id,
    );
    const completedCount = moduleComponents.filter((component) =>
      completedComponentIds.has(component.id),
    ).length;

    return {
      completedCount,
      totalCount: moduleComponents.length,
    };
  }

  function openLearningComponent(component: LearningComponent) {
    const componentState = componentStateMap.get(component.id);

    if (!componentState?.isUnlocked) {
      return;
    }

    if (!component.ref_id) {
      setErrorMessage("Thành phần học tập này chưa có mã tham chiếu để mở.");
      return;
    }

    const searchParams = new URLSearchParams({
      componentId: `${component.id}`,
      moduleId: `${component.module_id}`,
    });

    if (
      component.component_type === "exam" &&
      isUsingMockExamData() &&
      !componentState.isCompleted
    ) {
      searchParams.set("autoComplete", "1");
    }

    if (component.component_type === "document") {
      router.push(
        `/student/courses/${courseId}/document/${component.ref_id}?${searchParams.toString()}`,
      );
      return;
    }

    router.push(
      `/student/courses/${courseId}/exam/${component.ref_id}?${searchParams.toString()}`,
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
          className="fixed inset-0 z-40 bg-slate-950/40"
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
            onClick={() => router.push("/student/courses")}
            aria-label="Quay lại danh sách khóa học"
          >
            <ChevronLeft className="h-5 w-5" />
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
            <h1 className="text-lg font-semibold">Trang học khóa học</h1>
            <p className="text-sm text-slate-500">
              Nhấn vào từng thành phần để mở tài liệu hoặc bài kiểm tra tương ứng
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

      <section className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-4 pb-8 pt-24 sm:px-6 lg:px-8">
        {isLoading ? (
          <div className="flex min-h-[55vh] items-center justify-center rounded-[28px] bg-white shadow-sm">
            <div className="flex items-center gap-3 text-slate-600">
              <LoaderCircle className="h-5 w-5 animate-spin" />
              <span>Đang tải nội dung khóa học...</span>
            </div>
          </div>
        ) : null}

        {!isLoading && errorMessage ? (
          <div className="rounded-3xl border border-red-200 bg-red-50 px-5 py-4 text-red-700">
            {errorMessage}
          </div>
        ) : null}

        {!isLoading && !errorMessage && learningData ? (
          <>
            <section className="rounded-[28px] bg-linear-to-r from-cyan-700 via-sky-700 to-indigo-800 px-6 py-7 text-white shadow-xl">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                <div className="max-w-3xl">
                  <p className="text-sm font-medium text-sky-100">Đang học khóa</p>
                  <h2 className="mt-2 text-3xl font-semibold">
                    {learningData.course.title}
                  </h2>
                  <p className="mt-3 text-sm leading-6 text-sky-50">
                    {learningData.course.description}
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-4">
                  <div className="rounded-2xl bg-white/14 px-4 py-3">
                    <p className="text-sm text-sky-100">Trình độ</p>
                    <p className="mt-2 text-base font-semibold">
                      {learningData.course.level}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-white/14 px-4 py-3">
                    <p className="text-sm text-sky-100">Số module</p>
                    <p className="mt-2 text-base font-semibold">{modules.length}</p>
                  </div>
                  <div className="rounded-2xl bg-white/14 px-4 py-3">
                    <p className="text-sm text-sky-100">Đã hoàn thành</p>
                    <p className="mt-2 text-base font-semibold">
                      {completedComponentIds.size}/{orderedComponents.length} thành phần
                    </p>
                  </div>
                  <div className="rounded-2xl bg-white/14 px-4 py-3">
                    <p className="text-sm text-sky-100">Điểm cuối khóa</p>
                    <p className="mt-2 text-base font-semibold">
                      {learningData.courseProgressRecord?.final_score ?? 0}
                    </p>
                  </div>
                </div>
              </div>
            </section>

            <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
              <article className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-slate-200">
                <div className="flex items-center justify-between border-b border-slate-200 pb-4">
                  <div>
                    <h3 className="text-xl font-semibold">Nội dung khóa học</h3>
                    <p className="mt-1 text-sm text-slate-500">
                      Nhấn trực tiếp vào từng thành phần để mở đúng tài liệu hoặc
                      bài kiểm tra. Thành phần sau chỉ mở khi thành phần trước đã
                      hoàn thành.
                    </p>
                  </div>
                  <BookOpen className="h-6 w-6 text-sky-600" />
                </div>

                <div className="mt-5 space-y-4">
                  {modules.map((module) => {
                    const moduleComponents = orderedComponents.filter(
                      (component) => component.module_id === module.id,
                    );
                    const progress = getModuleProgress(module);

                    return (
                      <section
                        key={module.id}
                        className="rounded-3xl border border-slate-200 bg-slate-50/70 p-4"
                      >
                        <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
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
                          <div className="rounded-2xl bg-white px-4 py-3 text-sm text-slate-600 ring-1 ring-slate-200">
                            {progress.completedCount}/{progress.totalCount} thành phần đã xong
                          </div>
                        </div>

                        <div className="mt-4 space-y-3">
                          {moduleComponents.map((component) => {
                            const componentState = componentStateMap.get(component.id);
                            const isCompleted = componentState?.isCompleted ?? false;
                            const isUnlocked = componentState?.isUnlocked ?? false;
                            const Icon = getComponentIcon(component.component_type);
                            const examSummary = examSummaryMap.get(component.id);

                            return (
                              <button
                                key={component.id}
                                type="button"
                                onClick={() => openLearningComponent(component)}
                                disabled={!isUnlocked}
                                className={`w-full rounded-2xl border px-4 py-4 text-left transition ${
                                  !isUnlocked
                                    ? "cursor-not-allowed border-slate-200 bg-slate-100 opacity-70"
                                    : "border-slate-200 bg-white hover:-translate-y-0.5 hover:border-sky-300 hover:bg-sky-50/60"
                                }`}
                              >
                                <div className="flex items-start gap-4">
                                  <div className="mt-0.5">
                                    {isCompleted ? (
                                      <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                                    ) : isUnlocked ? (
                                      <Circle className="h-5 w-5 text-sky-600" />
                                    ) : (
                                      <Lock className="h-5 w-5 text-slate-400" />
                                    )}
                                  </div>

                                  <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                                        Bước {componentState?.order ?? 0}
                                      </span>
                                      <span className="rounded-full bg-sky-100 px-2.5 py-1 text-xs font-medium text-sky-700">
                                        {getComponentTypeLabel(component.component_type)}
                                      </span>
                                      <span
                                        className={`rounded-full px-2.5 py-1 text-xs font-medium ${getStatusBadgeClass(
                                          isCompleted,
                                        )}`}
                                      >
                                        {isCompleted ? "Đã hoàn thành" : "Chưa hoàn thành"}
                                      </span>
                                      {component.is_preview ? (
                                        <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700">
                                          Cho xem trước
                                        </span>
                                      ) : null}
                                    </div>

                                    <div className="mt-3 flex items-start gap-3">
                                      <Icon className="mt-0.5 h-5 w-5 text-slate-500" />
                                      <div className="min-w-0 flex-1">
                                        <div className="flex items-start justify-between gap-3">
                                          <div>
                                            <p className="text-sm font-semibold text-slate-900">
                                              {component.title}
                                            </p>
                                            <p className="mt-1 text-sm leading-6 text-slate-600">
                                              {component.summary}
                                            </p>
                                          </div>
                                          <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                                        </div>

                                        <p className="mt-2 text-xs text-slate-500">
                                          Thời lượng dự kiến: {component.estimated_minutes} phút
                                        </p>

                                        {component.component_type === "exam" ? (
                                          <div className="mt-3 grid gap-3 sm:grid-cols-2">
                                            <div className="rounded-2xl bg-slate-50 px-3 py-3">
                                              <p className="text-xs text-slate-500">
                                                Kết quả cao nhất
                                              </p>
                                              <p className="mt-1 text-sm font-semibold text-slate-900">
                                                {examSummary?.highest_result
                                                  ? `${examSummary.highest_result.score} điểm - ${
                                                      examSummary.highest_result.is_passed
                                                        ? "Đạt"
                                                        : "Chưa đạt"
                                                    }`
                                                  : "Chưa có kết quả"}
                                              </p>
                                            </div>
                                            <div className="rounded-2xl bg-slate-50 px-3 py-3">
                                              <p className="text-xs text-slate-500">
                                                Kết quả mới nhất
                                              </p>
                                              <p className="mt-1 text-sm font-semibold text-slate-900">
                                                {examSummary?.latest_result
                                                  ? `${examSummary.latest_result.score} điểm - ${
                                                      examSummary.latest_result.is_passed
                                                        ? "Đạt"
                                                        : "Chưa đạt"
                                                    }`
                                                  : "Chưa có kết quả"}
                                              </p>
                                            </div>
                                          </div>
                                        ) : null}

                                        <p className="mt-3 text-sm text-slate-500">
                                          {isUnlocked
                                            ? component.component_type === "exam"
                                              ? "Nhấn để mở trang làm bài kiểm tra."
                                              : "Nhấn để mở trang xem tài liệu."
                                            : "Cần hoàn thành thành phần trước đó để mở."}
                                        </p>
                                      </div>
                                    </div>
                                  </div>
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
                      <h3 className="text-xl font-semibold">Tiến độ khóa học</h3>
                      <p className="mt-1 text-sm text-slate-500">
                        Hệ thống đang đồng bộ hoàn thành thành phần, module và khóa
                        học theo dữ liệu FastAPI hoặc dữ liệu mô phỏng hiện có.
                      </p>
                    </div>
                    <Trophy className="h-6 w-6 text-sky-600" />
                  </div>

                  <div className="mt-5 space-y-4">
                    <div className="rounded-3xl bg-slate-50 p-5">
                      <div className="mb-2 flex items-center justify-between text-sm">
                        <span className="text-slate-600">Tiến độ tổng thể</span>
                        <span className="font-semibold text-slate-900">
                          {courseProgressPercent}%
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-200">
                        <div
                          className="h-2 rounded-full bg-linear-to-r from-sky-500 to-emerald-500"
                          style={{ width: `${courseProgressPercent}%` }}
                        />
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-2xl border border-slate-200 px-4 py-4">
                        <p className="text-sm text-slate-500">Module đã xong</p>
                        <p className="mt-2 text-lg font-semibold text-slate-900">
                          {completedModuleCount}/{modules.length}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-slate-200 px-4 py-4">
                        <p className="text-sm text-slate-500">Trạng thái khóa học</p>
                        <p className="mt-2 text-lg font-semibold text-slate-900">
                          {learningData.courseProgressRecord?.is_complete
                            ? "Đã hoàn thành"
                            : "Đang học"}
                        </p>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 px-4 py-4">
                      <p className="text-sm text-slate-500">Thành phần tiếp theo</p>
                      <p className="mt-2 text-lg font-semibold text-slate-900">
                        {nextAvailableComponent?.title ?? "Bạn đã hoàn thành tất cả thành phần."}
                      </p>
                      <p className="mt-2 text-sm text-slate-600">
                        {nextAvailableComponent
                          ? `Loại: ${getComponentTypeLabel(nextAvailableComponent.component_type)}`
                          : "Kết quả cuối khóa đã sẵn sàng để xem lại."}
                      </p>
                    </div>
                  </div>
                </article>

                <article className="rounded-[28px] bg-slate-900 px-6 py-6 text-white shadow-sm">
                  <h3 className="text-lg font-semibold">Quy tắc ghi nhận tiến độ</h3>
                  <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-300">
                    <li>Tài liệu được ghi hoàn thành khi trang tài liệu mở thành công.</li>
                    <li>Bài kiểm tra được ghi hoàn thành khi đã có kết quả tương ứng.</li>
                    <li>Module hoàn thành khi tất cả thành phần trong module đã hoàn thành.</li>
                    <li>Khóa học hoàn thành khi toàn bộ module hoặc toàn bộ thành phần đã hoàn thành.</li>
                    <li>Điểm cuối khóa lấy trung bình điểm cao nhất của từng bài kiểm tra thành phần.</li>
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

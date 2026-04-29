"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import {
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  Circle,
  FileText,
  LoaderCircle,
  Lock,
  Menu,
  NotebookPen,
} from "lucide-react";

import { ShowNavigation } from "../../../lib/app_nav";
import type { User } from "../../../lib/api_user";
import {
  getCourseLearningData,
  markCourseComponentCompleted,
  CourseLearningData,
  LearningComponent,
  LearningModule,
} from "../../../lib/api_course_learning";

const defaultUser: User = {
  id: 1,
  username: "Học sinh",
  email: "hoc_sinh@example.com",
  icon: "/icon.png",
  role: "student",
};

function getComponentTypeLabel(componentType: LearningComponent["component_type"]) {
  return componentType === "exam" ? "Bài kiểm tra" : "Tài liệu";
}

function getComponentIcon(componentType: LearningComponent["component_type"]) {
  return componentType === "exam" ? NotebookPen : FileText;
}

export default function CourseLearningPage() {
  const router = useRouter();
  const params = useParams<{ courseId: string }>();
  const courseId = Number(params.courseId ?? "0");

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [learningData, setLearningData] = useState<CourseLearningData | null>(null);
  const [selectedComponentId, setSelectedComponentId] = useState<number | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadCourseLearning() {
      try {
        const data = await getCourseLearningData(courseId, defaultUser.id);
        if (!isMounted) {
          return;
        }

        setLearningData(data);
        setErrorMessage("");

        const firstComponent = [...data.components].sort((a, b) => {
          if (a.module_id !== b.module_id) {
            return a.module_id - b.module_id;
          }
          return a.component_sequence - b.component_sequence;
        })[0];

        setSelectedComponentId(firstComponent?.id ?? null);
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

    if (Number.isNaN(courseId) || courseId <= 0) {
      setErrorMessage("Mã khóa học không hợp lệ.");
      setIsLoading(false);
      return;
    }

    loadCourseLearning();

    return () => {
      isMounted = false;
    };
  }, [courseId]);

  const modules = useMemo(() => {
    return [...(learningData?.modules ?? [])].sort(
      (a, b) => a.module_sequence - b.module_sequence,
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

    return [...learningData.components].sort((a, b) => {
      const leftModuleOrder = moduleOrder.get(a.module_id) ?? 0;
      const rightModuleOrder = moduleOrder.get(b.module_id) ?? 0;
      if (leftModuleOrder !== rightModuleOrder) {
        return leftModuleOrder - rightModuleOrder;
      }
      return a.component_sequence - b.component_sequence;
    });
  }, [learningData, modules]);

  const completedComponentIds = useMemo(() => {
    return new Set(
      (learningData?.progressRecords ?? [])
        .filter((record) => record.is_completed)
        .map((record) => record.course_component_id),
    );
  }, [learningData?.progressRecords]);

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

  const selectedComponent =
    orderedComponents.find((component) => component.id === selectedComponentId) ?? null;
  const selectedComponentState = selectedComponent
    ? componentStateMap.get(selectedComponent.id)
    : null;

  async function handleCompleteComponent(component: LearningComponent) {
    setIsSaving(true);
    setErrorMessage("");

    try {
      const savedProgress = await markCourseComponentCompleted({
        userId: defaultUser.id,
        courseId,
        moduleId: component.module_id,
        courseComponentId: component.id,
      });

      setLearningData((currentData) => {
        if (!currentData) {
          return currentData;
        }

        const otherProgressRecords = currentData.progressRecords.filter(
          (record) => record.course_component_id !== savedProgress.course_component_id,
        );

        return {
          ...currentData,
          progressRecords: [...otherProgressRecords, savedProgress],
        };
      });
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Không thể cập nhật tiến độ học tập.",
      );
    } finally {
      setIsSaving(false);
    }
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

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <ShowNavigation
        user={defaultUser}
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
            onClick={() => router.push("/student")}
          />
          <div>
            <h1 className="text-lg font-semibold">Trang học khóa học</h1>
            <p className="text-sm text-slate-500">
              Học theo module và thành phần mở khóa tuần tự
            </p>
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

                <div className="grid gap-3 sm:grid-cols-3">
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
                </div>
              </div>
            </section>

            <section className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
              <article className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-slate-200">
                <div className="flex items-center justify-between border-b border-slate-200 pb-4">
                  <div>
                    <h3 className="text-xl font-semibold">Nội dung khóa học</h3>
                    <p className="mt-1 text-sm text-slate-500">
                      Chọn thành phần để xem chi tiết. Thành phần sau chỉ mở khi hoàn
                      thành thành phần trước.
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
                        className="rounded-[24px] border border-slate-200 bg-slate-50/70 p-4"
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
                            {progress.completedCount}/{progress.totalCount} thành phần đã
                            xong
                          </div>
                        </div>

                        <div className="mt-4 space-y-3">
                          {moduleComponents.map((component) => {
                            const componentState = componentStateMap.get(component.id);
                            const isSelected = selectedComponentId === component.id;
                            const isCompleted = componentState?.isCompleted ?? false;
                            const isUnlocked = componentState?.isUnlocked ?? false;
                            const Icon = getComponentIcon(component.component_type);

                            return (
                              <button
                                key={component.id}
                                type="button"
                                onClick={() => setSelectedComponentId(component.id)}
                                disabled={!isUnlocked}
                                className={`flex w-full items-start gap-4 rounded-2xl border px-4 py-4 text-left transition-colors ${
                                  isSelected
                                    ? "border-sky-400 bg-sky-50"
                                    : "border-slate-200 bg-white"
                                } ${
                                  !isUnlocked
                                    ? "cursor-not-allowed opacity-65"
                                    : "hover:border-sky-300 hover:bg-sky-50/60"
                                }`}
                              >
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
                                    {component.is_preview ? (
                                      <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700">
                                        Cho xem trước
                                      </span>
                                    ) : null}
                                  </div>

                                  <div className="mt-3 flex items-start gap-3">
                                    <Icon className="mt-0.5 h-5 w-5 text-slate-500" />
                                    <div>
                                      <p className="text-sm font-semibold text-slate-900">
                                        {component.title}
                                      </p>
                                      <p className="mt-1 text-sm leading-6 text-slate-600">
                                        {component.summary}
                                      </p>
                                      <p className="mt-2 text-xs text-slate-500">
                                        Thời lượng dự kiến: {component.estimated_minutes} phút
                                      </p>
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
                      <h3 className="text-xl font-semibold">Chi tiết thành phần</h3>
                      <p className="mt-1 text-sm text-slate-500">
                        Chưa điều hướng đến tài liệu hoặc bài kiểm tra thật ở bước này.
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
                          <p className="text-sm text-slate-500">Thời lượng dự kiến</p>
                          <p className="mt-2 text-lg font-semibold text-slate-900">
                            {selectedComponent.estimated_minutes} phút
                          </p>
                        </div>
                        <div className="rounded-2xl border border-slate-200 px-4 py-4">
                          <p className="text-sm text-slate-500">Trạng thái hiện tại</p>
                          <p className="mt-2 text-lg font-semibold text-slate-900">
                            {selectedComponentState?.isCompleted
                              ? "Đã hoàn thành"
                              : selectedComponentState?.isUnlocked
                                ? "Sẵn sàng học"
                                : "Chưa mở khóa"}
                          </p>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-4 text-sm leading-6 text-slate-600">
                        Nội dung tài liệu hoặc bài kiểm tra thật sẽ được nối ở bước sau.
                        Ở phiên bản hiện tại, trang này dùng để học theo thứ tự, xem mô
                        tả thành phần và lưu tiến độ hoàn thành của học sinh.
                      </div>

                      <button
                        type="button"
                        onClick={() => handleCompleteComponent(selectedComponent)}
                        disabled={
                          isSaving ||
                          !selectedComponentState?.isUnlocked ||
                          selectedComponentState.isCompleted
                        }
                        className={`w-full rounded-2xl px-4 py-3 text-sm font-semibold text-white ${
                          isSaving ||
                          !selectedComponentState?.isUnlocked ||
                          selectedComponentState.isCompleted
                            ? "cursor-not-allowed bg-slate-400"
                            : "bg-sky-600 hover:bg-sky-700"
                        }`}
                      >
                        {selectedComponentState?.isCompleted
                          ? "Thành phần này đã hoàn thành"
                          : isSaving
                            ? "Đang lưu tiến độ học tập..."
                            : "Đánh dấu đã hoàn thành thành phần này"}
                      </button>
                    </div>
                  ) : (
                    <div className="mt-5 rounded-2xl border border-slate-200 px-4 py-5 text-sm text-slate-600">
                      Chọn một thành phần ở cột bên trái để xem chi tiết.
                    </div>
                  )}
                </article>

                <article className="rounded-[28px] bg-slate-900 px-6 py-6 text-white shadow-sm">
                  <h3 className="text-lg font-semibold">Quy tắc học tuần tự</h3>
                  <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-300">
                    <li>Học sinh phải hoàn thành thành phần trước để mở thành phần sau.</li>
                    <li>Tài liệu và bài kiểm tra đều được tính như một thành phần học.</li>
                    <li>Tiến độ đang được chuẩn bị để lưu qua FastAPI bằng route riêng.</li>
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
"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import {
  Award,
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  CircleX,
  FileText,
  Layers3,
  LoaderCircle,
  Menu,
  MessageCircle,
  NotebookPen,
  School,
  Sparkles,
  UserSquare2,
} from "lucide-react";
import { UserAccountMenu } from "../../../components/user-account-menu";
import { NotificationBell } from "../../../components/notification-bell";
import { ShowNavigation } from "../../../lib/app_nav";
import {
  getAdminCourseDetail,
  getAdminCourseStudents,
  type AdminCourseComponent,
  type AdminCourseDetail,
  type AdminCourseModule,
  type AdminCourseStudentStatus,
} from "../../../lib/api_course_admin";
import { reissueCertificate } from "../../../lib/api_certificate";
import { getCourseExtraData, type CourseExtraDataResponse } from "../../../lib/api_course_extra_data";
import { ADMIN_DEFAULT_USER, useAdminSession } from "../../_lib/use-admin-session";
import DiscussionSection from "../../../components/discussion-section";

// ─── Bloom level helpers ───
const BLOOM_LEVELS = [
  { key: "remember", label: "Nhớ", color: "bg-sky-100 text-sky-700" },
  { key: "understand", label: "Hiểu", color: "bg-blue-100 text-blue-700" },
  { key: "apply", label: "Áp dụng", color: "bg-indigo-100 text-indigo-700" },
  { key: "analyze", label: "Phân tích", color: "bg-violet-100 text-violet-700" },
  { key: "evaluate", label: "Đánh giá", color: "bg-amber-100 text-amber-800" },
  { key: "create", label: "Sáng tạo", color: "bg-emerald-100 text-emerald-700" },
] as const;

type BloomMap = Record<string, string[]>;

function parseBloomObjectives(json: string | undefined): BloomMap {
  if (!json) return {};
  try {
    const parsed = JSON.parse(json);
    if (typeof parsed === "object" && parsed !== null) return parsed;
  } catch { /* empty */ }
  return {};
}

function parseContentStructureCount(json: string | undefined): { prerequisites: number; taggedComponents: number; taggedModules: number } {
  if (!json) return { prerequisites: 0, taggedComponents: 0, taggedModules: 0 };
  try {
    const parsed = JSON.parse(json);
    if (typeof parsed !== "object" || parsed === null) return { prerequisites: 0, taggedComponents: 0, taggedModules: 0 };
    const tags: Record<string, string[]> = parsed.taxonomyTags ?? {};
    const prereqs: Record<string, unknown> = parsed.prerequisites ?? {};
    const taggedComponents = Object.keys(tags).filter((k) => k.startsWith("component:") && tags[k]?.length > 0).length;
    const taggedModules = Object.keys(tags).filter((k) => k.startsWith("module:") && tags[k]?.length > 0).length;
    const prerequisites = Object.values(prereqs).filter((v) => v !== null && v !== undefined).length;
    return { prerequisites, taggedComponents, taggedModules };
  } catch {
    return { prerequisites: 0, taggedComponents: 0, taggedModules: 0 };
  }
}

function getComponentTypeLabel(
  componentType: AdminCourseComponent["component_type"],
) {
  return componentType === "exam" ? "Bài kiểm tra" : "Tài liệu";
}

function getComponentIcon(
  componentType: AdminCourseComponent["component_type"],
) {
  return componentType === "exam" ? NotebookPen : FileText;
}

export default function AdminCourseDetailPage() {
  const router = useRouter();
  const params = useParams<{ courseId: string }>();
  const courseId = Number(params.courseId ?? "0");

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [courseDetail, setCourseDetail] = useState<AdminCourseDetail | null>(null);
  const [selectedModuleId, setSelectedModuleId] = useState<number | null>(null);
  const [selectedComponentId, setSelectedComponentId] = useState<number | null>(null);
  const [students, setStudents] = useState<AdminCourseStudentStatus[]>([]);
  const [courseExtraData, setCourseExtraData] = useState<CourseExtraDataResponse | null>(null);
  const [issuingCertFor, setIssuingCertFor] = useState<number | null>(null);
  const [certIssueMessage, setCertIssueMessage] = useState<{ userId: number; message: string; isError: boolean } | null>(null);
  const { currentUser, isCheckingAuth } = useAdminSession();

  useEffect(() => {
    let isMounted = true;

    async function loadCourseDetail() {
      if (!currentUser) {
        return;
      }

      try {
        if (!courseId || Number.isNaN(courseId)) {
          throw new Error("Mã khóa học không hợp lệ.");
        }

        const [detail, studentData, extraData] = await Promise.all([
          getAdminCourseDetail(courseId),
          getAdminCourseStudents(courseId).catch(() => []),
          getCourseExtraData(courseId),
        ]);

        if (!isMounted) {
          return;
        }

        setStudents(studentData);

        const orderedModules = [...detail.modules].sort(
          (left, right) => left.module_sequence - right.module_sequence,
        );
        const firstModule = orderedModules[0] ?? null;
        const firstComponent =
          [...detail.components]
            .sort((left, right) => {
              if (left.module_id !== right.module_id) {
                return left.module_id - right.module_id;
              }

              return left.component_sequence - right.component_sequence;
            })
            .find((component) =>
              firstModule ? component.module_id === firstModule.id : true,
            ) ?? null;

        setCourseDetail(detail);
        setCourseExtraData(extraData);
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
            : "Không thể tải chi tiết khóa học trên hệ thống.",
        );
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadCourseDetail();

    return () => {
      isMounted = false;
    };
  }, [courseId, currentUser]);

  const user = currentUser ?? ADMIN_DEFAULT_USER;

  const modules = useMemo(() => {
    return [...(courseDetail?.modules ?? [])].sort(
      (left, right) => left.module_sequence - right.module_sequence,
    );
  }, [courseDetail?.modules]);

  const components = useMemo(() => {
    const moduleOrder = new Map<number, number>();
    modules.forEach((module) => {
      moduleOrder.set(module.id, module.module_sequence);
    });

    return [...(courseDetail?.components ?? [])].sort((left, right) => {
      const leftOrder = moduleOrder.get(left.module_id) ?? 0;
      const rightOrder = moduleOrder.get(right.module_id) ?? 0;

      if (leftOrder !== rightOrder) {
        return leftOrder - rightOrder;
      }

      return left.component_sequence - right.component_sequence;
    });
  }, [courseDetail?.components, modules]);

  const selectedModule =
    modules.find((module) => module.id === selectedModuleId) ?? modules[0] ?? null;

  const selectedComponent =
    components.find((component) => component.id === selectedComponentId) ?? null;

  const totalDocuments = useMemo(
    () =>
      components.filter((component) => component.component_type === "document").length,
    [components],
  );

  const totalExams = useMemo(
    () => components.filter((component) => component.component_type === "exam").length,
    [components],
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

  function handleSelectModule(module: AdminCourseModule) {
    setSelectedModuleId(module.id);
    const firstComponentOfModule = components.find(
      (component) => component.module_id === module.id,
    );
    setSelectedComponentId(firstComponentOfModule?.id ?? null);
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
            onClick={() => router.push("/admin/courses")}
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
            onClick={() => router.push("/admin")}
          />
          <div>
            <h1 className="text-lg font-semibold">Chi tiết khóa học trên hệ thống</h1>
            <p className="text-sm text-slate-500">
              Xem cấu trúc khóa học, module và thành phần ở chế độ chỉ đọc
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

      <section className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-4 pb-8 pt-24 sm:px-6 lg:px-8">
        {isLoading ? (
          <div className="flex min-h-[55vh] items-center justify-center rounded-[28px] bg-white shadow-sm">
            <div className="flex items-center gap-3 text-slate-600">
              <LoaderCircle className="h-5 w-5 animate-spin" />
              <span>Đang tải chi tiết khóa học...</span>
            </div>
          </div>
        ) : null}

        {!isLoading && errorMessage ? (
          <div className="rounded-3xl border border-red-200 bg-red-50 px-5 py-4 text-red-700">
            {errorMessage}
          </div>
        ) : null}

        {!isLoading && !errorMessage && courseDetail ? (
          <>
            <section className="rounded-[28px] bg-linear-to-r from-sky-700 via-cyan-700 to-emerald-600 px-6 py-7 text-white shadow-xl">
              <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                <div className="max-w-3xl">
                  <p className="text-sm font-medium text-sky-100">Thông tin khóa học</p>
                  <h2 className="mt-2 text-3xl font-semibold">{courseDetail.title}</h2>
                  <p className="mt-3 text-sm leading-6 text-sky-50">
                    {courseDetail.description}
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl bg-white/14 px-4 py-3">
                    <p className="text-sm text-sky-100">Giảng viên</p>
                    <p className="mt-2 text-base font-semibold">
                      {courseDetail.instructor_name}
                    </p>
                    {courseDetail.instructor_email ? (
                      <p className="mt-1 text-xs text-sky-200">
                        {courseDetail.instructor_email}
                      </p>
                    ) : null}
                  </div>
                  <div className="rounded-2xl bg-white/14 px-4 py-3">
                    <p className="text-sm text-sky-100">Phân loại</p>
                    <p className="mt-2 text-base font-semibold">
                      {courseDetail.category_name}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-white/14 px-4 py-3">
                    <p className="text-sm text-sky-100">Học sinh</p>
                    <p className="mt-2 text-base font-semibold">
                      {courseDetail.total_student}
                    </p>
                  </div>
                </div>
              </div>
            </section>

            <section className="grid gap-4 md:grid-cols-4">
              <article className="rounded-3xl bg-white px-5 py-5 shadow-sm ring-1 ring-slate-200">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-slate-500">Số module</p>
                  <Layers3 className="h-5 w-5 text-sky-600" />
                </div>
                <p className="mt-3 text-3xl font-semibold text-slate-900">
                  {modules.length}
                </p>
              </article>

              <article className="rounded-3xl bg-white px-5 py-5 shadow-sm ring-1 ring-slate-200">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-slate-500">Tài liệu</p>
                  <FileText className="h-5 w-5 text-cyan-600" />
                </div>
                <p className="mt-3 text-3xl font-semibold text-slate-900">
                  {totalDocuments}
                </p>
              </article>

              <article className="rounded-3xl bg-white px-5 py-5 shadow-sm ring-1 ring-slate-200">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-slate-500">Bài kiểm tra</p>
                  <NotebookPen className="h-5 w-5 text-emerald-600" />
                </div>
                <p className="mt-3 text-3xl font-semibold text-slate-900">
                  {totalExams}
                </p>
              </article>

              <article className="rounded-3xl bg-white px-5 py-5 shadow-sm ring-1 ring-slate-200">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-slate-500">Mức độ</p>
                  <Sparkles className="h-5 w-5 text-amber-600" />
                </div>
                <p className="mt-3 text-3xl font-semibold text-slate-900">
                  {courseDetail.level}
                </p>
              </article>
            </section>

            <section className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
              <article className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-slate-200">
                <div className="flex items-center justify-between border-b border-slate-200 pb-4">
                  <div>
                    <h3 className="text-xl font-semibold">Cấu trúc khóa học</h3>
                    <p className="mt-1 text-sm text-slate-500">
                      Quản trị viên chỉ xem cấu trúc, không chỉnh sửa tại trang này.
                    </p>
                  </div>
                  <BookOpen className="h-6 w-6 text-sky-600" />
                </div>

                <div className="mt-5 space-y-4">
                  {modules.map((module) => {
                    const moduleComponents = components.filter(
                      (component) => component.module_id === module.id,
                    );

                    return (
                      <section
                        key={module.id}
                        className="rounded-[24px] border border-slate-200 bg-slate-50/70 p-4"
                      >
                        <button
                          type="button"
                          onClick={() => handleSelectModule(module)}
                          className={`w-full rounded-2xl border px-4 py-4 text-left transition-colors ${
                            selectedModule?.id === module.id
                              ? "border-sky-400 bg-sky-50"
                              : "border-slate-200 bg-white hover:border-sky-300"
                          }`}
                        >
                          <p className="text-sm font-semibold text-sky-700">
                            Module {module.module_sequence}
                          </p>
                          <h4 className="mt-1 text-lg font-semibold text-slate-900">
                            {module.title}
                          </h4>
                          <p className="mt-2 text-sm leading-6 text-slate-600">
                            {module.introduction}
                          </p>
                        </button>

                        <div className="mt-4 space-y-3">
                          {moduleComponents.map((component) => {
                            const Icon = getComponentIcon(component.component_type);

                            return (
                              <button
                                key={component.id}
                                type="button"
                                onClick={() => setSelectedComponentId(component.id)}
                                className={`flex w-full items-start gap-4 rounded-2xl border px-4 py-4 text-left transition-colors ${
                                  selectedComponent?.id === component.id
                                    ? "border-sky-400 bg-sky-50"
                                    : "border-slate-200 bg-white hover:border-sky-300"
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
                                        Cho xem trước
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
                      <h3 className="text-xl font-semibold">Thông tin tổng quan</h3>
                      <p className="mt-1 text-sm text-slate-500">
                        Toàn bộ trường ở khu vực này là chỉ đọc.
                      </p>
                    </div>
                    <UserSquare2 className="h-6 w-6 text-sky-600" />
                  </div>

                  <div className="mt-5 space-y-4">
                    <div className="rounded-3xl bg-slate-50 p-5">
                      <p className="text-sm text-slate-500">Giới thiệu ngắn</p>
                      <p className="mt-2 text-sm leading-6 text-slate-700">
                        {courseDetail.introduction}
                      </p>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-2xl border border-slate-200 px-4 py-4">
                        <p className="text-sm text-slate-500">Trạng thái công bố</p>
                        <p className="mt-2 text-base font-semibold text-slate-900">
                          {courseDetail.is_public ? "Đã công bố" : "Chưa công bố"}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-slate-200 px-4 py-4">
                        <p className="text-sm text-slate-500">Trạng thái kích hoạt</p>
                        <p className="mt-2 text-base font-semibold text-slate-900">
                          {courseDetail.is_active ? "Đang kích hoạt" : "Chưa kích hoạt"}
                        </p>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 px-4 py-4">
                      <p className="text-sm text-slate-500">Ảnh khóa học</p>
                      <div className="mt-3 overflow-hidden rounded-2xl ring-1 ring-slate-200">
                        <Image
                          src={courseDetail.image || "/logo.png"}
                          alt={courseDetail.title}
                          width={640}
                          height={360}
                          className="h-52 w-full object-cover"
                        />
                      </div>
                    </div>
                  </div>
                </article>

                {/* Thông tin thêm — compact */}
                {courseExtraData ? (() => {
                  const bloomData = parseBloomObjectives(courseExtraData.bloom_objectives);
                  const structureCount = parseContentStructureCount(courseExtraData.content_structure);
                  const hasBloom = Object.values(bloomData).some((arr) => arr.length > 0);
                  const hasStructure = structureCount.prerequisites > 0 || structureCount.taggedComponents > 0 || structureCount.taggedModules > 0;

                  if (!hasBloom && !hasStructure && !courseExtraData.required_course_id) return null;

                  return (
                    <article className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-slate-200">
                      <div className="mb-4 flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-emerald-600" />
                        <h3 className="text-base font-semibold">Thông tin thêm</h3>
                      </div>

                      <div className="space-y-3 text-sm">
                        {/* Bloom objectives */}
                        {hasBloom ? (
                          <div>
                            <p className="mb-2 text-xs font-medium text-slate-500 uppercase tracking-wide">Mục tiêu Bloom</p>
                            <div className="flex flex-wrap gap-1.5">
                              {BLOOM_LEVELS.map((level) => {
                                const items = bloomData[level.key];
                                if (!items || items.length === 0) return null;
                                return (
                                  <span
                                    key={level.key}
                                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${level.color}`}
                                  >
                                    {level.label}: {items.length}
                                  </span>
                                );
                              })}
                            </div>
                          </div>
                        ) : null}

                        {/* Content structure */}
                        {hasStructure ? (
                          <div className="flex flex-wrap gap-3 border-t border-slate-100 pt-3">
                            {structureCount.taggedModules > 0 ? (
                              <span className="rounded-lg bg-sky-50 px-2.5 py-1 text-xs text-sky-700">
                                {structureCount.taggedModules} module gắn thẻ
                              </span>
                            ) : null}
                            {structureCount.taggedComponents > 0 ? (
                              <span className="rounded-lg bg-violet-50 px-2.5 py-1 text-xs text-violet-700">
                                {structureCount.taggedComponents} thành phần gắn thẻ
                              </span>
                            ) : null}
                            {structureCount.prerequisites > 0 ? (
                              <span className="rounded-lg bg-amber-50 px-2.5 py-1 text-xs text-amber-700">
                                {structureCount.prerequisites} tiên quyết
                              </span>
                            ) : null}
                          </div>
                        ) : null}

                        {/* Prerequisite course */}
                        {courseExtraData.required_course_id ? (
                          <div className="border-t border-slate-100 pt-3 text-xs text-slate-500">
                            📋 Yêu cầu hoàn thành khóa học khác trước khi đăng ký
                          </div>
                        ) : null}
                      </div>
                    </article>
                  );
                })() : null}

                <article className="rounded-[28px] bg-slate-900 px-6 py-6 text-white shadow-sm">
                  <h3 className="text-lg font-semibold">Chi tiết thành phần đang chọn</h3>
                  {selectedComponent ? (
                    <div className="mt-4 space-y-3">
                      <p className="text-sm font-medium text-slate-300">
                        {getComponentTypeLabel(selectedComponent.component_type)}
                      </p>
                      <p className="text-lg font-semibold">{selectedComponent.title}</p>
                      <p className="text-sm leading-6 text-slate-300">
                        {selectedComponent.summary}
                      </p>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="rounded-2xl bg-white/10 px-4 py-3">
                          <p className="text-xs text-slate-300">Mã tham chiếu</p>
                          <p className="mt-1 text-sm font-semibold">
                            {selectedComponent.ref_id ?? "Chưa có"}
                          </p>
                        </div>
                        <div className="rounded-2xl bg-white/10 px-4 py-3">
                          <p className="text-xs text-slate-300">Thời lượng dự kiến</p>
                          <p className="mt-1 text-sm font-semibold">
                            {selectedComponent.estimated_minutes} phút
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="mt-4 text-sm leading-6 text-slate-300">
                      Chọn một thành phần trong danh sách để xem thông tin chi tiết.
                    </p>
                  )}
                </article>

                <article className="rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-slate-200">
                  <div className="flex items-center gap-3">
                    <MessageCircle className="h-6 w-6 text-sky-600" />
                    <div>
                      <h3 className="text-lg font-semibold">Thảo luận khóa học</h3>
                      <p className="mt-1 text-sm text-slate-500">
                        Xem và quản lý các thảo luận về khóa học.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => router.push(`/admin/courses/${courseId}/discussion`)}
                    className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-sky-600 px-4 py-3 text-sm font-semibold text-white hover:bg-sky-700 transition-colors"
                  >
                    <MessageCircle className="h-4 w-4" />
                    <span>Xem thảo luận khóa học</span>
                  </button>
                </article>

                <article className="rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-slate-200">
                  <div className="flex items-center gap-3">
                    <School className="h-6 w-6 text-cyan-600" />
                    <div>
                      <h3 className="text-lg font-semibold">Góc nhìn quản trị</h3>
                      <p className="mt-1 text-sm text-slate-500">
                        Khu vực này phục vụ việc kiểm tra chất lượng và trạng thái khóa học trên toàn hệ thống.
                      </p>
                    </div>
                  </div>
                </article>

                <article className="rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-slate-200">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-4">
                    <div>
                      <h3 className="text-lg font-semibold">Danh sách học sinh</h3>
                      <p className="mt-1 text-sm text-slate-500">
                        {students.length} học sinh đã đăng ký khóa học
                      </p>
                    </div>
                    <Award className="h-6 w-6 text-emerald-600" />
                  </div>

                  <div className="mt-5 max-h-[500px] space-y-3 overflow-y-auto">
                    {students.length === 0 ? (
                      <p className="py-6 text-center text-sm text-slate-400">
                        Chưa có học sinh nào đăng ký khóa học này.
                      </p>
                    ) : (
                      students.map((student) => {
                        const needsCert = student.is_complete && !student.has_certificate;

                        return (
                          <div
                            key={student.user_id}
                            className="rounded-2xl border border-slate-200 px-4 py-4"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <p className="font-semibold text-slate-900">
                                  {student.username}
                                </p>
                                {student.email ? (
                                  <p className="mt-1 text-xs text-slate-500">
                                    {student.email}
                                  </p>
                                ) : null}
                              </div>

                              <div className="flex shrink-0 items-center gap-2">
                                {student.is_complete ? (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700">
                                    <CheckCircle2 className="h-3 w-3" />
                                    Hoàn thành
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-700">
                                    <CircleX className="h-3 w-3" />
                                    Chưa hoàn thành
                                  </span>
                                )}

                                {student.has_certificate ? (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-700">
                                    <Award className="h-3 w-3" />
                                    Đã cấp
                                  </span>
                                ) : null}
                              </div>
                            </div>

                            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                              <span>
                                Module đã hoàn thành:{" "}
                                <strong className="text-slate-700">
                                  {student.module_completed}
                                </strong>
                              </span>
                              {student.final_score !== null ? (
                                <span>
                                  Điểm cuối:{" "}
                                  <strong className="text-slate-700">
                                    {student.final_score}
                                  </strong>
                                </span>
                              ) : null}
                              {student.is_complete && student.completed_at ? (
                                <span>
                                  Hoàn thành lúc:{" "}
                                  <strong className="text-slate-700">
                                    {new Date(student.completed_at).toLocaleDateString(
                                      "vi-VN",
                                    )}
                                  </strong>
                                </span>
                              ) : null}
                            </div>

                            {needsCert ? (
                              <div className="mt-3">
                                <button
                                  type="button"
                                  disabled={issuingCertFor === student.user_id}
                                  onClick={async () => {
                                    setIssuingCertFor(student.user_id);
                                    setCertIssueMessage(null);
                                    try {
                                      const result = await reissueCertificate(
                                        courseId,
                                        student.user_id,
                                      );
                                      setStudents((prev) =>
                                        prev.map((s) =>
                                          s.user_id === student.user_id
                                            ? {
                                                ...s,
                                                has_certificate: true,
                                                certificate_code:
                                                  result.certificate.certificate_code,
                                              }
                                            : s,
                                        ),
                                      );
                                      setCertIssueMessage({
                                        userId: student.user_id,
                                        message: result.message,
                                        isError: false,
                                      });
                                    } catch (error) {
                                      setCertIssueMessage({
                                        userId: student.user_id,
                                        message:
                                          error instanceof Error
                                            ? error.message
                                            : "Không thể cấp chứng chỉ",
                                        isError: true,
                                      });
                                    } finally {
                                      setIssuingCertFor(null);
                                    }
                                  }}
                                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                                    issuingCertFor === student.user_id
                                      ? "bg-slate-200 text-slate-500"
                                      : "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                                  }`}
                                >
                                  {issuingCertFor === student.user_id ? (
                                    <>
                                      <LoaderCircle className="h-3 w-3 animate-spin" />
                                      Đang cấp...
                                    </>
                                  ) : (
                                    <>
                                      <Award className="h-3 w-3" />
                                      Cấp chứng chỉ
                                    </>
                                  )}
                                </button>
                              </div>
                            ) : null}

                            {certIssueMessage &&
                              certIssueMessage.userId === student.user_id && (
                                <p
                                  className={`mt-2 text-xs ${
                                    certIssueMessage.isError
                                      ? "text-red-600"
                                      : "text-emerald-600"
                                  }`}
                                >
                                  {certIssueMessage.message}
                                </p>
                              )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </article>
              </aside>
            </section>
          </>
        ) : null}

        {!isLoading && selectedComponent ? (
          <DiscussionSection
            courseComponentId={selectedComponent.id}
            currentUser={user}
          />
        ) : null}
      </section>
    </main>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  BarChart3,
  BookMarked,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Eye,
  EyeOff,
  FileImage,
  FileText,
  Layers3,
  LoaderCircle,
  Menu,
  MessageCircle,
  NotebookPen,
  Pencil,
  Save,
  School,
  Sparkles,
} from "lucide-react";
import { UserAccountMenu } from "../../../components/user-account-menu";
import { NotificationBell } from "../../../components/notification-bell";
import { ShowNavigation } from "../../../lib/app_nav";
import { useInstructorSession } from "../../_lib/use-instructor-session";
import {
  fetchCourseProgressStats,
  getInstructorCourseDetail,
  deleteOldInstructorCourseImage,
  shouldDeleteUploadedCourseImage,
  uploadInstructorCourseImage,
  updateInstructorCourse,
  validateCourseImageFile,
  validateInstructorCourseUpdate,
  type CourseProgressStats,
  type InstructorCourseComponent,
  type InstructorCourseDetail,
  type InstructorCourseModule,
  type InstructorCourseUpdateInput,
} from "../../../lib/api_course_instructor";
import { getCourseExtraData, type CourseExtraDataResponse } from "../../../lib/api_course_extra_data";
import CourseSurveySection from "./_course-survey";
import ProgressChart from "./_progress-chart";
import type { User } from "../../../lib/api_user";

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

type TaxonomyTagMap = Record<string, string[]>;

function parseBloomObjectives(json: string | undefined): BloomMap {
  if (!json) return {};
  try {
    const parsed = JSON.parse(json);
    if (typeof parsed === "object" && parsed !== null) return parsed;
  } catch { /* empty */ }
  return {};
}

function parseTaxonomyTags(json: string | undefined): TaxonomyTagMap {
  if (!json) return {};
  try {
    const parsed = JSON.parse(json);
    if (typeof parsed !== "object" || parsed === null) return {};
    return parsed.taxonomyTags ?? {};
  } catch {
    return {};
  }
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

const initialUser: User = {
  id: 7,
  username: "Giảng viên",
  email: "giao_vien@example.com",
  icon: "/icon.png",
  role: "instructor",
};

type CourseEditFormState = {
  image: string;
  isActive: boolean;
  isPublic: boolean;
};

function getComponentTypeLabel(
  componentType: InstructorCourseComponent["component_type"],
) {
  switch (componentType) {
    case "exam":
      return "Bài kiểm tra";
    case "assignment":
      return "Bài tập";
    default:
      return "Tài liệu";
  }
}

function getComponentIcon(
  componentType: InstructorCourseComponent["component_type"],
) {
  switch (componentType) {
    case "exam":
      return NotebookPen;
    case "assignment":
      return ClipboardList;
    default:
      return FileText;
  }
}

function buildEditForm(course: InstructorCourseDetail): CourseEditFormState {
  return {
    image: course.image,
    isActive: course.is_active,
    isPublic: course.is_public,
  };
}

export default function InstructorCourseDetailPage() {
  const router = useRouter();
  const params = useParams<{ courseId: string }>();
  const courseId = Number(params.courseId ?? "0");

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const { currentUser, isCheckingAuth } = useInstructorSession();
  const [courseDetail, setCourseDetail] = useState<InstructorCourseDetail | null>(null);
  const [selectedModuleId, setSelectedModuleId] = useState<number | null>(null);
  const [selectedComponentId, setSelectedComponentId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<CourseEditFormState | null>(null);
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [previewImageUrl, setPreviewImageUrl] = useState("/logo.png");
  const [courseStats, setCourseStats] = useState<CourseProgressStats | null>(null);
  const [courseExtraData, setCourseExtraData] = useState<CourseExtraDataResponse | null>(null);

  // Parse taxonomy tags from content structure
  const taxonomyTags = useMemo<TaxonomyTagMap>(() => {
    return parseTaxonomyTags(courseExtraData?.content_structure);
  }, [courseExtraData?.content_structure]);

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

        const [detail, stats, extraData] = await Promise.all([
          getInstructorCourseDetail(courseId),
          fetchCourseProgressStats(courseId),
          getCourseExtraData(courseId),
        ]);

        if (!isMounted) {
          return;
        }

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
        setEditForm(buildEditForm(detail));
        setCourseStats(stats);
        setCourseExtraData(extraData);
        setSelectedImageFile(null);
        setPreviewImageUrl(detail.image || "/logo.png");
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
            : "Không thể tải chi tiết khóa học của giảng viên.",
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

  const user = currentUser ?? initialUser;

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

  function handleSelectModule(module: InstructorCourseModule) {
    setSelectedModuleId(module.id);
    const firstComponentOfModule = components.find(
      (component) => component.module_id === module.id,
    );
    setSelectedComponentId(firstComponentOfModule?.id ?? null);
  }

  function updateEditForm<K extends keyof CourseEditFormState>(
    key: K,
    value: CourseEditFormState[K],
  ) {
    setEditForm((currentForm) =>
      currentForm
        ? {
            ...currentForm,
            [key]: value,
          }
        : currentForm,
    );
  }

  async function handleSaveCourseSettings() {
    if (!courseDetail || !editForm) {
      return;
    }

    if (selectedImageFile) {
      const imageValidationMessage = validateCourseImageFile(selectedImageFile.name);
      if (imageValidationMessage) {
        setErrorMessage(imageValidationMessage);
        return;
      }
    }

    const payload: InstructorCourseUpdateInput = {
      title: courseDetail.title,
      category_id: courseDetail.category_id,
      instructor_id: courseDetail.instructor_id,
      introduction: courseDetail.introduction,
      description: courseDetail.description,
      level: courseDetail.level,
      total_module: courseDetail.total_module,
      total_student: courseDetail.total_student,
      image: editForm.image.trim(),
      is_active: editForm.isActive,
      is_public: editForm.isPublic,
    };

    const validationMessage = validateInstructorCourseUpdate(payload);
    if (validationMessage) {
      setErrorMessage(validationMessage);
      return;
    }

    setIsSaving(true);
    setErrorMessage("");

    try {
      let nextImageUrl = editForm.image.trim();
      let oldImageUrlToDelete: string | null = null;

      if (selectedImageFile) {
        const uploadedImage = await uploadInstructorCourseImage(selectedImageFile);
        nextImageUrl = uploadedImage.file_url;

        if (
          courseDetail.image !== nextImageUrl &&
          shouldDeleteUploadedCourseImage(courseDetail.image)
        ) {
          oldImageUrlToDelete = courseDetail.image;
        }
      }

      const savedCourse = await updateInstructorCourse(courseDetail.id, {
        ...payload,
        image: nextImageUrl,
      });

      if (oldImageUrlToDelete) {
        await deleteOldInstructorCourseImage(oldImageUrlToDelete);
      }

      setCourseDetail((currentDetail) =>
        currentDetail
          ? {
              ...currentDetail,
              ...savedCourse,
              image: savedCourse.image,
              is_active: savedCourse.is_active,
              is_public: savedCourse.is_public,
              updated_at_text: "Vừa cập nhật xong",
            }
          : currentDetail,
      );
      setEditForm((currentForm) =>
        currentForm
          ? {
              ...currentForm,
              image: savedCourse.image,
            }
          : currentForm,
      );
      setSelectedImageFile(null);
      setPreviewImageUrl(savedCourse.image || "/logo.png");
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Không thể lưu thay đổi của khóa học.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  useEffect(() => {
    if (!selectedImageFile) {
      setPreviewImageUrl(editForm?.image || "/logo.png");
      return;
    }

    const objectUrl = URL.createObjectURL(selectedImageFile);
    setPreviewImageUrl(objectUrl);
    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [editForm?.image, selectedImageFile]);

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
            className="rounded-xl p-2 text-slate-700 hover:bg-slate-100"
            onClick={() => setIsSidebarOpen(true)}
            aria-label="Mở thanh điều hướng"
          >
            <Menu className="h-5 w-5" />
          </button>
          <button
            type="button"
            className="rounded-xl p-2 text-slate-700 hover:bg-slate-100"
            onClick={() => router.push("/instructor/courses")}
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
            onClick={() => router.push("/instructor")}
          />
          <div>
            <h1 className="text-lg font-semibold">Chi tiết khóa học của giảng viên</h1>
            <p className="text-sm text-slate-500">
              Xem cấu trúc khóa học, module và quản lý trạng thái công bố
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
              <span>Đang tải chi tiết khóa học...</span>
            </div>
          </div>
        ) : null}

        {!isLoading && errorMessage ? (
          <div className="rounded-3xl border border-red-200 bg-red-50 px-5 py-4 text-red-700">
            {errorMessage}
          </div>
        ) : null}

        {!isLoading && !errorMessage && courseDetail && editForm ? (
          <>
            <section className="overflow-hidden rounded-4xl bg-linear-to-r from-cyan-700 via-sky-700 to-indigo-800 text-white shadow-xl">
              <div className="grid gap-0 lg:grid-cols-[1.15fr_0.85fr]">
                <div className="px-6 py-7">
                  <p className="text-sm font-medium text-sky-100">
                    Chi tiết khóa học giảng dạy
                  </p>
                  <h2 className="mt-2 text-3xl font-semibold">
                    {courseDetail.title}
                  </h2>
                  <p className="mt-3 max-w-3xl text-sm leading-6 text-sky-50">
                    {courseDetail.description}
                  </p>

                  <div className="mt-6 grid gap-3 sm:grid-cols-4">
                    <div className="rounded-2xl bg-white/14 px-4 py-3">
                      <p className="text-sm text-sky-100">Phân loại</p>
                      <p className="mt-2 text-base font-semibold">
                        {courseDetail.category_name}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-white/14 px-4 py-3">
                      <p className="text-sm text-sky-100">Trình độ</p>
                      <p className="mt-2 text-base font-semibold">
                        {courseDetail.level}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-white/14 px-4 py-3">
                      <p className="text-sm text-sky-100">Số module</p>
                      <p className="mt-2 text-base font-semibold">{modules.length}</p>
                    </div>
                    <div className="rounded-2xl bg-white/14 px-4 py-3">
                      <p className="text-sm text-sky-100">Sinh viên</p>
                      <p className="mt-2 text-base font-semibold">
                        {courseDetail.total_student}
                      </p>
                    </div>
                  </div>

                  <div className="mt-6 flex flex-wrap gap-3">
                    <span
                      className={`rounded-full px-3 py-1 text-sm font-medium ${
                        courseDetail.is_active
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-slate-200 text-slate-800"
                      }`}
                    >
                      {courseDetail.is_active ? "Đang kích hoạt" : "Chưa kích hoạt"}
                    </span>
                    <span
                      className={`rounded-full px-3 py-1 text-sm font-medium ${
                        courseDetail.is_public
                          ? "bg-amber-100 text-amber-900"
                          : "bg-slate-200 text-slate-800"
                      }`}
                    >
                      {courseDetail.is_public
                        ? "Đã công bố cho sinh viên"
                        : "Đang ẩn khỏi danh sách công khai"}
                    </span>
                    <span className="rounded-full bg-white/14 px-3 py-1 text-sm font-medium text-white">
                      {courseDetail.updated_at_text}
                    </span>
                    {courseDetail.instructor_name ? (
                      <span className="rounded-full bg-white/14 px-3 py-1 text-sm font-medium text-white">
                        {courseDetail.instructor_name}
                      </span>
                    ) : null}
                    {courseDetail.instructor_email ? (
                      <span className="rounded-full bg-white/14 px-3 py-1 text-sm font-medium text-sky-200">
                        {courseDetail.instructor_email}
                      </span>
                    ) : null}
                  </div>
                </div>

                <div className="relative min-h-65 bg-slate-950/15">
                  <Image
                    src={previewImageUrl || "/logo.png"}
                    alt={courseDetail.title}
                    fill
                    className="object-cover"
                  />
                  <div className="absolute inset-0 bg-linear-to-t from-slate-950/70 via-slate-950/20 to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-6">
                    <p className="text-sm font-medium text-sky-100">
                      Hình đại diện hiện tại
                    </p>
                    <p className="mt-2 text-lg font-semibold">
                      {courseDetail.introduction}
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
                  {modules.length}
                </p>
                <p className="mt-2 text-sm text-slate-600">
                  Toàn bộ các chặng học tập đang được bố trí trong khóa học này.
                </p>
              </article>

              <article className="rounded-3xl bg-white px-5 py-5 shadow-sm ring-1 ring-slate-200">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-slate-500">Tài liệu</p>
                  <BookOpen className="h-5 w-5 text-cyan-600" />
                </div>
                <p className="mt-3 text-3xl font-semibold text-slate-900">
                  {totalDocuments}
                </p>
                <p className="mt-2 text-sm text-slate-600">
                  Số thành phần học tập dạng tài liệu trong toàn khóa.
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
                <p className="mt-2 text-sm text-slate-600">
                  Số thành phần đánh giá đang gắn với khóa học này.
                </p>
              </article>

              <article className="rounded-3xl bg-white px-5 py-5 shadow-sm ring-1 ring-slate-200">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-slate-500">Hoàn thành khóa học</p>
                  <School className="h-5 w-5 text-emerald-600" />
                </div>
                <p className="mt-3 text-3xl font-semibold text-slate-900">
                  {courseStats
                    ? `${courseStats.completed_course}/${courseStats.total_enrolled}`
                    : "—"}
                </p>
                <p className="mt-2 text-sm text-slate-600">
                  {courseStats && courseStats.total_enrolled > 0
                    ? `${Math.round(
                        (courseStats.completed_course / courseStats.total_enrolled) * 100,
                      )}% sinh viên đã hoàn thành toàn bộ khóa học.`
                    : "Chưa có sinh viên nào tham gia khóa học này."}
                </p>
              </article>

              <article className="rounded-3xl bg-white px-5 py-5 shadow-sm ring-1 ring-slate-200">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-slate-500">Chế độ hiển thị</p>
                  {courseDetail.is_public ? (
                    <Eye className="h-5 w-5 text-amber-600" />
                  ) : (
                    <EyeOff className="h-5 w-5 text-slate-600" />
                  )}
                </div>
                <p className="mt-3 text-3xl font-semibold text-slate-900">
                  {courseDetail.is_public ? "Công khai" : "Đang ẩn"}
                </p>
                <p className="mt-2 text-sm text-slate-600">
                  Bạn có thể đổi nhanh ở khung quản lý bên phải.
                </p>
              </article>
            </section>

            {/* Progress chart section */}
            {courseStats ? (
              <ProgressChart
                stats={courseStats}
                modules={modules}
                components={components}
              />
            ) : null}

            <section className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
              <article className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-slate-200">
                <div className="flex items-center justify-between border-b border-slate-200 pb-4">
                  <div>
                    <h3 className="text-xl font-semibold">Cấu trúc khóa học</h3>
                    <p className="mt-1 text-sm text-slate-500">
                      Xem chi tiết từng module và toàn bộ thành phần học tập đang thuộc
                      khóa học này.
                    </p>
                  </div>
                  <School className="h-6 w-6 text-sky-600" />
                </div>

                <div className="mt-5 space-y-4">
                  {modules.length === 0 ? (
                    <article className="rounded-3xl border border-dashed border-sky-200 bg-sky-50/80 px-5 py-6 text-slate-700">
                      <h4 className="text-base font-semibold text-slate-900">
                        Chưa có module nào trong khóa học
                      </h4>
                      <p className="mt-2 text-sm leading-6 text-slate-600">
                        Khóa học này đã có thông tin cơ bản nhưng chưa được bổ sung
                        cấu trúc học tập. Bạn vẫn có thể cập nhật nội dung tổng quan
                        và quay lại thêm module sau.
                      </p>
                    </article>
                  ) : (
                    modules.map((module) => {
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
                            {/* Bloom tags for module */}
                            {(() => {
                              const moduleKey = `module:${module.id}`;
                              const moduleTags = taxonomyTags[moduleKey] ?? [];
                              if (moduleTags.length === 0) return null;
                              return (
                                <div className="mt-2 flex flex-wrap gap-1">
                                  {moduleTags.map((levelKey) => {
                                    const level = BLOOM_LEVELS.find((l) => l.key === levelKey);
                                    if (!level) return null;
                                    return (
                                      <span
                                        key={levelKey}
                                        className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${level.color}`}
                                      >
                                        {level.label}
                                      </span>
                                    );
                                  })}
                                </div>
                              );
                            })()}
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

                        <div className="mt-4 grid gap-3 sm:grid-cols-4">
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
                            <p className="text-xs text-slate-500">Sinh viên hoàn thành</p>
                            <p className="mt-1 text-base font-semibold text-slate-900">
                              {courseStats && courseStats.total_enrolled > 0
                                ? `${courseStats.module_completion_counts.find(
                                    (m) => m.module_id === module.id,
                                  )?.completed_count ?? 0}/${courseStats.total_enrolled}`
                                : "—"}
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
                          {items.length === 0 ? (
                            <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-4 text-sm text-slate-600">
                              Module này chưa có tài liệu hoặc bài kiểm tra nào.
                            </div>
                          ) : (
                            items.map((component) => {
                              const Icon = getComponentIcon(component.component_type);
                              const isSelectedComponent =
                                selectedComponentId === component.id;

                              const componentCompleted =
                                courseStats?.component_completion_counts.find(
                                  (c) => c.component_id === component.id,
                                )?.completed_count ?? null;

                              const examStat =
                                component.component_type === "exam" &&
                                component.ref_id
                                  ? courseStats?.exam_result_stats.find(
                                      (e) => e.exam_id === component.ref_id,
                                    ) ?? null
                                  : null;

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
                                          Cho xem trước
                                        </span>
                                      ) : null}
                                      {courseStats && courseStats.total_enrolled > 0 ? (
                                        <span className="rounded-full bg-violet-100 px-2.5 py-1 text-xs font-medium text-violet-700">
                                          {componentCompleted ?? 0}/{courseStats.total_enrolled} HS
                                        </span>
                                      ) : null}
                                      {examStat && examStat.total_attempts > 0 ? (
                                        <span className="rounded-full bg-orange-100 px-2.5 py-1 text-xs font-medium text-orange-700">
                                          {examStat.average_score.toFixed(1)} ★
                                        </span>
                                      ) : null}
                                      {/* Bloom tags for component */}
                                      {(() => {
                                        const compKey = `component:${component.id}`;
                                        const compTags = taxonomyTags[compKey] ?? [];
                                        if (compTags.length === 0) return null;
                                        return compTags.map((levelKey) => {
                                          const level = BLOOM_LEVELS.find((l) => l.key === levelKey);
                                          if (!level) return null;
                                          return (
                                            <span
                                              key={levelKey}
                                              className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${level.color}`}
                                            >
                                              {level.label}
                                            </span>
                                          );
                                        });
                                      })()}
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
                            })
                          )}
                        </div>
                      </section>
                    );
                  })
                  )}
                </div>
              </article>

              <aside className="space-y-6">
                {/* Discussion section */}
                <article className="rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-slate-200">
                  <div className="flex items-center gap-3">
                    <MessageCircle className="h-6 w-6 text-sky-600" />
                    <div>
                      <h3 className="text-lg font-semibold">Thảo luận khóa học</h3>
                      <p className="mt-1 text-sm text-slate-500">
                        Xem và phản hồi các câu hỏi, thảo luận của sinh viên về khóa học.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => router.push(`/instructor/courses/${courseId}/discussion`)}
                    className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-sky-600 px-4 py-3 text-sm font-semibold text-white hover:bg-sky-700 transition-colors"
                  >
                    <MessageCircle className="h-4 w-4" />
                    <span>Xem thảo luận khóa học</span>
                  </button>
                </article>

                {/* Survey section */}
                <article className="rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-slate-200">
                  <CourseSurveySection courseId={courseId} />
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

                        {/* Quản lý Bloom button */}
                        <div className="border-t border-slate-100 pt-3">
                          <button
                            type="button"
                            onClick={() => router.push(`/instructor/courses/${courseId}/update`)}
                            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-sky-50 px-4 py-2.5 text-xs font-medium text-sky-700 transition-colors hover:bg-sky-100"
                          >
                            <BookMarked className="h-4 w-4" />
                            <span>Quản lý mục tiêu Bloom</span>
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })() : null}

                {/* Trạng thái khóa học — compact */}
                <article className="rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-slate-200">
                  <div className="mb-5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100">
                        <Sparkles className="h-5 w-5 text-amber-600" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold">Trạng thái khóa học</h3>
                        <p className="text-sm text-slate-500">
                          Bật/tắt kích hoạt, công bố và hình nền
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-medium ${
                          editForm.isActive
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-slate-200 text-slate-800"
                        }`}
                      >
                        {editForm.isActive ? "Đang kích hoạt" : "Chưa kích hoạt"}
                      </span>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-medium ${
                          editForm.isPublic
                            ? "bg-amber-100 text-amber-900"
                            : "bg-slate-200 text-slate-800"
                        }`}
                      >
                        {editForm.isPublic ? "Đã công bố" : "Đang ẩn"}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <label className="flex cursor-pointer items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 transition-colors hover:bg-slate-100">
                      <div>
                        <p className="text-sm font-medium text-slate-900">
                          Kích hoạt khóa học
                        </p>
                        <p className="text-xs text-slate-500">
                          Cho phép khóa học hoạt động
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        checked={editForm.isActive}
                        onChange={(event) =>
                          updateEditForm("isActive", event.target.checked)
                        }
                        className="h-5 w-5 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                      />
                    </label>

                    <label className="flex cursor-pointer items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 transition-colors hover:bg-slate-100">
                      <div>
                        <p className="text-sm font-medium text-slate-900">
                          Công bố cho sinh viên
                        </p>
                        <p className="text-xs text-slate-500">
                          Hiển thị trong danh sách khóa học công khai
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        checked={editForm.isPublic}
                        onChange={(event) =>
                          updateEditForm("isPublic", event.target.checked)
                        }
                        className="h-5 w-5 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                      />
                    </label>

                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="relative mb-3 h-40 w-full overflow-hidden rounded-xl bg-slate-200">
                        <Image
                          src={previewImageUrl || "/logo.png"}
                          alt="Hình đại diện"
                          fill
                          className="object-cover"
                        />
                      </div>
                      <label className="block">
                        <span className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-700">
                          <FileImage className="h-4 w-4" />
                          Thay đổi hình đại diện
                        </span>
                        <input
                          type="file"
                          accept=".png,.jpg,.jpeg,.webp"
                          onChange={(event) =>
                            setSelectedImageFile(event.target.files?.[0] ?? null)
                          }
                          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-sky-400"
                        />
                      </label>
                      {selectedImageFile && (
                        <p className="mt-2 text-sm text-sky-700">
                          Đã chọn: {selectedImageFile.name}
                        </p>
                      )}
                    </div>

                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={handleSaveCourseSettings}
                        disabled={isSaving}
                        className={`flex-1 inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold text-white transition-colors ${
                          isSaving
                            ? "cursor-not-allowed bg-slate-400"
                            : "bg-sky-600 hover:bg-sky-700"
                        }`}
                      >
                        {isSaving ? (
                          <LoaderCircle className="h-4 w-4 animate-spin" />
                        ) : (
                          <Save className="h-4 w-4" />
                        )}
                        <span>{isSaving ? "Đang lưu..." : "Lưu thay đổi"}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          router.push(
                            `/instructor/courses/${courseId}/update`,
                          )
                        }
                        className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                      >
                        <Pencil className="h-4 w-4" />
                        <span>Chỉnh sửa</span>
                      </button>
                    </div>
                  </div>
                </article>

                <article className="rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-slate-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xl font-semibold">Chi tiết thành phần</h3>
                      <p className="mt-1 text-sm text-slate-500">
                        Xem nhanh nội dung, loại thành phần và đường đi quản lý liên quan.
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

                      {selectedComponent.component_type === "exam" &&
                      selectedComponent.ref_id ?
                        (() => {
                          const examStat = courseStats?.exam_result_stats.find(
                            (e) => e.exam_id === selectedComponent.ref_id,
                          ) ?? null;

                          if (!examStat || examStat.total_attempts === 0) {
                            return (
                              <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-4 text-sm text-slate-500">
                                Chưa có dữ liệu kết quả bài kiểm tra từ sinh viên.
                              </div>
                            );
                          }

                          const passRate = Math.round(
                            (examStat.pass_count / examStat.total_attempts) * 100,
                          );

                          return (
                            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 px-4 py-4">
                              <p className="text-sm font-semibold text-emerald-800">
                                Thống kê bài kiểm tra
                              </p>
                              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                                <div>
                                  <p className="text-xs text-emerald-600">
                                    Điểm trung bình
                                  </p>
                                  <p className="mt-1 text-lg font-semibold text-slate-900">
                                    {examStat.average_score.toFixed(1)}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-xs text-emerald-600">
                                    Tỉ lệ đạt
                                  </p>
                                  <p className="mt-1 text-lg font-semibold text-slate-900">
                                    {passRate}%
                                  </p>
                                </div>
                                <div>
                                  <p className="text-xs text-emerald-600">
                                    Lượt làm
                                  </p>
                                  <p className="mt-1 text-lg font-semibold text-slate-900">
                                    {examStat.pass_count}/{examStat.total_attempts}
                                  </p>
                                </div>
                              </div>
                              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-emerald-200">
                                <div
                                  className={`h-full rounded-full ${
                                    passRate >= 80
                                      ? "bg-emerald-500"
                                      : passRate >= 50
                                        ? "bg-amber-500"
                                        : "bg-red-500"
                                  }`}
                                  style={{ width: `${passRate}%` }}
                                />
                              </div>
                            </div>
                          );
                        })()
                      : null}

                      <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-4 text-sm leading-6 text-slate-600">
                        {selectedComponent.component_type === "exam"
                          ? "Bài kiểm tra này có thể tiếp tục được quản lý câu hỏi và lựa chọn ở trang chi tiết bài kiểm tra của giảng viên."
                          : selectedComponent.component_type === "assignment"
                            ? "Bài tập này có thể được chấm điểm và phản hồi ở trang chấm bài tập của giảng viên."
                            : "Thành phần tài liệu hiện đang hiển thị ở mức mô tả. Bạn có thể quản lý sâu hơn ở khu vực tài liệu của giảng viên."}
                      </div>

                      {selectedComponent.component_type === "exam" &&
                      selectedComponent.ref_id ? (
                        <Link
                          href={`/instructor/exam/${selectedComponent.ref_id}`}
                          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-sky-600 px-4 py-3 text-sm font-semibold text-white hover:bg-sky-700"
                        >
                          <NotebookPen className="h-4 w-4" />
                          <span>Mở trang chi tiết bài kiểm tra</span>
                        </Link>
                      ) : selectedComponent.component_type === "assignment" &&
                      selectedComponent.ref_id ? (
                        <Link
                          href={`/instructor/assignment/${selectedComponent.ref_id}`}
                          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white hover:bg-violet-700"
                        >
                          <ClipboardList className="h-4 w-4" />
                          <span>Mở trang chấm bài tập</span>
                        </Link>
                      ) : (
                        <Link
                          href="/instructor/document"
                          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800"
                        >
                          <BookOpen className="h-4 w-4" />
                          <span>Mở khu vực tài liệu của giảng viên</span>
                        </Link>
                      )}
                    </div>
                  ) : (
                    <div className="mt-5 rounded-2xl border border-slate-200 px-4 py-5 text-sm text-slate-600">
                      Chọn một thành phần ở cột bên trái để xem chi tiết.
                    </div>
                  )}
                </article>
              </aside>
            </section>
          </>
        ) : null}
      </section>
    </main>
  );
}

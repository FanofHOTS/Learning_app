"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import {
  BookOpen,
  Calendar,
  ChevronLeft,
  FileImage,
  LoaderCircle,
  Menu,
  Save,
  Sparkles,
} from "lucide-react";
import { UserAccountMenu } from "../../../../components/user-account-menu";
import { NotificationBell } from "../../../../components/notification-bell";
import { ShowNavigation } from "../../../../lib/app_nav";
import { useInstructorSession } from "../../../_lib/use-instructor-session";
import {
  getInstructorCourseDetail,
  updateInstructorCourse,
  getInstructorCourseCategories,
  validateInstructorCourseUpdate,
  uploadInstructorCourseImage,
  deleteOldInstructorCourseImage,
  shouldDeleteUploadedCourseImage,
  validateCourseImageFile,
  getInstructorPrerequisiteCourses,
  type InstructorCourseUpdateInput,
  type InstructorCourseDetail,
  type CourseCategoryOption,
} from "../../../../lib/api_course_instructor";
import {
  getCourseExtraData,
  updateCourseExtraData,
  createCourseExtraData,
  listCourseExtraData,
  type CourseExtraDataResponse,
} from "../../../../lib/api_course_extra_data";
import type { FastAPICourse } from "../../../../lib/api_course";
import type { User } from "../../../../lib/api_user";
import BloomObjectives from "../_bloom-objectives";
import BloomGapAlert from "../_bloom-gap-alert";
import AssessmentMatrix from "../_assessment-matrix";
import ContentStructure from "../_content-structure";
import { mergeMatrixIntoStructure, mergeStructureIntoMatrix } from "../_bloom-sync";
import type { InstructorCourseComponent } from "../../../../lib/api_course_instructor";

const initialUser: User = {
  id: 7,
  username: "Giảng viên",
  email: "giao_vien@example.com",
  icon: "/icon.png",
  role: "instructor",
};

type CourseFormState = {
  title: string;
  introduction: string;
  description: string;
  category_id: number;
  level: string;
  total_student: number;
  image: string;
};

export default function InstructorCourseUpdatePage() {
  const router = useRouter();
  const params = useParams<{ courseId: string }>();
  const courseId = Number(params.courseId ?? "0");

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingExtraData, setIsSavingExtraData] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const { currentUser, isCheckingAuth } = useInstructorSession();

  const [courseDetail, setCourseDetail] = useState<InstructorCourseDetail | null>(null);
  const [categories, setCategories] = useState<CourseCategoryOption[]>([]);
  const [courseExtraData, setCourseExtraData] = useState<CourseExtraDataResponse | null>(null);
  const [prerequisiteCourses, setPrerequisiteCourses] = useState<FastAPICourse[]>([]);
  const [requiredCourseMap, setRequiredCourseMap] = useState<Map<number, number | null>>(new Map());

  // Form state for basic info
  const [form, setForm] = useState<CourseFormState | null>(null);
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [previewImageUrl, setPreviewImageUrl] = useState("/logo.png");

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      if (!currentUser) return;
      try {
        if (!courseId || Number.isNaN(courseId)) {
          throw new Error("Mã khóa học không hợp lệ.");
        }

        const [detail, cats, extraData, prereqs, allExtraData] = await Promise.all([
          getInstructorCourseDetail(courseId),
          getInstructorCourseCategories(),
          getCourseExtraData(courseId),
          getInstructorPrerequisiteCourses(currentUser.id),
          listCourseExtraData(),
        ]);

        if (!isMounted) return;

        setCourseDetail(detail);
        setCategories(cats);
        setCourseExtraData(extraData);
        setPrerequisiteCourses(prereqs);
        setForm({
          title: detail.title,
          introduction: detail.introduction,
          description: detail.description,
          category_id: detail.category_id,
          level: detail.level,
          total_student: detail.total_student,
          image: detail.image,
        });
        setPreviewImageUrl(detail.image || "/logo.png");

        // Prerequisite chain map for cycle detection
        const prereqMap = new Map<number, number | null>();
        for (const ed of allExtraData) {
          prereqMap.set(ed.course_id, ed.required_course_id);
        }
        setRequiredCourseMap(prereqMap);

        setErrorMessage("");
      } catch (error) {
        if (!isMounted) return;
        setErrorMessage(
          error instanceof Error ? error.message : "Không thể tải dữ liệu khóa học.",
        );
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadData();
    return () => { isMounted = false; };
  }, [courseId, currentUser]);

  // Image preview
  useEffect(() => {
    if (!selectedImageFile) {
      setPreviewImageUrl(form?.image || "/logo.png");
      return;
    }
    const objectUrl = URL.createObjectURL(selectedImageFile);
    setPreviewImageUrl(objectUrl);
    return () => { URL.revokeObjectURL(objectUrl); };
  }, [form?.image, selectedImageFile]);

  const user = currentUser ?? initialUser;

  const components = useMemo(() => {
    return [...(courseDetail?.components ?? [])].sort((left, right) => {
      if (left.module_id !== right.module_id) return left.module_id - right.module_id;
      return left.component_sequence - right.component_sequence;
    });
  }, [courseDetail?.components]);

  const modules = useMemo(() => {
    return [...(courseDetail?.modules ?? [])].sort(
      (left, right) => left.module_sequence - right.module_sequence,
    );
  }, [courseDetail?.modules]);

  const updateForm = useCallback(<K extends keyof CourseFormState>(
    key: K,
    value: CourseFormState[K],
  ) => {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  }, []);

  async function handleSaveBasicInfo() {
    if (!courseDetail || !form) return;

    if (selectedImageFile) {
      const msg = validateCourseImageFile(selectedImageFile.name);
      if (msg) { setErrorMessage(msg); return; }
    }

    const payload: InstructorCourseUpdateInput = {
      title: form.title,
      category_id: form.category_id,
      instructor_id: courseDetail.instructor_id,
      introduction: form.introduction,
      description: form.description,
      level: form.level,
      total_module: courseDetail.total_module,
      total_student: form.total_student,
      image: form.image.trim(),
      is_active: courseDetail.is_active,
      is_public: courseDetail.is_public,
    };

    const validationMsg = validateInstructorCourseUpdate(payload);
    if (validationMsg) { setErrorMessage(validationMsg); return; }

    setIsSaving(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      let nextImageUrl = form.image.trim();
      let oldImageUrlToDelete: string | null = null;

      if (selectedImageFile) {
        const uploaded = await uploadInstructorCourseImage(selectedImageFile);
        nextImageUrl = uploaded.file_url;
        if (courseDetail.image !== nextImageUrl && shouldDeleteUploadedCourseImage(courseDetail.image)) {
          oldImageUrlToDelete = courseDetail.image;
        }
      }

      const saved = await updateInstructorCourse(courseDetail.id, { ...payload, image: nextImageUrl });
      if (oldImageUrlToDelete) await deleteOldInstructorCourseImage(oldImageUrlToDelete);

      setCourseDetail((prev) =>
        prev ? { ...prev, ...saved, image: saved.image, updated_at_text: "Vừa cập nhật xong" } : prev,
      );
      setForm((prev) => (prev ? { ...prev, image: saved.image } : prev));
      setSelectedImageFile(null);
      setPreviewImageUrl(saved.image || "/logo.png");
      setSuccessMessage("✅ Thông tin cơ bản đã được lưu.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Không thể lưu thông tin khóa học.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSaveExtraData() {
    if (!courseExtraData) return;
    setIsSavingExtraData(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      // Cycle detection for prerequisite
      const newRequiredId = courseExtraData.required_course_id;
      if (newRequiredId && newRequiredId > 0) {
        let current: number | null = newRequiredId;
        const visited = new Set<number>();
        while (current !== null && current > 0) {
          if (current === courseId) {
            throw new Error("Không thể chọn khóa học yêu cầu trước tạo thành vòng lặp (A→B→A).");
          }
          if (visited.has(current)) {
            throw new Error("Phát hiện vòng lặp trong chuỗi khóa học yêu cầu trước.");
          }
          visited.add(current);
          current = requiredCourseMap.get(current) ?? null;
        }
      }

      await updateCourseExtraData(courseId, {
        objective: courseExtraData.objective,
        requirement: courseExtraData.requirement,
        required_course_id: courseExtraData.required_course_id,
        open_at: courseExtraData.open_at,
        close_at: courseExtraData.close_at,
        bloom_objectives: courseExtraData.bloom_objectives,
        assessment_matrix: courseExtraData.assessment_matrix,
        content_structure: courseExtraData.content_structure,
      });
      setSuccessMessage("✅ Thông tin mở rộng đã được lưu.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Không thể lưu thông tin mở rộng.");
    } finally {
      setIsSavingExtraData(false);
    }
  }

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
            onClick={() => router.push(`/instructor/courses/${courseId}`)}
            aria-label="Quay lại chi tiết khóa học"
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
            <h1 className="text-lg font-semibold">Chỉnh sửa khóa học</h1>
            <p className="text-sm text-slate-500">
              Cập nhật thông tin cơ bản, mục tiêu và cấu trúc nội dung
            </p>
          </div>
        </div>
        <div className="hidden items-center gap-2 md:flex">
          <NotificationBell userId={user.id} />
          <UserAccountMenu user={user} variant="dashboard" />
        </div>
      </header>

      <section className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-6 px-4 pb-8 pt-24 sm:px-6 lg:px-8">
        {isLoading ? (
          <div className="flex min-h-[55vh] items-center justify-center rounded-[28px] bg-white shadow-sm">
            <div className="flex items-center gap-3 text-slate-600">
              <LoaderCircle className="h-5 w-5 animate-spin" />
              <span>Đang tải dữ liệu...</span>
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

        {!isLoading && !errorMessage && courseDetail && form ? (
          <>
            {/* ─── Thông tin cơ bản ─── */}
            <article className="rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-slate-200">
              <div className="mb-6 flex items-center gap-3 border-b border-slate-200 pb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-100">
                  <BookOpen className="h-5 w-5 text-sky-600" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold">Thông tin cơ bản</h2>
                  <p className="text-sm text-slate-500">
                    Tên khóa học, mô tả, phân loại và trình độ
                  </p>
                </div>
              </div>

              <div className="space-y-5">
                <label className="space-y-2 text-sm text-slate-700">
                  <span className="font-medium">Tên khóa học</span>
                  <input
                    type="text"
                    value={form.title}
                    onChange={(e) => updateForm("title", e.target.value)}
                    className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-sky-400 focus:bg-white"
                    placeholder="Nhập tên khóa học"
                  />
                </label>

                <label className="space-y-2 text-sm text-slate-700">
                  <span className="font-medium">Giới thiệu ngắn</span>
                  <input
                    type="text"
                    value={form.introduction}
                    onChange={(e) => updateForm("introduction", e.target.value)}
                    className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-sky-400 focus:bg-white"
                    placeholder="Giới thiệu ngắn về khóa học"
                  />
                </label>

                <label className="space-y-2 text-sm text-slate-700">
                  <span className="font-medium">Mô tả chi tiết</span>
                  <textarea
                    value={form.description}
                    onChange={(e) => updateForm("description", e.target.value)}
                    rows={4}
                    className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-sky-400 focus:bg-white"
                    placeholder="Mô tả chi tiết nội dung khóa học"
                  />
                </label>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="space-y-2 text-sm text-slate-700">
                    <span className="font-medium">Phân loại</span>
                    <select
                      value={form.category_id}
                      onChange={(e) => updateForm("category_id", Number(e.target.value))}
                      className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-sky-400 focus:bg-white"
                    >
                      {categories.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="space-y-2 text-sm text-slate-700">
                    <span className="font-medium">Trình độ</span>
                    <select
                      value={form.level}
                      onChange={(e) => updateForm("level", e.target.value)}
                      className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-sky-400 focus:bg-white"
                    >
                      <option value="Cơ bản">Cơ bản</option>
                      <option value="Trung cấp">Trung cấp</option>
                      <option value="Nâng cao">Nâng cao</option>
                    </select>
                  </label>
                </div>

                <label className="space-y-2 text-sm text-slate-700">
                  <span className="font-medium">Số sinh viên dự kiến</span>
                  <input
                    type="number"
                    value={form.total_student}
                    onChange={(e) => updateForm("total_student", Number(e.target.value))}
                    min={0}
                    className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-sky-400 focus:bg-white"
                  />
                </label>

                {/* Image upload */}
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="relative mb-3 h-48 w-full overflow-hidden rounded-xl bg-slate-200">
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
                      onChange={(e) => setSelectedImageFile(e.target.files?.[0] ?? null)}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-sky-400"
                    />
                  </label>
                  {selectedImageFile && (
                    <p className="mt-2 text-sm text-sky-700">Đã chọn: {selectedImageFile.name}</p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleSaveBasicInfo}
                  disabled={isSaving}
                  className={`inline-flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold text-white transition-colors ${
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
                  <span>{isSaving ? "Đang lưu..." : "Lưu thông tin cơ bản"}</span>
                </button>
              </div>
            </article>

            {/* ─── Thông tin mở rộng ─── */}
            <article className="rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-slate-200">
              <div className="mb-6 flex items-center gap-3 border-b border-slate-200 pb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100">
                  <Sparkles className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold">Thông tin mở rộng</h2>
                  <p className="text-sm text-slate-500">
                    Mục tiêu Bloom, ma trận đánh giá, cấu trúc nội dung và yêu cầu
                  </p>
                </div>
              </div>

              <div className="space-y-6">
                {/* Bloom Objectives */}
                <div className="space-y-2 text-sm text-slate-700">
                  <span className="font-medium">Mục tiêu khóa học (theo thang Bloom)</span>
                  <BloomObjectives
                    value={courseExtraData?.bloom_objectives ?? "{}"}
                    onChange={(json) =>
                      setCourseExtraData((prev) =>
                        prev
                          ? { ...prev, bloom_objectives: json }
                          : null, // shouldn't happen as we create on save
                      )
                    }
                  />
                </div>

                {/* Bloom Gap Alert */}
                <BloomGapAlert
                  bloomObjectivesJson={courseExtraData?.bloom_objectives ?? "{}"}
                  assessmentMatrixJson={courseExtraData?.assessment_matrix ?? "{}"}
                  hasAssessmentComponents={components.some(
                    (c) => c.component_type === "exam" || c.component_type === "assignment",
                  )}
                />

                {/* Assessment Matrix */}
                <div className="space-y-2 text-sm text-slate-700">
                  <AssessmentMatrix
                    value={courseExtraData?.assessment_matrix ?? "{}"}
                    components={components as InstructorCourseComponent[]}
                    onChange={(json) =>
                      setCourseExtraData((prev) =>
                        prev
                          ? {
                              ...prev,
                              assessment_matrix: json,
                              content_structure: mergeMatrixIntoStructure(
                                json,
                                prev.content_structure,
                                components as InstructorCourseComponent[],
                              ),
                            }
                          : prev,
                      )
                    }
                  />
                </div>

                {/* Content Structure */}
                <div className="space-y-2 text-sm text-slate-700">
                  <ContentStructure
                    value={courseExtraData?.content_structure ?? "{}"}
                    modules={modules}
                    components={components as InstructorCourseComponent[]}
                    onChange={(json) =>
                      setCourseExtraData((prev) =>
                        prev
                          ? {
                              ...prev,
                              content_structure: json,
                              assessment_matrix: mergeStructureIntoMatrix(
                                json,
                                prev.assessment_matrix,
                                components as InstructorCourseComponent[],
                              ),
                            }
                          : prev,
                      )
                    }
                  />
                </div>

                {/* Requirement */}
                <label className="space-y-2 text-sm text-slate-700">
                  <span className="font-medium">Yêu cầu khóa học</span>
                  <textarea
                    value={courseExtraData?.requirement ?? ""}
                    onChange={(e) =>
                      setCourseExtraData((prev) =>
                        prev ? { ...prev, requirement: e.target.value } : prev,
                      )
                    }
                    rows={3}
                    placeholder="Nhập yêu cầu của khóa học..."
                    className="w-full rounded-3xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-sky-400 focus:bg-white"
                  />
                </label>

                {/* Open/Close dates */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="space-y-2 text-sm text-slate-700">
                    <span className="flex items-center gap-1.5 font-medium">
                      <Calendar className="h-4 w-4 text-sky-600" />
                      Ngày mở khóa học
                    </span>
                    <input
                      type="datetime-local"
                      value={
                        courseExtraData?.open_at
                          ? new Date(courseExtraData.open_at).toISOString().slice(0, 16)
                          : new Date().toISOString().slice(0, 16)
                      }
                      onChange={(e) =>
                        setCourseExtraData((prev) =>
                          prev
                            ? { ...prev, open_at: new Date(e.target.value).toISOString() }
                            : prev,
                        )
                      }
                      className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-sky-400 focus:bg-white"
                    />
                  </label>
                  <label className="space-y-2 text-sm text-slate-700">
                    <span className="flex items-center gap-1.5 font-medium">
                      <Calendar className="h-4 w-4 text-amber-600" />
                      Ngày kết thúc
                    </span>
                    <input
                      type="datetime-local"
                      value={
                        courseExtraData?.close_at
                          ? new Date(courseExtraData.close_at).toISOString().slice(0, 16)
                          : new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 16)
                      }
                      onChange={(e) =>
                        setCourseExtraData((prev) =>
                          prev
                            ? { ...prev, close_at: new Date(e.target.value).toISOString() }
                            : prev,
                        )
                      }
                      className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-sky-400 focus:bg-white"
                    />
                  </label>
                </div>

                {/* Prerequisite course */}
                <label className="space-y-2 text-sm text-slate-700">
                  <span className="font-medium">Khóa học yêu cầu trước (tùy chọn)</span>
                  <select
                    value={courseExtraData?.required_course_id ?? 0}
                    onChange={(e) =>
                      setCourseExtraData((prev) =>
                        prev
                          ? {
                              ...prev,
                              required_course_id:
                                Number(e.target.value) > 0 ? Number(e.target.value) : null,
                            }
                          : prev,
                      )
                    }
                    className="w-full rounded-2xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-sky-400 focus:bg-white"
                  >
                    <option value={0}>Không có</option>
                    {prerequisiteCourses
                      .filter((pc) => pc.id !== courseId)
                      .map((pc) => (
                        <option key={pc.id} value={pc.id}>
                          {pc.title}
                        </option>
                      ))}
                  </select>
                </label>

                <button
                  type="button"
                  onClick={async () => {
                    // Create extra data if not exists
                    if (!courseExtraData) {
                      try {
                        const created = await createCourseExtraData({
                          course_id: courseId,
                          objective: "",
                          requirement: "",
                          required_course_id: null,
                          open_at: new Date().toISOString(),
                          close_at: new Date(Date.now() + 365 * 86400000).toISOString(),
                        });
                        setCourseExtraData(created);
                        setSuccessMessage("✅ Đã tạo thông tin mở rộng. Hãy điền nội dung và lưu lại.");
                      } catch (err) {
                        setErrorMessage(
                          err instanceof Error ? err.message : "Không thể tạo thông tin mở rộng.",
                        );
                      }
                      return;
                    }
                    await handleSaveExtraData();
                  }}
                  disabled={isSavingExtraData}
                  className={`inline-flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold text-white transition-colors ${
                    isSavingExtraData
                      ? "cursor-not-allowed bg-slate-400"
                      : "bg-emerald-600 hover:bg-emerald-700"
                  }`}
                >
                  {isSavingExtraData ? (
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  <span>
                    {isSavingExtraData
                      ? "Đang lưu..."
                      : courseExtraData
                        ? "Lưu thông tin mở rộng"
                        : "Tạo thông tin mở rộng"}
                  </span>
                </button>
              </div>
            </article>
          </>
        ) : null}
      </section>
    </main>
  );
}

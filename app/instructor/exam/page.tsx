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
  PencilLine,
  Save,
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
  filterInstructorExam,
  getInstructorExamList,
  updateInstructorExam,
  validateInstructorExamUpdate,
  type InstructorExam,
  type InstructorExamFilterState,
  type InstructorExamUpdateInput,
} from "../../lib/api_exam_instructor";

const initialUser: User = {
  id: 7,
  username: "Giảng viên",
  email: "giang_vien@example.com",
  icon: "/icon.png",
  role: "instructor",
};

const defaultFilters: InstructorExamFilterState = {
  keyword: "",
  courseId: "all",
  isActive: "all",
  duration_minutes_min: 0,
  duration_minutes_max: 0,
  total_questions_min: 0,
  total_questions_max: 0,
};

type EditFormState = {
  title: string;
  description: string;
  courseId: string;
  durationMinutes: number;
  totalQuestions: number;
  isActive: boolean;
  passScore: number;
  maxScore: number;
};

function buildEditForm(exam: InstructorExam): EditFormState {
  return {
    title: exam.title,
    description: exam.description ?? "",
    courseId: `${exam.course_id ?? ""}`,
    durationMinutes: exam.duration_minutes,
    totalQuestions: exam.total_questions,
    isActive: exam.is_active,
    passScore: exam.pass_score,
    maxScore: exam.max_score,
  };
}

function getActivationLabel(isActive: boolean) {
  return isActive ? "Đang kích hoạt" : "Chưa kích hoạt";
}

export default function InstructorExamPage() {
  const router = useRouter();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const { currentUser, isCheckingAuth } = useInstructorSession();
  const [exams, setExams] = useState<InstructorExam[]>([]);
  const [filters, setFilters] = useState<InstructorExamFilterState>(defaultFilters);
  const [selectedExam, setSelectedExam] = useState<InstructorExam | null>(null);
  const [editForm, setEditForm] = useState<EditFormState | null>(null);
  const [instructorCourses, setInstructorCourses] = useState<
    Array<{ id: number; title: string }>
  >([]);

  useEffect(() => {
    let isMounted = true;

    async function loadPageData() {
      if (!currentUser) {
        return;
      }
      try {
        const [examList, courseList] = await Promise.all([
          getInstructorExamList(currentUser.id),
          getInstructorCourseListRaw(currentUser.id),
        ]);

        if (!isMounted) {
          return;
        }
        setExams(examList);
        setInstructorCourses(
          courseList.map((course) => ({
            id: course.id,
            title: course.title,
          })),
        );
        setErrorMessage("");
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Không thể tải danh sách bài kiểm tra của giảng viên.",
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

  const user = currentUser ?? initialUser;
  const filteredExams = useMemo(
    () => filterInstructorExam(exams, filters),
    [exams, filters],
  );
  const activeExamCount = useMemo(
    () => exams.filter((exam) => exam.is_active).length,
    [exams],
  );
  const usedCourseCount = useMemo(
    () => new Set(exams.map((exam) => exam.course_id).filter(Boolean)).size,
    [exams],
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


  function openEditPanel(exam: InstructorExam) {
    setSelectedExam(exam);
    setEditForm(buildEditForm(exam));
    setErrorMessage("");
  }

  function closeEditPanel() {
    setSelectedExam(null);
    setEditForm(null);
  }

  function updateFilter<K extends keyof InstructorExamFilterState>(
    key: K,
    value: InstructorExamFilterState[K],
  ) {
    setFilters((currentFilters) => ({
      ...currentFilters,
      [key]: value,
    }));
  }

  function updateEditForm<K extends keyof EditFormState>(
    key: K,
    value: EditFormState[K],
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

  async function handleSaveExam() {
    if (!selectedExam || !editForm) {
      return;
    }

    const payload: InstructorExamUpdateInput = {
      title: editForm.title.trim(),
      description: editForm.description.trim() || null,
      course_id: Number(editForm.courseId),
      duration_minutes: editForm.durationMinutes,
      total_questions: editForm.totalQuestions,
      is_active: editForm.isActive,
      pass_score: editForm.passScore,
      max_score: editForm.maxScore,
    };

    const validationMessage = validateInstructorExamUpdate(payload);
    if (validationMessage) {
      setErrorMessage(validationMessage);
      return;
    }

    setIsSaving(true);
    setErrorMessage("");

    try {
      const savedExam = await updateInstructorExam(selectedExam.id, payload);
      const courseName =
        instructorCourses.find((course) => course.id === payload.course_id)?.title ??
        `Khóa học #${payload.course_id}`;

      const nextExam: InstructorExam = {
        ...selectedExam,
        ...savedExam,
        course_name: courseName,
      };

      setExams((currentExams) =>
        currentExams.map((exam) => (exam.id === nextExam.id ? nextExam : exam)),
      );
      setSelectedExam(nextExam);
      setEditForm(buildEditForm(nextExam));
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Không thể lưu thay đổi bài kiểm tra.",
      );
    } finally {
      setIsSaving(false);
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
            <h1 className="text-lg font-semibold">Bài kiểm tra của giảng viên</h1>
            <p className="text-sm text-slate-500">
              Lọc, theo dõi và cập nhật bài kiểm tra từ các khóa học của mình
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
              <span>Đang tải danh sách bài kiểm tra của giảng viên...</span>
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
            <section className="rounded-[28px] bg-linear-to-r from-sky-700 via-cyan-700 to-emerald-600 px-6 py-7 text-white shadow-xl">
              <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                <div className="max-w-3xl">
                  <p className="text-sm font-medium text-sky-100">
                    Quản lý đánh giá học tập
                  </p>
                  <h2 className="mt-2 text-3xl font-semibold">
                    Danh sách bài kiểm tra của {user.username}
                  </h2>
                  <p className="mt-3 text-sm leading-6 text-sky-50">
                    Đây là danh sách các bài kiểm tra được sử dụng trong các khóa 
                    học, từ đây bạn có thể xem hoặc chỉnh sửa nội dung bao quát của bài  
                    kiểm tra. Câu hỏi cùng các lựa chọn chỉ chỉnh sửa ở trang chi tiết 
                    từng bài kiểm tra.
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl bg-white/14 px-4 py-3">
                    <p className="text-sm text-sky-100">Tổng bài kiểm tra</p>
                    <p className="mt-2 text-base font-semibold">{exams.length}</p>
                  </div>
                  <div className="rounded-2xl bg-white/14 px-4 py-3">
                    <p className="text-sm text-sky-100">Đang kích hoạt</p>
                    <p className="mt-2 text-base font-semibold">{activeExamCount}</p>
                  </div>
                  <div className="rounded-2xl bg-white/14 px-4 py-3">
                    <p className="text-sm text-sky-100">Khóa học có bài kiểm tra</p>
                    <p className="mt-2 text-base font-semibold">{usedCourseCount}</p>
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
                  {filteredExams.length}
                </p>
                <p className="mt-2 text-sm text-slate-600">
                  Số bài kiểm tra khớp với bộ lọc hiện tại.
                </p>
              </article>

              <article className="rounded-3xl bg-white px-5 py-5 shadow-sm ring-1 ring-slate-200">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-slate-500">Sẵn sàng cho sinh viên</p>
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                </div>
                <p className="mt-3 text-3xl font-semibold text-slate-900">
                  {activeExamCount}
                </p>
                <p className="mt-2 text-sm text-slate-600">
                  Bài kiểm tra đang được kích hoạt để phục vụ giảng dạy.
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
                  Số khóa học của giảng viên hiện đang có bài kiểm tra.
                </p>
              </article>
            </section>

            <section className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h3 className="text-xl font-semibold">Bộ lọc bài kiểm tra</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    Lọc theo từ khóa, khóa học, trạng thái kích hoạt, thời gian làm bài
                    và tổng số lượng câu hỏi.
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

              <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <label className="block">
                  <span className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-700">
                    <Search className="h-4 w-4" />
                    <span>Từ khóa</span>
                  </span>
                  <input
                    type="text"
                    value={filters.keyword}
                    onChange={(event) => updateFilter("keyword", event.target.value)}
                    placeholder="Tìm theo tiêu đề, mô tả hoặc khóa học"
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-sky-400"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-700">
                    <BookOpen className="h-4 w-4" />
                    <span>Khóa học</span>
                  </span>
                  <select
                    value={filters.courseId}
                    onChange={(event) => updateFilter("courseId", event.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-sky-400"
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
                    <Filter className="h-4 w-4" />
                    <span>Thời gian làm bài tối thiểu</span>
                  </span>
                  <input
                    type="number"
                    min={0}
                    value={filters.duration_minutes_min}
                    onChange={(event) =>
                      updateFilter("duration_minutes_min", Number(event.target.value))
                    }
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-sky-400"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-700">
                    <Filter className="h-4 w-4" />
                    <span>Thời gian làm bài tối đa</span>
                  </span>
                  <input
                    type="number"
                    min={0}
                    value={filters.duration_minutes_max}
                    onChange={(event) =>
                      updateFilter("duration_minutes_max", Number(event.target.value))
                    }
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-sky-400"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-700">
                    <Filter className="h-4 w-4" />
                    <span>Số câu hỏi tối thiểu</span>
                  </span>
                  <input
                    type="number"
                    min={0}
                    value={filters.total_questions_min}
                    onChange={(event) =>
                      updateFilter("total_questions_min", Number(event.target.value))
                    }
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-sky-400"
                  />
                </label>

                <label className="block md:col-span-2 xl:col-span-3">
                  <span className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-700">
                    <Filter className="h-4 w-4" />
                    <span>Số câu hỏi tối đa</span>
                  </span>
                  <input
                    type="number"
                    min={0}
                    value={filters.total_questions_max}
                    onChange={(event) =>
                      updateFilter("total_questions_max", Number(event.target.value))
                    }
                    className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-sky-400"
                  />
                </label>
              </div>
            </section>

            <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
              <article className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-slate-200">
                <div className="flex items-center justify-between border-b border-slate-200 pb-4">
                  <div>
                    <h3 className="text-xl font-semibold">Danh sách bài kiểm tra</h3>
                    <p className="mt-1 text-sm text-slate-500">
                      Chọn một bài kiểm tra để xem thông tin và chỉnh sửa nhanh.
                    </p>
                  </div>
                </div>

                {filteredExams.length === 0 ? (
                  <div className="mt-5 rounded-3xl border border-dashed border-slate-300 px-5 py-10 text-center">
                    <EyeOff className="mx-auto h-8 w-8 text-slate-400" />
                    <h4 className="mt-4 text-lg font-semibold text-slate-900">
                      Không có bài kiểm tra phù hợp
                    </h4>
                    <p className="mt-2 text-sm text-slate-600">
                      Hãy thử thay đổi bộ lọc để xem thêm bài kiểm tra từ các khóa học
                      của giảng viên.
                    </p>
                  </div>
                ) : (
                  <div className="mt-5 space-y-4">
                    {filteredExams.map((exam) => (
                      <article
                        key={exam.id}
                        className={`rounded-3xl border p-4 transition-colors ${
                          selectedExam?.id === exam.id
                            ? "border-sky-400 bg-sky-50"
                            : "border-slate-200 bg-slate-50/60 hover:border-sky-300 hover:bg-sky-50/70"
                        }`}
                      >
                        <div className="flex flex-col gap-4">
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="rounded-full bg-sky-100 px-2.5 py-1 text-xs font-medium text-sky-700">
                                  {exam.course_name}
                                </span>
                                <span
                                  className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                                    exam.is_active
                                      ? "bg-emerald-100 text-emerald-700"
                                      : "bg-slate-200 text-slate-700"
                                  }`}
                                >
                                  {getActivationLabel(exam.is_active)}
                                </span>
                              </div>

                              <h4 className="mt-3 text-xl font-semibold text-slate-900">
                                {exam.title}
                              </h4>
                              <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-600">
                                {exam.description ||
                                  "Bài kiểm tra này chưa có mô tả chi tiết."}
                              </p>
                            </div>

                            <button
                              type="button"
                              onClick={() => openEditPanel(exam)}
                              className="inline-flex items-center gap-2 self-start rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                            >
                              <PencilLine className="h-4 w-4" />
                              <span>Sửa thông tin</span>
                            </button>
                          </div>

                          <div className="grid gap-3 sm:grid-cols-4">
                            <div className="rounded-2xl bg-white px-3 py-3 ring-1 ring-slate-200">
                              <p className="text-xs text-slate-500">Thời gian</p>
                              <p className="mt-1 text-base font-semibold text-slate-900">
                                {exam.duration_minutes} phút
                              </p>
                            </div>
                            <div className="rounded-2xl bg-white px-3 py-3 ring-1 ring-slate-200">
                              <p className="text-xs text-slate-500">Số câu hỏi</p>
                              <p className="mt-1 text-base font-semibold text-slate-900">
                                {exam.total_questions}
                              </p>
                            </div>
                            <div className="rounded-2xl bg-white px-3 py-3 ring-1 ring-slate-200">
                              <p className="text-xs text-slate-500">Điểm tối đa</p>
                              <p className="mt-1 text-base font-semibold text-slate-900">
                                {exam.max_score}
                              </p>
                            </div>
                            <div className="rounded-2xl bg-white px-3 py-3 ring-1 ring-slate-200">
                              <p className="text-xs text-slate-500">Điểm cần đạt</p>
                              <p className="mt-1 text-base font-semibold text-slate-900">
                                {exam.pass_score}
                              </p>
                            </div>
                          </div>

                          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <p className="text-sm text-slate-500">
                              Muốn sửa câu hỏi và lựa chọn? Hãy mở trang chi tiết của bài
                              kiểm tra này.
                            </p>
                            <Link
                              href={`/instructor/exam/${exam.id}`}
                              className="inline-flex items-center gap-1 text-sm font-semibold text-sky-700"
                            >
                              <span>Đi tới trang chi tiết</span>
                              <ChevronRight className="h-4 w-4" />
                            </Link>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </article>

              <aside className="rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-slate-200">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-semibold">Chỉnh sửa bài kiểm tra</h3>
                    <p className="mt-1 text-sm text-slate-500">
                      Thuộc tính quan trọng không được để trống và điểm cần đạt không
                      được lớn hơn điểm tối đa.
                    </p>
                  </div>
                  {selectedExam ? (
                    <button
                      type="button"
                      onClick={closeEditPanel}
                      className="rounded-full p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                      aria-label="Đóng khung chỉnh sửa"
                    >
                      <EyeOff className="h-5 w-5" />
                    </button>
                  ) : null}
                </div>

                {selectedExam && editForm ? (
                  <div className="mt-5 space-y-5">
                    <div className="rounded-3xl bg-slate-50 p-5">
                      <p className="text-sm text-slate-500">Đang chỉnh sửa</p>
                      <h4 className="mt-2 text-2xl font-semibold text-slate-900">
                        {selectedExam.title}
                      </h4>
                      <p className="mt-2 text-sm text-slate-600">
                        Khóa học hiện tại: {selectedExam.course_name}
                      </p>
                    </div>

                    <label className="block">
                      <span className="mb-2 block text-sm font-medium text-slate-700">
                        Tiêu đề bài kiểm tra
                      </span>
                      <input
                        type="text"
                        value={editForm.title}
                        onChange={(event) => updateEditForm("title", event.target.value)}
                        className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-sky-400"
                      />
                    </label>

                    <label className="block">
                      <span className="mb-2 block text-sm font-medium text-slate-700">
                        Mô tả
                      </span>
                      <textarea
                        rows={4}
                        value={editForm.description}
                        onChange={(event) =>
                          updateEditForm("description", event.target.value)
                        }
                        className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-sky-400"
                      />
                    </label>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <label className="block">
                        <span className="mb-2 block text-sm font-medium text-slate-700">
                          Thời gian làm bài
                        </span>
                        <input
                          type="number"
                          min={1}
                          value={editForm.durationMinutes}
                          onChange={(event) =>
                            updateEditForm("durationMinutes", Number(event.target.value))
                          }
                          className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-sky-400"
                        />
                      </label>

                      <label className="block">
                        <span className="mb-2 block text-sm font-medium text-slate-700">
                          Tổng số lượng câu hỏi
                        </span>
                        <input
                          type="number"
                          min={1}
                          value={editForm.totalQuestions}
                          onChange={(event) =>
                            updateEditForm("totalQuestions", Number(event.target.value))
                          }
                          className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-sky-400"
                        />
                      </label>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <label className="block">
                        <span className="mb-2 block text-sm font-medium text-slate-700">
                          Điểm cần đạt
                        </span>
                        <input
                          type="number"
                          min={0}
                          value={editForm.passScore}
                          onChange={(event) =>
                            updateEditForm("passScore", Number(event.target.value))
                          }
                          className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-sky-400"
                        />
                      </label>

                      <label className="block">
                        <span className="mb-2 block text-sm font-medium text-slate-700">
                          Điểm tối đa
                        </span>
                        <input
                          type="number"
                          min={1}
                          value={editForm.maxScore}
                          onChange={(event) =>
                            updateEditForm("maxScore", Number(event.target.value))
                          }
                          className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-sky-400"
                        />
                      </label>
                    </div>

                    <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                      <input
                        type="checkbox"
                        checked={editForm.isActive}
                        onChange={(event) =>
                          updateEditForm("isActive", event.target.checked)
                        }
                        className="mt-1 h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                      />
                      <span>
                        <span className="block text-sm font-medium text-slate-900">
                          Kích hoạt bài kiểm tra
                        </span>
                        <span className="mt-1 block text-sm text-slate-600">
                          Khi bật, bài kiểm tra có thể được dùng trong luồng học tập của
                          khóa học.
                        </span>
                      </span>
                    </label>

                    <div className="rounded-2xl border border-cyan-200 bg-cyan-50 px-4 py-4 text-sm text-cyan-900">
                      Câu hỏi và các lựa chọn của bài kiểm tra chỉ được chỉnh sửa ở trang
                      chi tiết.
                      <div className="mt-3">
                        <Link
                          href={`/instructor/exam/${selectedExam.id}`}
                          className="inline-flex items-center gap-1 font-semibold text-cyan-800"
                        >
                          <span>Mở trang chi tiết bài kiểm tra</span>
                          <ChevronRight className="h-4 w-4" />
                        </Link>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleSaveExam}
                      disabled={isSaving}
                      className={`inline-flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold text-white ${
                        isSaving ? "cursor-not-allowed bg-slate-400" : "bg-sky-600 hover:bg-sky-700"
                      }`}
                    >
                      {isSaving ? (
                        <LoaderCircle className="h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4" />
                      )}
                      <span>
                        {isSaving ? "Đang lưu thay đổi..." : "Lưu thay đổi bài kiểm tra"}
                      </span>
                    </button>
                  </div>
                ) : (
                  <div className="mt-5 rounded-2xl border border-dashed border-slate-300 px-4 py-10 text-center">
                    <PencilLine className="mx-auto h-8 w-8 text-slate-400" />
                    <h4 className="mt-4 text-lg font-semibold text-slate-900">
                      Chưa chọn bài kiểm tra
                    </h4>
                    <p className="mt-2 text-sm text-slate-600">
                      Chọn một bài kiểm tra ở danh sách bên trái để chỉnh sửa thông tin
                      chung như tiêu đề, khóa học, thời lượng, trạng thái kích hoạt và
                      điểm số.
                    </p>
                  </div>
                )}
              </aside>
            </section>
          </>
        ) : null}
      </section>
    </main>
  );
}


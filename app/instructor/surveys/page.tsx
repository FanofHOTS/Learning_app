"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BarChart3,
  ClipboardList,
  LoaderCircle,
  Menu,
  Plus,
  Search,
  Sparkles,
  Trash2,
} from "lucide-react";
import { UserAccountMenu } from "../../components/user-account-menu";
import { NotificationBell } from "../../components/notification-bell";
import { ShowNavigation } from "../../lib/app_nav";
import { useInstructorSession } from "../_lib/use-instructor-session";
import {
  createSurvey,
  deleteSurvey,
  getPublicSurveys,
  updateSurvey,
  getSurveyResults,
  getSurveyQuestions,
  createSurveyQuestion,
  updateSurveyQuestion,
  deleteSurveyQuestion,
  notifySurveyStudents,
  getSurveyStatus,
  parseSurveyOptions,
  type Survey,
  type SurveyQuestion,
  type SurveyResultStats,
} from "../../lib/api_survey";
import type { User } from "../../lib/api_user";

const initialUser: User = {
  id: 7,
  username: "Giảng viên",
  email: "giao_vien@example.com",
  icon: "/icon.png",
  role: "instructor",
};

type ModalMode =
  | "closed"
  | "create"
  | "edit"
  | "questions"
  | "results";

type QuestionForm = {
  question_text: string;
  question_type: string;
  options: string[];
  is_required: boolean;
  sequence: number;
};

export default function InstructorSurveysPage() {
  const router = useRouter();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [searchKeyword, setSearchKeyword] = useState("");
  const { currentUser, isCheckingAuth } = useInstructorSession();

  // Modal state
  const [modalMode, setModalMode] = useState<ModalMode>("closed");
  const [selectedSurvey, setSelectedSurvey] = useState<Survey | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editIsPublic, setEditIsPublic] = useState(false);
  const [editEndAt, setEditEndAt] = useState("");
  const [questions, setQuestions] = useState<SurveyQuestion[]>([]);
  const [questionForm, setQuestionForm] = useState<QuestionForm>({
    question_text: "",
    question_type: "multiple_choice",
    options: [],
    is_required: true,
    sequence: 1,
  });
  const [optionInput, setOptionInput] = useState("");
  const [results, setResults] = useState<SurveyResultStats[]>([]);
  const [notifyingId, setNotifyingId] = useState<number | null>(null);
  const [notifyMessage, setNotifyMessage] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadSurveys() {
      if (!currentUser) return;
      try {
        setErrorMessage("");

        // Get all public surveys (we'll filter by instructor later)
        const allSurveys = await getPublicSurveys();
        // For now, show all public surveys and surveys created by this instructor
        // In a real app, there would be an endpoint for instructor's surveys
        if (!isMounted) return;
        setSurveys(allSurveys);
      } catch (error) {
        if (!isMounted) return;
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Không thể tải danh sách khảo sát.",
        );
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadSurveys();
    return () => {
      isMounted = false;
    };
  }, [currentUser]);

  const user = currentUser ?? initialUser;

  const filteredSurveys = useMemo(() => {
    if (!searchKeyword.trim()) return surveys;
    const kw = searchKeyword.toLowerCase();
    return surveys.filter(
      (s) =>
        s.title.toLowerCase().includes(kw) ||
        s.description.toLowerCase().includes(kw),
    );
  }, [surveys, searchKeyword]);

  function openCreateModal() {
    setSelectedSurvey(null);
    setEditTitle("");
    setEditDescription("");
    setEditIsPublic(true);
    setEditEndAt("");
    setModalMode("create");
  }

  function openEditModal(survey: Survey) {
    setSelectedSurvey(survey);
    setEditTitle(survey.title);
    setEditDescription(survey.description);
    setEditIsPublic(survey.is_public);
    setEditEndAt(
      survey.end_at
        ? new Date(survey.end_at).toISOString().slice(0, 16)
        : "",
    );
    setModalMode("edit");
  }

  async function openQuestionsModal(survey: Survey) {
    setSelectedSurvey(survey);
    setIsLoading(true);
    setModalMode("questions");
    try {
      const qs = await getSurveyQuestions(survey.id);
      setQuestions(qs);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Không thể tải câu hỏi.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function openResultsModal(survey: Survey) {
    setSelectedSurvey(survey);
    setIsLoading(true);
    setModalMode("results");
    try {
      const [qs, r] = await Promise.all([
        getSurveyQuestions(survey.id),
        getSurveyResults(survey.id),
      ]);
      setQuestions(qs);
      setResults(r);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Không thể tải kết quả.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCreateOrUpdate() {
    setIsSaving(true);
    setErrorMessage("");
    try {
      if (modalMode === "create") {
        const created = await createSurvey({
          title: editTitle || "Khảo sát mới",
          description: editDescription,
          is_public: editIsPublic,
          end_at: editEndAt ? new Date(editEndAt).toISOString() : null,
        });
        setSurveys((prev) => [created, ...prev]);
      } else if (modalMode === "edit" && selectedSurvey) {
        const updated = await updateSurvey(selectedSurvey.id, {
          title: editTitle,
          description: editDescription,
          is_public: editIsPublic,
          end_at: editEndAt ? new Date(editEndAt).toISOString() : null,
        });
        setSurveys((prev) =>
          prev.map((s) => (s.id === updated.id ? updated : s)),
        );
      }
      setModalMode("closed");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Không thể lưu khảo sát.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleNotifyStudents(surveyId: number) {
    setNotifyingId(surveyId);
    setNotifyMessage("");
    try {
      const result = await notifySurveyStudents(surveyId);
      setNotifyMessage(result.message);
      setTimeout(() => setNotifyMessage(""), 4000);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Không thể gửi thông báo.",
      );
    } finally {
      setNotifyingId(null);
    }
  }

  async function handleDelete(surveyId: number) {
    if (!confirm("Bạn có chắc muốn xóa khảo sát này?")) return;
    try {
      await deleteSurvey(surveyId);
      setSurveys((prev) => prev.filter((s) => s.id !== surveyId));
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Không thể xóa khảo sát.",
      );
    }
  }

  async function handleAddQuestion() {
    if (!selectedSurvey || !questionForm.question_text.trim()) return;
    setIsSaving(true);
    try {
      const created = await createSurveyQuestion({
        survey_id: selectedSurvey.id,
        question_text: questionForm.question_text,
        question_type: questionForm.question_type,
        options: JSON.stringify(questionForm.options),
        sequence: questionForm.sequence,
        is_required: questionForm.is_required,
      });
      setQuestions((prev) => [...prev, created]);
      setQuestionForm({
        question_text: "",
        question_type: "multiple_choice",
        options: [],
        is_required: true,
        sequence: questions.length + 2,
      });
      setOptionInput("");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Không thể thêm câu hỏi.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeleteQuestion(questionId: number) {
    try {
      await deleteSurveyQuestion(questionId);
      setQuestions((prev) => prev.filter((q) => q.id !== questionId));
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Không thể xóa câu hỏi.",
      );
    }
  }

  function addOption() {
    const trimmed = optionInput.trim();
    if (trimmed && !questionForm.options.includes(trimmed)) {
      setQuestionForm((prev) => ({
        ...prev,
        options: [...prev.options, trimmed],
      }));
      setOptionInput("");
    }
  }

  function removeOption(option: string) {
    setQuestionForm((prev) => ({
      ...prev,
      options: prev.options.filter((o) => o !== option),
    }));
  }

  const isAuthPending = isCheckingAuth || !currentUser;

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
          aria-label="Đóng"
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
          >
            <Menu className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-lg font-semibold">Quản lý khảo sát</h1>
            <p className="text-sm text-slate-500">
              Tạo khảo sát, thêm câu hỏi và xem kết quả
            </p>
          </div>
        </div>
        <div className="hidden items-center gap-2 md:flex">
          <NotificationBell userId={user.id} />
          <UserAccountMenu user={user} variant="dashboard" />
        </div>
      </header>

      <section className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 px-4 pb-8 pt-24 sm:px-6 lg:px-8">
        {errorMessage ? (
          <div className="rounded-3xl border border-red-200 bg-red-50 px-5 py-4 text-red-700">
            {errorMessage}
          </div>
        ) : null}

        <section className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold">Khảo sát công khai</h2>
              <p className="mt-1 text-sm text-slate-500">
                Thu thập ý kiến sinh viên trước khi xây dựng khóa học
              </p>
            </div>
            <button
              type="button"
              onClick={openCreateModal}
              className="inline-flex items-center gap-2 rounded-2xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-700"
            >
              <Plus className="h-4 w-4" />
              Tạo khảo sát mới
            </button>
          </div>

          <div className="mt-4">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                placeholder="Tìm kiếm khảo sát..."
                className="w-full rounded-xl border border-slate-300 px-9 py-2.5 text-sm outline-none focus:border-sky-400"
              />
            </label>
          </div>
        </section>

        {isLoading ? (
          <div className="flex min-h-[40vh] items-center justify-center rounded-[28px] bg-white shadow-sm">
            <div className="flex items-center gap-3 text-slate-600">
              <LoaderCircle className="h-5 w-5 animate-spin" />
              <span>Đang tải...</span>
            </div>
          </div>
        ) : (
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredSurveys.length === 0 ? (
              <div className="col-span-full rounded-[28px] border border-dashed border-slate-300 bg-white px-6 py-12 text-center text-slate-500 shadow-sm">
                Chưa có khảo sát nào. Hãy tạo khảo sát đầu tiên!
              </div>
            ) : (
              filteredSurveys.map((survey) => {
                const statusInfo = getSurveyStatus(survey);
                return (
                  <div
                    key={survey.id}
                    className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-slate-200"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusInfo.color}`}
                      >
                        {statusInfo.label}
                      </span>
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">
                        {survey.is_public ? "Công khai" : "Nội bộ"}
                      </span>
                    </div>

                    <h3 className="mt-3 text-lg font-semibold text-slate-900">
                      {survey.title}
                    </h3>
                    <p className="mt-1 line-clamp-2 text-sm leading-6 text-slate-600">
                      {survey.description || "Không có mô tả"}
                    </p>

                    <div className="mt-4 border-t border-slate-100 pt-3">
                      <p className="text-xs text-slate-500">
                        Tạo:{" "}
                        {new Date(survey.created_at).toLocaleDateString(
                          "vi-VN",
                        )}
                        {survey.end_at
                          ? ` | Hạn: ${new Date(survey.end_at).toLocaleDateString("vi-VN")}`
                          : ""}
                      </p>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => openEditModal(survey)}
                        className="rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      >
                        Sửa
                      </button>
                      <button
                        type="button"
                        onClick={() => openQuestionsModal(survey)}
                        className="rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      >
                        Câu hỏi
                      </button>
                      <button
                        type="button"
                        onClick={() => openResultsModal(survey)}
                        className="rounded-xl border border-emerald-300 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-50"
                      >
                        Kết quả
                      </button>
                      {survey.is_public && survey.is_active ? (
                        <button
                          type="button"
                          onClick={() => handleNotifyStudents(survey.id)}
                          disabled={notifyingId === survey.id}
                          className="rounded-xl border border-sky-300 px-3 py-1.5 text-xs font-medium text-sky-700 hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {notifyingId === survey.id ? (
                            <LoaderCircle className="h-3 w-3 animate-spin" />
                          ) : (
                            "🔔 Thông báo"
                          )}
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => handleDelete(survey.id)}
                        className="rounded-xl border border-red-300 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                    {notifyMessage ? (
                      <div className="mt-2 rounded-xl bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                        {notifyMessage}
                      </div>
                    ) : null}
                  </div>
                );
              })
            )}
          </section>
        )}

        {/* Loading overlay inside questions/results modals */}
        {(modalMode === "questions" || modalMode === "results") && isLoading ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 backdrop-blur-sm">
            <div className="flex items-center gap-3 rounded-3xl bg-white px-6 py-5 shadow-xl">
              <LoaderCircle className="h-5 w-5 animate-spin text-slate-500" />
              <span className="text-sm text-slate-700">Đang tải...</span>
            </div>
          </div>
        ) : null}
      </section>

      {/* ─── Create/Edit Modal ─── */}
      {modalMode === "create" || modalMode === "edit" ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 backdrop-blur-sm px-4">
          <div className="w-full max-w-lg rounded-[32px] bg-white p-6 shadow-2xl">
            <h2 className="text-lg font-semibold text-slate-900">
              {modalMode === "create" ? "Tạo khảo sát mới" : "Chỉnh sửa khảo sát"}
            </h2>

            <div className="mt-5 space-y-4">
              <label className="block space-y-1.5 text-sm text-slate-700">
                <span className="font-medium">Tiêu đề</span>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full rounded-2xl border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-sky-400"
                  placeholder="Nhập tiêu đề khảo sát"
                />
              </label>

              <label className="block space-y-1.5 text-sm text-slate-700">
                <span className="font-medium">Mô tả</span>
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  rows={3}
                  className="w-full rounded-2xl border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-sky-400"
                  placeholder="Mô tả mục đích khảo sát..."
                />
              </label>

              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={editIsPublic}
                    onChange={(e) => setEditIsPublic(e.target.checked)}
                    className="rounded"
                  />
                  <span>Công khai</span>
                </label>
              </div>

              <label className="block space-y-1.5 text-sm text-slate-700">
                <span className="font-medium">Thời hạn (tùy chọn)</span>
                <input
                  type="datetime-local"
                  value={editEndAt}
                  onChange={(e) => setEditEndAt(e.target.value)}
                  className="w-full rounded-2xl border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-sky-400"
                />
              </label>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setModalMode("closed")}
                className="rounded-2xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleCreateOrUpdate}
                disabled={isSaving}
                className="rounded-2xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-400"
              >
                {isSaving
                  ? "Đang lưu..."
                  : modalMode === "create"
                    ? "Tạo khảo sát"
                    : "Lưu thay đổi"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* ─── Questions Modal ─── */}
      {modalMode === "questions" && selectedSurvey && !isLoading ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 backdrop-blur-sm px-4">
          <div className="w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-[32px] bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  Câu hỏi: {selectedSurvey.title}
                </h2>
                <p className="text-sm text-slate-500">
                  {questions.length} câu hỏi
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalMode("closed")}
                className="rounded-xl px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
              >
                Đóng
              </button>
            </div>

            {/* Existing questions */}
            <div className="mt-4 space-y-3">
              {questions.length === 0 ? (
                <p className="text-sm text-slate-500">
                  Chưa có câu hỏi nào. Hãy thêm câu hỏi đầu tiên!
                </p>
              ) : (
                questions
                  .sort((a, b) => a.sequence - b.sequence)
                  .map((q, idx) => (
                    <div
                      key={q.id}
                      className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-slate-900">
                            {idx + 1}. {q.question_text}
                          </p>
                          <div className="mt-2 flex flex-wrap gap-2 text-xs">
                            <span className="rounded-full bg-sky-100 px-2 py-0.5 text-sky-700">
                              {q.question_type === "text"
                                ? "Văn bản"
                                : q.question_type === "multiple_choice"
                                  ? "Chọn 1"
                                  : q.question_type === "checkbox"
                                    ? "Chọn nhiều"
                                    : "Đánh giá"}
                            </span>
                            {q.is_required ? (
                              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-700">
                                Bắt buộc
                              </span>
                            ) : null}
                          </div>
                          {q.question_type !== "text" &&
                          q.question_type !== "rating" ? (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {parseSurveyOptions(q.options).map((opt) => (
                                <span
                                  key={opt}
                                  className="rounded-lg bg-white px-2 py-0.5 text-xs text-slate-600 ring-1 ring-slate-200"
                                >
                                  {opt}
                                </span>
                              ))}
                            </div>
                          ) : null}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteQuestion(q.id)}
                          className="shrink-0 rounded-lg p-1.5 text-red-500 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))
              )}
            </div>

            {/* Add question form */}
            <div className="mt-6 border-t border-slate-200 pt-4">
              <h3 className="mb-3 text-sm font-semibold text-slate-900">
                Thêm câu hỏi mới
              </h3>

              <div className="space-y-3">
                <textarea
                  value={questionForm.question_text}
                  onChange={(e) =>
                    setQuestionForm((prev) => ({
                      ...prev,
                      question_text: e.target.value,
                    }))
                  }
                  placeholder="Nội dung câu hỏi..."
                  rows={2}
                  className="w-full rounded-2xl border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-sky-400"
                />

                <div className="flex flex-wrap gap-3">
                  <label className="text-sm text-slate-700">
                    <span className="font-medium">Loại: </span>
                    <select
                      value={questionForm.question_type}
                      onChange={(e) =>
                        setQuestionForm((prev) => ({
                          ...prev,
                          question_type: e.target.value,
                        }))
                      }
                      className="ml-2 rounded-xl border border-slate-300 px-3 py-1.5 text-sm"
                    >
                      <option value="multiple_choice">Chọn 1</option>
                      <option value="checkbox">Chọn nhiều</option>
                      <option value="text">Văn bản</option>
                      <option value="rating">Đánh giá</option>
                    </select>
                  </label>

                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={questionForm.is_required}
                      onChange={(e) =>
                        setQuestionForm((prev) => ({
                          ...prev,
                          is_required: e.target.checked,
                        }))
                      }
                      className="rounded"
                    />
                    <span>Bắt buộc</span>
                  </label>
                </div>

                {questionForm.question_type === "multiple_choice" ||
                questionForm.question_type === "checkbox" ? (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={optionInput}
                        onChange={(e) => setOptionInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addOption())}
                        placeholder="Thêm lựa chọn..."
                        className="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-400"
                      />
                      <button
                        type="button"
                        onClick={addOption}
                        className="rounded-xl bg-sky-100 px-3 py-2 text-sm font-medium text-sky-700 hover:bg-sky-200"
                      >
                        Thêm
                      </button>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {questionForm.options.map((opt) => (
                        <span
                          key={opt}
                          className="inline-flex items-center gap-1 rounded-lg bg-white px-2.5 py-1 text-xs text-slate-700 ring-1 ring-slate-200"
                        >
                          {opt}
                          <button
                            type="button"
                            onClick={() => removeOption(opt)}
                            className="text-red-500 hover:text-red-700"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}

                <button
                  type="button"
                  onClick={handleAddQuestion}
                  disabled={isSaving || !questionForm.question_text.trim()}
                  className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-400"
                >
                  {isSaving ? (
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                  Thêm câu hỏi
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* ─── Results Modal ─── */}
      {modalMode === "results" && selectedSurvey && !isLoading ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 backdrop-blur-sm px-4">
          <div className="w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-[32px] bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  Kết quả khảo sát
                </h2>
                <p className="text-sm text-slate-500">{selectedSurvey.title}</p>
              </div>
              <button
                type="button"
                onClick={() => setModalMode("closed")}
                className="rounded-xl px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
              >
                Đóng
              </button>
            </div>

            <div className="mt-4 space-y-5">
              {results.length === 0 ? (
                <p className="text-sm text-slate-500">
                  Chưa có kết quả nào.
                </p>
              ) : (
                results.map((result, idx) => (
                  <div
                    key={result.question_id}
                    className="rounded-2xl border border-slate-200 p-4"
                  >
                    <h3 className="text-sm font-semibold text-slate-900">
                      {idx + 1}. {result.question_text}
                    </h3>
                    <p className="mt-1 text-xs text-slate-500">
                      Tổng số câu trả lời: {result.total_responses}
                    </p>

                    {result.question_type === "text" ? (
                      <div className="mt-3 space-y-1.5">
                        {result.text_answers.map((answer, ai) => (
                          <p
                            key={ai}
                            className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-700"
                          >
                            {answer}
                          </p>
                        ))}
                        {result.text_answers.length === 0 ? (
                          <p className="text-sm text-slate-400">
                            Chưa có câu trả lời văn bản.
                          </p>
                        ) : null}
                      </div>
                    ) : result.question_type === "rating" ? (
                      <div className="mt-3">
                        <div className="flex items-center gap-2 text-sm">
                          <span className="font-medium text-slate-900">
                            Điểm trung bình:
                          </span>
                          <span className="text-lg font-semibold text-amber-600">
                            {result.rating_avg.toFixed(1)}
                          </span>
                          <span className="text-slate-500">
                            ({result.rating_count} lượt)
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-3 space-y-2">
                        {Object.entries(result.choice_counts).map(
                          ([choice, count]) => (
                            <div key={choice} className="flex items-center gap-3">
                              <span className="w-1/2 text-sm text-slate-700">
                                {choice}
                              </span>
                              <div className="flex-1 h-5 rounded-full bg-slate-100 overflow-hidden">
                                <div
                                  className="h-full rounded-full bg-sky-500"
                                  style={{
                                    width: `${result.total_responses > 0 ? (count / result.total_responses) * 100 : 0}%`,
                                  }}
                                />
                              </div>
                              <span className="w-12 text-right text-xs text-slate-500">
                                {count}
                              </span>
                            </div>
                          ),
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

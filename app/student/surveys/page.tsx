"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  ExternalLink,
  LoaderCircle,
  Menu,
  Search,
  Send,
  Star,
} from "lucide-react";
import { UserAccountMenu } from "../../components/user-account-menu";
import { NotificationBell } from "../../components/notification-bell";
import { ShowNavigation } from "../../lib/app_nav";
import type { User } from "../../lib/api_user";
import {
  STUDENT_DEFAULT_USER,
  useStudentSession,
} from "../_lib/use-student-session";
import {
  checkUserSurveyResponse,
  getPublicSurveys,
  getSurveyQuestions,
  submitSurveyResponse,
  parseSurveyOptions,
  getSurveyStatus,
  type Survey,
  type SurveyQuestion,
  type SurveyAnswer,
} from "../../lib/api_survey";

const initialUser: User = STUDENT_DEFAULT_USER;

export default function StudentSurveysPage() {
  const router = useRouter();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [searchKeyword, setSearchKeyword] = useState("");
  const { currentUser, isCheckingAuth } = useStudentSession();

  // Modal state for filling survey
  const [selectedSurvey, setSelectedSurvey] = useState<Survey | null>(null);
  const [questions, setQuestions] = useState<SurveyQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [ratingValues, setRatingValues] = useState<Record<number, number>>({});
  const [hasResponded, setHasResponded] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isModalLoading, setIsModalLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadSurveys() {
      if (!currentUser) return;
      try {
        const allSurveys = await getPublicSurveys();
        if (!isMounted) return;
        setSurveys(allSurveys);
        setErrorMessage("");
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

  const activeSurveys = useMemo(
    () => filteredSurveys.filter((s) => getSurveyStatus(s).label === "Đang mở"),
    [filteredSurveys],
  );

  const otherSurveys = useMemo(
    () => filteredSurveys.filter((s) => getSurveyStatus(s).label !== "Đang mở"),
    [filteredSurveys],
  );

  async function handleOpenSurvey(survey: Survey) {
    setSelectedSurvey(survey);
    setIsSubmitted(false);
    setAnswers({});
    setRatingValues({});
    setIsModalLoading(true);
    setErrorMessage("");

    try {
      const [questionData, responded] = await Promise.all([
        getSurveyQuestions(survey.id),
        checkUserSurveyResponse(survey.id, user.id),
      ]);
      setQuestions(questionData);
      setHasResponded(responded);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Không thể tải câu hỏi.",
      );
    } finally {
      setIsModalLoading(false);
    }
  }

  const handleAnswer = useCallback((questionId: number, value: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  }, []);

  const handleRating = useCallback(
    (questionId: number, value: number) => {
      setRatingValues((prev) => ({ ...prev, [questionId]: value }));
      setAnswers((prev) => ({ ...prev, [questionId]: String(value) }));
    },
    [],
  );

  const handleCheckboxToggle = useCallback(
    (questionId: number, option: string) => {
      setAnswers((prev) => {
        const current = prev[questionId] || "";
        const selected = current ? current.split("||") : [];
        const idx = selected.indexOf(option);
        if (idx >= 0) {
          selected.splice(idx, 1);
        } else {
          selected.push(option);
        }
        return { ...prev, [questionId]: selected.join("||") };
      });
    },
    [],
  );

  const allRequiredAnswered = useMemo(() => {
    return questions.every((q) => {
      if (!q.is_required) return true;
      const answer = answers[q.id];
      return answer && answer.trim().length > 0;
    });
  }, [questions, answers]);

  async function handleSubmitSurvey() {
    if (!currentUser || !selectedSurvey || isSubmitting) return;
    setIsSubmitting(true);
    setErrorMessage("");

    try {
      const answerList: SurveyAnswer[] = questions.map((q) => ({
        question_id: q.id,
        answer: answers[q.id] || "",
      }));
      await submitSurveyResponse(selectedSurvey.id, currentUser.id, answerList);
      setIsSubmitted(true);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Không thể gửi khảo sát.",
      );
    } finally {
      setIsSubmitting(false);
    }
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
            <h1 className="text-lg font-semibold">Khảo sát ý kiến</h1>
            <p className="text-sm text-slate-500">
              Tham gia khảo sát để góp ý cho các khóa học sắp tới
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

        {isLoading ? (
          <div className="flex min-h-[50vh] items-center justify-center rounded-[28px] bg-white shadow-sm">
            <div className="flex items-center gap-3 text-slate-600">
              <LoaderCircle className="h-5 w-5 animate-spin" />
              <span>Đang tải danh sách khảo sát...</span>
            </div>
          </div>
        ) : (
          <>
            {/* Hero section */}
            <section className="rounded-[30px] bg-linear-to-r from-sky-700 via-cyan-700 to-emerald-600 px-6 py-7 text-white shadow-xl">
              <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                <div className="max-w-3xl">
                  <p className="text-sm font-medium uppercase tracking-[0.24em] text-sky-100">
                    Đóng góp ý kiến
                  </p>
                  <h2 className="mt-3 text-3xl font-semibold">
                    Ý kiến của bạn giúp xây dựng khóa học tốt hơn
                  </h2>
                  <p className="mt-3 max-w-2xl text-sm leading-6 text-sky-50">
                    Trước khi mở khóa học mới, giảng viên cần lắng nghe nhu cầu
                    của sinh viên. Hãy tham gia các khảo sát dưới đây để đóng góp
                    vào việc định hướng nội dung giảng dạy.
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-3xl bg-white/15 px-5 py-4 backdrop-blur">
                    <p className="text-sm text-sky-100">Khảo sát đang mở</p>
                    <p className="mt-2 text-3xl font-semibold">
                      {activeSurveys.length}
                    </p>
                  </div>
                  <div className="rounded-3xl bg-white/15 px-5 py-4 backdrop-blur">
                    <p className="text-sm text-sky-100">Tổng số</p>
                    <p className="mt-2 text-3xl font-semibold">
                      {surveys.length}
                    </p>
                  </div>
                  <div className="rounded-3xl bg-white/15 px-5 py-4 backdrop-blur">
                    <p className="text-sm text-sky-100">Kết quả được tổng hợp</p>
                    <p className="mt-2 text-3xl font-semibold">
                      Minh bạch
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* Search */}
            <section className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-slate-200">
              <label className="relative block">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchKeyword}
                  onChange={(e) => setSearchKeyword(e.target.value)}
                  placeholder="Tìm kiếm khảo sát theo tiêu đề hoặc mô tả..."
                  className="w-full rounded-xl border border-slate-300 px-9 py-2.5 text-sm outline-none focus:border-sky-400"
                />
              </label>
            </section>

            {/* Active surveys */}
            <section>
              <h3 className="mb-4 text-xl font-semibold text-slate-900">
                Khảo sát đang mở
              </h3>

              {activeSurveys.length === 0 && otherSurveys.length === 0 ? (
                <div className="rounded-[28px] border border-dashed border-slate-300 bg-white px-6 py-12 text-center text-slate-500 shadow-sm">
                  <ClipboardList className="mx-auto h-10 w-10 text-slate-300" />
                  <p className="mt-4 font-medium">Chưa có khảo sát nào</p>
                  <p className="mt-1 text-sm">
                    Hiện tại chưa có khảo sát công khai nào. Hãy quay lại sau!
                  </p>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {activeSurveys.map((survey) => (
                    <button
                      key={survey.id}
                      type="button"
                      onClick={() => handleOpenSurvey(survey)}
                      className="group rounded-[28px] bg-white p-5 text-left shadow-sm ring-1 ring-slate-200 transition-all hover:-translate-y-1 hover:shadow-lg hover:ring-sky-300"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700">
                          Đang mở
                        </span>
                        <ExternalLink className="h-4 w-4 text-slate-400 opacity-0 transition group-hover:opacity-100" />
                      </div>

                      <h4 className="mt-3 text-lg font-semibold text-slate-900">
                        {survey.title}
                      </h4>
                      <p className="mt-1 line-clamp-2 text-sm leading-6 text-slate-600">
                        {survey.description}
                      </p>

                      <div className="mt-4 flex items-center gap-3 text-xs text-slate-500">
                        <span>
                          📅{" "}
                          {new Date(survey.created_at).toLocaleDateString(
                            "vi-VN",
                          )}
                        </span>
                        {survey.end_at ? (
                          <span>
                            ⏰ Hạn:{" "}
                            {new Date(survey.end_at).toLocaleDateString("vi-VN")}
                          </span>
                        ) : null}
                      </div>

                      <div className="mt-3 pt-3 border-t border-slate-100">
                        <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-sky-700">
                          Tham gia khảo sát
                          <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </section>

            {/* Closed/expired surveys */}
            {otherSurveys.length > 0 ? (
              <section>
                <h3 className="mb-4 text-xl font-semibold text-slate-900">
                  Khảo sát đã kết thúc
                </h3>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {otherSurveys.map((survey) => {
                    const status = getSurveyStatus(survey);
                    return (
                      <div
                        key={survey.id}
                        className="rounded-[28px] bg-white/70 p-5 shadow-sm ring-1 ring-slate-200 opacity-75"
                      >
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${status.color}`}
                        >
                          {status.label}
                        </span>
                        <h4 className="mt-3 text-lg font-semibold text-slate-800">
                          {survey.title}
                        </h4>
                        <p className="mt-1 line-clamp-2 text-sm leading-6 text-slate-500">
                          {survey.description}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </section>
            ) : null}
          </>
        )}
      </section>

      {/* ─── Survey Modal ─── */}
      {selectedSurvey ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 backdrop-blur-sm px-4">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-[32px] bg-white p-6 shadow-2xl">
            {/* Modal header */}
            <div className="flex items-start justify-between border-b border-slate-200 pb-4">
              <div className="min-w-0 flex-1 pr-4">
                <h2 className="text-lg font-semibold text-slate-900">
                  {selectedSurvey.title}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  {selectedSurvey.description}
                </p>
                {selectedSurvey.end_at ? (
                  <p className="mt-2 text-xs text-slate-400">
                    ⏰ Hạn cuối:{" "}
                    {new Date(selectedSurvey.end_at).toLocaleDateString("vi-VN")}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedSurvey(null);
                  setAnswers({});
                  setRatingValues({});
                  setIsSubmitted(false);
                }}
                className="shrink-0 rounded-xl px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
              >
                ✕
              </button>
            </div>

            {isModalLoading ? (
              <div className="flex items-center justify-center py-16">
                <LoaderCircle className="h-8 w-8 animate-spin text-slate-500" />
              </div>
            ) : hasResponded ? (
              <div className="mt-6 rounded-3xl border border-emerald-200 bg-emerald-50 p-6 text-center">
                <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" />
                <h3 className="mt-4 text-xl font-semibold text-emerald-800">
                  Bạn đã tham gia khảo sát này!
                </h3>
                <p className="mt-2 text-sm text-emerald-600">
                  Cảm ơn bạn đã đóng góp ý kiến. Mỗi phản hồi đều giúp chúng tôi
                  cải thiện chất lượng khóa học.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedSurvey(null);
                    setAnswers({});
                    setIsSubmitted(false);
                  }}
                  className="mx-auto mt-6 inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-700"
                >
                  <ClipboardList className="h-4 w-4" />
                  Quay lại danh sách
                </button>
              </div>
            ) : isSubmitted ? (
              <div className="mt-6 rounded-3xl border border-emerald-200 bg-emerald-50 p-6 text-center">
                <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" />
                <h3 className="mt-4 text-xl font-semibold text-emerald-800">
                  Gửi thành công!
                </h3>
                <p className="mt-2 text-sm text-emerald-600">
                  Câu trả lời của bạn đã được ghi nhận. Cảm ơn bạn đã đóng góp
                  ý kiến để giúp xây dựng các khóa học tốt hơn!
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedSurvey(null);
                    setAnswers({});
                    setIsSubmitted(false);
                  }}
                  className="mx-auto mt-6 inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-700"
                >
                  <ClipboardList className="h-4 w-4" />
                  Quay lại danh sách
                </button>
              </div>
            ) : questions.length === 0 ? (
              <div className="mt-6 rounded-3xl border border-dashed border-slate-300 p-8 text-center text-slate-500">
                Khảo sát này chưa có câu hỏi nào.
              </div>
            ) : (
              <>
                {/* Questions */}
                <div className="mt-4 space-y-5">
                  {questions
                    .sort((a, b) => a.sequence - b.sequence)
                    .map((question, index) => (
                      <div
                        key={question.id}
                        className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <h4 className="text-sm font-semibold text-slate-900">
                            <span className="text-sky-600">{index + 1}.</span>{" "}
                            {question.question_text}
                            {question.is_required ? (
                              <span className="ml-1 text-red-500">*</span>
                            ) : null}
                          </h4>
                          <span className="shrink-0 rounded-full bg-slate-200 px-2 py-0.5 text-xs text-slate-600">
                            {question.question_type === "text"
                              ? "Văn bản"
                              : question.question_type === "multiple_choice"
                                ? "Chọn 1"
                                : question.question_type === "checkbox"
                                  ? "Chọn nhiều"
                                  : "Đánh giá"}
                          </span>
                        </div>

                        <div className="mt-3">
                          {question.question_type === "text" ? (
                            <textarea
                              value={answers[question.id] || ""}
                              onChange={(e) =>
                                handleAnswer(question.id, e.target.value)
                              }
                              rows={3}
                              placeholder="Nhập câu trả lời..."
                              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-sky-400"
                            />
                          ) : question.question_type === "multiple_choice" ? (
                            <div className="grid gap-1.5">
                              {parseSurveyOptions(question.options).map(
                                (option) => (
                                  <button
                                    key={option}
                                    type="button"
                                    onClick={() =>
                                      handleAnswer(question.id, option)
                                    }
                                    className={`rounded-xl border px-3 py-2 text-left text-sm transition ${
                                      answers[question.id] === option
                                        ? "border-sky-500 bg-sky-50 text-sky-900"
                                        : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                                    }`}
                                  >
                                    {option}
                                  </button>
                                ),
                              )}
                            </div>
                          ) : question.question_type === "checkbox" ? (
                            <div className="grid gap-1.5">
                              {parseSurveyOptions(question.options).map(
                                (option) => {
                                  const selected = (
                                    answers[question.id] || ""
                                  ).includes(option);
                                  return (
                                    <button
                                      key={option}
                                      type="button"
                                      onClick={() =>
                                        handleCheckboxToggle(
                                          question.id,
                                          option,
                                        )
                                      }
                                      className={`rounded-xl border px-3 py-2 text-left text-sm transition ${
                                        selected
                                          ? "border-sky-500 bg-sky-50 text-sky-900"
                                          : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                                      }`}
                                    >
                                      <span className="mr-2">
                                        {selected ? "☑" : "□"}
                                      </span>
                                      {option}
                                    </button>
                                  );
                                },
                              )}
                            </div>
                          ) : question.question_type === "rating" ? (
                            <div className="flex items-center gap-1">
                              {[1, 2, 3, 4, 5].map((star) => (
                                <button
                                  key={star}
                                  type="button"
                                  onClick={() =>
                                    handleRating(question.id, star)
                                  }
                                  className={`rounded-lg p-1.5 transition ${
                                    (ratingValues[question.id] || 0) >= star
                                      ? "text-amber-500"
                                      : "text-slate-300 hover:text-amber-400"
                                  }`}
                                >
                                  <Star
                                    className="h-7 w-7"
                                    fill={
                                      (ratingValues[question.id] || 0) >= star
                                        ? "currentColor"
                                        : "none"
                                    }
                                  />
                                </button>
                              ))}
                              {ratingValues[question.id] ? (
                                <span className="ml-2 text-sm text-slate-600">
                                  {ratingValues[question.id]}/5
                                </span>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    ))}
                </div>

                {/* Submit button */}
                <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-slate-600">
                    Đã trả lời{" "}
                    {
                      Object.values(answers).filter((v) => v?.trim()).length
                    }
                    /{questions.length} câu hỏi
                  </p>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedSurvey(null);
                        setAnswers({});
                        setRatingValues({});
                        setIsSubmitted(false);
                      }}
                      className="rounded-2xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Hủy
                    </button>
                    <button
                      type="button"
                      onClick={handleSubmitSurvey}
                      disabled={!allRequiredAnswered || isSubmitting}
                      className={`inline-flex items-center gap-2 rounded-2xl px-5 py-2.5 text-sm font-semibold text-white transition ${
                        !allRequiredAnswered || isSubmitting
                          ? "cursor-not-allowed bg-slate-400"
                          : "bg-sky-600 hover:bg-sky-700"
                      }`}
                    >
                      {isSubmitting ? (
                        <LoaderCircle className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                      {isSubmitting ? "Đang gửi..." : "Gửi khảo sát"}
                    </button>
                  </div>
                </div>
                {!allRequiredAnswered ? (
                  <p className="mt-3 text-sm text-amber-600">
                    Vui lòng trả lời tất cả câu hỏi bắt buộc (có dấu *) trước
                    khi gửi.
                  </p>
                ) : null}
              </>
            )}
          </div>
        </div>
      ) : null}
    </main>
  );
}

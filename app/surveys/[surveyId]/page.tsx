"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  ClipboardList,
  LoaderCircle,
  Send,
  Star,
} from "lucide-react";

import { PublicSiteShell } from "../../components/public-site-shell";
import {
  checkUserSurveyResponse,
  getPublicSurvey,
  getSurveyQuestions,
  submitSurveyResponse,
  parseSurveyOptions,
  getSurveyStatus,
  type Survey,
  type SurveyAnswer,
  type SurveyQuestion,
} from "../../lib/api_survey";
import type { User } from "../../lib/api_user";
import { getCurrentUser } from "../../lib/auth_client";

const USE_MOCK_DATA = process.env.NEXT_PUBLIC_USE_MOCK_DATA !== "false";

export default function PublicSurveyDetailPage() {
  const router = useRouter();
  const params = useParams<{ surveyId: string }>();
  const surveyId = Number(params.surveyId ?? "0");

  const [isLoading, setIsLoading] = useState(true);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [survey, setSurvey] = useState<Survey | null>(null);
  const [questions, setQuestions] = useState<SurveyQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [hasResponded, setHasResponded] = useState(false);
  const [ratingValues, setRatingValues] = useState<Record<number, number>>({});
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  // Auth check
  useEffect(() => {
    if (USE_MOCK_DATA) {
      setCurrentUser({
        id: 1,
        username: "Nguyễn Văn An",
        email: "nguyenvanan@student.edu.vn",
        icon: "/icon.png",
        role: "student",
      });
      setIsAuthLoading(false);
      return;
    }

    async function checkAuth() {
      try {
        const storedToken =
          localStorage.getItem("accessToken") ||
          sessionStorage.getItem("accessToken");
        if (storedToken) {
          const user = await getCurrentUser(storedToken);
          setCurrentUser(user);
        }
      } catch {
        // not logged in
      } finally {
        setIsAuthLoading(false);
      }
    }

    checkAuth();
  }, []);

  // Load survey data
  useEffect(() => {
    if (isAuthLoading) return;

    let isMounted = true;

    async function loadData() {
      try {
        if (!surveyId || Number.isNaN(surveyId)) {
          throw new Error("Mã khảo sát không hợp lệ.");
        }

        const [surveyData, questionData] = await Promise.all([
          getPublicSurvey(surveyId),
          getSurveyQuestions(surveyId),
        ]);

        if (!isMounted) return;

        setSurvey(surveyData);
        setQuestions(questionData);

        if (currentUser) {
          try {
            const responded = await checkUserSurveyResponse(
              surveyId,
              currentUser.id,
            );
            setHasResponded(responded);
          } catch {
            // ignore
          }
        }

        setErrorMessage("");
      } catch (error) {
        if (!isMounted) return;
        setErrorMessage(
          error instanceof Error ? error.message : "Không thể tải khảo sát.",
        );
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadData();
    return () => {
      isMounted = false;
    };
  }, [surveyId, currentUser, isAuthLoading]);

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

  async function handleSubmit() {
    if (!currentUser || !survey || isSubmitting) return;
    setIsSubmitting(true);
    setErrorMessage("");

    try {
      const answerList: SurveyAnswer[] = questions.map((q) => ({
        question_id: q.id,
        answer: answers[q.id] || "",
      }));

      await submitSurveyResponse(survey.id, currentUser.id, answerList);
      setIsSubmitted(true);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Không thể gửi khảo sát.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  const showLoginPrompt = !currentUser && !isAuthLoading;

  return (
    <PublicSiteShell activePath="/surveys" user={currentUser}>
      <div className="mx-auto max-w-3xl space-y-6">
        <button
          type="button"
          onClick={() => router.push("/surveys")}
          className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-slate-600 hover:bg-white/60"
        >
          <ArrowLeft className="h-4 w-4" />
          Quay lại danh sách khảo sát
        </button>

        {isLoading || isAuthLoading ? (
          <div className="flex items-center justify-center rounded-[32px] bg-white/90 py-20 shadow-sm">
            <LoaderCircle className="h-8 w-8 animate-spin text-slate-500" />
          </div>
        ) : errorMessage ? (
          <div className="rounded-3xl border border-red-200 bg-red-50 px-6 py-5 text-red-700">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <p className="font-semibold">Lỗi</p>
                <p className="mt-1 text-sm">{errorMessage}</p>
              </div>
            </div>
          </div>
        ) : showLoginPrompt ? (
          <div className="flex flex-col items-center justify-center gap-4 rounded-[32px] bg-white/90 px-6 py-16 text-center shadow-sm">
            <AlertCircle className="h-10 w-10 text-amber-500" />
            <h2 className="text-xl font-semibold text-slate-900">
              Vui lòng đăng nhập
            </h2>
            <p className="max-w-md text-sm text-slate-600">
              Bạn cần đăng nhập để tham gia khảo sát. Nếu chưa có tài khoản, hãy
              đăng ký để bắt đầu đóng góp ý kiến.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => router.push("/login")}
                className="rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800"
              >
                Đăng nhập
              </button>
              <button
                type="button"
                onClick={() => router.push("/register")}
                className="rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-800 hover:bg-slate-50"
              >
                Đăng ký
              </button>
            </div>
          </div>
        ) : survey ? (
          <>
            {/* Survey header */}
            <div className="rounded-[32px] bg-white/90 p-6 shadow-sm ring-1 ring-slate-200">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h1 className="text-2xl font-semibold text-slate-900">
                    {survey.title}
                  </h1>
                  <p className="mt-2 text-sm leading-7 text-slate-600">
                    {survey.description}
                  </p>
                </div>
                <span
                  className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium ${
                    getSurveyStatus(survey).color
                  }`}
                >
                  {getSurveyStatus(survey).label}
                </span>
              </div>

              {survey.end_at ? (
                <p className="mt-4 flex items-center gap-2 text-sm text-slate-500">
                  <span>⏰</span>
                  Hạn cuối:{" "}
                  {new Date(survey.end_at).toLocaleDateString("vi-VN", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
              ) : null}

              {hasResponded ? (
                <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                  Bạn đã tham gia khảo sát này rồi. Cảm ơn bạn đã đóng góp ý
                  kiến!
                </div>
              ) : null}

              {isSubmitted ? (
                <div className="mt-6 rounded-3xl border border-emerald-200 bg-emerald-50 p-6 text-center">
                  <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" />
                  <h2 className="mt-4 text-xl font-semibold text-emerald-800">
                    Cảm ơn bạn đã tham gia!
                  </h2>
                  <p className="mt-2 text-sm text-emerald-600">
                    Câu trả lời của bạn đã được ghi nhận. Chúng tôi sẽ sử dụng
                    thông tin này để cải thiện chất lượng khóa học.
                  </p>
                  <button
                    type="button"
                    onClick={() => router.push("/surveys")}
                    className="mx-auto mt-6 inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-700"
                  >
                    <ClipboardList className="h-4 w-4" />
                    Xem thêm khảo sát
                  </button>
                </div>
              ) : null}
            </div>

            {/* Questions */}
            {!hasResponded && !isSubmitted ? (
              <div className="space-y-5">
                {questions.map((question, index) => (
                  <div
                    key={question.id}
                    className="rounded-[28px] bg-white/90 p-6 shadow-sm ring-1 ring-slate-200"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="text-base font-semibold text-slate-900">
                        <span className="text-sky-600">{index + 1}.</span>{" "}
                        {question.question_text}
                        {question.is_required ? (
                          <span className="ml-1 text-red-500">*</span>
                        ) : null}
                      </h3>
                      <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">
                        {question.question_type === "text"
                          ? "Văn bản"
                          : question.question_type === "multiple_choice"
                            ? "Chọn 1"
                            : question.question_type === "checkbox"
                              ? "Chọn nhiều"
                              : "Đánh giá"}
                      </span>
                    </div>

                    <div className="mt-4">
                      {question.question_type === "text" ? (
                        <textarea
                          value={answers[question.id] || ""}
                          onChange={(e) =>
                            handleAnswer(question.id, e.target.value)
                          }
                          rows={3}
                          placeholder="Nhập câu trả lời của bạn..."
                          className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-sky-400"
                        />
                      ) : question.question_type === "multiple_choice" ? (
                        <div className="grid gap-2">
                          {parseSurveyOptions(question.options).map(
                            (option) => (
                              <button
                                key={option}
                                type="button"
                                onClick={() =>
                                  handleAnswer(question.id, option)
                                }
                                className={`rounded-2xl border px-4 py-3 text-left text-sm transition ${
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
                        <div className="grid gap-2">
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
                                    handleCheckboxToggle(question.id, option)
                                  }
                                  className={`rounded-2xl border px-4 py-3 text-left text-sm transition ${
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
                        <div className="flex items-center gap-2">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <button
                              key={star}
                              type="button"
                              onClick={() => handleRating(question.id, star)}
                              className={`rounded-xl p-2 transition ${
                                (ratingValues[question.id] || 0) >= star
                                  ? "text-amber-500"
                                  : "text-slate-300 hover:text-amber-400"
                              }`}
                            >
                              <Star
                                className="h-8 w-8"
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

                <div className="rounded-[28px] bg-white/90 p-6 shadow-sm ring-1 ring-slate-200">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-slate-600">
                      Đã trả lời{" "}
                      {Object.keys(answers).filter(
                        (k) => answers[Number(k)]?.trim(),
                      ).length }
                      /{questions.length} câu hỏi
                    </p>
                    <button
                      type="button"
                      onClick={handleSubmit}
                      disabled={!allRequiredAnswered || isSubmitting}
                      className={`inline-flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold text-white transition ${
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
                  {!allRequiredAnswered ? (
                    <p className="mt-3 text-sm text-amber-600">
                      Vui lòng trả lời tất cả câu hỏi bắt buộc (có dấu *) trước
                      khi gửi.
                    </p>
                  ) : null}
                </div>
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </PublicSiteShell>
  );
}

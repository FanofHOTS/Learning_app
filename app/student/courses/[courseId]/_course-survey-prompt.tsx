"use client";

import { useEffect, useState } from "react";
import {
  CheckCircle2,
  ClipboardList,
  LoaderCircle,
  Star,
  X,
} from "lucide-react";
import {
  checkSurveyResponded,
  getSurveyQuestions,
  getSurveysByCourse,
  submitSurveyResponse,
  type Survey,
  type SurveyQuestion,
} from "../../../lib/api_course_survey";

type SurveyPromptProps = {
  courseId: number;
  userId: number;
};

function parseOptions(options: string): string[] {
  try {
    return Array.isArray(JSON.parse(options)) ? JSON.parse(options) : [];
  } catch {
    return [];
  }
}

export default function CourseSurveyPrompt({
  courseId,
  userId,
}: SurveyPromptProps) {
  const [survey, setSurvey] = useState<Survey | null>(null);
  const [questions, setQuestions] = useState<SurveyQuestion[]>([]);
  const [hasResponded, setHasResponded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [errors, setErrors] = useState<Record<number, string>>({});

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const surveys = await getSurveysByCourse(courseId);
        const activeSurvey = surveys.find((s) => s.is_active);
        if (!activeSurvey) {
          if (mounted) setIsLoading(false);
          return;
        }

        const responded = await checkSurveyResponded(
          activeSurvey.id,
          userId,
        );
        if (responded) {
          if (mounted) setHasResponded(true);
          if (mounted) setIsLoading(false);
          return;
        }

        const qs = await getSurveyQuestions(activeSurvey.id);
        if (mounted) {
          setSurvey(activeSurvey);
          setQuestions(qs.sort((a, b) => a.sequence - b.sequence));
          // Init answers
          const init: Record<number, string> = {};
          qs.forEach((q) => {
            if (q.question_type === "checkbox") {
              init[q.id] = "";
            } else {
              init[q.id] = "";
            }
          });
          setAnswers(init);
        }
      } catch {
        // Silently fail - don't block the course page
      } finally {
        if (mounted) setIsLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, [courseId, userId]);

  if (isLoading || isDismissed || !survey || hasResponded || questions.length === 0) {
    return null;
  }

  if (successMessage) {
    return (
      <div className="rounded-3xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-emerald-700">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5" />
          <span className="font-medium">{successMessage}</span>
        </div>
      </div>
    );
  }

  function setAnswer(questionId: number, value: string) {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[questionId];
      return next;
    });
  }

  function toggleCheckboxOption(questionId: number, option: string) {
    const current = answers[questionId] ?? "";
    const parts = current.split("||").filter(Boolean);
    const idx = parts.indexOf(option);
    if (idx >= 0) {
      parts.splice(idx, 1);
    } else {
      parts.push(option);
    }
    setAnswer(questionId, parts.join("||"));
  }

  async function handleSubmit() {
    // Validate required fields
    const newErrors: Record<number, string> = {};
    questions.forEach((q) => {
      if (q.is_required && !answers[q.id]?.trim()) {
        newErrors[q.id] = "Vui lòng trả lời câu hỏi này";
      }
    });
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsSubmitting(true);
    try {
      if (!survey) return;
      await submitSurveyResponse({
        survey_id: survey.id,
        user_id: userId,
        answers: questions.map((q) => ({
          question_id: q.id,
          answer: answers[q.id] ?? "",
        })),
      });
      setSuccessMessage(
        "Cảm ơn bạn đã tham gia khảo sát! Câu trả lời của bạn sẽ giúp giảng viên cải thiện khóa học.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="rounded-3xl border border-sky-200 bg-gradient-to-br from-sky-50 to-white p-6 shadow-sm">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-100">
            <ClipboardList className="h-5 w-5 text-sky-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-900">
              {survey.title}
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              {survey.description || "Giúp giảng viên hiểu rõ hơn về nhu cầu của bạn"}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setIsDismissed(true)}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          aria-label="Đóng"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-5 space-y-4">
        {questions.map((question, idx) => (
          <div key={question.id}>
            <div className="mb-2 flex items-start gap-2">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sky-100 text-xs font-medium text-sky-700">
                {idx + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-900">
                  {question.question_text}
                  {question.is_required && (
                    <span className="ml-1 text-red-500">*</span>
                  )}
                </p>
              </div>
            </div>

            {/* Text input */}
            {question.question_type === "text" && (
              <textarea
                value={answers[question.id] ?? ""}
                onChange={(e) => setAnswer(question.id, e.target.value)}
                rows={3}
                placeholder="Nhập câu trả lời..."
                className={`ml-8 w-full rounded-xl border ${
                  errors[question.id]
                    ? "border-red-300 bg-red-50"
                    : "border-slate-200 bg-white"
                } px-3 py-2.5 text-sm outline-none focus:border-sky-400`}
              />
            )}

            {/* Rating */}
            {question.question_type === "rating" && (
              <div className="ml-8 flex items-center gap-2">
                {[1, 2, 3, 4, 5].map((star) => {
                  const current = parseInt(answers[question.id] ?? "0");
                  return (
                    <button
                      key={star}
                      type="button"
                      onClick={() =>
                        setAnswer(question.id, String(star))
                      }
                      className="transition-transform hover:scale-110"
                    >
                      <Star
                        className={`h-7 w-7 ${
                          star <= current
                            ? "fill-amber-400 text-amber-400"
                            : "text-slate-200 hover:text-amber-300"
                        }`}
                      />
                    </button>
                  );
                })}
                {answers[question.id] && (
                  <span className="ml-2 text-sm font-medium text-slate-600">
                    {answers[question.id]}/5
                  </span>
                )}
              </div>
            )}

            {/* Multiple choice */}
            {question.question_type === "multiple_choice" && (
              <div className="ml-8 space-y-2">
                {parseOptions(question.options).map((option, oi) => (
                  <label
                    key={oi}
                    className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 text-sm transition-colors ${
                      answers[question.id] === option
                        ? "border-sky-400 bg-sky-50 text-sky-700"
                        : "border-slate-200 bg-white text-slate-700 hover:border-sky-200"
                    }`}
                  >
                    <input
                      type="radio"
                      name={`q-${question.id}`}
                      checked={answers[question.id] === option}
                      onChange={() => setAnswer(question.id, option)}
                      className="h-4 w-4 text-sky-600 focus:ring-sky-500"
                    />
                    {option}
                  </label>
                ))}
              </div>
            )}

            {/* Checkbox */}
            {question.question_type === "checkbox" && (
              <div className="ml-8 space-y-2">
                {parseOptions(question.options).map((option, oi) => {
                  const selected =
                    (answers[question.id] ?? "")
                      .split("||")
                      .filter(Boolean)
                      .indexOf(option) >= 0;
                  return (
                    <label
                      key={oi}
                      className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 text-sm transition-colors ${
                        selected
                          ? "border-sky-400 bg-sky-50 text-sky-700"
                          : "border-slate-200 bg-white text-slate-700 hover:border-sky-200"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() =>
                          toggleCheckboxOption(question.id, option)
                        }
                        className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                      />
                      {option}
                    </label>
                  );
                })}
              </div>
            )}

            {errors[question.id] && (
              <p className="ml-8 mt-1 text-xs text-red-500">
                {errors[question.id]}
              </p>
            )}
          </div>
        ))}
      </div>

      <div className="mt-6 flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={() => setIsDismissed(true)}
          className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
        >
          Để sau
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="inline-flex items-center gap-2 rounded-xl bg-sky-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? (
            <LoaderCircle className="h-4 w-4 animate-spin" />
          ) : (
            <CheckCircle2 className="h-4 w-4" />
          )}
          Gửi khảo sát
        </button>
      </div>
    </div>
  );
}

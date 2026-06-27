"use client";

import { useEffect, useState } from "react";
import {
  BarChart3,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FileText,
  LoaderCircle,
  Plus,
  Star,
  Trash2,
} from "lucide-react";
import {
  createSurvey,
  createSurveyQuestion,
  deleteSurvey,
  deleteSurveyQuestion,
  getSurveyQuestions,
  getSurveyResults,
  getSurveysByCourse,
  updateSurvey,
  updateSurveyQuestion,
  type Survey,
  type SurveyQuestion,
  type SurveyResultStats,
} from "../../../lib/api_course_survey";

type CourseSurveySectionProps = {
  courseId: number;
};

const QUESTION_TYPES = [
  { value: "text", label: "Văn bản" },
  { value: "multiple_choice", label: "Trắc nghiệm 1 đáp án" },
  { value: "checkbox", label: "Trắc nghiệm nhiều đáp án" },
  { value: "rating", label: "Đánh giá sao (1-5)" },
] as const;

function parseOptions(options: string): string[] {
  try {
    const parsed = JSON.parse(options);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function AddQuestionForm({
  surveyId,
  onCreated,
  onCancel,
}: {
  surveyId: number;
  onCreated: () => void;
  onCancel: () => void;
}) {
  const [text, setText] = useState("");
  const [type, setType] = useState<string>("text");
  const [options, setOptions] = useState<string[]>([""]);
  const [isRequired, setIsRequired] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  async function handleSave() {
    if (!text.trim()) return;
    setIsSaving(true);
    try {
      await createSurveyQuestion({
        survey_id: surveyId,
        question_text: text.trim(),
        question_type: type,
        options: JSON.stringify(options.filter((o) => o.trim())),
        sequence: 0,
        is_required: isRequired,
      });
      onCreated();
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4">
      <div className="space-y-3">
        <label className="space-y-1.5 text-sm text-slate-700">
          <span>Câu hỏi</span>
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Nhập câu hỏi khảo sát..."
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-sky-400"
          />
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1.5 text-sm text-slate-700">
            <span>Loại câu hỏi</span>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-sky-400"
            >
              {QUESTION_TYPES.map((qt) => (
                <option key={qt.value} value={qt.value}>
                  {qt.label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-2 self-end pb-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={isRequired}
              onChange={(e) => setIsRequired(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-sky-600"
            />
            Bắt buộc
          </label>
        </div>

        {(type === "multiple_choice" || type === "checkbox") && (
          <div className="space-y-2">
            <p className="text-sm text-slate-600">Các lựa chọn:</p>
            {options.map((opt, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <input
                  type="text"
                  value={opt}
                  onChange={(e) => {
                    const next = [...options];
                    next[idx] = e.target.value;
                    setOptions(next);
                  }}
                  placeholder={`Lựa chọn ${idx + 1}`}
                  className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-sky-400"
                />
                <button
                  type="button"
                  onClick={() => setOptions(options.filter((_, i) => i !== idx))}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-500"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => setOptions([...options, ""])}
              className="inline-flex items-center gap-1 text-xs font-medium text-sky-600 hover:text-sky-700"
            >
              <Plus className="h-3.5 w-3.5" /> Thêm lựa chọn
            </button>
          </div>
        )}

        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving || !text.trim()}
            className="inline-flex items-center gap-1.5 rounded-xl bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
            Thêm câu hỏi
          </button>
        </div>
      </div>
    </div>
  );
}

function SurveyResultsView({ surveyId }: { surveyId: number }) {
  const [results, setResults] = useState<SurveyResultStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function load() {
      const data = await getSurveyResults(surveyId);
      if (mounted) setResults(data);
      setIsLoading(false);
    }
    load();
    return () => {
      mounted = false;
    };
  }, [surveyId]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-6">
        <LoaderCircle className="h-5 w-5 animate-spin text-slate-400" />
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-500">
        Chưa có kết quả khảo sát nào.
      </div>
    );
  }

  const totalRespondents = Math.max(
    ...results.map((r) => r.total_responses),
    0,
  );

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
        <span className="font-semibold">{totalRespondents}</span> sinh viên đã tham gia khảo sát
      </div>

      {results.map((result) => (
        <div
          key={result.question_id}
          className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4"
        >
          <p className="text-sm font-semibold text-slate-900">
            {result.question_text}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {result.total_responses} câu trả lời
          </p>

          <div className="mt-3">
            {result.question_type === "text" && (
              <div className="space-y-2">
                {result.text_answers.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">
                    Chưa có câu trả lời văn bản
                  </p>
                ) : (
                  result.text_answers.map((answer, i) => (
                    <div
                      key={i}
                      className="rounded-xl bg-white px-3 py-2 text-sm text-slate-700 shadow-sm ring-1 ring-slate-200"
                    >
                      {answer}
                    </div>
                  ))
                )}
              </div>
            )}

            {result.question_type === "rating" && (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className={`h-5 w-5 ${
                        star <= Math.round(result.rating_avg)
                          ? "fill-amber-400 text-amber-400"
                          : "text-slate-200"
                      }`}
                    />
                  ))}
                </div>
                <span className="text-lg font-bold text-slate-900">
                  {result.rating_avg.toFixed(1)}
                </span>
                <span className="text-xs text-slate-500">
                  ({result.rating_count} lượt)
                </span>
              </div>
            )}

            {(result.question_type === "multiple_choice" ||
              result.question_type === "checkbox") && (
              <div className="space-y-2">
                {Object.entries(result.choice_counts).length === 0 ? (
                  <p className="text-xs text-slate-400 italic">
                    Chưa có dữ liệu
                  </p>
                ) : (
                  (() => {
                    const maxCount = Math.max(
                      ...Object.values(result.choice_counts),
                      1,
                    );
                    return Object.entries(result.choice_counts)
                      .sort(([, a], [, b]) => b - a)
                      .map(([choice, count]) => {
                        const pct = Math.round(
                          (count / result.total_responses) * 100,
                        );
                        return (
                          <div key={choice} className="space-y-1">
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-slate-700">{choice}</span>
                              <span className="font-medium text-slate-900">
                                {count} ({pct}%)
                              </span>
                            </div>
                            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
                              <div
                                className="h-full rounded-full bg-sky-500"
                                style={{
                                  width: `${(count / maxCount) * 100}%`,
                                }}
                              />
                            </div>
                          </div>
                        );
                      });
                  })()
                )}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function CourseSurveySection({
  courseId,
}: CourseSurveySectionProps) {
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [selectedSurveyId, setSelectedSurveyId] = useState<number | null>(null);
  const [questions, setQuestions] = useState<SurveyQuestion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [isCreatingSurvey, setIsCreatingSurvey] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [expandedSurveyId, setExpandedSurveyId] = useState<number | null>(null);
  const [showAddQuestion, setShowAddQuestion] = useState(false);

  async function loadSurveys() {
    const data = await getSurveysByCourse(courseId);
    setSurveys(data);
    if (data.length > 0 && !selectedSurveyId) {
      setSelectedSurveyId(data[0].id);
    }
    setIsLoading(false);
  }

  async function loadQuestions(surveyId: number) {
    const data = await getSurveyQuestions(surveyId);
    setQuestions(data);
  }

  useEffect(() => {
    loadSurveys();
  }, [courseId]);

  useEffect(() => {
    if (selectedSurveyId) {
      loadQuestions(selectedSurveyId);
      setShowResults(false);
    } else {
      setQuestions([]);
    }
  }, [selectedSurveyId]);

  const selectedSurvey = surveys.find((s) => s.id === selectedSurveyId) ?? null;

  async function handleCreateSurvey() {
    setIsCreatingSurvey(true);
    try {
      await createSurvey({
        course_id: courseId,
        title: "Khảo sát nhu cầu học tập",
        description:
          "Giúp giảng viên hiểu rõ hơn về nhu cầu, trình độ và mong đợi của bạn trước khi bắt đầu khóa học.",
      });
      await loadSurveys();
    } finally {
      setIsCreatingSurvey(false);
    }
  }

  async function handleDeleteSurvey(surveyId: number) {
    await deleteSurvey(surveyId);
    if (selectedSurveyId === surveyId) {
      setSelectedSurveyId(null);
    }
    await loadSurveys();
  }

  async function handleToggleActive(survey: Survey) {
    await updateSurvey(survey.id, { is_active: !survey.is_active });
    await loadSurveys();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-slate-900">
            📋 Khảo sát nhu cầu học tập
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            Tạo khảo sát để tìm hiểu nhu cầu, trình độ và mong đợi của sinh viên
          </p>
        </div>
        <button
          type="button"
          onClick={handleCreateSurvey}
          disabled={isCreatingSurvey}
          className="inline-flex items-center gap-1.5 rounded-xl bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isCreatingSurvey ? (
            <LoaderCircle className="h-4 w-4 animate-spin" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
          Tạo khảo sát
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-6">
          <LoaderCircle className="h-5 w-5 animate-spin text-slate-400" />
        </div>
      ) : surveys.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-sky-200 bg-sky-50/80 px-5 py-6 text-center text-sm text-slate-500">
          <p className="font-medium text-slate-700">Chưa có khảo sát nào</p>
          <p className="mt-1">
            Tạo khảo sát để thu thập thông tin về sinh viên trước khóa học
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {surveys.map((survey) => {
            const isExpanded = expandedSurveyId === survey.id;
            const isSelected = selectedSurveyId === survey.id;

            return (
              <div
                key={survey.id}
                className={`rounded-2xl border overflow-hidden transition-colors ${
                  isSelected
                    ? "border-sky-300 bg-sky-50/50"
                    : "border-slate-200 bg-white"
                }`}
              >
                {/* Survey header */}
                <button
                  type="button"
                  onClick={() => {
                    setSelectedSurveyId(survey.id);
                    setExpandedSurveyId(isExpanded ? null : survey.id);
                    setShowAddQuestion(false);
                  }}
                  className="flex w-full items-center justify-between px-4 py-3 text-left"
                >
                  <div className="flex items-center gap-3">
                    <FileText className="h-5 w-5 text-sky-600" />
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {survey.title}
                      </p>
                      <p className="text-xs text-slate-500">
                        {survey.is_active ? "Đang kích hoạt" : "Đã tắt"} ·{" "}
                        {survey.description.slice(0, 60)}
                        {survey.description.length > 60 ? "..." : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4 text-slate-400" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-slate-400" />
                    )}
                  </div>
                </button>

                {/* Expanded content */}
                {isExpanded && (
                  <div className="border-t border-slate-200 px-4 py-4">
                    {/* Survey actions */}
                    <div className="mb-4 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleToggleActive(survey)}
                        className={`rounded-xl px-3 py-1.5 text-xs font-medium transition-colors ${
                          survey.is_active
                            ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                            : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                        }`}
                      >
                        {survey.is_active ? "Đang hoạt động" : "Tạm tắt"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowResults(!showResults);
                          setShowAddQuestion(false);
                        }}
                        className={`rounded-xl px-3 py-1.5 text-xs font-medium transition-colors ${
                          showResults
                            ? "bg-violet-100 text-violet-700"
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        }`}
                      >
                        <BarChart3 className="mr-1 inline-block h-3.5 w-3.5" />
                        Kết quả
                      </button>

                      {!showResults && (
                        <button
                          type="button"
                          onClick={() => setShowAddQuestion(!showAddQuestion)}
                          className="rounded-xl bg-sky-100 px-3 py-1.5 text-xs font-medium text-sky-700 hover:bg-sky-200"
                        >
                          <Plus className="mr-1 inline-block h-3.5 w-3.5" />
                          Thêm câu hỏi
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => handleDeleteSurvey(survey.id)}
                        className="rounded-xl bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100"
                      >
                        <Trash2 className="mr-1 inline-block h-3.5 w-3.5" />
                        Xóa
                      </button>
                    </div>

                    {/* Results view */}
                    {showResults ? (
                      <SurveyResultsView surveyId={survey.id} />
                    ) : (
                      <>
                        {/* Add question form */}
                        {showAddQuestion && (
                          <div className="mb-4">
                            <AddQuestionForm
                              surveyId={survey.id}
                              onCreated={() => {
                                setShowAddQuestion(false);
                                loadQuestions(survey.id);
                              }}
                              onCancel={() => setShowAddQuestion(false)}
                            />
                          </div>
                        )}

                        {/* Questions list */}
                        <div className="space-y-2">
                          {questions.length === 0 ? (
                            <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-5 text-center text-sm text-slate-500">
                              Chưa có câu hỏi nào. Nhấn &quot;Thêm câu hỏi&quot; để bắt đầu tạo khảo sát.
                            </div>
                          ) : (
                            questions
                              .sort((a, b) => a.sequence - b.sequence)
                              .map((question, idx) => (
                                <div
                                  key={question.id}
                                  className="flex items-start justify-between gap-3 rounded-xl bg-white px-3 py-3 shadow-sm ring-1 ring-slate-200"
                                >
                                  <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-200 text-xs font-medium text-slate-600">
                                        {idx + 1}
                                      </span>
                                      <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-700">
                                        {QUESTION_TYPES.find(
                                          (t) => t.value === question.question_type,
                                        )?.label ?? question.question_type}
                                      </span>
                                      {question.is_required && (
                                        <span className="text-xs text-red-500">
                                          *
                                        </span>
                                      )}
                                    </div>
                                    <p className="mt-2 text-sm text-slate-700">
                                      {question.question_text}
                                    </p>
                                    {(question.question_type ===
                                      "multiple_choice" ||
                                      question.question_type ===
                                        "checkbox") && (
                                      <div className="mt-2 flex flex-wrap gap-2">
                                        {parseOptions(question.options).map(
                                          (opt, oi) => (
                                            <span
                                              key={oi}
                                              className="rounded-lg bg-slate-100 px-2 py-1 text-xs text-slate-600"
                                            >
                                              {opt}
                                            </span>
                                          ),
                                        )}
                                      </div>
                                    )}
                                  </div>
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      await deleteSurveyQuestion(question.id);
                                      loadQuestions(survey.id);
                                    }}
                                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-500"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </div>
                              ))
                          )}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

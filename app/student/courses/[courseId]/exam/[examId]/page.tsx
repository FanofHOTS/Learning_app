"use client";

import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  CheckCircle2,
  ChevronLeft,
  Clock3,
  LoaderCircle,
  Menu,
  Sparkles,
  Trophy,
  XCircle,
} from "lucide-react";
import { UserAccountMenu } from "../../../../../components/user-account-menu";
import { ShowNavigation } from "../../../../../lib/app_nav";
import type { User } from "../../../../../lib/api_user";
import {
  type Exam,
  type ExamOption,
  type ExamQuestion,
  type ExamResult,
  createRandomPassingExamResult,
  getExamById,
  getExamResultsByUserAndExam,
  getOptionsByQuestion,
  getQuestionsByExam,
  isUsingMockExamData,
  submitExamResult,
} from "../../../../../lib/api_exam";
import { completeCourseComponentAndSyncProgress } from "../../../../../lib/api_course_learning";
import {
  STUDENT_DEFAULT_USER,
  useStudentSession,
} from "../../../../_lib/use-student-session";

const initialUser: User = STUDENT_DEFAULT_USER;

type SelectedAnswer = {
  optionId: number;
  content: string;
};

function formatRemainingTime(totalSeconds: number): string {
  const safeSeconds = Math.max(0, totalSeconds);
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function calculateRemainingSeconds(deadlineMs: number): number {
  return Math.max(0, Math.ceil((deadlineMs - Date.now()) / 1000));
}

function pickLatestResult(results: ExamResult[]): ExamResult | null {
  if (results.length === 0) {
    return null;
  }

  return [...results].sort((left, right) => {
    const leftTime = left.submitted_at ? Date.parse(left.submitted_at) : 0;
    const rightTime = right.submitted_at ? Date.parse(right.submitted_at) : 0;

    if (leftTime !== rightTime) {
      return rightTime - leftTime;
    }

    return right.id - left.id;
  })[0] ?? null;
}

function pickHighestResult(results: ExamResult[]): ExamResult | null {
  if (results.length === 0) {
    return null;
  }

  return [...results].sort((left, right) => {
    if (left.score !== right.score) {
      return right.score - left.score;
    }

    const leftTime = left.submitted_at ? Date.parse(left.submitted_at) : 0;
    const rightTime = right.submitted_at ? Date.parse(right.submitted_at) : 0;
    return rightTime - leftTime;
  })[0] ?? null;
}

export default function ExamPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const params = useParams<{ courseId: string; examId: string }>();
  const courseId = Number(params.courseId ?? "0");
  const examId = Number(params.examId ?? "0");
  const componentId = Number(searchParams.get("componentId") ?? "0");
  const moduleId = Number(searchParams.get("moduleId") ?? "0");
  const shouldAutoComplete = searchParams.get("autoComplete") === "1";

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAutoGenerating, setIsAutoGenerating] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [progressNotice, setProgressNotice] = useState("");
  const [timerNotice, setTimerNotice] = useState("");
  const [exam, setExam] = useState<Exam | null>(null);
  const [questions, setQuestions] = useState<ExamQuestion[]>([]);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, SelectedAnswer>>({});
  const [examResult, setExamResult] = useState<ExamResult | null>(null);
  const [examHistory, setExamHistory] = useState<ExamResult[]>([]);
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
  const [hasTimeExpired, setHasTimeExpired] = useState(false);
  const [hasTriggeredAutoSubmit, setHasTriggeredAutoSubmit] = useState(false);
  const [hasHandledAutoMode, setHasHandledAutoMode] = useState(false);
  const submissionLockRef = useRef(false);
  const { currentUser, isCheckingAuth } = useStudentSession();

  const isAutoMockMode = shouldAutoComplete && isUsingMockExamData();
  const isAuthPending = isCheckingAuth || !currentUser;
  const user = currentUser ?? initialUser;

  const deadlineStorageKey = useMemo(() => {
    if (!currentUser || Number.isNaN(examId) || examId <= 0) {
      return "";
    }

    return `student-exam-deadline:${currentUser.id}:${examId}`;
  }, [currentUser, examId]);

  const totalScore = useMemo(() => {
    return questions.reduce((sum, question) => sum + question.score, 0);
  }, [questions]);

  const answeredCount = Object.keys(selectedAnswers).length;
  const canSubmit = questions.length > 0 && answeredCount === questions.length;
  const highestResult = useMemo(() => pickHighestResult(examHistory), [examHistory]);
  const latestResult = useMemo(() => pickLatestResult(examHistory), [examHistory]);
  const timerDisplay = useMemo(
    () => formatRemainingTime(remainingSeconds ?? 0),
    [remainingSeconds],
  );
  const isAnswerSelectionDisabled = isSubmitting || hasTimeExpired;

  function clearStoredDeadline() {
    if (typeof window === "undefined" || !deadlineStorageKey) {
      return;
    }

    window.localStorage.removeItem(deadlineStorageKey);
  }

  function resetAttemptState() {
    clearStoredDeadline();
    setSelectedAnswers({});
    setExamResult(null);
    setErrorMessage("");
    setProgressNotice("");
    setTimerNotice("");
    setRemainingSeconds(null);
    setHasTimeExpired(false);
    setHasTriggeredAutoSubmit(false);
  }

  useEffect(() => {
    let isMounted = true;

    async function loadPageData() {
      if (!currentUser) {
        return;
      }

      if (Number.isNaN(courseId) || courseId <= 0) {
        setErrorMessage("Mã khóa học không hợp lệ.");
        setIsLoading(false);
        return;
      }

      if (Number.isNaN(examId) || examId <= 0) {
        setErrorMessage("Mã bài kiểm tra không hợp lệ.");
        setIsLoading(false);
        return;
      }

      try {
        const fetchedExam = await getExamById(examId);
        const fetchedQuestions = await getQuestionsByExam(examId);
        const questionsWithOptions = await Promise.all(
          fetchedQuestions.map(async (question) => ({
            ...question,
            options: await getOptionsByQuestion(question.id),
          })),
        );
        const history = await getExamResultsByUserAndExam(currentUser.id, examId);

        if (!isMounted) {
          return;
        }

        setExam(fetchedExam);
        setQuestions(questionsWithOptions);
        setExamHistory(history);
        setErrorMessage("");
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Không thể tải dữ liệu bài kiểm tra.",
        );
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadPageData();

    return () => {
      isMounted = false;
    };
  }, [courseId, currentUser, examId]);

  useEffect(() => {
    let isMounted = true;

    async function runAutoMockFlow() {
      if (
        hasHandledAutoMode ||
        !shouldAutoComplete ||
        !currentUser ||
        !exam ||
        !isUsingMockExamData()
      ) {
        return;
      }

      try {
        setIsAutoGenerating(true);
        const generatedResult = await createRandomPassingExamResult({
          userId: currentUser.id,
          examId: exam.id,
        });

        if (componentId > 0 && moduleId > 0 && courseId > 0) {
          await completeCourseComponentAndSyncProgress({
            userId: currentUser.id,
            courseId,
            moduleId,
            courseComponentId: componentId,
          });
        }

        if (!isMounted) {
          return;
        }

        if (typeof window !== "undefined" && deadlineStorageKey) {
          window.localStorage.removeItem(deadlineStorageKey);
        }
        setExamResult(generatedResult);
        setExamHistory((currentHistory) => [...currentHistory, generatedResult]);
        setProgressNotice(
          "Chế độ mô phỏng đã tự tạo một kết quả đạt và ghi nhận thành phần bài kiểm tra là hoàn thành.",
        );
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Không thể tạo kết quả mô phỏng cho bài kiểm tra.",
        );
      } finally {
        if (isMounted) {
          setIsAutoGenerating(false);
          setHasHandledAutoMode(true);
        }
      }
    }

    void runAutoMockFlow();

    return () => {
      isMounted = false;
    };
  }, [
    componentId,
    courseId,
    currentUser,
    deadlineStorageKey,
    exam,
    hasHandledAutoMode,
    moduleId,
    shouldAutoComplete,
  ]);

  function handleSelectAnswer(questionId: number, option: ExamOption) {
    if (isAnswerSelectionDisabled) {
      return;
    }

    setSelectedAnswers((current) => ({
      ...current,
      [questionId]: {
        optionId: option.id,
        content: option.content,
      },
    }));
  }

  function isQuestionCorrect(question: ExamQuestion) {
    const selected = selectedAnswers[question.id];
    if (!selected) {
      return false;
    }

    const correctOption = question.options?.find((option) => option.is_correct);
    if (correctOption) {
      return selected.optionId === correctOption.id;
    }

    return (
      selected.content.trim().toLowerCase() ===
      question.answer.trim().toLowerCase()
    );
  }

  async function performSubmission(submissionMode: "manual" | "auto") {
    if (!exam || !currentUser || submissionLockRef.current) {
      return;
    }

    submissionLockRef.current = true;
    setIsSubmitting(true);
    setErrorMessage("");

    if (submissionMode === "auto") {
      setTimerNotice(
        "Đã hết thời gian làm bài. Hệ thống đang tự động nộp bài kiểm tra của bạn.",
      );
    } else {
      setTimerNotice("");
    }

    try {
      const correctAnswers = questions.filter(isQuestionCorrect).length;
      const score = questions.reduce((sum, question) => {
        return isQuestionCorrect(question) ? sum + question.score : sum;
      }, 0);

      const resultPayload = {
        user_id: currentUser.id,
        exam_id: exam.id,
        score,
        total_questions: questions.length,
        correct_answers: correctAnswers,
        is_passed: score >= exam.pass_score,
        submitted_at: new Date().toISOString(),
      };

      const submittedResult = await submitExamResult(resultPayload);

      if (componentId > 0 && moduleId > 0 && courseId > 0) {
        await completeCourseComponentAndSyncProgress({
          userId: currentUser.id,
          courseId,
          moduleId,
          courseComponentId: componentId,
        });
        setProgressNotice(
          "Đã ghi nhận hoàn thành thành phần bài kiểm tra và đồng bộ tiến trình khóa học.",
        );
      }

      clearStoredDeadline();
      setRemainingSeconds(0);
      setHasTimeExpired(false);
      setHasTriggeredAutoSubmit(false);
      setExamResult(submittedResult);
      setExamHistory((currentHistory) => [...currentHistory, submittedResult]);

      if (submissionMode === "auto") {
        setTimerNotice("Đã hết thời gian làm bài. Bài kiểm tra đã được nộp tự động.");
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Không thể gửi kết quả bài kiểm tra.",
      );

      if (submissionMode === "auto") {
        setTimerNotice(
          "Đã hết thời gian làm bài nhưng hệ thống chưa thể tự động nộp bài. Vui lòng bấm nộp lại bài kiểm tra.",
        );
      }
    } finally {
      submissionLockRef.current = false;
      setIsSubmitting(false);
    }
  }

  const triggerAutoSubmit = useEffectEvent(() => {
    void performSubmission("auto");
  });

  useEffect(() => {
    if (!deadlineStorageKey) {
      return;
    }

    if (examResult || isAutoMockMode) {
      window.localStorage.removeItem(deadlineStorageKey);
    }
  }, [deadlineStorageKey, examResult, isAutoMockMode]);

  useEffect(() => {
    if (
      !deadlineStorageKey ||
      !exam ||
      !currentUser ||
      examResult ||
      isLoading ||
      isAutoMockMode
    ) {
      return;
    }

    const durationInMs = Math.max(0, exam.duration_minutes) * 60_000;
    const storedDeadline = Number(window.localStorage.getItem(deadlineStorageKey));
    const deadlineMs =
      Number.isFinite(storedDeadline) && storedDeadline > 0
        ? storedDeadline
        : Date.now() + durationInMs;

    window.localStorage.setItem(deadlineStorageKey, String(deadlineMs));

    const syncTimer = () => {
      const nextRemainingSeconds = calculateRemainingSeconds(deadlineMs);
      setRemainingSeconds(nextRemainingSeconds);
      setHasTimeExpired(nextRemainingSeconds === 0);
    };

    syncTimer();
    const intervalId = window.setInterval(syncTimer, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [currentUser, deadlineStorageKey, exam, examResult, isAutoMockMode, isLoading]);

  useEffect(() => {
    if (
      !exam ||
      !currentUser ||
      examResult ||
      isSubmitting ||
      !hasTimeExpired ||
      hasTriggeredAutoSubmit ||
      isAutoMockMode
    ) {
      return;
    }

    setHasTriggeredAutoSubmit(true);
    triggerAutoSubmit();
  }, [
    currentUser,
    exam,
    examResult,
    hasTimeExpired,
    hasTriggeredAutoSubmit,
    isAutoMockMode,
    isSubmitting,
  ]);

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

  async function handleSubmitExam() {
    if (!exam || !currentUser) {
      return;
    }

    await performSubmission("manual");
  }

  async function handleCreateMockAttempt() {
    if (!currentUser || !exam) {
      return;
    }

    try {
      setIsAutoGenerating(true);
      const generatedResult = await createRandomPassingExamResult({
        userId: currentUser.id,
        examId: exam.id,
      });

      if (componentId > 0 && moduleId > 0 && courseId > 0) {
        await completeCourseComponentAndSyncProgress({
          userId: currentUser.id,
          courseId,
          moduleId,
          courseComponentId: componentId,
        });
      }

      clearStoredDeadline();
      setExamResult(generatedResult);
      setExamHistory((currentHistory) => [...currentHistory, generatedResult]);
      setProgressNotice(
        "Đã tạo thêm một lượt làm mô phỏng đạt yêu cầu và đồng bộ tiến trình học tập.",
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Không thể tạo thêm lượt làm mô phỏng.",
      );
    } finally {
      setIsAutoGenerating(false);
    }
  }

  const currentScore =
    examResult?.score ??
    questions.reduce((sum, question) => {
      return isQuestionCorrect(question) ? sum + question.score : sum;
    }, 0);

  const earnedPercentage =
    totalScore > 0 ? Math.round((currentScore / totalScore) * 100) : 0;

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
            <h1 className="text-lg font-semibold">Làm bài kiểm tra</h1>
            <p className="text-sm text-slate-500">
              Hoàn thành bài kiểm tra để cập nhật tiến trình học tập của khóa học
            </p>
          </div>
        </div>

        <div className="hidden md:block">
          <UserAccountMenu user={user} variant="dashboard" />
        </div>

        <div className="hidden items-center gap-3">
          <div className="rounded-full bg-sky-100 px-3 py-1 text-sm font-medium text-sky-700">
            {user.role === "student" ? "Học sinh" : user.role}
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold">{user.username}</p>
            <p className="text-xs text-slate-500">{user.email}</p>
          </div>
        </div>
      </header>

      <section className="mx-auto mt-24 max-w-7xl px-4 pb-16">
        {isLoading ? (
          <div className="flex min-h-[60vh] items-center justify-center">
            <LoaderCircle className="h-10 w-10 animate-spin text-slate-500" />
          </div>
        ) : (
          <div className="space-y-6">
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm text-slate-500">Bài kiểm tra {exam?.id ?? examId}</p>
                  <h2 className="text-2xl font-semibold text-slate-900">
                    {exam?.title ?? "Bài kiểm tra không xác định"}
                  </h2>
                </div>
                <div className="grid gap-2 sm:grid-cols-3">
                  <div className="rounded-2xl bg-slate-100 px-4 py-3 text-center">
                    <p className="text-xs uppercase text-slate-500">Thời gian</p>
                    <p className="text-lg font-semibold text-slate-900">
                      {exam?.duration_minutes ?? 0} phút
                    </p>
                  </div>
                  <div className="rounded-2xl bg-slate-100 px-4 py-3 text-center">
                    <p className="text-xs uppercase text-slate-500">Số câu</p>
                    <p className="text-lg font-semibold text-slate-900">
                      {questions.length}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-slate-100 px-4 py-3 text-center">
                    <p className="text-xs uppercase text-slate-500">Điểm đạt</p>
                    <p className="text-lg font-semibold text-slate-900">
                      {exam?.pass_score ?? 0}
                    </p>
                  </div>
                </div>
              </div>
              {exam?.description ? (
                <p className="mt-4 text-sm leading-7 text-slate-600">
                  {exam.description}
                </p>
              ) : null}

              {!examResult && !isAutoMockMode ? (
                <div
                  className={`mt-6 flex flex-col gap-4 rounded-3xl border px-5 py-4 sm:flex-row sm:items-center sm:justify-between ${
                    hasTimeExpired
                      ? "border-red-200 bg-red-50 text-red-700"
                      : (remainingSeconds ?? 0) <= 300
                        ? "border-amber-200 bg-amber-50 text-amber-700"
                        : "border-sky-200 bg-sky-50 text-sky-700"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <Clock3 className="mt-1 h-5 w-5 shrink-0" />
                    <div>
                      <p className="font-semibold">Thời gian làm bài còn lại</p>
                      <p className="mt-1 text-sm">
                        {hasTimeExpired
                          ? "Đã hết thời gian. Hệ thống sẽ tự động nộp bài kiểm tra."
                          : "Khi đồng hồ về 00:00, hệ thống sẽ tự động nộp bài kiểm tra."}
                      </p>
                    </div>
                  </div>
                  <div className="rounded-2xl bg-white/80 px-4 py-3 text-center shadow-sm">
                    <p className="text-xs uppercase text-slate-500">Đếm ngược</p>
                    <p className="text-2xl font-semibold text-slate-900">
                      {timerDisplay}
                    </p>
                  </div>
                </div>
              ) : null}

              <div className="mt-6 grid gap-3 md:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 px-4 py-4">
                  <p className="text-sm text-slate-500">Kết quả cao nhất</p>
                  <p className="mt-2 text-lg font-semibold text-slate-900">
                    {highestResult
                      ? `${highestResult.score} điểm - ${
                          highestResult.is_passed ? "Đạt" : "Chưa đạt"
                        }`
                      : "Chưa có kết quả"}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 px-4 py-4">
                  <p className="text-sm text-slate-500">Kết quả mới nhất</p>
                  <p className="mt-2 text-lg font-semibold text-slate-900">
                    {latestResult
                      ? `${latestResult.score} điểm - ${
                          latestResult.is_passed ? "Đạt" : "Chưa đạt"
                        }`
                      : "Chưa có kết quả"}
                  </p>
                </div>
              </div>
            </div>

            {errorMessage ? (
              <div className="rounded-3xl border border-red-200 bg-red-50 p-5 text-red-700">
                <div className="flex items-start gap-3">
                  <XCircle className="mt-1 h-5 w-5 shrink-0" />
                  <div>
                    <p className="font-semibold">Lỗi</p>
                    <p className="mt-1 text-sm">{errorMessage}</p>
                  </div>
                </div>
              </div>
            ) : null}

            {progressNotice ? (
              <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-700">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="mt-1 h-5 w-5 shrink-0" />
                  <div>
                    <p className="font-semibold">Tiến trình học tập đã được cập nhật</p>
                    <p className="mt-1 text-sm">{progressNotice}</p>
                  </div>
                </div>
              </div>
            ) : null}

            {timerNotice ? (
              <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-amber-700">
                <div className="flex items-start gap-3">
                  <Clock3 className="mt-1 h-5 w-5 shrink-0" />
                  <div>
                    <p className="font-semibold">Thông báo thời gian làm bài</p>
                    <p className="mt-1 text-sm">{timerNotice}</p>
                  </div>
                </div>
              </div>
            ) : null}

            {examResult ? (
              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-sm text-slate-500">Kết quả bài kiểm tra</p>
                    <h3 className="text-2xl font-semibold text-slate-900">
                      {examResult.is_passed ? "Bạn đã đạt" : "Bạn chưa đạt"}
                    </h3>
                  </div>
                  <div className="rounded-3xl bg-slate-100 px-5 py-4 text-center">
                    <p className="text-xs uppercase text-slate-500">Tổng điểm</p>
                    <p className="text-3xl font-semibold text-slate-900">
                      {examResult.score}
                    </p>
                    <p className="text-sm text-slate-500">
                      / {totalScore || exam?.max_score || 100}
                    </p>
                  </div>
                </div>

                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  <div className="rounded-3xl bg-slate-50 p-5">
                    <p className="text-sm text-slate-500">Số câu đúng</p>
                    <p className="mt-2 text-xl font-semibold text-slate-900">
                      {examResult.correct_answers} / {examResult.total_questions}
                    </p>
                  </div>
                  <div className="rounded-3xl bg-slate-50 p-5">
                    <p className="text-sm text-slate-500">Tỷ lệ</p>
                    <p className="mt-2 text-xl font-semibold text-slate-900">
                      {earnedPercentage}%
                    </p>
                  </div>
                </div>

                <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
                  <button
                    type="button"
                    className="inline-flex items-center justify-center rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-700"
                    onClick={() => router.push(`/student/courses/${courseId}`)}
                  >
                    <ChevronLeft className="mr-2 h-4 w-4" />
                    Quay lại chi tiết khóa học
                  </button>
                  {isUsingMockExamData() ? (
                    <button
                      type="button"
                      className="inline-flex items-center justify-center rounded-2xl bg-sky-100 px-4 py-3 text-sm font-semibold text-sky-700 transition hover:bg-sky-200"
                      onClick={handleCreateMockAttempt}
                      disabled={isAutoGenerating}
                    >
                      {isAutoGenerating ? (
                        <span className="flex items-center gap-2">
                          <LoaderCircle className="h-4 w-4 animate-spin" />
                          Đang tạo lượt làm mô phỏng...
                        </span>
                      ) : (
                        <span className="flex items-center gap-2">
                          <Sparkles className="h-4 w-4" />
                          Tạo lượt làm mô phỏng mới
                        </span>
                      )}
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="inline-flex items-center justify-center rounded-2xl bg-sky-100 px-4 py-3 text-sm font-semibold text-sky-700 transition hover:bg-sky-200"
                      onClick={resetAttemptState}
                    >
                      Làm lại bài kiểm tra
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-6 flex items-center justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">
                      Câu hỏi trắc nghiệm
                    </h3>
                    <p className="text-sm text-slate-500">
                      Chọn đáp án đúng rồi gửi kết quả để lưu về hệ thống.
                    </p>
                  </div>
                  <div className="rounded-2xl bg-slate-100 px-4 py-3 text-right">
                    <p className="text-xs uppercase text-slate-500">Đã trả lời</p>
                    <p className="text-lg font-semibold text-slate-900">
                      {answeredCount}/{questions.length}
                    </p>
                  </div>
                </div>

                {isAutoMockMode ? (
                  <div className="rounded-3xl border border-dashed border-sky-300 bg-sky-50 p-8 text-center text-sky-700">
                    <Trophy className="mx-auto h-8 w-8" />
                    <p className="mt-3 font-semibold">
                      Chế độ mô phỏng đang tự tạo kết quả đạt cho bài kiểm tra này.
                    </p>
                  </div>
                ) : questions.length === 0 ? (
                  <div className="rounded-3xl border border-dashed border-slate-300 p-8 text-center text-slate-500">
                    Không có câu hỏi nào cho bài thi này.
                  </div>
                ) : (
                  <div className="space-y-6">
                    {questions.map((question) => {
                      const selected = selectedAnswers[question.id];
                      const options = question.options ?? [];

                      return (
                        <div
                          key={question.id}
                          className="rounded-3xl border border-slate-200 bg-slate-50 p-5"
                        >
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <p className="text-sm font-semibold text-slate-900">
                                Câu {question.sequence}
                              </p>
                              <p className="mt-2 text-base text-slate-700">
                                {question.content}
                              </p>
                            </div>
                            <div className="rounded-2xl bg-white px-3 py-2 text-sm text-slate-500 shadow-sm">
                              {question.score} điểm
                            </div>
                          </div>

                          <div className="mt-4 grid gap-3">
                            {options.map((option, index) => (
                              <button
                                key={option.id}
                                type="button"
                                onClick={() => handleSelectAnswer(question.id, option)}
                                disabled={isAnswerSelectionDisabled}
                                className={`rounded-2xl border px-4 py-3 text-left transition ${
                                  selected?.optionId === option.id
                                    ? "border-sky-600 bg-sky-100"
                                    : "border-slate-200 bg-white hover:border-slate-300"
                                } ${
                                  isAnswerSelectionDisabled
                                    ? "cursor-not-allowed opacity-70"
                                    : ""
                                }`}
                              >
                                <div className="flex items-center gap-3">
                                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border text-xs font-semibold text-slate-700">
                                    {String.fromCharCode(65 + index)}
                                  </span>
                                  <span className="text-sm text-slate-700">
                                    {option.content}
                                  </span>
                                </div>
                              </button>
                            ))}
                          </div>

                          {selected ? (
                            <div className="mt-4 text-sm text-slate-500">
                              Đã chọn:{" "}
                              <span className="font-medium text-slate-900">
                                {selected.content}
                              </span>
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                )}

                {!isAutoMockMode ? (
                  <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="rounded-3xl bg-slate-50 p-5 text-slate-700">
                      <p className="text-sm">Tổng điểm lý thuyết</p>
                      <p className="mt-2 text-xl font-semibold text-slate-900">
                        {totalScore}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={(!canSubmit && !hasTimeExpired) || isSubmitting}
                      onClick={handleSubmitExam}
                      className="inline-flex items-center justify-center rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:bg-slate-400"
                    >
                      {isSubmitting ? (
                        <span className="flex items-center gap-2">
                          <LoaderCircle className="h-5 w-5 animate-spin" />
                          Đang gửi kết quả...
                        </span>
                      ) : (
                        <span className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4" />
                          Nộp bài kiểm tra
                        </span>
                      )}
                    </button>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        )}
      </section>
    </main>
  );
}

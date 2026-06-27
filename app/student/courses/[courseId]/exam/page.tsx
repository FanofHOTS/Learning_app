"use client";
 
import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import {
   CheckCircle2,
   ChevronLeft,
   LoaderCircle,
   Menu,
   XCircle,
 } from "lucide-react";
 import { UserAccountMenu } from "../../../../components/user-account-menu";
import { NotificationBell } from "../../../../components/notification-bell";
import { ShowNavigation } from "../../../../lib/app_nav";
import type { User } from "../../../../lib/api_user";
import {
  Exam,
  ExamOption,
  ExamQuestion,
  ExamResult,
  getExamById,
  getOptionsByQuestion,
  getQuestionsByExam,
  submitExamResult,
} from "../../../../lib/api_exam";
import {
  STUDENT_DEFAULT_USER,
  useStudentSession,
} from "../../../_lib/use-student-session";
 
const initialUser: User = STUDENT_DEFAULT_USER;
 
type SelectedAnswer = {
  optionId: number;
  content: string;
};
 
export default function ExamPage() {
  const router = useRouter();
  const params = useParams<{ courseId: string; examId: string }>();
  const courseId = Number(params.courseId ?? "0");
  const examId = Number(params.examId ?? "0");

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [exam, setExam] = useState<Exam | null>(null);
  const [questions, setQuestions] = useState<ExamQuestion[]>([]);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, SelectedAnswer>>({});
  const [examResult, setExamResult] = useState<ExamResult | null>(null);
  const { currentUser, isCheckingAuth } = useStudentSession();

  useEffect(() => {
    let isMounted = true;

    async function loadExamData() {
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

        if (!isMounted) return;

        setExam(fetchedExam);
        setQuestions(questionsWithOptions);
        setErrorMessage("");
      } catch (error) {
        if (!isMounted) return;
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

    loadExamData();

    return () => {
      isMounted = false;
    };
  }, [courseId, currentUser, examId]);

  const isAuthPending = isCheckingAuth || !currentUser;
  const user = currentUser ?? initialUser;
  const totalScore = useMemo(() => {
    return questions.reduce((sum, question) => sum + question.score, 0);
  }, [questions]);

  const answeredCount = Object.keys(selectedAnswers).length;
  const canSubmit = questions.length > 0 && answeredCount === questions.length;

  function handleSelectAnswer(questionId: number, option: ExamOption) {
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
      selected.content.trim().toLowerCase() ===
      question.answer.trim().toLowerCase()
    );
  }

  async function handleSubmitExam() {
    if (!exam) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");

    try {
      const correctAnswers = questions.filter(isQuestionCorrect).length;
      const score = questions.reduce((sum, question) => {
        return isQuestionCorrect(question) ? sum + question.score : sum;
      }, 0);

      const resultPayload = {
        user_id: user.id,
        exam_id: exam.id,
        score,
        total_questions: questions.length,
        correct_answers: correctAnswers,
        is_passed: score >= exam.pass_score,
      };

      const submittedResult = await submitExamResult(resultPayload);
      setExamResult(submittedResult);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Không thể gửi kết quả bài kiểm tra.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  const score = examResult?.score ??
    questions.reduce((sum, question) => {
      return isQuestionCorrect(question) ? sum + question.score : sum;
    }, 0);

  const earnedPercentage = totalScore > 0 ? Math.round((score / totalScore) * 100) : 0;

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
              Hoàn thành bài kiểm tra để xem kết quả và quay lại khóa học.
            </p>
          </div>
        </div>

        <div className="hidden items-center gap-2 md:flex">
          <NotificationBell userId={user.id} />
          <UserAccountMenu user={user} variant="dashboard" />
        </div>

        <div className="hidden items-center gap-3">
          <div className="rounded-full bg-sky-100 px-3 py-1 text-sm font-medium text-sky-700">
            {user.role === "student" ? "Sinh viên" : user.role}
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
                    <p className="text-sm text-slate-500">/ {totalScore}</p>
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
                  <button
                    type="button"
                    className="inline-flex items-center justify-center rounded-2xl bg-sky-100 px-4 py-3 text-sm font-semibold text-sky-700 transition hover:bg-sky-200"
                    onClick={() => setExamResult(null)}
                  >
                    Làm lại bài kiểm tra
                  </button>
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

                {questions.length === 0 ? (
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
                                className={`rounded-2xl border px-4 py-3 text-left transition ${
                                  selected?.optionId === option.id
                                    ? "border-sky-600 bg-sky-100"
                                    : "border-slate-200 bg-white hover:border-slate-300"
                                }`}
                              >
                                <div className="flex items-center gap-3">
                                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border text-xs font-semibold text-slate-700">
                                    {String.fromCharCode(65 + index)}
                                  </span>
                                  <span className="text-sm text-slate-700">{option.content}</span>
                                </div>
                              </button>
                            ))}
                          </div>

                          {selected ? (
                            <div className="mt-4 text-sm text-slate-500">
                              Đã chọn: <span className="font-medium text-slate-900">{selected.content}</span>
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="rounded-3xl bg-slate-50 p-5 text-slate-700">
                    <p className="text-sm">Tổng điểm lý thuyết</p>
                    <p className="mt-2 text-xl font-semibold text-slate-900">
                      {totalScore}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={!canSubmit || isSubmitting}
                    onClick={handleSubmitExam}
                    className="inline-flex items-center justify-center rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:bg-slate-400"
                  >
                    {isSubmitting ? (
                      <span className="flex items-center gap-2">
                        <LoaderCircle className="h-5 w-5 animate-spin" />
                        Gửi kết quả...
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4" />
                        Nộp bài kiểm tra
                      </span>
                    )}
                  </button>
                </div>
              </div>
            )}
        </div>
        )}
      </section>
    </main>
  );
}

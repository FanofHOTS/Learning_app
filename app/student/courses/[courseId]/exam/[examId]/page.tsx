"use client";

import {
  useCallback,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
} from "react";
import Image from "next/image";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  CheckCircle2,
  ChevronLeft,
  Clock3,
  LoaderCircle,
  Menu,
  XCircle,
} from "lucide-react";
import { UserAccountMenu } from "../../../../../components/user-account-menu";
import { NotificationBell } from "../../../../../components/notification-bell";
import { ShowNavigation } from "../../../../../lib/app_nav";
import type { User } from "../../../../../lib/api_user";
import {
  type Exam,
  type ExamAnswerSelection,
  type ExamOption,
  type ExamQuestion,
  type ExamResult,
  buildAnswerPayload,
  getBlankValues,
  getExamById,
  getExamResultsByUserAndExam,
  getLevelLabel,
  getLevelColor,
  getOptionsByQuestion,
  getQuestionTypeLabel,
  getQuestionsByExam,
  isFillInBlankType,
  isMultipleAnswerType,
  isSelectionCorrect,
  isSelectionProvided,
  selectExamQuestionSubset,
  shuffleExamQuestions,
  type AnswerItem,
} from "../../../../../lib/api_exam";
import {
  ExamAttemptError,
  autosaveExamAttempt,
  parseServerTimestamp,
  startExamAttempt,
  submitExamAttempt,
  type ExamAttemptRead,
} from "../../../../../lib/api_exam_attempt";
import {
  clearExamAttemptDraft,
  loadExamAttemptDraft,
  pruneExamAttemptDrafts,
  saveExamAttemptDraft,
} from "../../../../../lib/exam_attempt_storage";
import { completeCourseComponentAndSyncProgress } from "../../../../../lib/api_course_learning";
import DiscussionSection from "../../../../../components/discussion-section";
import {
  STUDENT_DEFAULT_USER,
  useStudentSession,
} from "../../../../_lib/use-student-session";

const initialUser: User = STUDENT_DEFAULT_USER;

/** Giờ:phút:giây của lần lưu gần nhất. */
function formatSavedClock(date: Date): string {
  return date.toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

/**
 * Dựng lại lựa chọn đáp án từ câu trả lời đã lưu trên máy chủ.
 * Nội dung phương án được tra từ danh sách phương án của câu hỏi để phần
 * "Đã chọn: ..." hiển thị đúng.
 */
function buildSelectionsFromAttemptAnswers(
  answers: AnswerItem[] | null | undefined,
  questionMap: Map<number, ExamQuestion>,
): Record<number, ExamAnswerSelection> {
  const selections: Record<number, ExamAnswerSelection> = {};

  for (const answer of answers ?? []) {
    if (!answer || typeof answer.question_id !== "number") {
      continue;
    }

    const optionIds = Array.isArray(answer.option_ids)
      ? answer.option_ids.filter((optionId) => typeof optionId === "number")
      : [];

    if (optionIds.length > 1) {
      selections[answer.question_id] = { kind: "multiple", optionIds };
      continue;
    }

    if (optionIds.length === 1) {
      const options = questionMap.get(answer.question_id)?.options ?? [];
      selections[answer.question_id] = {
        kind: "single",
        optionId: optionIds[0],
        content:
          options.find((option) => option.id === optionIds[0])?.content ?? "",
      };
      continue;
    }

    if (typeof answer.answer_text === "string") {
      selections[answer.question_id] = {
        kind: "blanks",
        values: answer.answer_text.split("|").map((value) => value.trim()),
      };
    }
  }

  return selections;
}

/** Số câu đã trả lời trong một bộ lựa chọn. */
function countAnsweredSelections(
  questions: ExamQuestion[],
  selections: Record<number, ExamAnswerSelection>,
): number {
  return questions.filter((question) =>
    isSelectionProvided(question, selections[question.id]),
  ).length;
}

function formatRemainingTime(totalSeconds: number): string {
  const safeSeconds = Math.max(0, totalSeconds);
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function calculateRemainingSeconds(deadlineMs: number): number {
  return Math.max(0, Math.ceil((deadlineMs - Date.now()) / 1000));
}

/** Thông báo khi cấu trúc câu hỏi phải bù câu từ nhóm khác cho đủ số lượng. */
function buildStructureNotice(result: {
  configured: boolean;
  filledFromOtherGroups: number;
}): string {
  if (!result.configured || result.filledFromOtherGroups <= 0) {
    return "";
  }

  return `Một số nhóm trong cấu trúc câu hỏi không đủ câu nên đề đã bù ${result.filledFromOtherGroups} câu từ nhóm khác để đủ số lượng.`;
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

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [progressNotice, setProgressNotice] = useState("");
  const [structureNotice, setStructureNotice] = useState("");
  const [timerNotice, setTimerNotice] = useState("");
  const [exam, setExam] = useState<Exam | null>(null);
  const [questions, setQuestions] = useState<ExamQuestion[]>([]);
  const [selectedAnswers, setSelectedAnswers] = useState<
    Record<number, ExamAnswerSelection>
  >({});
  const [examResult, setExamResult] = useState<ExamResult | null>(null);
  const [examHistory, setExamHistory] = useState<ExamResult[]>([]);
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
  const [hasTimeExpired, setHasTimeExpired] = useState(false);
  const [hasTriggeredAutoSubmit, setHasTriggeredAutoSubmit] = useState(false);
  const [isQuestionCountBlocked, setIsQuestionCountBlocked] = useState(false);
  const [attemptId, setAttemptId] = useState<number | null>(null);
  const [saveState, setSaveState] = useState<
    "idle" | "dirty" | "saving" | "saved" | "error"
  >("idle");
  const [lastSavedAtLabel, setLastSavedAtLabel] = useState("");
  const [saveErrorMessage, setSaveErrorMessage] = useState("");
  const [restoredNotice, setRestoredNotice] = useState("");
  const [deadlineMs, setDeadlineMs] = useState<number | null>(null);
  const submissionLockRef = useRef(false);
  const allQuestionsPoolRef = useRef<ExamQuestion[]>([]);
  const attemptIdRef = useRef<number | null>(null);
  const studentIdRef = useRef(0);
  const selectedAnswersRef = useRef<Record<number, ExamAnswerSelection>>({});
  const questionsRef = useRef<ExamQuestion[]>([]);
  const examResultRef = useRef<ExamResult | null>(null);
  const dirtyRef = useRef(false);
  const saveInFlightRef = useRef(false);
  const { currentUser, isCheckingAuth } = useStudentSession();

  const isAuthPending = isCheckingAuth || !currentUser;
  const user = currentUser ?? initialUser;

  useEffect(() => {
    if (currentUser) {
      studentIdRef.current = currentUser.id;
    }
  }, [currentUser]);

  useEffect(() => {
    selectedAnswersRef.current = selectedAnswers;
  }, [selectedAnswers]);

  useEffect(() => {
    questionsRef.current = questions;
  }, [questions]);

  useEffect(() => {
    examResultRef.current = examResult;
  }, [examResult]);

  useEffect(() => {
    // Dọn bản nháp của các lượt làm bài đã bỏ dở từ lâu (giữ 7 ngày).
    pruneExamAttemptDrafts();
  }, []);

  /** Bản lưu dự phòng trên trình duyệt, ghi ngay khi đổi đáp án. */
  function persistDraft(answers: Record<number, ExamAnswerSelection>) {
    const attempt = attemptIdRef.current;
    const studentId = studentIdRef.current;
    if (!attempt || studentId <= 0 || examId <= 0) {
      return;
    }

    saveExamAttemptDraft(studentId, examId, {
      attemptId: attempt,
      answers,
      savedAt: Date.now(),
    });
  }

  /** Máy chủ đã chốt lượt làm bài (hết giờ hoặc nộp ở tab khác). */
  const applySubmittedAttempt = useCallback((attempt: ExamAttemptRead) => {
    const result = attempt.result;
    if (!result) {
      return;
    }

    clearExamAttemptDraft(attempt.user_id, attempt.exam_id);
    dirtyRef.current = false;
    setSaveState("idle");
    setDeadlineMs(null);
    setRemainingSeconds(0);
    setHasTimeExpired(false);
    setHasTriggeredAutoSubmit(false);
    setExamResult(result);
    setExamHistory((current) =>
      current.some((entry) => entry.id === result.id)
        ? current
        : [...current, result],
    );
    setTimerNotice(
      "Bài làm đã được máy chủ ghi nhận và nộp. Bạn không thể chỉnh sửa thêm.",
    );
  }, []);

  /**
   * Đẩy câu trả lời hiện tại lên máy chủ.
   *
   * Chỉ báo "đã lưu" khi máy chủ trả về thành công. Lỗi mạng thì giữ nguyên
   * trạng thái chưa lưu và tự thử lại; bản lưu trên trình duyệt vẫn còn.
   */
  const flushAnswers = useCallback(
    async (options: { keepalive?: boolean } = {}): Promise<boolean> => {
      const attempt = attemptIdRef.current;
      if (!attempt || examResultRef.current) {
        return true;
      }
      if (saveInFlightRef.current) {
        return false;
      }
      if (!dirtyRef.current) {
        return true;
      }

      saveInFlightRef.current = true;
      setSaveState("saving");

      try {
        const response = await autosaveExamAttempt(
          attempt,
          questionsRef.current.map((question) =>
            buildAnswerPayload(
              question,
              selectedAnswersRef.current[question.id],
            ),
          ),
          { keepalive: options.keepalive },
        );

        if (response.result) {
          // Máy chủ tự nộp vì đã hết giờ — hiển thị kết quả, ngừng lưu.
          applySubmittedAttempt(response);
          return true;
        }

        dirtyRef.current = false;
        setSaveState("saved");
        setLastSavedAtLabel(formatSavedClock(new Date()));
        setSaveErrorMessage("");
        if (
          typeof response.remaining_seconds === "number" &&
          response.remaining_seconds >= 0
        ) {
          // Đồng bộ lại đồng hồ theo máy chủ ở mỗi lần lưu thành công.
          setDeadlineMs(Date.now() + response.remaining_seconds * 1000);
        }
        return true;
      } catch (error) {
        if (
          error instanceof ExamAttemptError &&
          error.kind === "already_submitted"
        ) {
          return true;
        }

        setSaveState("error");
        setSaveErrorMessage(
          error instanceof Error
            ? error.message
            : "Không lưu được bài làm lên máy chủ.",
        );
        return false;
      } finally {
        saveInFlightRef.current = false;
      }
    },
    [applySubmittedAttempt],
  );

  // Lưu sau khi ngừng đổi đáp án ~0.9s.
  useEffect(() => {
    if (!attemptId || examResult || saveState !== "dirty") {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void flushAnswers();
    }, 900);

    return () => window.clearTimeout(timeoutId);
  }, [selectedAnswers, attemptId, examResult, saveState, flushAnswers]);

  // Lưu định kỳ ngắn phòng khi đáp án chưa được đẩy lên (mất mạng, tab nền).
  useEffect(() => {
    if (!attemptId || examResult) {
      return;
    }

    const intervalId = window.setInterval(() => {
      if (dirtyRef.current) {
        void flushAnswers();
      }
    }, 10_000);

    return () => window.clearInterval(intervalId);
  }, [attemptId, examResult, flushAnswers]);

  // Thử lại khi lỗi lưu: mỗi lần trạng thái quay lại "error" là hẹn 5s sau.
  useEffect(() => {
    if (!attemptId || examResult || saveState !== "error") {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void flushAnswers();
    }, 5000);

    return () => window.clearTimeout(timeoutId);
  }, [attemptId, examResult, saveState, flushAnswers]);

  // Đóng tab/chuyển tab: cố gắng gửi nốt bản lưu mới nhất.
  useEffect(() => {
    if (!attemptId || examResult) {
      return;
    }

    const flushOnHide = () => {
      if (dirtyRef.current) {
        void flushAnswers({ keepalive: true });
      }
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        flushOnHide();
      }
    };

    window.addEventListener("pagehide", flushOnHide);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("pagehide", flushOnHide);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [attemptId, examResult, flushAnswers]);

  const totalScore = useMemo(() => {
    return questions.reduce((sum, question) => sum + question.score, 0);
  }, [questions]);

  const answeredCount = questions.filter((question) =>
    isSelectionProvided(question, selectedAnswers[question.id]),
  ).length;
  const canSubmit = questions.length > 0 && answeredCount === questions.length && !isQuestionCountBlocked;
  const highestResult = useMemo(() => pickHighestResult(examHistory), [examHistory]);
  const latestResult = useMemo(() => pickLatestResult(examHistory), [examHistory]);
  const durationMinutes = exam?.duration_minutes;
  const hasTimeLimit =
    Number.isFinite(durationMinutes) && (durationMinutes ?? 0) > 0;
  const timerDisplay = useMemo(
    () =>
      remainingSeconds === null
        ? "--:--"
        : formatRemainingTime(remainingSeconds),
    [remainingSeconds],
  );
  const isAnswerSelectionDisabled = isSubmitting || hasTimeExpired;

  function resetAttemptState() {
    if (!currentUser || !exam) {
      return;
    }

    // Làm mới bộ câu hỏi nếu đang ở chế độ chọn subset (pool > yêu cầu)
    const pool = allQuestionsPoolRef.current;
    const targetCount = exam.total_questions ?? 0;
    let nextQuestions = questions;

    setStructureNotice("");
    if (pool.length > targetCount && targetCount > 0) {
      const result = selectExamQuestionSubset(
        pool,
        targetCount,
        exam.question_distribution_mode,
        exam.question_distribution,
      );
      nextQuestions = shuffleExamQuestions(result.selected);
      setStructureNotice(buildStructureNotice(result));
    } else {
      // Xáo trộn lại toàn bộ bộ câu hỏi cho lượt làm lại
      nextQuestions = shuffleExamQuestions(questions);
    }

    setSelectedAnswers({});
    selectedAnswersRef.current = {};
    setQuestions(nextQuestions);
    questionsRef.current = nextQuestions;
    dirtyRef.current = false;
    setExamResult(null);
    examResultRef.current = null;
    setErrorMessage("");
    setProgressNotice("");
    setTimerNotice("");
    setRestoredNotice("");
    setSaveState("idle");
    setSaveErrorMessage("");
    setLastSavedAtLabel("");
    setRemainingSeconds(null);
    setHasTimeExpired(false);
    setHasTriggeredAutoSubmit(false);
    setDeadlineMs(null);
    setAttemptId(null);
    attemptIdRef.current = null;
    clearExamAttemptDraft(currentUser.id, exam.id);

    // Mỗi lần làm lại là một lượt mới trên máy chủ (đồng hồ mới, không ghi đè
    // kết quả đã nộp trước đó).
    void (async () => {
      try {
        const attempt = await startExamAttempt({
          userId: currentUser.id,
          examId: exam.id,
          questionIds: nextQuestions.map((question) => question.id),
          durationMinutes: exam.duration_minutes,
        });

        attemptIdRef.current = attempt.id;
        setAttemptId(attempt.id);
        setDeadlineMs(
          typeof attempt.remaining_seconds === "number"
            ? Date.now() + attempt.remaining_seconds * 1000
            : null,
        );
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Không tạo được lượt làm bài mới.",
        );
      }
    })();
  }

  /** Ghi nhận đáp án mới: lưu trình duyệt ngay, đẩy lên máy chủ sau ~0.9s. */
  function commitAnswers(next: Record<number, ExamAnswerSelection>) {
    selectedAnswersRef.current = next;
    setSelectedAnswers(next);
    persistDraft(next);
    dirtyRef.current = true;
    setSaveState("dirty");
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

        // Kiểm tra số lượng câu hỏi hiện có so với số lượng yêu cầu
        const countBlocked = fetchedExam.total_questions > 0 && fetchedQuestions.length < fetchedExam.total_questions;
        setIsQuestionCountBlocked(countBlocked);

        // Nếu có nhiều câu hỏi hơn yêu cầu, chọn tập con theo tỷ lệ mức độ nhận thức (Bloom)
        const shouldSelectSubset =
          !countBlocked &&
          fetchedExam.total_questions > 0 &&
          fetchedQuestions.length > fetchedExam.total_questions;

        let finalQuestions = questionsWithOptions;

        // Lưu toàn bộ câu hỏi gốc để dùng khi làm lại
        allQuestionsPoolRef.current = questionsWithOptions;

        if (shouldSelectSubset) {
          const result = selectExamQuestionSubset(
            questionsWithOptions,
            fetchedExam.total_questions,
            fetchedExam.question_distribution_mode,
            fetchedExam.question_distribution,
          );
          finalQuestions = result.selected;
          setStructureNotice(buildStructureNotice(result));
        } else {
          setStructureNotice("");
        }

        setExam(fetchedExam);
        setExamHistory(history);
        studentIdRef.current = currentUser.id;

        // Xáo trộn thứ tự câu hỏi cho lượt làm này và đánh số lại 1..N
        const shuffledQuestions = shuffleExamQuestions(finalQuestions);
        const questionMap = new Map<number, ExamQuestion>(
          questionsWithOptions.map((question) => [question.id, question]),
        );

        if (countBlocked || shuffledQuestions.length === 0) {
          setQuestions(shuffledQuestions);
          setErrorMessage("");
          return;
        }

        let attempt: ExamAttemptRead;
        try {
          // Máy chủ giữ thời gian bắt đầu/hạn nộp và câu trả lời đã lưu tạm;
          // tải lại trang sẽ nhận lại đúng lượt đang làm thay vì tạo lượt mới.
          attempt = await startExamAttempt({
            userId: currentUser.id,
            examId: fetchedExam.id,
            questionIds: shuffledQuestions.map((question) => question.id),
            durationMinutes: fetchedExam.duration_minutes,
          });
        } catch (startError) {
          if (!isMounted) {
            return;
          }
          setQuestions(shuffledQuestions);
          setSaveState("error");
          setSaveErrorMessage(
            startError instanceof Error
              ? startError.message
              : "Không tạo được phiên làm bài trên máy chủ.",
          );
          return;
        }

        if (!isMounted) {
          return;
        }

        // Giữ đúng bộ câu hỏi của lượt đang làm để lần quay lại thấy đúng đề.
        const restoredQuestions = attempt.question_ids
          .map((questionIdValue) => questionMap.get(questionIdValue))
          .filter((question): question is ExamQuestion => Boolean(question));

        const activeQuestions =
          restoredQuestions.length > 0
            ? restoredQuestions.map((question, index) => ({
                ...question,
                sequence: index + 1,
              }))
            : shuffledQuestions;

        setQuestions(activeQuestions);
        questionsRef.current = activeQuestions;

        attemptIdRef.current = attempt.id;
        setAttemptId(attempt.id);
        setDeadlineMs(
          typeof attempt.remaining_seconds === "number"
            ? Date.now() + attempt.remaining_seconds * 1000
            : null,
        );

        if (attempt.status === "submitted") {
          setErrorMessage("");
          applySubmittedAttempt(attempt);
          return;
        }

        const serverSelections = buildSelectionsFromAttemptAnswers(
          attempt.answers,
          questionMap,
        );
        const draft = loadExamAttemptDraft(currentUser.id, fetchedExam.id);
        const serverSavedAt = parseServerTimestamp(attempt.last_saved_at);
        const useDraft =
          draft !== null &&
          draft.attemptId === attempt.id &&
          draft.savedAt > serverSavedAt &&
          Object.keys(draft.answers).length > 0;

        const restoredSelections = useDraft ? draft.answers : serverSelections;
        const restoredCount = countAnsweredSelections(
          activeQuestions,
          restoredSelections,
        );

        setSelectedAnswers(restoredSelections);
        selectedAnswersRef.current = restoredSelections;

        if (useDraft) {
          // Bản trên trình duyệt mới hơn bản máy chủ đã xác nhận → đẩy lên lại.
          dirtyRef.current = true;
          setSaveState("dirty");
        } else if (restoredCount > 0) {
          setSaveState("saved");
          if (attempt.last_saved_at) {
            setLastSavedAtLabel(
              formatSavedClock(
                new Date(parseServerTimestamp(attempt.last_saved_at)),
              ),
            );
          }
        }

        if (restoredCount > 0) {
          setRestoredNotice(
            useDraft
              ? `Đã khôi phục ${restoredCount} câu trả lời từ bản lưu trên trình duyệt (máy chủ chưa xác nhận).`
              : `Đã khôi phục ${restoredCount} câu trả lời đã lưu trên máy chủ.`,
          );
        }

        setErrorMessage("");
        return;
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
  }, [applySubmittedAttempt, courseId, currentUser, examId]);

  function handleSelectAnswer(questionId: number, option: ExamOption) {
    if (isAnswerSelectionDisabled) {
      return;
    }

    commitAnswers({
      ...selectedAnswersRef.current,
      [questionId]: {
        kind: "single",
        optionId: option.id,
        content: option.content,
      },
    });
  }

  function handleToggleMultipleAnswer(questionId: number, option: ExamOption) {
    if (isAnswerSelectionDisabled) {
      return;
    }

    const previous = selectedAnswersRef.current[questionId];
    const previousIds =
      previous?.kind === "multiple" ? previous.optionIds : [];
    const nextIds = previousIds.includes(option.id)
      ? previousIds.filter((optionId) => optionId !== option.id)
      : [...previousIds, option.id];

    commitAnswers({
      ...selectedAnswersRef.current,
      [questionId]: { kind: "multiple", optionIds: nextIds },
    });
  }

  function handleChangeBlankAnswer(
    questionId: number,
    question: ExamQuestion,
    blankIndex: number,
    value: string,
  ) {
    if (isAnswerSelectionDisabled) {
      return;
    }

    const values = getBlankValues(
      question,
      selectedAnswersRef.current[questionId],
    );
    const nextValues = values.map((blankValue, index) =>
      index === blankIndex ? value : blankValue,
    );

    commitAnswers({
      ...selectedAnswersRef.current,
      [questionId]: { kind: "blanks", values: nextValues },
    });
  }

  function isQuestionCorrect(question: ExamQuestion) {
    return isSelectionCorrect(question, selectedAnswers[question.id]);
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

      // Gửi kèm câu trả lời thật để máy chủ tự chấm. Nộp lặp trên cùng lượt
      // làm bài chỉ trả lại kết quả đã có, không tạo kết quả trùng.
      const answers = questions.map((question) =>
        buildAnswerPayload(question, selectedAnswers[question.id]),
      );

      const activeAttemptId = attemptIdRef.current;
      if (!activeAttemptId) {
        throw new Error(
          "Chưa có phiên làm bài trên máy chủ. Vui lòng tải lại trang rồi nộp lại.",
        );
      }

      const submittedAttempt = await submitExamAttempt(
        activeAttemptId,
        answers,
        {
          score,
          maxScore: totalScore,
          totalQuestions: questions.length,
          correctAnswers,
          isPassed: score >= exam.pass_score,
        },
      );

      const submittedResult = submittedAttempt.result;
      if (!submittedResult) {
        throw new Error(
          "Máy chủ chưa trả về kết quả bài kiểm tra. Vui lòng thử nộp lại.",
        );
      }

      if (score < exam.pass_score) {
        setProgressNotice(
          "Bạn chưa đạt yêu cầu bài kiểm tra. Hãy thử lại để cải thiện kết quả.",
        );
      }
      
      if (componentId > 0 && moduleId > 0 && courseId > 0 && score >= exam.pass_score) {
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

      clearExamAttemptDraft(currentUser.id, exam.id);
      dirtyRef.current = false;
      setSaveState("idle");
      setDeadlineMs(null);
      setRestoredNotice("");
      setRemainingSeconds(0);
      setHasTimeExpired(false);
      setHasTriggeredAutoSubmit(false);
      setExamResult(submittedResult);
      setExamHistory((currentHistory) =>
        currentHistory.some((entry) => entry.id === submittedResult.id)
          ? currentHistory
          : [...currentHistory, submittedResult],
      );

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
    // Hạn nộp do máy chủ cấp trong lượt làm bài; tải lại trang chỉ tính tiếp
    // phần thời gian còn lại từ mốc đó, không đặt lại đồng hồ.
    if (deadlineMs === null) {
      setRemainingSeconds(null);
      setHasTimeExpired(false);
      return;
    }

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
  }, [deadlineMs]);

  useEffect(() => {
    if (
      !exam ||
      !currentUser ||
      examResult ||
      isSubmitting ||
      !hasTimeExpired ||
      hasTriggeredAutoSubmit ||
      !hasTimeLimit
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
    hasTimeLimit,
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

        <div className="hidden items-center gap-2 md:flex">
          <NotificationBell userId={user.id} />
          <UserAccountMenu user={user} variant="dashboard" />
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
                      {hasTimeLimit ? `${durationMinutes} phút` : "Không giới hạn"}
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
              ) : null}                {hasTimeLimit && !examResult && !isQuestionCountBlocked ? (
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
                      <p className="mt-1 text-xs">
                        Hạn nộp do máy chủ giữ nên tải lại trang không làm đồng hồ
                        chạy lại.
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
            </div>                {errorMessage ? (
              <div className="rounded-3xl border border-red-200 bg-red-50 p-5 text-red-700">
                <div className="flex items-start gap-3">
                  <XCircle className="mt-1 h-5 w-5 shrink-0" />
                  <div>
                    <p className="font-semibold">
                      {isQuestionCountBlocked ? "Không thể làm bài kiểm tra" : "Lỗi"}
                    </p>
                    <p className="mt-1 text-sm">{errorMessage}</p>
                  </div>
                </div>
              </div>
            ) : null}

            {isQuestionCountBlocked ? (
              <div className="rounded-3xl border border-amber-200 bg-amber-50 p-6 text-amber-800">
                <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-3">
                    <XCircle className="mt-1 h-6 w-6 shrink-0" />
                    <div>
                      <p className="text-lg font-semibold">
                        Bài kiểm tra chưa sẵn sàng
                      </p>
                      <p className="mt-2 text-sm leading-relaxed">
                        Số lượng câu hỏi hiện tại ({questions.length})
                        {" "}thấp hơn số lượng câu hỏi yêu cầu ({exam?.total_questions ?? 0}).
                      </p>
                      <p className="mt-1 text-sm leading-relaxed">
                        Vui lòng liên hệ giảng viên để bổ sung thêm câu hỏi trước khi có thể làm bài kiểm tra này.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => router.push(`/student/courses/${courseId}`)}
                    className="inline-flex shrink-0 items-center justify-center rounded-2xl bg-amber-100 px-4 py-2.5 text-sm font-semibold text-amber-800 transition hover:bg-amber-200"
                  >
                    <ChevronLeft className="mr-2 h-4 w-4" />
                    Quay lại khóa học
                  </button>
                </div>
              </div>
            ) : null}

            {structureNotice ? (
              <div className="rounded-3xl border border-indigo-200 bg-indigo-50 p-5 text-indigo-800">
                <p className="font-semibold">Cấu trúc đề thi</p>
                <p className="mt-1 text-sm">{structureNotice}</p>
              </div>
            ) : null}

            {restoredNotice ? (
              <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-800">
                <p className="font-semibold">Đã khôi phục bài làm</p>
                <p className="mt-1 text-sm">{restoredNotice}</p>
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
                      / {(examResult.max_score ?? totalScore) || exam?.max_score || 100}
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
                  <button
                    type="button"
                    className="inline-flex items-center justify-center rounded-2xl bg-sky-100 px-4 py-3 text-sm font-semibold text-sky-700 transition hover:bg-sky-200"
                    onClick={resetAttemptState}
                  >
                    Làm lại bài kiểm tra
                  </button>
                </div>
              </div>
            ) : (
              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">
                      Câu hỏi
                    </h3>
                    <p className="text-sm text-slate-500">
                      Trả lời các câu hỏi rồi gửi kết quả để lưu về hệ thống.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {attemptId ? (
                      <div
                        className={`flex items-center gap-2 rounded-2xl px-3 py-2 text-xs font-medium ${
                          saveState === "error"
                            ? "bg-red-50 text-red-700 ring-1 ring-red-200"
                            : saveState === "saving"
                              ? "bg-sky-50 text-sky-700 ring-1 ring-sky-200"
                              : saveState === "saved"
                                ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                                : saveState === "dirty"
                                  ? "bg-amber-50 text-amber-700 ring-1 ring-amber-200"
                                  : "bg-slate-100 text-slate-600 ring-1 ring-slate-200"
                        }`}
                        title={saveErrorMessage}
                      >
                        {saveState === "saving" ? (
                          <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                        ) : saveState === "saved" ? (
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        ) : saveState === "error" ? (
                          <XCircle className="h-3.5 w-3.5" />
                        ) : (
                          <Clock3 className="h-3.5 w-3.5" />
                        )}
                        <span>
                          {saveState === "saving"
                            ? "Đang lưu..."
                            : saveState === "saved"
                              ? `Đã lưu lúc ${lastSavedAtLabel}`
                              : saveState === "error"
                                ? "Lỗi lưu - đang thử lại"
                                : saveState === "dirty"
                                  ? "Có thay đổi chưa lưu"
                                  : "Tự động lưu khi trả lời"}
                        </span>
                        {saveState === "error" ? (
                          <button
                            type="button"
                            onClick={() => void flushAnswers()}
                            className="ml-1 rounded-lg bg-red-100 px-2 py-0.5 font-semibold text-red-800 hover:bg-red-200"
                          >
                            Thử lại
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                    <div className="rounded-2xl bg-slate-100 px-4 py-3 text-right">
                      <p className="text-xs uppercase text-slate-500">Đã trả lời</p>
                      <p className="text-lg font-semibold text-slate-900">
                        {answeredCount}/{questions.length}
                      </p>
                    </div>
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
                      const isFillBlank = isFillInBlankType(question.question_type);
                      const isMultiAnswer = isMultipleAnswerType(question.question_type);
                      const blankValues = isFillBlank
                        ? getBlankValues(question, selected)
                        : [];
                      const contentSegments = isFillBlank
                        ? question.content.split(/_{2,}/)
                        : [];
                      const selectedOptionIds =
                        selected?.kind === "multiple" ? selected.optionIds : [];
                      const selectedLabels = isMultiAnswer
                        ? options
                            .filter((option) => selectedOptionIds.includes(option.id))
                            .map((option) => option.content)
                        : [];

                      return (
                        <div
                          key={question.id}
                          className="rounded-3xl border border-slate-200 bg-slate-50 p-5"
                        >
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-sm font-semibold text-slate-900">
                                  Câu {question.sequence}
                                </p>
                                <span className="rounded-full bg-slate-200 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
                                  {getQuestionTypeLabel(question.question_type)}
                                </span>
                              </div>
                              {isFillBlank ? null : (
                                <p className="mt-2 text-base text-slate-700">
                                  {question.content}
                                </p>
                              )}
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              <div className="rounded-2xl bg-white px-3 py-2 text-sm text-slate-500 shadow-sm">
                                {question.score} điểm
                              </div>
                              {question.bloom_level ? (
                                <span
                                  className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
                                  style={{
                                    backgroundColor: `${getLevelColor(question.bloom_level)}18`,
                                    color: getLevelColor(question.bloom_level),
                                    border: `1px solid ${getLevelColor(question.bloom_level)}40`,
                                  }}
                                >
                                  <span
                                    className="inline-block h-2 w-2 rounded-full"
                                    style={{ backgroundColor: getLevelColor(question.bloom_level) }}
                                  />
                                  {getLevelLabel(question.bloom_level)}
                                </span>
                              ) : null}
                            </div>
                          </div>

                          {isMultiAnswer ? (
                            <p className="mt-3 text-xs text-slate-500">
                              Chọn tất cả các đáp án đúng.
                            </p>
                          ) : isFillBlank ? (
                            <p className="mt-3 text-xs text-slate-500">
                              Điền nội dung vào từng chỗ trống.
                            </p>
                          ) : null}

                          {isFillBlank ? (
                            <div className="mt-4 flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-4 text-base leading-8 text-slate-700">
                              {contentSegments.map((segment, index) => (
                                <span
                                  key={`${question.id}-blank-${index}`}
                                  className="inline-flex flex-wrap items-center gap-2"
                                >
                                  {segment ? <span>{segment}</span> : null}
                                  {index < blankValues.length ? (
                                    <input
                                      type="text"
                                      value={blankValues[index] ?? ""}
                                      onChange={(event) =>
                                        handleChangeBlankAnswer(
                                          question.id,
                                          question,
                                          index,
                                          event.target.value,
                                        )
                                      }
                                      disabled={isAnswerSelectionDisabled}
                                      placeholder={`Chỗ trống ${index + 1}`}
                                      className="min-w-40 rounded-2xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100 disabled:cursor-not-allowed disabled:opacity-70"
                                    />
                                  ) : null}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <div className="mt-4 grid gap-3">
                              {options.map((option, index) => {
                                const isOptionSelected = isMultiAnswer
                                  ? selectedOptionIds.includes(option.id)
                                  : selected?.kind === "single" &&
                                    selected.optionId === option.id;

                                return (
                                  <button
                                    key={option.id}
                                    type="button"
                                    onClick={() =>
                                      isMultiAnswer
                                        ? handleToggleMultipleAnswer(question.id, option)
                                        : handleSelectAnswer(question.id, option)
                                    }
                                    disabled={isAnswerSelectionDisabled}
                                    className={`rounded-2xl border px-4 py-3 text-left transition ${
                                      isOptionSelected
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
                                );
                              })}
                            </div>
                          )}

                          {isFillBlank || isMultiAnswer ? (
                            selectedLabels.length > 0 ? (
                              <div className="mt-4 text-sm text-slate-500">
                                Đã chọn:{" "}
                                <span className="font-medium text-slate-900">
                                  {selectedLabels.join(", ")}
                                </span>
                              </div>
                            ) : null
                          ) : selected?.kind === "single" ? (
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

                {!isQuestionCountBlocked ? (
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

        {componentId > 0 ? (
          <DiscussionSection
            courseComponentId={componentId}
            currentUser={user}
          />
        ) : null}
      </section>
    </main>
  );
}

"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import {
  Edit3,
  LoaderCircle,
  Menu,
  Plus,
  Save,
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  Trash2,
  X,
  Sparkles,
} from "lucide-react";
import { UserAccountMenu } from "../../../components/user-account-menu";
import { NotificationBell } from "../../../components/notification-bell";
import { ShowNavigation } from "../../../lib/app_nav";
import type { User } from "../../../lib/api_user";
import { useInstructorSession } from "../../_lib/use-instructor-session";
import DiscussionSection from "../../../components/discussion-section";
import BloomDistribution from "./_bloom-distribution";
import { getCourseComponentByRef } from "../../../lib/api_course_component";
import {
  Exam,
  ExamQuestion,
  getInstructorExamById,
  getInstructorExamQuestions,
  getInstructorQuestionOptions,
  createInstructorQuestion,
  updateInstructorQuestion,
  deleteInstructorQuestion,
  createInstructorOption,
  updateInstructorOption,
  deleteInstructorOption,
  reorderInstructorExamQuestions,
} from "../../../lib/api_exam_instructor";
import {
  getLevelLabel,
  getLevelColor,
  getFillInBlankCount,
  getQuestionTypeLabel,
  isFillInBlankType,
  isMultipleAnswerType,
  formatBlankAnswers,
  parseFillInBlankAnswers,
  splitBlankAlternatives,
} from "../../../lib/api_exam";

const initialUser: User = {
  id: 0,
  username: "Giảng viên",
  email: "giao_vien@example.com",
  icon: "/icon.png",
  role: "instructor",
};

type DraftOption = {
  id: number | null;
  tempId: string;
  question_id: number;
  content: string;
  is_correct: boolean;
};

type QuestionWithOptions = Omit<ExamQuestion, "options"> & {
  options: DraftOption[];
  blank_answers?: string[];
};

type DraftQuestion = Omit<ExamQuestion, "id" | "options"> & {
  bloom_level?: string;
  options: DraftOption[];
  blank_answers?: string[];
};

// Dùng bộ đếm tạm để phân biệt các lựa chọn mới trước khi lưu thành công.
let draftOptionCount = 0;

function createOptionDraft(questionId: number): DraftOption {
  draftOptionCount = draftOptionCount + 1;
  return {
    //id: null,
    id: draftOptionCount,
    tempId: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    question_id: questionId,
    content: "",
    is_correct: false,
  };
}

function createEditOptionDraft(questionId: number): DraftOption {
  return {
    id: null,
    tempId: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    question_id: questionId,
    content: "",
    is_correct: false,
  };
}

function getCorrectOption(options: DraftOption[]) {
  return options.find((option) => option.is_correct);
}

function getCorrectOptions(options: DraftOption[]) {
  return options.filter((option) => option.is_correct);
}

function isSameDraftOption(option: DraftOption, target: DraftOption) {
  if (option.tempId === target.tempId) {
    return true;
  }
  return option.id !== null && option.id === target.id;
}

/**
 * Đánh dấu đáp án đúng cho một lựa chọn. Với câu hỏi nhiều đáp án thì bật/tắt
 * đáp án của lựa chọn được bấm; với câu hỏi một đáp án thì chỉ giữ một đáp án.
 */
function toggleDraftOptionCorrect(
  options: DraftOption[],
  target: DraftOption,
  allowMultiple: boolean,
): DraftOption[] {
  if (allowMultiple) {
    return options.map((option) =>
      isSameDraftOption(option, target)
        ? { ...option, is_correct: !option.is_correct }
        : option,
    );
  }

  return options.map((option) => ({
    ...option,
    is_correct: isSameDraftOption(option, target),
  }));
}

/** Căn lại mảng đáp án chỗ trống cho đúng số lượng chỗ trống trong nội dung. */
function ensureBlankAnswers(answers: string[], blankCount: number): string[] {
  return Array.from(
    { length: blankCount },
    (_, index) => answers[index] ?? "",
  );
}

function getDraftBlankAnswers(draft: DraftQuestion): string[] {
  return ensureBlankAnswers(
    draft.blank_answers ?? [],
    getFillInBlankCount(draft.content),
  );
}

const questionTypeOptions: Array<{
  value: string;
  label: string;
  description: string;
}> = [
  {
    value: "multiple_choice",
    label: "Trắc nghiệm một đáp án",
    description: "Sinh viên chọn đúng một lựa chọn.",
  },
  {
    value: "true_false",
    label: "Đúng hoặc sai",
    description: "Sinh viên chọn Đúng hoặc Sai cho một nhận định.",
  },
  {
    value: "multiple_answer",
    label: "Trắc nghiệm nhiều đáp án",
    description: "Sinh viên chọn tất cả các lựa chọn đúng.",
  },
  {
    value: "fill_in_blank",
    label: "Điền chỗ trống",
    description: "Sinh viên nhập nội dung cho các chỗ trống đánh dấu bằng ___.",
  },
];

function getQuestionTypeDescription(type: string | null | undefined): string {
  const matched = questionTypeOptions.find((option) => option.value === type);
  return matched?.description ?? questionTypeOptions[0].description;
}

function getDraftValidationMessage(draft: DraftQuestion) {
  if (!draft.content.trim()) {
    return "Nội dung câu hỏi không được bỏ trống.";
  }

  if (isFillInBlankType(draft.question_type)) {
    const blankAnswers = getDraftBlankAnswers(draft);
    if (blankAnswers.length === 0) {
      return "Chưa xác định được chỗ trống cho câu hỏi điền chỗ trống.";
    }
    // Mỗi chỗ trống cần ít nhất một cách viết (phần trước dấu ~).
    if (
      blankAnswers.some((answer) => splitBlankAlternatives(answer).length === 0)
    ) {
      return "Đáp án của tất cả chỗ trống phải được điền đầy đủ.";
    }
    return "";
  }

  if (draft.options.length < 2) {
    return "Cần ít nhất 2 lựa chọn cho câu hỏi trắc nghiệm.";
  }

  if (draft.options.some((option) => !option.content.trim())) {
    return "Nội dung tất cả lựa chọn phải được điền đầy đủ.";
  }

  const correctCount = getCorrectOptions(draft.options).length;

  if (isMultipleAnswerType(draft.question_type)) {
    if (correctCount < 2) {
      return "Câu hỏi chọn nhiều đáp án cần ít nhất 2 lựa chọn đúng.";
    }
    if (correctCount >= draft.options.length) {
      return "Câu hỏi chọn nhiều đáp án cần có ít nhất 1 lựa chọn sai.";
    }
    return "";
  }

  if (correctCount !== 1) {
    return "Cần đúng một lựa chọn đúng cho câu hỏi.";
  }

  return "";
}

function BloomLevelBadge({ level }: { level: string }) {
  const label = getLevelLabel(level);
  const color = getLevelColor(level);
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium"
      style={{
        backgroundColor: `${color}18`,
        color: color,
        border: `1px solid ${color}40`,
      }}
    >
      <span
        className="inline-block h-2 w-2 rounded-full"
        style={{ backgroundColor: color }}
      />
      {label}
    </span>
  );
}

function BloomLevelSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const levels = [
    { value: "remember", label: "Nhận biết", color: "#06b6d4" },
    { value: "understand", label: "Thông hiểu", color: "#22c55e" },
    { value: "apply", label: "Vận dụng", color: "#f59e0b" },
    { value: "analyze", label: "Phân tích", color: "#f97316" },
    { value: "evaluate", label: "Đánh giá", color: "#ef4444" },
    { value: "create", label: "Sáng tạo", color: "#8b5cf6" },
  ];

  return (
    <label className="block text-sm font-medium text-slate-700">
      Cấp độ Bloom
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-3xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
      >
        {levels.map((level) => (
          <option key={level.value} value={level.value}>
            {level.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function QuestionTypeSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block text-sm font-medium text-slate-700">
      Loại câu hỏi
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full rounded-3xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
      >
        {questionTypeOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <span className="mt-2 block text-xs font-normal text-slate-500">
        {getQuestionTypeDescription(value)}
      </span>
    </label>
  );
}

function BlankAnswerEditor({
  values,
  onChange,
}: {
  values: string[];
  onChange: (index: number, value: string) => void;
}) {
  return (
    <div className="space-y-3 rounded-3xl bg-slate-50 p-4">
      <div>
        <p className="text-sm font-semibold text-slate-900">Đáp án chỗ trống</p>
        <p className="mt-1 text-xs text-slate-500">
          Đánh dấu mỗi chỗ trống trong nội dung câu hỏi bằng ___ (ít nhất hai dấu
          gạch dưới). Hệ thống tạo một ô trả lời cho mỗi chỗ trống. Nếu một chỗ
          trống có nhiều cách viết được chấp nhận (viết tắt, viết đầy đủ...), đặt
          các cách viết trong cùng ô và cách nhau bằng dấu ~ (ví dụ: Hà Nội ~ HN).
        </p>
      </div>
      {values.map((value, index) => (
        <label
          key={`blank-${index}`}
          className="block text-sm font-medium text-slate-700"
        >
          Chỗ trống {index + 1}
          <input
            type="text"
            value={value}
            onChange={(event) => onChange(index, event.target.value)}
            className="mt-2 w-full rounded-3xl border border-slate-200 px-4 py-3 text-sm shadow-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
          />
        </label>
      ))}
    </div>
  );
}

function buildQuestionAnswer(draft: DraftQuestion): string {
  if (isFillInBlankType(draft.question_type)) {
    return getDraftBlankAnswers(draft)
      .map((answer) => answer.trim())
      .join(" | ");
  }

  if (isMultipleAnswerType(draft.question_type)) {
    return getCorrectOptions(draft.options)
      .map((option) => option.content.trim())
      .filter((content) => content !== "")
      .join(" | ");
  }

  return getCorrectOption(draft.options)?.content ?? "";
}

function buildQuestionPayload(draft: DraftQuestion): Omit<ExamQuestion, "id"> {
  return {
    exam_id: draft.exam_id,
    content: draft.content,
    question_type: draft.question_type,
    sequence: draft.sequence,
    score: draft.score,
    answer: buildQuestionAnswer(draft),
    bloom_level: draft.bloom_level,
  };
}

export default function InstructorExamDetailPage() {
  const router = useRouter();
  const params = useParams();
  const examId = Number(params?.examId ?? "0");

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isReordering, setIsReordering] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [courseComponentId, setCourseComponentId] = useState<number | null>(null);
  const { currentUser, isCheckingAuth } = useInstructorSession();
  const [exam, setExam] = useState<Exam | null>(null);
  const [questions, setQuestions] = useState<QuestionWithOptions[]>([]);
  const [editQuestionId, setEditQuestionId] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState<QuestionWithOptions | null>(null);
  const [newQuestionDraft, setNewQuestionDraft] = useState<DraftQuestion>({
    exam_id: examId,
    content: "",
    question_type: "multiple_choice",
    sequence: 1,
    score: 10,
    answer: "",
    bloom_level: "remember",
    options: [createOptionDraft(examId), createOptionDraft(examId)],
    blank_answers: [""],
  });


  useEffect(() => {
    let isMounted = true;

    async function loadExamData() {
      if (!currentUser) {
        return;
      }
      if (!examId || Number.isNaN(examId)) {
        setErrorMessage("ID bài kiểm tra không hợp lệ.");
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        const exam = await getInstructorExamById(examId);
        const questions = await getInstructorExamQuestions(examId);

        const questionsWithOptions = await Promise.all(
          questions.map(async (question) => {
            const options = await getInstructorQuestionOptions(question.id);
            return {
              ...question,
              options: options.map((option) => ({
                ...option,
                tempId: `${option.id}-${Math.random().toString(36).slice(2)}`,
              })),
            };
          }),
        );

        const refComponent = await getCourseComponentByRef("exam", examId).catch(
          () => null,
        );

        if (!isMounted) return;
        setExam(exam);
        setQuestions(questionsWithOptions);
        setCourseComponentId(refComponent?.id ?? null);
        setErrorMessage("");
      } catch (error) {
        if (!isMounted) return;
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Không thể tải dữ liệu bài kiểm tra.",
        );
      } finally {
        if (!isMounted) return;
        setIsLoading(false);
      }
    }

    loadExamData();

    return () => {
      isMounted = false;
    };
  }, [examId, currentUser]);

  useEffect(() => {
    setNewQuestionDraft((prev) => ({
      ...prev,
      exam_id: examId,
      sequence: questions.length + 1,
      options: prev.options.length
        ? prev.options.map((option) => ({
            ...option,
            question_id: examId,
          }))
        : [createOptionDraft(examId), createOptionDraft(examId)],
    }));
  }, [examId, questions.length]);

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

  const user = currentUser ?? initialUser;

  const handleStartEdit = (question: QuestionWithOptions) => {
    setEditQuestionId(question.id);
    setEditDraft({
      ...question,
      bloom_level: question.bloom_level ?? "remember",
      options: question.options.map((option) => ({
        ...option,
        tempId: `${option.id}-${Math.random().toString(36).slice(2)}`,
      })),
      blank_answers: isFillInBlankType(question.question_type)
        ? ensureBlankAnswers(
            parseFillInBlankAnswers(question.answer),
            getFillInBlankCount(question.content),
          )
        : [],
    });
    setErrorMessage("");
  };

  const handleCancelEdit = () => {
    setEditQuestionId(null);
    setEditDraft(null);
    setErrorMessage("");
  };

  const confirmDeleteQuestion = async (questionId: number) => {
    try {
      setIsSaving(true);
      await deleteInstructorQuestion(questionId);
      setQuestions((current) =>
        current.filter((question) => question.id !== questionId),
      );
      setExam((current) =>
        current
          ? {
              ...current,
              actual_question_count: Math.max(
                0,
                (current.actual_question_count ?? questions.length) - 1,
              ),
            }
          : current,
      );
      if (editQuestionId === questionId) {
        handleCancelEdit();
      }
      setErrorMessage("");
      toast.success("Đã xóa câu hỏi thành công.");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Xóa câu hỏi thất bại.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteQuestion = (questionId: number) => {
    toast.info(
      ({ closeToast }) => (
        <div>
          <p className="font-medium text-slate-900">
            Bạn có chắc muốn xóa câu hỏi này?
          </p>
          <div className="mt-3 flex justify-end gap-2">
            <button
              type="button"
              className="rounded-lg px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100"
              onClick={closeToast}
            >
              Hủy
            </button>
            <button
              type="button"
              className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700"
              onClick={() => {
                closeToast();
                void confirmDeleteQuestion(questionId);
              }}
            >
              Xóa
            </button>
          </div>
        </div>
      ),
      {
        autoClose: false,
        closeButton: false,
        closeOnClick: false,
        draggable: false,
      },
    );
  };

  const handleMoveQuestion = async (questionId: number, direction: -1 | 1) => {
    const currentIndex = questions.findIndex((question) => question.id === questionId);
    const targetIndex = currentIndex + direction;
    if (
      currentIndex < 0 ||
      targetIndex < 0 ||
      targetIndex >= questions.length
    ) {
      return;
    }

    const reorderedQuestions = [...questions];
    const [movedQuestion] = reorderedQuestions.splice(currentIndex, 1);
    reorderedQuestions.splice(targetIndex, 0, movedQuestion);
    reorderedQuestions.forEach((question, index) => {
      question.sequence = index + 1;
    });

    // Cập nhật giao diện ngay, rồi lưu thứ tự lên máy chủ
    setQuestions(reorderedQuestions);
    setErrorMessage("");

    try {
      setIsReordering(true);
      await reorderInstructorExamQuestions(
        examId,
        reorderedQuestions.map((question) => question.id),
      );
    } catch (error) {
      // Khôi phục lại thứ tự ban đầu nếu lưu thất bại
      setQuestions(questions);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Sắp xếp câu hỏi thất bại.",
      );
    } finally {
      setIsReordering(false);
    }
  };

  const handleDeleteOptionFromDraft = (
    draft: DraftQuestion,
    theOption: DraftOption,
  ) => {
    const nextOptions = draft.options.filter((option) => option.tempId !== theOption.tempId);
    const deletedOption = draft.options.find((option) => (option.id === theOption.id && option.id !== null) || option.tempId === theOption.tempId);
    if (
      deletedOption?.is_correct &&
      !nextOptions.some((option) => option.is_correct)
    ) {
      window.alert(
        "Vui lòng chọn một lựa chọn đúng khác trước khi xóa lựa chọn đúng hiện tại.",
      );
      return draft.options;
    }
    return nextOptions;
  };

  const handleDeleteOptionFromNew = (theOption: DraftOption) => {
    setNewQuestionDraft((draft) => ({
      ...draft,
      options: handleDeleteOptionFromDraft(draft, theOption),
    }));
  };

  const handleDeleteOptionFromEdit = (theOption: DraftOption) => {
    if (!editDraft) return;
    setEditDraft((draft) =>
      draft
        ? {
            ...draft,
            options: handleDeleteOptionFromDraft(draft, theOption),
          }
        : draft,
    );
  };

  const handleNewOptionCorrect = (theOption: DraftOption) => {
    setNewQuestionDraft((draft) => ({
      ...draft,
      options: toggleDraftOptionCorrect(
        draft.options,
        theOption,
        isMultipleAnswerType(draft.question_type),
      ),
    }));
  };

  const handleEditOptionCorrect = (theOption: DraftOption) => {
    setEditDraft((draft) =>
      draft
        ? {
            ...draft,
            options: toggleDraftOptionCorrect(
              draft.options,
              theOption,
              isMultipleAnswerType(draft.question_type),
            ),
          }
        : draft,
    );
  };

  const handleNewQuestionTypeChange = (nextType: string) => {
    setNewQuestionDraft((draft) => ({
      ...draft,
      question_type: nextType,
      blank_answers: isFillInBlankType(nextType)
        ? ensureBlankAnswers(
            draft.blank_answers ?? [],
            getFillInBlankCount(draft.content),
          )
        : draft.blank_answers,
    }));
  };

  const handleEditQuestionTypeChange = (nextType: string) => {
    setEditDraft((draft) =>
      draft
        ? {
            ...draft,
            question_type: nextType,
            blank_answers: isFillInBlankType(nextType)
              ? ensureBlankAnswers(
                  draft.blank_answers ?? [],
                  getFillInBlankCount(draft.content),
                )
              : draft.blank_answers,
          }
        : draft,
    );
  };

  const handleNewContentChange = (value: string) => {
    setNewQuestionDraft((draft) => ({
      ...draft,
      content: value,
      blank_answers: isFillInBlankType(draft.question_type)
        ? ensureBlankAnswers(
            draft.blank_answers ?? [],
            getFillInBlankCount(value),
          )
        : draft.blank_answers,
    }));
  };

  const handleEditContentChange = (value: string) => {
    setEditDraft((draft) =>
      draft
        ? {
            ...draft,
            content: value,
            blank_answers: isFillInBlankType(draft.question_type)
              ? ensureBlankAnswers(
                  draft.blank_answers ?? [],
                  getFillInBlankCount(value),
                )
              : draft.blank_answers,
          }
        : draft,
    );
  };

  const handleNewBlankAnswerChange = (index: number, value: string) => {
    setNewQuestionDraft((draft) => ({
      ...draft,
      blank_answers: ensureBlankAnswers(
        draft.blank_answers ?? [],
        getFillInBlankCount(draft.content),
      ).map((answer, answerIndex) => (answerIndex === index ? value : answer)),
    }));
  };

  const handleEditBlankAnswerChange = (index: number, value: string) => {
    setEditDraft((draft) =>
      draft
        ? {
            ...draft,
            blank_answers: ensureBlankAnswers(
              draft.blank_answers ?? [],
              getFillInBlankCount(draft.content),
            ).map((answer, answerIndex) =>
              answerIndex === index ? value : answer,
            ),
          }
        : draft,
    );
  };

  const handleSaveEditedQuestion = async () => {
    if (!editDraft) return;
    const validationMessage = getDraftValidationMessage(editDraft);
    if (validationMessage) {
      setErrorMessage(validationMessage);
      return;
    }

    try {
      setIsSaving(true);
      const payload = buildQuestionPayload(editDraft);
      await updateInstructorQuestion(editDraft.id, payload);

      const originalQuestion = questions.find((q) => q.id === editDraft.id);
      const originalOptions = originalQuestion?.options ?? [];
      // Câu hỏi điền chỗ trống không lưu lựa chọn nào.
      const persistedOptions = isFillInBlankType(editDraft.question_type)
        ? []
        : editDraft.options;

      const deletedOptions = originalOptions.filter(
        (option) => !persistedOptions.some((updated) => updated.id === option.id),
      );

      const updatedOptions = persistedOptions.filter(
        (option) =>
          option.id !== null &&
          originalOptions.some(
            (original) =>
              original.id === option.id &&
              (original.content !== option.content ||
                original.is_correct !== option.is_correct),
          ),
      );

      const createdOptions = persistedOptions.filter((option) => option.id === null);

      await Promise.all(
        deletedOptions.map((option) => deleteInstructorOption(option.id!)),
      );

      await Promise.all(
        updatedOptions.map((option) =>
          updateInstructorOption(option.id!, {
            question_id: editDraft.id,
            content: option.content,
            is_correct: option.is_correct,
          }),
        ),
      );

      await Promise.all(
        createdOptions.map((option) =>
          createInstructorOption({
            question_id: editDraft.id,
            content: option.content,
            is_correct: option.is_correct,
          }),
        ),
      );

      const savedOptions = await getInstructorQuestionOptions(editDraft.id);
      setQuestions((current) =>
        current.map((question) =>
          question.id === editDraft.id
            ? {
                ...question,
                ...payload,
                options: savedOptions.map((option) => ({
                  ...option,
                  tempId: `${option.id}-${Math.random().toString(36).slice(2)}`,
                })),
              }
            : question,
        ),
      );
      handleCancelEdit();
      setErrorMessage("");
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Cập nhật câu hỏi thất bại.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateQuestion = async () => {
    const draft = newQuestionDraft;
    const validationMessage = getDraftValidationMessage(draft);
    if (validationMessage) {
      setErrorMessage(validationMessage);
      return;
    }

    try {
      setIsSaving(true);
      const payload = buildQuestionPayload(draft);
      const createdQuestion = await createInstructorQuestion(payload);

      const createdOptions = await Promise.all(
        (isFillInBlankType(draft.question_type) ? [] : draft.options).map(
          (option) =>
            createInstructorOption({
              question_id: createdQuestion.id,
              content: option.content,
              is_correct: option.is_correct,
            }),
        ),
      );

      draftOptionCount = 0;

      setQuestions((current) => [
        ...current,
        {
          ...createdQuestion,
          options: createdOptions.map((option) => ({
            ...option,
            tempId: `${option.id}-${Math.random().toString(36).slice(2)}`,
          })),
        },
      ]);
      setExam((current) =>
        current
          ? {
              ...current,
              actual_question_count:
                (current.actual_question_count ?? questions.length) + 1,
            }
          : current,
      );

      setNewQuestionDraft({
        exam_id: examId,
        content: "",
        question_type: "multiple_choice",
        sequence: questions.length + 2,
        score: 10,
        answer: "",
        bloom_level: "remember",
        options: [createOptionDraft(examId), createOptionDraft(examId)],
        blank_answers: [""],
      });
      setErrorMessage("");
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Tạo câu hỏi thất bại.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <ToastContainer position="top-right" autoClose={3500} />
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
          <button
            type="button"
            className="rounded-xl p-2 text-slate-700 hover:bg-slate-100"
            onClick={() => router.push("/instructor/exam")}
            aria-label="Quay lại danh sách bài kiểm tra"
          >
            <ChevronLeft className="h-5 w-5" />
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
            <h1 className="text-lg font-semibold">Chi tiết bài kiểm tra</h1>
            <p className="text-sm text-slate-500">
              Quản lý câu hỏi và lựa chọn trắc nghiệm cho bài thi.
            </p>
          </div>
        </div>

        <button
          type="button"
          className="flex flex-row items-center gap-2 rounded-xl p-2 text-slate-700 hover:bg-slate-100"
          onClick={() => router.push("/instructor/ai-generator")}
          aria-label="Trợ lý AI"
        >
          <Sparkles className="h-5 w-5" />
          <span>Nhờ AI hỗ trợ</span>
        </button>

        <div className="hidden items-center gap-2 md:flex">
          <NotificationBell userId={user.id} />
          <UserAccountMenu user={user} variant="dashboard" />
        </div>
      </header>

      <section className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-4 pb-8 pt-24 sm:px-6 lg:px-8">
        {isLoading ? (
          <div className="flex min-h-[50vh] items-center justify-center rounded-3xl bg-white shadow-sm">
            <div className="flex items-center gap-3 text-slate-600">
              <LoaderCircle className="h-5 w-5 animate-spin" />
              <span>Đang tải thông tin bài kiểm tra...</span>
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
            <section className="rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-slate-200">
              <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-sm font-medium uppercase tracking-[0.2em] text-sky-600">
                    Bài kiểm tra giảng dạy
                  </p>
                  <h2 className="mt-2 text-3xl font-semibold text-slate-900">
                    {exam?.title ?? "Bài kiểm tra không xác định"}
                  </h2>
                  <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
                    {exam?.description ??
                      "Sử dụng khu vực này để thêm, chỉnh sửa hoặc xóa câu hỏi trắc nghiệm cho bài thi."}
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                  <div className="rounded-3xl bg-slate-50 p-4 text-center">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                      Câu hỏi thực tế
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-slate-900">
                      {exam?.actual_question_count ?? questions.length}
                    </p>
                  </div>
                  <div className="rounded-3xl bg-slate-50 p-4 text-center">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                      Số câu khi làm bài
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-slate-900">
                      {exam?.total_questions}
                    </p>
                  </div>
                  <div className="rounded-3xl bg-slate-50 p-4 text-center">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                      Thời lượng
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-slate-900">
                      {exam?.duration_minutes} phút
                    </p>
                  </div>
                  <div className="rounded-3xl bg-slate-50 p-4 text-center">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                      Điểm tối đa
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-slate-900">
                      {exam?.max_score}
                    </p>
                  </div>
                  <div className="rounded-3xl bg-slate-50 p-4 text-center">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                      Ngưỡng đạt
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-slate-900">
                      {exam?.pass_score}
                    </p>
                  </div>
                </div>
              </div>
            </section>

            <div className="grid gap-6 xl:grid-cols-[1.4fr_0.6fr]">
              <section className="space-y-6">
                {questions.length === 0 ? (
                  <article className="rounded-[28px] border border-dashed border-slate-300 bg-white px-6 py-10 text-center shadow-sm ring-1 ring-slate-200">
                    <p className="text-sm font-semibold uppercase tracking-[0.2em] text-sky-600">
                      Chưa có câu hỏi
                    </p>
                    <h3 className="mt-3 text-2xl font-semibold text-slate-900">
                      Bài kiểm tra này chưa có ngân hàng câu hỏi
                    </h3>
                    <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-slate-600">
                      Bạn vẫn có thể xem thông tin bài kiểm tra ở phía trên và
                      sử dụng biểu mẫu bên phải để tạo câu hỏi đầu tiên cho bài
                      thi này.
                    </p>
                  </article>
                ) : null}

                {questions.map((question, questionIndex) => {
                  const isEditing = editQuestionId === question.id;

                  if (isEditing && editDraft) {
                    return (
                      <article
                        key={question.id}
                        className="rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-slate-200"
                      >
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                          <div>
                            <h3 className="text-xl font-semibold text-slate-900">
                              Chỉnh sửa câu hỏi #{question.sequence}
                            </h3>
                            <p className="mt-1 text-sm text-slate-500">
                              Tùy chọn hoặc đáp án sẽ hiển thị theo loại câu hỏi bạn chọn.
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={handleCancelEdit}
                              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-3 py-2 text-sm text-slate-600 transition hover:bg-slate-50"
                            >
                              <X className="h-4 w-4" />
                              Hủy
                            </button>
                            <button
                              type="button"
                              onClick={handleSaveEditedQuestion}
                              disabled={isSaving}
                              className="inline-flex items-center gap-2 rounded-2xl bg-sky-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              <Save className="h-4 w-4" />
                              Lưu
                            </button>
                          </div>
                        </div>

                        <div className="mt-6 space-y-4">
                          <div>
                            <label className="block text-sm font-medium text-slate-700">
                              Nội dung câu hỏi
                            </label>
                            <textarea
                              value={editDraft.content}
                              onChange={(event) =>
                                handleEditContentChange(event.target.value)
                              }
                              className="mt-2 w-full rounded-3xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                              rows={3}
                            />
                          </div>

                          <div className="grid gap-4 sm:grid-cols-2">
                            <label className="block text-sm font-medium text-slate-700">
                              Điểm câu hỏi
                              <input
                                type="number"
                                min={1}
                                value={editDraft.score}
                                onChange={(event) =>
                                  setEditDraft((draft) =>
                                    draft
                                      ? {
                                          ...draft,
                                          score: Number(event.target.value),
                                        }
                                      : draft,
                                  )
                                }
                                className="mt-2 w-full rounded-3xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                              />
                            </label>
                            <label className="block text-sm font-medium text-slate-700">
                              Thứ tự hiển thị
                              <input
                                type="number"
                                min={1}
                                value={editDraft.sequence}
                                onChange={(event) =>
                                  setEditDraft((draft) =>
                                    draft
                                      ? {
                                          ...draft,
                                          sequence: Number(event.target.value),
                                        }
                                      : draft,
                                  )
                                }
                                className="mt-2 w-full rounded-3xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                              />
                            </label>
                          </div>

                          <BloomLevelSelect
                            value={editDraft.bloom_level ?? "remember"}
                            onChange={(value) =>
                              setEditDraft((draft) =>
                                draft
                                  ? {
                                      ...draft,
                                      bloom_level: value,
                                    }
                                  : draft,
                              )
                            }
                          />

                          <QuestionTypeSelect
                            value={editDraft.question_type}
                            onChange={handleEditQuestionTypeChange}
                          />

                          {!isFillInBlankType(editDraft.question_type) ? (
                          <div className="space-y-3 rounded-3xl bg-slate-50 p-4">
                            <div className="flex items-center justify-between">
                              <p className="text-sm font-semibold text-slate-900">
                                Lựa chọn câu hỏi
                              </p>
                              <button
                                type="button"
                                onClick={() =>
                                  setEditDraft((draft) =>
                                    draft
                                      ? {
                                          ...draft,
                                          options: [
                                            ...draft.options,
                                            createEditOptionDraft(editDraft.id),
                                          ],
                                        }
                                      : draft,
                                  )
                                }
                                className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                              >
                                <Plus className="h-4 w-4" />
                                Thêm lựa chọn
                              </button>
                            </div>

                            <div className="space-y-3">
                              {editDraft.options.map((option) => (
                                <div
                                  key={option.id ?? option.tempId}
                                  className="flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white p-4"
                                >
                                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                    <div className="flex items-center gap-3">
                                      <button
                                        type="button"
                                        className={`rounded-full border px-2 py-1 text-xs font-semibold transition ${
                                          option.is_correct
                                            ? "border-emerald-500 bg-emerald-100 text-emerald-700"
                                            : "border-slate-300 text-slate-600"
                                        }`}
                                        onClick={() =>
                                          handleEditOptionCorrect(option)
                                        }
                                      >
                                        {option.is_correct ? "Đúng" : "Đánh dấu đúng"}
                                      </button>
                                      <span className="text-sm text-slate-700">
                                        Lựa chọn
                                      </span>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleDeleteOptionFromEdit(option)
                                      }
                                      className="inline-flex items-center gap-2 rounded-2xl border border-red-200 px-3 py-2 text-sm text-red-600 transition hover:bg-red-50"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                      Xóa
                                    </button>
                                  </div>
                                  <input
                                    type="text"
                                    value={option.content}
                                    onChange={(event) =>
                                      setEditDraft((draft) =>
                                        draft
                                          ? {
                                              ...draft,
                                              options: draft.options.map((item) =>
                                                (item.id === option.id && item.id !== null) ||
                                                item.tempId === option.tempId
                                                  ? {
                                                      ...item,
                                                      content: event.target.value,
                                                    }
                                                  : item,
                                              ),
                                            }
                                          : draft,
                                      )
                                    }
                                    className="w-full rounded-3xl border border-slate-200 px-4 py-3 text-sm shadow-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                                  />
                                </div>
                              ))}
                            </div>
                          </div>
                          ) : (
                            <BlankAnswerEditor
                              values={getDraftBlankAnswers(editDraft)}
                              onChange={handleEditBlankAnswerChange}
                            />
                          )}
                        </div>
                      </article>
                    );
                  }

                  return (
                    <article
                      key={question.id}
                      className="rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-slate-200"
                    >
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                          <h3 className="text-xl font-semibold text-slate-900">
                            Câu hỏi #{question.sequence}
                          </h3>
                          <p className="mt-2 text-sm text-slate-600">
                            {question.content}
                          </p>
                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                              {getQuestionTypeLabel(question.question_type)}
                            </span>
                            <span className="text-xs uppercase tracking-[0.2em] text-slate-500">
                              Điểm: {question.score}
                            </span>
                            <BloomLevelBadge level={question.bloom_level ?? "remember"} />
                          </div>
                          {isFillInBlankType(question.question_type) ? (
                            <p className="mt-3 text-sm text-slate-600">
                              Đáp án:{" "}
                              <span className="font-medium text-slate-900">
                                {formatBlankAnswers(question.answer) ||
                                  "Chưa có đáp án"}
                              </span>
                            </p>
                          ) : null}
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="flex items-center rounded-2xl border border-slate-200">
                            <button
                              type="button"
                              onClick={() => handleMoveQuestion(question.id, -1)}
                              disabled={isReordering || questionIndex === 0}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-l-2xl text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                              aria-label="Di chuyển câu hỏi lên"
                            >
                              <ChevronUp className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMoveQuestion(question.id, 1)}
                              disabled={
                                isReordering || questionIndex === questions.length - 1
                              }
                              className="inline-flex h-9 w-9 items-center justify-center rounded-r-2xl text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                              aria-label="Di chuyển câu hỏi xuống"
                            >
                              <ChevronDown className="h-4 w-4" />
                            </button>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleStartEdit(question)}
                            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-100"
                          >
                            <Edit3 className="h-4 w-4" />
                            Chỉnh sửa
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteQuestion(question.id)}
                            className="inline-flex items-center gap-2 rounded-2xl border border-red-200 px-3 py-2 text-sm text-red-600 transition hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                            Xóa
                          </button>
                        </div>
                      </div>

                      {!isFillInBlankType(question.question_type) ? (
                      <div className="mt-6 space-y-3">
                        {question.options.map((option) => (
                          <div
                            key={option.id ?? option.tempId}
                            className="flex flex-col gap-2 rounded-3xl border border-slate-200 bg-slate-50 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
                          >
                            <div>
                              <p className="font-medium text-slate-900">
                                {option.content}
                              </p>
                              <p className="text-xs text-slate-500">
                                {option.is_correct ? "Lựa chọn đúng" : "Lựa chọn sai"}
                              </p>
                            </div>
                            {option.is_correct ? (
                              <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                                Đúng
                              </span>
                            ) : null}
                          </div>
                        ))}
                      </div>
                      ) : null}
                    </article>
                  );
                })}
              </section>

              <aside className="space-y-6">
                <article className="rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-slate-200">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <h3 className="text-xl font-semibold text-slate-900">
                        Thêm câu hỏi mới
                      </h3>
                      <p className="mt-1 text-sm text-slate-500">
                        Tạo câu hỏi trắc nghiệm hoặc điền chỗ trống cho bài thi hiện tại.
                      </p>
                    </div>
                    <div className="rounded-full bg-sky-100 px-3 py-1 text-sm font-medium text-sky-700">
                      {questions.length} câu hỏi
                    </div>
                  </div>

                  <div className="mt-6 space-y-4">
                    <label className="block text-sm font-medium text-slate-700">
                      Nội dung câu hỏi
                      <textarea
                        value={newQuestionDraft.content}
                        onChange={(event) =>
                          handleNewContentChange(event.target.value)
                        }
                        className="mt-2 w-full rounded-3xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                        rows={3}
                      />
                    </label>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <label className="block text-sm font-medium text-slate-700">
                        Điểm câu hỏi
                        <input
                          type="number"
                          min={1}
                          value={newQuestionDraft.score}
                          onChange={(event) =>
                            setNewQuestionDraft((draft) => ({
                              ...draft,
                              score: Number(event.target.value),
                            }))
                          }
                          className="mt-2 w-full rounded-3xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                        />
                      </label>
                      <label className="block text-sm font-medium text-slate-700">
                        Thứ tự hiển thị
                        <input
                          type="number"
                          min={1}
                          value={newQuestionDraft.sequence}
                          onChange={(event) =>
                            setNewQuestionDraft((draft) => ({
                              ...draft,
                              sequence: Number(event.target.value),
                            }))
                          }
                          className="mt-2 w-full rounded-3xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                        />
                      </label>
                    </div>

                    <BloomLevelSelect
                      value={newQuestionDraft.bloom_level ?? "remember"}
                      onChange={(value) =>
                        setNewQuestionDraft((draft) => ({
                          ...draft,
                          bloom_level: value,
                        }))
                      }
                    />

                    <QuestionTypeSelect
                      value={newQuestionDraft.question_type}
                      onChange={handleNewQuestionTypeChange}
                    />

                    {!isFillInBlankType(newQuestionDraft.question_type) ? (
                    <div className="space-y-3 rounded-3xl bg-slate-50 p-4">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold text-slate-900">
                          Lựa chọn trắc nghiệm
                        </p>
                        <button
                          type="button"
                          onClick={() =>
                            setNewQuestionDraft((draft) => ({
                              ...draft,
                              options: [
                                ...draft.options,
                                createOptionDraft(examId),
                              ],
                            }))
                          }
                          className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                        >
                          <Plus className="h-4 w-4" />
                          Thêm lựa chọn
                        </button>
                      </div>

                      <div className="space-y-3">
                        {newQuestionDraft.options.map((option) => (
                          <div
                            key={option.id ?? option.tempId}
                            className="flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white p-4"
                          >
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                              <button
                                type="button"
                                className={`rounded-full border px-2 py-1 text-xs font-semibold transition ${
                                  option.is_correct
                                    ? "border-emerald-500 bg-emerald-100 text-emerald-700"
                                    : "border-slate-300 text-slate-600"
                                }`}
                                onClick={() => handleNewOptionCorrect(option)}
                              >
                                {option.is_correct ? "Đúng" : "Đánh dấu đúng"}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteOptionFromNew(option)}
                                className="inline-flex items-center gap-2 rounded-2xl border border-red-200 px-3 py-2 text-sm text-red-600 transition hover:bg-red-50"
                              >
                                <Trash2 className="h-4 w-4" />
                                Xóa
                              </button>
                            </div>
                            <input
                              type="text"
                              value={option.content}
                              onChange={(event) =>
                                setNewQuestionDraft((draft) => ({
                                  ...draft,
                                  options: draft.options.map((item) =>
                                    (item.id === option.id && item.id !== null) ||
                                    item.tempId === option.tempId
                                      ? {
                                          ...item,
                                          content: event.target.value,
                                        }
                                      : item,
                                  ),
                                }))
                              }
                              className="w-full rounded-3xl border border-slate-200 px-4 py-3 text-sm shadow-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                    ) : (
                      <BlankAnswerEditor
                        values={getDraftBlankAnswers(newQuestionDraft)}
                        onChange={handleNewBlankAnswerChange}
                      />
                    )}

                    <button
                      type="button"
                      onClick={handleCreateQuestion}
                      disabled={isSaving}
                      className="inline-flex items-center gap-2 rounded-3xl bg-sky-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Save className="h-4 w-4" />
                      Lưu câu hỏi mới
                    </button>
                  </div>
                </article>

                <BloomDistribution examId={examId} />

                <article className="rounded-[28px] bg-slate-900 px-6 py-6 text-white shadow-sm">
                  <h3 className="text-lg font-semibold">Lưu ý chung</h3>
                  <p className="mt-3 text-sm leading-6 text-slate-300">
                    Câu hỏi một đáp án cần đúng một lựa chọn đúng; câu hỏi nhiều
                    đáp án cần ít nhất hai lựa chọn đúng và một lựa chọn sai; câu
                    hỏi điền chỗ trống dùng ___ để đánh dấu chỗ trống. Xóa câu hỏi
                    hoặc lựa chọn sẽ hiển thị cảnh báo xác nhận.
                  </p>
                </article>
              </aside>
            </div>
          </>
        ) : null}

        {!isLoading && courseComponentId ? (
          <DiscussionSection
            courseComponentId={courseComponentId}
            currentUser={user}
          />
        ) : null}
      </section>
    </main>
  );
}

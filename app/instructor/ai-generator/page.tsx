"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
  Download,
  Eye,
  EyeOff,
  FileText,
  Globe,
  LoaderCircle,
  Menu,
  Pencil,
  Play,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import { UserAccountMenu } from "../../components/user-account-menu";
import { NotificationBell } from "../../components/notification-bell";
import { ShowNavigation } from "../../lib/app_nav";
import type { User } from "../../lib/api_user";
import { useInstructorSession } from "../_lib/use-instructor-session";
import {
  AI_GENERATOR_MAX_QUESTIONS,
  AI_GENERATOR_PAGE_SIZE,
  AI_GENERATOR_UPLOAD_ACCEPT,
  clampQuestionCount,
  downloadInstructorQuestionsAsJson,
  downloadInstructorQuestionsAsTxt,
  generateInstructorQuestionsFromText,
  generateInstructorQuestionsFromUpload,
  generateInstructorQuestionsFromUrl,
  getBlankValues,
  getCorrectAnswerLabel,
  getCorrectOptionContents,
  getInstructorAiExamChoices,
  isFillInBlankQuestion,
  isGeneratedSelectionCorrect,
  isGeneratedSelectionProvided,
  isMultipleAnswerQuestion,
  saveGeneratedQuestionsToExam,
  type AiGeneratorQuestionType,
  type AiGeneratorTopicPlan,
  type GeneratedAnswerSelection,
  type GeneratedQuestion,
  type InstructorAiExamChoice,
  type QuestionGenerationResponse,
  getCognitiveDistributionLabel,
} from "../../lib/api_ai_generator_instructor";
import {
  BLANK_ALTERNATIVE_SEPARATOR,
  getFillInBlankCount,
  getLevelLabel,
  getLevelColor,
  isFillInBlankType,
  isMultipleAnswerType,
  parseFillInBlankAnswers,
  splitBlankAlternatives,
} from "../../lib/api_exam";
import CognitiveSettings from "../../ai-generator/_cognitive-settings";
import type {
  CognitiveSettingsState,
  CategoryOption,
  TopicAllocation,
} from "../../ai-generator/_cognitive-settings";
import { getCategoryList } from "../../lib/api_category";

const initialUser: User = {
  id: 0,
  username: "Giảng viên",
  email: "giang_vien@example.com",
  icon: "/icon.png",
  role: "instructor",
};

const questionTypeOptions: Array<{
  value: AiGeneratorQuestionType;
  label: string;
  description: string;
}> = [
  {
    value: "multiple_choice",
    label: "Nhiều lựa chọn",
    description: "Mỗi câu có bốn phương án và một đáp án đúng.",
  },
  {
    value: "true_false",
    label: "Đúng hoặc sai",
    description: "Phù hợp cho bài kiểm tra nhanh hoặc các nhận định trọng tâm.",
  },
  {
    value: "multiple_answer",
    label: "Chọn nhiều đáp án",
    description: "Mỗi câu có bốn phương án và từ hai đến ba đáp án đúng.",
  },
  {
    value: "fill_in_blank",
    label: "Điền chỗ trống",
    description: "Câu hỏi có một hoặc hai chỗ trống ___ để người học tự điền.",
  },
];

type SourceMode = "text" | "upload" | "url";

const initialTopicAllocations: TopicAllocation[] = [
  { id: "topic-1", topic: "", description: "", percentage: 100 },
];

const bloomLevelOptions: Array<{ value: string; label: string }> = [
  { value: "remember", label: "Nhận biết" },
  { value: "understand", label: "Thông hiểu" },
  { value: "apply", label: "Vận dụng" },
  { value: "analyze", label: "Phân tích" },
  { value: "evaluate", label: "Đánh giá" },
  { value: "create", label: "Sáng tạo" },
];

function getSourceLabel(sourceMode: SourceMode): string {
  switch (sourceMode) {
    case "upload":
      return "Tệp tài liệu";
    case "url":
      return "URL tài liệu";
    default:
      return "Văn bản thuần";
  }
}

function getGenerateButtonLabel(sourceMode: SourceMode): string {
  switch (sourceMode) {
    case "upload":
      return "Tạo câu hỏi từ tệp tải lên";
    case "url":
      return "Tạo câu hỏi từ URL tài liệu";
    default:
      return "Tạo câu hỏi từ văn bản";
  }
}

function getCognitiveSummaryLabel(value: string, response?: QuestionGenerationResponse): string {
  if (response) {
    const cognitive = getCognitiveDistributionLabel(
      response.difficulty_remember,
      response.difficulty_understand,
      response.difficulty_apply,
    );
    return cognitive;
  }
  return "NB 34% · TH 33% · VD 33%";
}

function getQuestionTypeLabel(value: string): string {
  switch (value) {
    case "true_false":
      return "Đúng hoặc sai";
    case "multiple_answer":
      return "Chọn nhiều đáp án";
    case "fill_in_blank":
      return "Điền chỗ trống";
    default:
      return "Nhiều lựa chọn";
  }
}

function getSourceTypeLabel(value: string): string {
  switch (value) {
    case "text":
      return "Văn bản thuần";
    case "text_file":
      return "Tệp văn bản";
    case "pdf_text":
      return "PDF qua OCR";
    case "pdf_visual":
      return "PDF qua phân tích hình ảnh";
    case "image_ocr_text":
      return "Ảnh qua OCR";
    case "image_visual":
      return "Ảnh qua phân tích hình ảnh";
    case "video_frame_ocr_text":
      return "Video qua OCR";
    case "video_visual":
      return "Video qua phân tích hình ảnh";
    default:
      return value;
  }
}

export default function InstructorAiGeneratorPage() {
  const router = useRouter();
  const practiceSectionRef = useRef<HTMLDivElement>(null);

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isLoadingPage, setIsLoadingPage] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSavingToExam, setIsSavingToExam] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [saveSuccessMessage, setSaveSuccessMessage] = useState("");
  const { currentUser, isCheckingAuth } = useInstructorSession();
  const [examChoices, setExamChoices] = useState<InstructorAiExamChoice[]>([]);
  const [selectedExamId, setSelectedExamId] = useState("");
  const [sourceMode, setSourceMode] = useState<SourceMode>("text");
  const [plainText, setPlainText] = useState("");
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [documentUrl, setDocumentUrl] = useState("");
  const [questionCountInput, setQuestionCountInput] = useState("5");
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [cognitiveSettings, setCognitiveSettings] = useState<CognitiveSettingsState>({
    sourceMode: "document_only",
    topic: "",
    topicDescription: "",
    difficultyRemember: 34,
    difficultyUnderstand: 33,
    difficultyApply: 33,
  });
  const [questionType, setQuestionType] =
    useState<AiGeneratorQuestionType>("multiple_choice");
  const [generationResponse, setGenerationResponse] =
    useState<QuestionGenerationResponse | null>(null);
  const [requestedQuestionCount, setRequestedQuestionCount] = useState(0);
  const [showCorrectAnswers, setShowCorrectAnswers] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [isPracticeMode, setIsPracticeMode] = useState(false);
  const [practiceAnswers, setPracticeAnswers] = useState<
    Record<number, GeneratedAnswerSelection>
  >({});
  const [practiceSubmitted, setPracticeSubmitted] = useState(false);
  const [editingSequence, setEditingSequence] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState<GeneratedQuestion | null>(null);
  const [editErrorMessage, setEditErrorMessage] = useState("");
  const [editedSequences, setEditedSequences] = useState<Set<number>>(new Set());
  const [topicAllocations, setTopicAllocations] = useState<TopicAllocation[]>(
    initialTopicAllocations,
  );
  const [bulkScoreInput, setBulkScoreInput] = useState("1");
  const [bulkScoreMessage, setBulkScoreMessage] = useState("");

  useEffect(() => {
    let isMounted = true;      async function loadPageData() {
      if (!currentUser) {
        return;
      }
      try {
        const [exams, categoryList] = await Promise.all([
          getInstructorAiExamChoices(currentUser.id),
          getCategoryList(),
        ]);

        if (!isMounted) {
          return;
        }
        setExamChoices(exams);
        setSelectedExamId(exams[0] ? String(exams[0].id) : "");
        setCategories(categoryList);
        setErrorMessage("");
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Không thể tải dữ liệu trang trợ lý ai của giảng viên.",
        );
      } finally {
        if (isMounted) {
          setIsLoadingPage(false);
        }
      }
    }

    void loadPageData();

    return () => {
      isMounted = false;
    };
  }, [currentUser]);

  useEffect(() => {
    if (isPracticeMode) {
      practiceSectionRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  }, [isPracticeMode]);

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
  const generatedQuestions = generationResponse?.questions ?? [];
  const totalGeneratedScore = generatedQuestions.reduce(
    (total, question) => total + question.score,
    0,
  );
  const topicSummary =
    generationResponse?.topics && generationResponse.topics.length > 0
      ? generationResponse.topics
          .map((plan) => `${plan.topic} (${plan.percentage}%)`)
          .join(" · ")
      : generationResponse?.topic ?? "";
  const selectedExam =
    examChoices.find((exam) => exam.id === Number(selectedExamId)) ?? null;
  const totalPages =
    generatedQuestions.length > 0
      ? Math.ceil(generatedQuestions.length / AI_GENERATOR_PAGE_SIZE)
      : 1;
  const paginatedQuestions = generatedQuestions.slice(
    (currentPage - 1) * AI_GENERATOR_PAGE_SIZE,
    currentPage * AI_GENERATOR_PAGE_SIZE,
  );
  const practiceAnsweredCount = generatedQuestions.filter((question) =>
    isGeneratedSelectionProvided(question, practiceAnswers[question.sequence]),
  ).length;
  const practiceCorrectCount = practiceSubmitted
    ? generatedQuestions.filter((question) =>
        isGeneratedSelectionCorrect(
          question,
          practiceAnswers[question.sequence],
        ),
      ).length
    : 0;
  const practicePercentage =
    generatedQuestions.length > 0
      ? Math.round((practiceCorrectCount / generatedQuestions.length) * 100)
      : 0;

  function handleQuestionCountChange(nextValue: string) {
    const digitsOnly = nextValue.replace(/[^\d]/g, "");
    setQuestionCountInput(digitsOnly);
  }

  function handleQuestionCountBlur() {
    const safeValue = clampQuestionCount(Number(questionCountInput || "1"));
    setQuestionCountInput(String(safeValue));
  }

  function handleChangeSourceMode(nextMode: SourceMode) {
    setSourceMode(nextMode);
    setErrorMessage("");
    setSaveSuccessMessage("");
  }

  function handleChooseFile(event: React.ChangeEvent<HTMLInputElement>) {
    const nextFile = event.target.files?.[0] ?? null;
    setUploadedFile(nextFile);
    setErrorMessage("");
    setSaveSuccessMessage("");
  }

  async function handleGenerateQuestions() {
    const safeQuestionCount = clampQuestionCount(Number(questionCountInput || "1"));
    setQuestionCountInput(String(safeQuestionCount));
    setErrorMessage("");
    setSaveSuccessMessage("");

    const distributionTotal =
      cognitiveSettings.difficultyRemember +
      cognitiveSettings.difficultyUnderstand +
      cognitiveSettings.difficultyApply;
    if (distributionTotal !== 100) {
      setErrorMessage(
        `Tổng tỷ lệ phân bố mức độ nhận thức phải bằng 100% (hiện tại: ${distributionTotal}%). Hãy điều chỉnh lại các thanh trượt hoặc nhấn "Cân bằng".`,
      );
      return;
    }

    let topicPlans: AiGeneratorTopicPlan[] = [];
    let effectiveTopic = cognitiveSettings.topic;
    let effectiveTopicDescription = cognitiveSettings.topicDescription;

    if (cognitiveSettings.sourceMode === "topic_only" && topicAllocations.length > 0) {
      const cleanedPlans = topicAllocations.map((item) => ({
        topic: item.topic.trim(),
        description: (item.description ?? "").trim() || null,
        percentage: Math.round(item.percentage),
      }));

      if (cleanedPlans.some((plan) => !plan.topic)) {
        setErrorMessage("Hãy nhập tên cho tất cả chủ đề đã thêm.");
        return;
      }

      const uniqueTopics = new Set(
        cleanedPlans.map((plan) => plan.topic.toLowerCase()),
      );
      if (uniqueTopics.size !== cleanedPlans.length) {
        setErrorMessage("Các chủ đề trong danh sách không được trùng nhau.");
        return;
      }

      if (cleanedPlans.some((plan) => plan.percentage < 1)) {
        setErrorMessage("Mỗi chủ đề cần ít nhất 1% số câu hỏi.");
        return;
      }

      const percentageTotal = cleanedPlans.reduce(
        (total, plan) => total + plan.percentage,
        0,
      );
      if (percentageTotal !== 100) {
        setErrorMessage(
          `Tổng tỷ lệ các chủ đề phải bằng 100% (hiện tại: ${percentageTotal}%). Hãy nhấn "Chia đều" hoặc chỉnh lại từng chủ đề.`,
        );
        return;
      }

      if (cleanedPlans.length > 1) {
        if (safeQuestionCount < cleanedPlans.length) {
          setErrorMessage(
            `Cần ít nhất ${cleanedPlans.length} câu hỏi để chia cho ${cleanedPlans.length} chủ đề.`,
          );
          return;
        }
        topicPlans = cleanedPlans;
      }

      effectiveTopic = cleanedPlans[0].topic;
      effectiveTopicDescription = cleanedPlans[0].description ?? "";
    }

    try {
      setIsGenerating(true);

      let response: QuestionGenerationResponse;

      const baseGenInput = {
        questionCount: safeQuestionCount,
        questionType,
        sourceMode: cognitiveSettings.sourceMode,
        topic: effectiveTopic,
        topicDescription: effectiveTopicDescription,
        topics: topicPlans.length > 0 ? topicPlans : undefined,
        difficultyRemember: cognitiveSettings.difficultyRemember,
        difficultyUnderstand: cognitiveSettings.difficultyUnderstand,
        difficultyApply: cognitiveSettings.difficultyApply,
      };

      if (cognitiveSettings.sourceMode === "topic_only") {
        // Nguồn "Chỉ chủ đề" bỏ qua tệp/URL; dùng API văn bản để giữ danh sách chủ đề.
        response = await generateInstructorQuestionsFromText({
          ...baseGenInput,
          content: plainText,
        });
      } else if (sourceMode === "text") {
        response = await generateInstructorQuestionsFromText({
          ...baseGenInput,
          content: plainText,
        });
      } else if (sourceMode === "upload") {
        if (!uploadedFile) {
          throw new Error("Vui lòng chọn tệp tài liệu trước khi yêu cầu trợ lý ai tạo câu hỏi.");
        }

        response = await generateInstructorQuestionsFromUpload({
          ...baseGenInput,
          file: uploadedFile,
        });
      } else {
        response = await generateInstructorQuestionsFromUrl({
          ...baseGenInput,
          documentUrl,
        });
      }

      setRequestedQuestionCount(safeQuestionCount);
      setGenerationResponse(response);
      setCurrentPage(1);
      setShowCorrectAnswers(false);
      setIsPracticeMode(false);
      setPracticeAnswers({});
      setPracticeSubmitted(false);
      setEditingSequence(null);
      setEditDraft(null);
      setEditErrorMessage("");
      setEditedSequences(new Set());
      setBulkScoreMessage("");
      setBulkScoreInput("1");
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Không thể tạo bộ câu hỏi trắc nghiệm.",
      );
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleSaveGeneratedQuestionsToExam() {
    if (!selectedExam) {
      setErrorMessage("Vui lòng chọn một bài kiểm tra để nhận bộ câu hỏi.");
      return;
    }

    if (generatedQuestions.length === 0) {
      setErrorMessage("Chưa có bộ câu hỏi nào để đưa vào bài kiểm tra.");
      return;
    }

    setErrorMessage("");
    setSaveSuccessMessage("");

    try {
      setIsSavingToExam(true);

      const result = await saveGeneratedQuestionsToExam({
        examId: selectedExam.id,
        generatedQuestions,
      });

      setExamChoices((currentExams) =>
        currentExams.map((exam) =>
          exam.id === result.examId
            ? { ...exam, actual_question_count: result.actualQuestionCount }
            : exam,
        ),
      );
      setSaveSuccessMessage(
        `Đã thêm ${result.createdQuestionCount} câu hỏi và ${result.createdOptionCount} lựa chọn vào bài kiểm tra "${selectedExam.title}".`,
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Không thể đưa bộ câu hỏi vào bài kiểm tra đã chọn.",
      );
    } finally {
      setIsSavingToExam(false);
    }
  }

  function handleTogglePracticeMode() {
    if (isPracticeMode) {
      setIsPracticeMode(false);
      return;
    }

    setPracticeAnswers({});
    setPracticeSubmitted(false);
    setIsPracticeMode(true);
  }

  function handleSelectPracticeAnswer(questionSequence: number, optionContent: string) {
    setPracticeAnswers((currentAnswers) => ({
      ...currentAnswers,
      [questionSequence]: { kind: "single", content: optionContent },
    }));

    if (practiceSubmitted) {
      setPracticeSubmitted(false);
    }
  }

  function handleTogglePracticeMultipleAnswer(
    questionSequence: number,
    optionContent: string,
  ) {
    setPracticeAnswers((currentAnswers) => {
      const currentSelection = currentAnswers[questionSequence];
      const selectedContents =
        currentSelection?.kind === "multiple" ? currentSelection.contents : [];
      const nextContents = selectedContents.includes(optionContent)
        ? selectedContents.filter((content) => content !== optionContent)
        : [...selectedContents, optionContent];
      const nextAnswers = { ...currentAnswers };

      if (nextContents.length === 0) {
        delete nextAnswers[questionSequence];
      } else {
        nextAnswers[questionSequence] = {
          kind: "multiple",
          contents: nextContents,
        };
      }

      return nextAnswers;
    });

    if (practiceSubmitted) {
      setPracticeSubmitted(false);
    }
  }

  function handleChangePracticeBlankAnswer(
    questionSequence: number,
    question: GeneratedQuestion,
    blankIndex: number,
    value: string,
  ) {
    setPracticeAnswers((currentAnswers) => {
      const blankValues = getBlankValues(
        question,
        currentAnswers[questionSequence],
      );
      const nextValues = blankValues.map((blankValue, index) =>
        index === blankIndex ? value : blankValue,
      );

      return {
        ...currentAnswers,
        [questionSequence]: { kind: "blanks", values: nextValues },
      };
    });

    if (practiceSubmitted) {
      setPracticeSubmitted(false);
    }
  }

  function handleSubmitPractice() {
    if (generatedQuestions.length === 0) {
      return;
    }

    if (practiceAnsweredCount < generatedQuestions.length) {
      setErrorMessage("Vui lòng trả lời đủ tất cả câu hỏi trước khi chấm bài thử.");
      return;
    }

    setErrorMessage("");
    setPracticeSubmitted(true);
  }

  function handleResetPractice() {
    setPracticeAnswers({});
    setPracticeSubmitted(false);
    setErrorMessage("");
  }

  function handleStartEditQuestion(question: GeneratedQuestion) {
    setEditingSequence(question.sequence);
    setEditDraft({
      ...question,
      options: question.options.map((option) => ({ ...option })),
    });
    setEditErrorMessage("");
  }

  function handleCancelEditQuestion() {
    setEditingSequence(null);
    setEditDraft(null);
    setEditErrorMessage("");
  }

  function handleEditDraftContent(value: string) {
    setEditDraft((current) => (current ? { ...current, content: value } : current));
  }

  function handleEditDraftScore(value: string) {
    const digitsOnly = value.replace(/[^\d]/g, "");
    setEditDraft((current) =>
      current ? { ...current, score: Number(digitsOnly || "0") } : current,
    );
  }

  function handleApplyScoreToAll() {
    const parsedScore = Number(bulkScoreInput);
    if (!Number.isFinite(parsedScore) || parsedScore < 0) {
      setErrorMessage("Điểm cho tất cả câu hỏi không hợp lệ.");
      return;
    }

    const score = Math.min(100, Math.floor(parsedScore));
    setGenerationResponse((current) =>
      current
        ? {
            ...current,
            questions: current.questions.map((question) => ({
              ...question,
              score,
            })),
          }
        : current,
    );
    setBulkScoreInput(String(score));
    setBulkScoreMessage(
      `Đã đặt ${score} điểm cho tất cả ${generatedQuestions.length} câu hỏi.`,
    );
    setErrorMessage("");
  }

  function handleEditDraftBloomLevel(value: string) {
    setEditDraft((current) => (current ? { ...current, bloom_level: value } : current));
  }

  function handleEditDraftExplanation(value: string) {
    setEditDraft((current) => (current ? { ...current, explanation: value } : current));
  }

  function handleEditDraftBlankAnswer(blankIndex: number, value: string) {
    setEditDraft((current) => {
      if (!current) {
        return current;
      }

      const blankCount = getFillInBlankCount(current.content);
      const currentAnswers = parseFillInBlankAnswers(current.answer);
      const nextAnswers = Array.from(
        { length: blankCount },
        (_, index) =>
          index === blankIndex ? value : currentAnswers[index] ?? "",
      );

      return { ...current, answer: nextAnswers.join(" | ") };
    });
  }

  function handleEditOptionContent(optionIndex: number, value: string) {
    setEditDraft((current) => {
      if (!current) {
        return current;
      }

      const options = current.options.map((option, index) =>
        index === optionIndex ? { ...option, content: value } : option,
      );

      return { ...current, options };
    });
  }

  function handleMarkOptionAsCorrect(optionIndex: number) {
    setEditDraft((current) => {
      if (!current) {
        return current;
      }

      // Câu chọn nhiều đáp án cho phép đánh dấu nhiều phương án đúng.
      const allowMultipleCorrect = isMultipleAnswerType(current.question_type);
      const options = current.options.map((option, index) => {
        if (index === optionIndex) {
          return {
            ...option,
            is_correct: allowMultipleCorrect ? !option.is_correct : true,
          };
        }

        return allowMultipleCorrect ? option : { ...option, is_correct: false };
      });

      return { ...current, options };
    });
  }

  function handleSaveEditQuestion() {
    if (!editDraft) {
      return;
    }

    const content = editDraft.content.trim();
    if (!content) {
      setEditErrorMessage("Nội dung câu hỏi không được để trống.");
      return;
    }

    const score = editDraft.score;
    if (!Number.isFinite(score) || score < 0) {
      setEditErrorMessage("Điểm số của câu hỏi không hợp lệ.");
      return;
    }

    const isFillBlank = isFillInBlankType(editDraft.question_type);
    const isMultiAnswer = isMultipleAnswerType(editDraft.question_type);
    let savedQuestion: GeneratedQuestion;

    if (isFillBlank) {
      const blankCount = getFillInBlankCount(content);
      const currentAnswers = parseFillInBlankAnswers(editDraft.answer);
      const blankAnswers = Array.from(
        { length: blankCount },
        (_, index) => currentAnswers[index]?.trim() ?? "",
      );

      // Mỗi chỗ trống cần ít nhất một cách viết; các cách viết thay thế của cùng
      // một chỗ trống được phân tách bằng dấu ~.
      const blankAnswerGroups = blankAnswers.map(splitBlankAlternatives);
      if (blankAnswerGroups.some((alternatives) => alternatives.length === 0)) {
        setEditErrorMessage(
          `Câu hỏi có ${blankCount} chỗ trống, hãy nhập đáp án cho từng chỗ trống.`,
        );
        return;
      }

      savedQuestion = {
        ...editDraft,
        content,
        score,
        answer: blankAnswerGroups
          .map((alternatives) =>
            alternatives.join(BLANK_ALTERNATIVE_SEPARATOR),
          )
          .join(" | "),
        options: [],
        bloom_level: editDraft.bloom_level || "remember",
        explanation: editDraft.explanation?.trim() || undefined,
      };
    } else {
      const nonEmptyOptions = editDraft.options.filter((option) =>
        option.content.trim() !== "",
      );
      if (nonEmptyOptions.length < 2) {
        setEditErrorMessage("Câu hỏi cần ít nhất hai phương án có nội dung.");
        return;
      }

      const correctOptions = nonEmptyOptions.filter((option) => option.is_correct);
      if (correctOptions.length === 0) {
        setEditErrorMessage("Hãy đánh dấu một phương án làm đáp án đúng.");
        return;
      }

      if (isMultiAnswer && correctOptions.length < 2) {
        setEditErrorMessage(
          "Câu hỏi chọn nhiều đáp án cần ít nhất hai phương án đúng.",
        );
        return;
      }

      const options = editDraft.options
        .map((option) => ({
          ...option,
          content: option.content.trim(),
        }))
        .filter((option) => option.content !== "");

      savedQuestion = {
        ...editDraft,
        content,
        score,
        answer: correctOptions.map((option) => option.content.trim()).join(" | "),
        options,
        bloom_level: editDraft.bloom_level || "remember",
        explanation: editDraft.explanation?.trim() || undefined,
      };
    }

    setGenerationResponse((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        questions: current.questions.map((question) =>
          question.sequence === savedQuestion.sequence ? savedQuestion : question,
        ),
      };
    });

    setEditedSequences((current) => {
      const next = new Set(current);
      next.add(savedQuestion.sequence);
      return next;
    });

    // Phương án có thể đã thay đổi, xóa câu trả lời thử cũ để tránh kết quả sai lệch.
    setPracticeAnswers({});
    setPracticeSubmitted(false);

    handleCancelEditQuestion();
  }

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#fff7ed_40%,#eff6ff_100%)] text-slate-900">
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

      <header className="fixed top-0 left-0 z-30 flex w-full items-center justify-between border-b border-slate-200 bg-white/92 px-4 py-3 shadow-sm backdrop-blur">
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
            <h1 className="text-lg font-semibold">Trợ lý AI tạo câu hỏi trắc nghiệm</h1>
            <p className="text-sm text-slate-500">
              Nơi có thể tạo nhanh bộ câu hỏi và đưa thẳng vào bài kiểm tra của mình
            </p>
          </div>
        </div>

        <div className="hidden items-center gap-2 md:flex">
          <NotificationBell userId={user.id} />
          <UserAccountMenu user={user} variant="dashboard" />
        </div>
      </header>

      <section className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-4 pb-14 pt-24 sm:px-6 lg:px-8">
        {isLoadingPage ? (
          <div className="flex min-h-[55vh] items-center justify-center rounded-4xl bg-white shadow-sm ring-1 ring-slate-200">
            <div className="flex items-center gap-3 text-slate-600">
              <LoaderCircle className="h-5 w-5 animate-spin" />
              <span>Đang tải dữ liệu giảng viên...</span>
            </div>
          </div>
        ) : (
          <>
            <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
              <article className="overflow-hidden rounded-4xl bg-slate-950 text-white shadow-2xl shadow-orange-950/10">
                <div className="relative px-6 py-7 sm:px-8">
                  <div className="absolute inset-y-0 right-0 hidden w-1/2 bg-[radial-gradient(circle_at_top_right,rgba(251,191,36,0.34),transparent_55%),radial-gradient(circle_at_bottom_right,rgba(59,130,246,0.24),transparent_48%)] lg:block" />
                  <div className="relative max-w-3xl">
                    <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-sm text-amber-100">
                      <Sparkles className="h-4 w-4" />
                      <span>Không chỉ tạo câu hỏi mà còn đưa thẳng vào bài kiểm tra</span>
                    </div>
                    <h2 className="mt-4 text-3xl font-semibold leading-tight sm:text-4xl">
                      Xây dựng ngân hàng câu hỏi nhanh hơn cho từng bài kiểm tra của bạn
                    </h2>
                    <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-200 sm:text-base">
                      Bạn có thể dùng trợ lý AI để tạo bộ câu hỏi, kiểm tra thử bộ câu hỏi 
                      đã tạo, thêm bộ câu hỏi đã tạo vào bài kiểm tra hay tải chúng về máy.
                    </p>

                    <div className="mt-7 grid gap-3 sm:grid-cols-3">
                      <div className="rounded-3xl border border-white/10 bg-white/8 px-4 py-4">
                        <p className="text-xs uppercase tracking-[0.18em] text-amber-100">
                          Nguồn dữ liệu
                        </p>
                        <p className="mt-2 text-lg font-semibold">3 lựa chọn</p>
                        <p className="mt-2 text-sm text-slate-300">
                          Văn bản, tệp tải lên hoặc URL tài liệu
                        </p>
                      </div>
                      <div className="rounded-3xl border border-white/10 bg-white/8 px-4 py-4">
                        <p className="text-xs uppercase tracking-[0.18em] text-amber-100">
                          Giới hạn số câu
                        </p>
                        <p className="mt-2 text-lg font-semibold">
                          {AI_GENERATOR_MAX_QUESTIONS} câu
                        </p>
                        <p className="mt-2 text-sm text-slate-300">
                          Có thể thay đổi trong tương lai
                        </p>
                      </div>
                      <div className="rounded-3xl border border-white/10 bg-white/8 px-4 py-4">
                        <p className="text-xs uppercase tracking-[0.18em] text-amber-100">
                          Số bài kiểm tra
                        </p>
                        <p className="mt-2 text-lg font-semibold">
                          {examChoices.length} bài kiểm tra
                        </p>
                        <p className="mt-2 text-sm text-slate-300">
                          Mà bạn có thể thêm câu hỏi vào
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </article>

              <aside className="rounded-4xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
                <div className="flex items-center gap-3">
                  <div className="rounded-2xl bg-cyan-100 p-3 text-cyan-700">
                    <CheckCircle2 className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold">Một số lưu ý nhỏ</h3>
                    <p className="mt-1 text-sm text-slate-500">
                      AI chỉ nhận một nguồn dữ liệu trong mỗi lần tạo đề.
                    </p>
                  </div>
                </div>

                <div className="mt-10 space-y-6">
                  <div className="rounded-3xl bg-slate-50 px-6 py-6">
                    <p className="text-sm font-semibold text-slate-900">
                      1. Chọn một nguồn; có thể chia nhiều chủ đề khi chọn “Chỉ chủ đề”
                    </p>
                  </div>
                  <div className="rounded-3xl bg-slate-50 px-6 py-6">
                    <p className="text-sm font-semibold text-slate-900">
                      2. Tối đa {AI_GENERATOR_MAX_QUESTIONS} câu trong một lần tạo
                    </p>
                  </div>
                  <div className="rounded-3xl bg-slate-50 px-6 py-6">
                    <p className="text-sm font-semibold text-slate-900">
                      3. Có thể tải xuống, kiểm tra thử ngay hoặc thêm vào một bài kiểm tra
                    </p>
                  </div>
                </div>
              </aside>
            </section>

            {errorMessage ? (
              <section className="rounded-[28px] border border-red-200 bg-red-50 px-5 py-4 text-red-700">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
                  <div>
                    <p className="font-semibold">Không thể hoàn tất yêu cầu</p>
                    <p className="mt-1 text-sm">{errorMessage}</p>
                  </div>
                </div>
              </section>
            ) : null}

            {saveSuccessMessage ? (
              <section className="rounded-[28px] border border-emerald-200 bg-emerald-50 px-5 py-4 text-emerald-800">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
                  <div>
                    <p className="font-semibold">Đã cập nhật bài kiểm tra</p>
                    <p className="mt-1 text-sm">{saveSuccessMessage}</p>
                  </div>
                </div>
              </section>
            ) : null}

            <section className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
              <article className="rounded-4xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <h3 className="text-2xl font-semibold">Nguồn nội dung đầu vào</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-500">
                      Chọn đúng một cách cung cấp dữ liệu cho mỗi lần tạo bộ câu hỏi.
                    </p>
                  </div>
                  <div className="rounded-full bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700">
                    Đang chọn: {getSourceLabel(sourceMode)}
                  </div>
                </div>

                <div className="mt-6 grid gap-3 md:grid-cols-3">
                  <button
                    type="button"
                    onClick={() => handleChangeSourceMode("text")}
                    className={`rounded-3xl border px-4 py-4 text-left transition ${
                      sourceMode === "text"
                        ? "border-amber-400 bg-amber-50 shadow-sm"
                        : "border-slate-200 bg-white hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="rounded-2xl bg-slate-100 p-3 text-slate-700">
                        <FileText className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900">Văn bản thuần</p>
                        <p className="mt-1 text-sm text-slate-500">
                          Dán nội dung trực tiếp.
                        </p>
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleChangeSourceMode("upload")}
                    className={`rounded-3xl border px-4 py-4 text-left transition ${
                      sourceMode === "upload"
                        ? "border-amber-400 bg-amber-50 shadow-sm"
                        : "border-slate-200 bg-white hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="rounded-2xl bg-slate-100 p-3 text-slate-700">
                        <Upload className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900">Tệp tài liệu</p>
                        <p className="mt-1 text-sm text-slate-500">
                          Dùng PDF, ảnh hoặc tệp văn bản.
                        </p>
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleChangeSourceMode("url")}
                    className={`rounded-3xl border px-4 py-4 text-left transition ${
                      sourceMode === "url"
                        ? "border-amber-400 bg-amber-50 shadow-sm"
                        : "border-slate-200 bg-white hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="rounded-2xl bg-slate-100 p-3 text-slate-700">
                        <Globe className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900">URL tài liệu</p>
                        <p className="mt-1 text-sm text-slate-500">
                          Phù hợp khi đã có liên kết tài liệu.
                        </p>
                      </div>
                    </div>
                  </button>
                </div>

                <div className="mt-6 rounded-[28px] border border-slate-200 bg-slate-50 p-5">
                  {sourceMode === "text" ? (
                    <div>
                      <label
                        htmlFor="plain-text-source"
                        className="text-sm font-semibold text-slate-900"
                      >
                        Nội dung dùng để tạo câu hỏi trắc nghiệm
                      </label>
                      <textarea
                        id="plain-text-source"
                        value={plainText}
                        onChange={(event) => setPlainText(event.target.value)}
                        rows={11}
                        placeholder="Nhập hoặc dán nội dung bài giảng, tài liệu học tập, ghi chú chương hoặc hướng dẫn chuyên đề tại đây..."
                        className="mt-3 w-full rounded-3xl border border-slate-200 bg-white px-4 py-4 text-sm leading-7 text-slate-800 outline-none transition focus:border-amber-400"
                      />
                    </div>
                  ) : null}

                  {sourceMode === "upload" ? (
                    <div>
                      <label
                        htmlFor="upload-source"
                        className="text-sm font-semibold text-slate-900"
                      >
                        Chọn tệp tài liệu
                      </label>
                      <div className="mt-3 rounded-3xl border border-dashed border-slate-300 bg-white px-5 py-8">
                        <input
                          id="upload-source"
                          type="file"
                          accept={AI_GENERATOR_UPLOAD_ACCEPT}
                          onChange={handleChooseFile}
                          className="block w-full text-sm text-slate-700 file:mr-4 file:rounded-full file:border-0 file:bg-slate-900 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-slate-700"
                        />
                        <p className="mt-4 text-sm text-slate-500">
                          Hỗ trợ `.txt`, `.md`, `.pdf`, ảnh và một số định dạng video.
                        </p>
                        {uploadedFile ? (
                          <div className="mt-4 rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                            Đã chọn tệp: <span className="font-semibold">{uploadedFile.name}</span>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ) : null}

                  {sourceMode === "url" ? (
                    <div>
                      <label
                        htmlFor="url-source"
                        className="text-sm font-semibold text-slate-900"
                      >
                        URL dẫn đến tài liệu
                      </label>
                      <input
                        id="url-source"
                        type="url"
                        value={documentUrl}
                        onChange={(event) => setDocumentUrl(event.target.value)}
                        placeholder="Ví dụ: http://127.0.0.1:8000/uploads/bai-giang.pdf"
                        className="mt-3 w-full rounded-3xl border border-slate-200 bg-white px-4 py-4 text-sm text-slate-800 outline-none transition focus:border-amber-400"
                      />
                      <p className="mt-3 text-sm leading-6 text-slate-500">
                        Nếu URL trỏ đến tài liệu hợp lệ, hệ thống sẽ tự lấy nội dung để tạo đề.
                      </p>
                    </div>
                  ) : null}

                  <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="rounded-2xl bg-white px-4 py-3 text-sm text-slate-600 ring-1 ring-slate-200">
                      Mỗi lần tạo đề chỉ dùng một nguồn dữ liệu duy nhất.
                    </div>
                    <button
                      type="button"
                      onClick={handleGenerateQuestions}
                      disabled={isGenerating}
                      className="inline-flex items-center justify-center rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
                    >
                      {isGenerating ? (
                        <span className="flex items-center gap-2">
                          <LoaderCircle className="h-4 w-4 animate-spin" />
                          Đang tạo bộ câu hỏi...
                        </span>
                      ) : (
                        <span className="flex items-center gap-2">
                          <Sparkles className="h-4 w-4" />
                          {getGenerateButtonLabel(sourceMode)}
                        </span>
                      )}
                    </button>
                  </div>
                </div>
              </article>

              <aside className="space-y-6">
                <article className="rounded-4xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
                  <h3 className="text-2xl font-semibold">Thiết lập bộ câu hỏi</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    Thiết lập các thông số để trợ lý AI tạo câu hỏi.
                  </p>

                  <div className="mt-6 space-y-5">
                    <div>
                      <label
                        htmlFor="question-count"
                        className="text-sm font-semibold text-slate-900"
                      >
                        Số lượng câu hỏi
                      </label>
                      <input
                        id="question-count"
                        type="text"
                        inputMode="numeric"
                        value={questionCountInput}
                        onChange={(event) => handleQuestionCountChange(event.target.value)}
                        onBlur={handleQuestionCountBlur}
                        className="mt-3 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-4 text-lg font-semibold text-slate-900 outline-none transition focus:border-amber-400"
                      />
                      <p className="mt-2 text-sm text-slate-500">
                        Tối đa {AI_GENERATOR_MAX_QUESTIONS} câu trong một lần tạo.
                      </p>
                    </div>

                    <CognitiveSettings
                      value={cognitiveSettings}
                      onChange={(next) => {
                        if (
                          next.sourceMode !== "topic_only" &&
                          topicAllocations.length > 1
                        ) {
                          setTopicAllocations(initialTopicAllocations);
                        }
                        setCognitiveSettings(next);
                      }}
                      categories={categories}
                      enableMultipleTopics
                      topicAllocations={topicAllocations}
                      onTopicAllocationsChange={setTopicAllocations}
                    />

                    <div>
                      <p className="text-sm font-semibold text-slate-900">Loại câu hỏi</p>
                      <div className="mt-3 space-y-3">
                        {questionTypeOptions.map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => setQuestionType(option.value)}
                            className={`w-full rounded-3xl border px-4 py-4 text-left transition ${
                              questionType === option.value
                                ? "border-amber-400 bg-amber-50"
                                : "border-slate-200 bg-slate-50 hover:border-slate-300"
                            }`}
                          >
                            <p className="font-semibold text-slate-900">{option.label}</p>
                            <p className="mt-1 text-sm leading-6 text-slate-500">
                              {option.description}
                            </p>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </article>

                <article className="rounded-4xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-2xl font-semibold">Bài kiểm tra đích</h3>
                      <p className="mt-2 text-sm leading-6 text-slate-500">
                        Chọn bài kiểm tra để nhận bộ câu hỏi sau khi tạo.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => router.push("/instructor/exam")}
                      className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                    >
                      Mở trang bài kiểm tra
                    </button>
                  </div>

                  {examChoices.length === 0 ? (
                    <div className="mt-5 rounded-[28px] border border-dashed border-slate-300 bg-slate-50 px-5 py-6 text-sm leading-6 text-slate-600">
                      Giảng viên hiện chưa có bài kiểm tra nào để nhận bộ câu hỏi. Hãy tạo hoặc mở một bài kiểm tra trước.
                    </div>
                  ) : (
                    <div className="mt-5 space-y-4">
                      <div>
                        <label
                          htmlFor="target-exam"
                          className="text-sm font-semibold text-slate-900"
                        >
                          Chọn bài kiểm tra
                        </label>
                        <select
                          id="target-exam"
                          value={selectedExamId}
                          onChange={(event) => setSelectedExamId(event.target.value)}
                          className="mt-3 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-900 outline-none transition focus:border-amber-400"
                        >
                          {examChoices.map((exam) => (
                            <option key={exam.id} value={exam.id}>
                              {exam.title} - {exam.course_name}
                            </option>
                          ))}
                        </select>
                      </div>

                      {selectedExam ? (
                        <div className="rounded-[28px] bg-slate-50 px-5 py-5">
                          <p className="text-sm text-slate-500">Bài kiểm tra đã chọn</p>
                          <h4 className="mt-2 text-lg font-semibold text-slate-900">
                            {selectedExam.title}
                          </h4>
                          <p className="mt-2 text-sm leading-6 text-slate-600">
                            Khóa học: {selectedExam.course_name}
                          </p>
                          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                            <div className="rounded-2xl bg-white px-4 py-3">
                              <p className="text-xs uppercase tracking-[0.14em] text-slate-500">
                                Câu hỏi thực tế
                              </p>
                              <p className="mt-2 text-lg font-semibold text-slate-900">
                                {selectedExam.actual_question_count ?? 0}
                              </p>
                            </div>
                            <div className="rounded-2xl bg-white px-4 py-3">
                              <p className="text-xs uppercase tracking-[0.14em] text-slate-500">
                                Số câu khi làm bài
                              </p>
                              <p className="mt-2 text-lg font-semibold text-slate-900">
                                {selectedExam.total_questions}
                              </p>
                            </div>
                            <div className="rounded-2xl bg-white px-4 py-3">
                              <p className="text-xs uppercase tracking-[0.14em] text-slate-500">
                                Thời gian
                              </p>
                              <p className="mt-2 text-lg font-semibold text-slate-900">
                                {selectedExam.duration_minutes} phút
                              </p>
                            </div>
                            <div className="rounded-2xl bg-white px-4 py-3">
                              <p className="text-xs uppercase tracking-[0.14em] text-slate-500">
                                Trạng thái
                              </p>
                              <p className="mt-2 text-lg font-semibold text-slate-900">
                                {selectedExam.is_active ? "Đang bật" : "Đang tắt"}
                              </p>
                            </div>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  )}
                </article>
              </aside>
            </section>

            {generationResponse ? (
              <section className="space-y-6">
                <article className="rounded-4xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
                  <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                    <div className="max-w-3xl">
                      <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-700">
                        <CheckCircle2 className="h-4 w-4" />
                        <span>Đã tạo xong bộ câu hỏi</span>
                      </div>
                      <h3 className="mt-4 text-2xl font-semibold">
                        Bộ câu hỏi đã sẵn sàng để xem, tải xuống hoặc đưa vào bài kiểm tra
                      </h3>
                      <p className="mt-3 text-sm leading-7 text-slate-500">
                        Trang đang hiển thị tối đa {AI_GENERATOR_PAGE_SIZE} câu mỗi lần.
                        Nếu lưu vào bài kiểm tra, trang web sẽ thêm đúng bộ câu hỏi này.
                      </p>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2 xl:min-w-90">
                      <div className="rounded-3xl bg-slate-50 px-4 py-4">
                        <p className="text-sm text-slate-500">Số câu đã yêu cầu</p>
                        <p className="mt-2 text-2xl font-semibold text-slate-900">
                          {requestedQuestionCount}
                        </p>
                      </div>
                      <div className="rounded-3xl bg-slate-50 px-4 py-4">
                        <p className="text-sm text-slate-500">Số câu nhận được</p>
                        <p className="mt-2 text-2xl font-semibold text-slate-900">
                          {generatedQuestions.length}
                        </p>
                      </div>
                      <div className="rounded-3xl bg-slate-50 px-4 py-4">
                        <p className="text-sm text-slate-500">Nguồn xử lý</p>
                        <p className="mt-2 text-base font-semibold text-slate-900">
                          {getSourceTypeLabel(generationResponse.source_type)}
                        </p>
                      </div>
                      <div className="rounded-3xl bg-slate-50 px-4 py-4">
                        <p className="text-sm text-slate-500">Mô hình sử dụng</p>
                        <p className="mt-2 break-all text-base font-semibold text-slate-900">
                          {generationResponse.model_used}
                        </p>
                      </div>
                      <div className="rounded-3xl bg-slate-50 px-4 py-4">
                        <p className="text-sm text-slate-500">Phân bố mức độ nhận thức</p>
                        <p className="mt-2 text-base font-semibold text-slate-900">
                          {getCognitiveDistributionLabel(
                            generationResponse.difficulty_remember,
                            generationResponse.difficulty_understand,
                            generationResponse.difficulty_apply,
                          )}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 rounded-3xl bg-slate-50 px-4 py-4">
                    <p className="text-sm font-semibold text-slate-900">Tóm tắt nội dung nguồn</p>
                    <p className="mt-2 text-sm leading-7 text-slate-600">
                      {generationResponse.content_preview || "Chưa có phần xem trước nội dung."}
                    </p>
                  </div>

                  <div className="mt-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex flex-col gap-3 sm:flex-row">
                      <button
                        type="button"
                        onClick={() => downloadInstructorQuestionsAsTxt(generationResponse)}
                        className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                      >
                        <Download className="mr-2 h-4 w-4" />
                        Tải xuống .txt
                      </button>
                      <button
                        type="button"
                        onClick={() => downloadInstructorQuestionsAsJson(generationResponse)}
                        className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                      >
                        <Download className="mr-2 h-4 w-4" />
                        Tải xuống .json
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={handleSaveGeneratedQuestionsToExam}
                      disabled={!selectedExam || isSavingToExam}
                      className="inline-flex items-center justify-center rounded-2xl bg-amber-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:bg-amber-200"
                    >
                      {isSavingToExam ? (
                        <span className="flex items-center gap-2">
                          <LoaderCircle className="h-4 w-4 animate-spin" />
                          Đang đưa vào bài kiểm tra...
                        </span>
                      ) : (
                        <span className="flex items-center gap-2">
                          <BookOpen className="h-4 w-4" />
                          Đưa bộ câu hỏi vào bài kiểm tra đã chọn
                        </span>
                      )}
                    </button>
                  </div>

                  {generationResponse.warnings.length > 0 ? (
                    <div className="mt-6 rounded-[28px] border border-amber-200 bg-amber-50 px-5 py-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" />
                          <p className="font-semibold text-amber-800">
                            Lưu ý từ quá trình tạo đề
                          </p>
                        </div>
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
                          <AlertTriangle className="h-3 w-3" />
                          {generationResponse.warnings.length} cảnh báo
                        </span>
                      </div>
                      <div className="mt-3 space-y-2">
                        {generationResponse.warnings.map((warning, index) => (
                          <div
                            key={`${warning}-${index}`}
                            className="flex items-start gap-3 rounded-2xl bg-white/70 px-4 py-3 text-sm leading-6 text-amber-800"
                          >
                            <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-200 text-xs font-bold text-amber-700">
                              {index + 1}
                            </span>
                            <span>{warning}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <div className="mt-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex flex-col gap-3 sm:flex-row">
                      <button
                        type="button"
                        onClick={() => setShowCorrectAnswers((current) => !current)}
                        className="inline-flex items-center justify-center rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-700"
                      >
                        {showCorrectAnswers ? (
                          <>
                            <EyeOff className="mr-2 h-4 w-4" />
                            Ẩn đáp án đúng
                          </>
                        ) : (
                          <>
                            <Eye className="mr-2 h-4 w-4" />
                            Hiện đáp án đúng
                          </>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={handleTogglePracticeMode}
                        className="inline-flex items-center justify-center rounded-2xl bg-cyan-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-cyan-500"
                      >
                        <Play className="mr-2 h-4 w-4" />
                        {isPracticeMode ? "Ẩn phần kiểm tra thử" : "Kiểm tra thử với bộ câu hỏi này"}
                      </button>
                    </div>

                    <div className="rounded-full bg-slate-100 px-4 py-2 text-sm text-slate-600">
                      Trang {currentPage}/{totalPages} • hiển thị {AI_GENERATOR_PAGE_SIZE} câu mỗi lần
                    </div>
                  </div>
                </article>

                <article className="rounded-4xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h3 className="text-2xl font-semibold">Danh sách câu hỏi đã tạo</h3>
                      <p className="mt-2 text-sm leading-6 text-slate-500">
                        {getCognitiveSummaryLabel("", generationResponse)} •{" "}
                        {getQuestionTypeLabel(generationResponse.question_type)}
                        {topicSummary ? ` • 📌 ${topicSummary}` : ""}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-amber-600">
                        ✏️ Bạn có thể chỉnh sửa nội dung, phương án và đáp án của từng câu hỏi
                        trước khi kiểm tra thử, tải xuống hoặc đưa vào bài kiểm tra.
                      </p>
                    </div>
                    {generatedQuestions.length !== requestedQuestionCount ? (
                      <div className="rounded-full bg-amber-50 px-4 py-2 text-sm font-medium text-amber-700">
                        Hệ thống hiện trả về {generatedQuestions.length}/{requestedQuestionCount} câu
                      </div>
                    ) : null}
                  </div>

                  <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 lg:flex-row lg:items-end lg:justify-between">
                    <div className="flex flex-wrap items-end gap-3">
                      <div>
                        <label
                          htmlFor="bulk-score"
                          className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-700"
                        >
                          Điểm cho tất cả câu
                        </label>
                        <input
                          id="bulk-score"
                          type="text"
                          inputMode="numeric"
                          value={bulkScoreInput}
                          onChange={(event) =>
                            setBulkScoreInput(
                              event.target.value.replace(/[^\d]/g, ""),
                            )
                          }
                          className="mt-1 w-24 rounded-xl border border-amber-300 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none transition focus:border-amber-500"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={handleApplyScoreToAll}
                        className="rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-amber-400"
                      >
                        Áp dụng cho tất cả
                      </button>
                      <p className="text-xs text-amber-700">
                        Tổng điểm hiện tại:{" "}
                        <span className="font-semibold">{totalGeneratedScore}</span>
                      </p>
                    </div>
                    {bulkScoreMessage ? (
                      <p className="text-xs font-medium text-emerald-700">
                        {bulkScoreMessage}
                      </p>
                    ) : null}
                  </div>

                  <div className="mt-6 space-y-4">
                    {paginatedQuestions.map((question) => {
                      const correctOptionContents =
                        getCorrectOptionContents(question);

                      if (editingSequence === question.sequence && editDraft) {
                        const editBlankAnswers = Array.from(
                          { length: getFillInBlankCount(editDraft.content) },
                          (_, index) =>
                            parseFillInBlankAnswers(editDraft.answer)[index] ?? "",
                        );

                        return (
                          <article
                            key={`edit-${question.sequence}`}
                            className="rounded-[28px] border-2 border-amber-300 bg-amber-50/60 p-5"
                          >
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                              <div>
                                <div className="inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-amber-700">
                                  <Pencil className="h-3.5 w-3.5" />
                                  <span>Đang chỉnh sửa câu {question.sequence}</span>
                                </div>
                                <p className="mt-3 text-sm leading-6 text-slate-600">
                                  Chỉnh sửa nội dung câu hỏi, phương án và đáp án. Thay đổi
                                  sẽ được áp dụng khi kiểm tra thử, tải xuống hoặc đưa vào
                                  bài kiểm tra.
                                </p>
                              </div>
                            </div>

                            <div className="mt-5 space-y-5">
                              <div>
                                <label
                                  htmlFor={`edit-content-${question.sequence}`}
                                  className="text-sm font-semibold text-slate-900"
                                >
                                  Nội dung câu hỏi
                                </label>
                                <textarea
                                  id={`edit-content-${question.sequence}`}
                                  value={editDraft.content}
                                  onChange={(event) => handleEditDraftContent(event.target.value)}
                                  rows={3}
                                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-800 outline-none transition focus:border-amber-400"
                                />
                              </div>

                              <div className="grid gap-4 sm:grid-cols-2">
                                <div>
                                  <label
                                    htmlFor={`edit-score-${question.sequence}`}
                                    className="text-sm font-semibold text-slate-900"
                                  >
                                    Điểm số
                                  </label>
                                  <input
                                    id={`edit-score-${question.sequence}`}
                                    type="text"
                                    inputMode="numeric"
                                    value={String(editDraft.score)}
                                    onChange={(event) => handleEditDraftScore(event.target.value)}
                                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-amber-400"
                                  />
                                </div>
                                <div>
                                  <label
                                    htmlFor={`edit-bloom-${question.sequence}`}
                                    className="text-sm font-semibold text-slate-900"
                                  >
                                    Cấp độ nhận thức
                                  </label>
                                  <select
                                    id={`edit-bloom-${question.sequence}`}
                                    value={editDraft.bloom_level ?? "remember"}
                                    onChange={(event) => handleEditDraftBloomLevel(event.target.value)}
                                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-400"
                                  >
                                    {bloomLevelOptions.map((level) => (
                                      <option key={level.value} value={level.value}>
                                        {level.label}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              </div>

                              {isFillInBlankType(editDraft.question_type) ? (
                                <div>
                                  <p className="text-sm font-semibold text-slate-900">
                                    Đáp án chỗ trống
                                    <span className="ml-2 font-normal text-slate-500">
                                      Mỗi chỗ trống ___ trong câu hỏi cần một đáp án. Nhiều
                                      cách viết được chấp nhận cho cùng một chỗ trống thì
                                      cách nhau bằng dấu ~ (ví dụ: Hà Nội ~ HN).
                                    </span>
                                  </p>
                                  <div className="mt-3 space-y-3">
                                    {editBlankAnswers.map((answer, blankIndex) => (
                                      <div
                                        key={`${question.sequence}-edit-blank-${blankIndex}`}
                                        className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3"
                                      >
                                        <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                                          {blankIndex + 1}
                                        </span>
                                        <input
                                          type="text"
                                          value={answer}
                                          onChange={(event) =>
                                            handleEditDraftBlankAnswer(
                                              blankIndex,
                                              event.target.value,
                                            )
                                          }
                                          placeholder={`Đáp án chỗ trống ${blankIndex + 1} (nhiều cách viết: cách nhau bằng ~)`}
                                          className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 outline-none transition focus:border-amber-400"
                                        />
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ) : (
                                <div>
                                  <p className="text-sm font-semibold text-slate-900">
                                    Phương án trả lời
                                    <span className="ml-2 font-normal text-slate-500">
                                      {isMultipleAnswerType(editDraft.question_type)
                                        ? "Nhấn vào vòng tròn để chọn các đáp án đúng."
                                        : "Nhấn vào vòng tròn để chọn đáp án đúng."}
                                    </span>
                                  </p>
                                  <div className="mt-3 space-y-3">
                                  {editDraft.options.map((option, optionIndex) => {
                                    const isMarkedCorrect = option.is_correct;

                                    return (
                                      <div
                                        key={`${question.sequence}-edit-option-${optionIndex}`}
                                        className={`flex items-center gap-3 rounded-2xl border px-4 py-3 transition ${
                                          isMarkedCorrect
                                            ? "border-emerald-300 bg-emerald-50"
                                            : "border-slate-200 bg-white"
                                        }`}
                                      >
                                        <button
                                          type="button"
                                          onClick={() => handleMarkOptionAsCorrect(optionIndex)}
                                          className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition ${
                                            isMarkedCorrect
                                              ? "border-emerald-500 bg-emerald-500 text-white"
                                              : "border-slate-300 bg-white text-slate-400 hover:border-emerald-400"
                                          }`}
                                          aria-label={`Đánh dấu phương án ${String.fromCharCode(65 + optionIndex)} là đáp án đúng`}
                                          title="Chọn làm đáp án đúng"
                                        >
                                          {isMarkedCorrect ? (
                                            <Check className="h-4 w-4" />
                                          ) : (
                                            <Circle className="h-4 w-4" />
                                          )}
                                        </button>
                                        <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                                          {String.fromCharCode(65 + optionIndex)}
                                        </span>
                                        <input
                                          type="text"
                                          value={option.content}
                                          onChange={(event) =>
                                            handleEditOptionContent(optionIndex, event.target.value)
                                          }
                                          placeholder={`Phương án ${String.fromCharCode(65 + optionIndex)}`}
                                          className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 outline-none transition focus:border-amber-400"
                                        />
                                        {isMarkedCorrect ? (
                                          <span className="hidden shrink-0 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700 sm:inline">
                                            Đáp án đúng
                                          </span>
                                        ) : null}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                              )}

                              <div>
                                <label
                                  htmlFor={`edit-explanation-${question.sequence}`}
                                  className="text-sm font-semibold text-slate-900"
                                >
                                  Giải thích (không bắt buộc)
                                </label>
                                <textarea
                                  id={`edit-explanation-${question.sequence}`}
                                  value={editDraft.explanation ?? ""}
                                  onChange={(event) =>
                                    handleEditDraftExplanation(event.target.value)
                                  }
                                  rows={2}
                                  placeholder="Thêm lời giải thích cho câu hỏi..."
                                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-800 outline-none transition focus:border-amber-400"
                                />
                              </div>

                              {editErrorMessage ? (
                                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                                  {editErrorMessage}
                                </div>
                              ) : null}

                              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <div className="rounded-2xl bg-white px-4 py-3 text-sm text-slate-600 ring-1 ring-slate-200">
                                  Thay đổi sẽ được giữ trong bộ câu hỏi hiện tại.
                                </div>
                                <div className="flex flex-col gap-3 sm:flex-row">
                                  <button
                                    type="button"
                                    onClick={handleCancelEditQuestion}
                                    className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                                  >
                                    <X className="mr-2 h-4 w-4" />
                                    Hủy
                                  </button>
                                  <button
                                    type="button"
                                    onClick={handleSaveEditQuestion}
                                    className="inline-flex items-center justify-center rounded-2xl bg-amber-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-amber-400"
                                  >
                                    <Check className="mr-2 h-4 w-4" />
                                    Lưu thay đổi
                                  </button>
                                </div>
                              </div>
                            </div>
                          </article>
                        );
                      }

                      return (
                        <article
                          key={`${question.sequence}-${question.content}`}
                          className="rounded-[28px] border border-slate-200 bg-slate-50 p-5"
                        >
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                              <div className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 ring-1 ring-slate-200">
                                <span>Câu {question.sequence}</span>
                                <span>•</span>
                                <span>{question.score} điểm</span>
                              </div>
                              <p className="mt-4 text-base leading-7 text-slate-900">
                                {question.content}
                              </p>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              <div className="rounded-2xl bg-white px-3 py-2 text-sm text-slate-500 ring-1 ring-slate-200">
                                {getQuestionTypeLabel(question.question_type)}
                              </div>
                              {question.bloom_level ? (
                                <span
                                  className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium"
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
                              {question.topic ? (
                                <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-700 ring-1 ring-indigo-200">
                                  {question.topic}
                                </span>
                              ) : null}
                              {editedSequences.has(question.sequence) ? (
                                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1.5 text-xs font-semibold text-amber-700">
                                  <Check className="h-3.5 w-3.5" />
                                  Đã chỉnh sửa
                                </span>
                              ) : null}
                              <button
                                type="button"
                                onClick={() => handleStartEditQuestion(question)}
                                className="inline-flex items-center gap-1.5 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-amber-300 hover:bg-amber-50"
                              >
                                <Pencil className="h-4 w-4" />
                                Chỉnh sửa
                              </button>
                            </div>
                          </div>

                          <div className="mt-5 grid gap-3">
                            {question.options.map((option, optionIndex) => {
                              const isCorrectAnswer =
                                correctOptionContents.includes(option.content);

                              return (
                                <div
                                  key={`${question.sequence}-${option.content}-${optionIndex}`}
                                  className={`rounded-2xl border px-4 py-3 transition ${
                                    showCorrectAnswers && isCorrectAnswer
                                      ? "border-emerald-300 bg-emerald-50"
                                      : "border-slate-200 bg-white"
                                  }`}
                                >
                                  <div className="flex items-start gap-3">
                                    <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-slate-200 text-xs font-semibold text-slate-700">
                                      {String.fromCharCode(65 + optionIndex)}
                                    </span>
                                    <div className="flex-1">
                                      <p className="text-sm leading-6 text-slate-700">
                                        {option.content}
                                      </p>
                                      {showCorrectAnswers && isCorrectAnswer ? (
                                        <p className="mt-2 text-sm font-semibold text-emerald-700">
                                          Đây là đáp án đúng
                                        </p>
                                      ) : null}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          {showCorrectAnswers ? (
                            <div className="mt-4 rounded-2xl bg-slate-900 px-4 py-3 text-sm text-slate-100">
                              Đáp án đúng:{" "}
                              <span className="font-semibold">
                                {getCorrectAnswerLabel(question)}
                              </span>
                            </div>
                          ) : null}

                          {showCorrectAnswers && question.explanation ? (
                            <div className="mt-3 rounded-2xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm leading-6 text-cyan-800">
                              <span className="font-semibold">Giải thích:</span>{" "}
                              {question.explanation}
                            </div>
                          ) : null}
                        </article>
                      );
                    })}
                  </div>

                  {totalPages > 1 ? (
                    <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <button
                        type="button"
                        onClick={() => setCurrentPage((current) => Math.max(1, current - 1))}
                        disabled={currentPage === 1}
                        className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <ChevronLeft className="mr-2 h-4 w-4" />
                        Trang trước
                      </button>

                      <div className="flex flex-wrap items-center justify-center gap-2">
                        {Array.from({ length: totalPages }, (_, index) => {
                          const pageNumber = index + 1;
                          return (
                            <button
                              key={pageNumber}
                              type="button"
                              onClick={() => setCurrentPage(pageNumber)}
                              className={`inline-flex h-11 min-w-11 items-center justify-center rounded-2xl px-4 text-sm font-semibold transition ${
                                currentPage === pageNumber
                                  ? "bg-slate-900 text-white"
                                  : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                              }`}
                            >
                              {pageNumber}
                            </button>
                          );
                        })}
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          setCurrentPage((current) => Math.min(totalPages, current + 1))
                        }
                        disabled={currentPage === totalPages}
                        className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Trang sau
                        <ChevronRight className="ml-2 h-4 w-4" />
                      </button>
                    </div>
                  ) : null}
                </article>

                {isPracticeMode ? (
                  <article
                    ref={practiceSectionRef}
                    className="rounded-4xl bg-white p-6 shadow-sm ring-1 ring-slate-200"
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <h3 className="text-2xl font-semibold">Kiểm tra thử</h3>
                        <p className="mt-2 text-sm leading-6 text-slate-500">
                          Chọn đáp án cho từng câu hỏi rồi chấm thử ngay trên trang.
                        </p>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="rounded-3xl bg-slate-50 px-4 py-4">
                          <p className="text-sm text-slate-500">Đã trả lời</p>
                          <p className="mt-2 text-2xl font-semibold text-slate-900">
                            {practiceAnsweredCount}/{generatedQuestions.length}
                          </p>
                        </div>
                        <div className="rounded-3xl bg-slate-50 px-4 py-4">
                          <p className="text-sm text-slate-500">Trạng thái</p>
                          <p className="mt-2 text-base font-semibold text-slate-900">
                            {practiceSubmitted ? "Đã chấm bài thử" : "Chưa chấm"}
                          </p>
                        </div>
                      </div>
                    </div>

                    {practiceSubmitted ? (
                      <div className="mt-6 rounded-[28px] bg-emerald-50 px-5 py-5 text-emerald-800">
                        <div className="flex items-start gap-3">
                          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
                          <div>
                            <p className="font-semibold">Kết quả kiểm tra thử</p>
                            <p className="mt-2 text-sm leading-6">
                              Bạn trả lời đúng {practiceCorrectCount}/{generatedQuestions.length} câu,
                              tương đương {practicePercentage}%.
                            </p>
                          </div>
                        </div>
                      </div>
                    ) : null}

                    <div className="mt-6 space-y-4">
                      {generatedQuestions.map((question) => {
                        const selection = practiceAnswers[question.sequence];
                        const correctOptionContents =
                          getCorrectOptionContents(question);
                        const isFillBlankQuestion = isFillInBlankQuestion(question);
                        const isMultiAnswerQuestion =
                          isMultipleAnswerQuestion(question);
                        const blankValues = isFillBlankQuestion
                          ? getBlankValues(question, selection)
                          : [];
                        const contentSegments = isFillBlankQuestion
                          ? question.content.split(/_{2,}/)
                          : [];
                        const selectedContents =
                          selection?.kind === "multiple" ? selection.contents : [];
                        const selectedContent =
                          selection?.kind === "single" ? selection.content : "";
                        const isQuestionCorrect = practiceSubmitted
                          ? isGeneratedSelectionCorrect(question, selection)
                          : false;

                        return (
                          <article
                            key={`practice-${question.sequence}-${question.content}`}
                            className={`rounded-[28px] border p-5 ${
                              practiceSubmitted
                                ? isQuestionCorrect
                                  ? "border-emerald-200 bg-emerald-50"
                                  : "border-rose-200 bg-rose-50"
                                : "border-slate-200 bg-slate-50"
                            }`}
                          >
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                              <div>
                                <div className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 ring-1 ring-slate-200">
                                  <span>Câu {question.sequence}</span>
                                  <span>•</span>
                                  <span>{question.score} điểm</span>
                                </div>
                                <p className="mt-4 text-base leading-7 text-slate-900">
                                  {question.content}
                                </p>
                              </div>
                              {practiceSubmitted ? (
                                <div
                                  className={`rounded-full px-3 py-2 text-sm font-semibold ${
                                    isQuestionCorrect
                                      ? "bg-emerald-100 text-emerald-700"
                                      : "bg-rose-100 text-rose-700"
                                  }`}
                                >
                                  {isQuestionCorrect ? "Đúng" : "Chưa đúng"}
                                </div>
                              ) : null}
                            </div>

                            {isMultiAnswerQuestion ? (
                              <p className="mt-4 text-xs text-slate-500">
                                Chọn tất cả các đáp án đúng.
                              </p>
                            ) : isFillBlankQuestion ? (
                              <p className="mt-4 text-xs text-slate-500">
                                Điền nội dung vào từng chỗ trống.
                              </p>
                            ) : null}

                            {isFillBlankQuestion ? (
                              <div className="mt-4 flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-4 text-base leading-8 text-slate-700">
                                {contentSegments.map((segment, index) => (
                                  <span
                                    key={`practice-${question.sequence}-blank-${index}`}
                                    className="inline-flex flex-wrap items-center gap-2"
                                  >
                                    {segment ? <span>{segment}</span> : null}
                                    {index < blankValues.length ? (
                                      <input
                                        type="text"
                                        value={blankValues[index] ?? ""}
                                        onChange={(event) =>
                                          handleChangePracticeBlankAnswer(
                                            question.sequence,
                                            question,
                                            index,
                                            event.target.value,
                                          )
                                        }
                                        placeholder={`Chỗ trống ${index + 1}`}
                                        className="min-w-40 rounded-2xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
                                      />
                                    ) : null}
                                  </span>
                                ))}
                              </div>
                            ) : null}

                            <div className="mt-5 grid gap-3">
                              {question.options.map((option, optionIndex) => {
                                const isSelected = isMultiAnswerQuestion
                                  ? selectedContents.includes(option.content)
                                  : selectedContent === option.content;
                                const isCorrectOption =
                                  correctOptionContents.includes(option.content);

                                let optionClassName =
                                  "border-slate-200 bg-white hover:border-slate-300";

                                if (isSelected) {
                                  optionClassName = "border-cyan-400 bg-cyan-50";
                                }

                                if (practiceSubmitted && isCorrectOption) {
                                  optionClassName = "border-emerald-300 bg-emerald-100";
                                }

                                if (
                                  practiceSubmitted &&
                                  isSelected &&
                                  !isCorrectOption
                                ) {
                                  optionClassName = "border-rose-300 bg-rose-100";
                                }

                                return (
                                  <button
                                    key={`practice-${question.sequence}-${option.content}-${optionIndex}`}
                                    type="button"
                                    onClick={() =>
                                      isMultiAnswerQuestion
                                        ? handleTogglePracticeMultipleAnswer(
                                            question.sequence,
                                            option.content,
                                          )
                                        : handleSelectPracticeAnswer(
                                            question.sequence,
                                            option.content,
                                          )
                                    }
                                    className={`rounded-2xl border px-4 py-3 text-left transition ${optionClassName}`}
                                  >
                                    <div className="flex items-start gap-3">
                                      <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-slate-200 text-xs font-semibold text-slate-700">
                                        {String.fromCharCode(65 + optionIndex)}
                                      </span>
                                      <div className="flex-1">
                                        <p className="text-sm leading-6 text-slate-700">
                                          {option.content}
                                        </p>
                                        {practiceSubmitted && isCorrectOption ? (
                                          <p className="mt-2 text-sm font-semibold text-emerald-700">
                                            Đáp án đúng
                                          </p>
                                        ) : null}
                                      </div>
                                    </div>
                                  </button>
                                );
                              })}
                            </div>

                            {practiceSubmitted ? (
                              <div className="mt-4 rounded-2xl bg-slate-900 px-4 py-3 text-sm text-slate-100">
                                Đáp án đúng:{" "}
                                <span className="font-semibold">
                                  {getCorrectAnswerLabel(question)}
                                </span>
                              </div>
                            ) : null}

                            {practiceSubmitted && question.explanation ? (
                              <div className="mt-3 rounded-2xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm leading-6 text-cyan-800">
                                <span className="font-semibold">Giải thích:</span>{" "}
                                {question.explanation}
                              </div>
                            ) : null}
                          </article>
                        );
                      })}
                    </div>

                    <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="rounded-2xl bg-slate-100 px-4 py-3 text-sm text-slate-600">
                        Hãy hoàn thành toàn bộ câu hỏi trước khi chấm bài thử.
                      </div>
                      <div className="flex flex-col gap-3 sm:flex-row">
                        <button
                          type="button"
                          onClick={handleResetPractice}
                          className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                        >
                          Làm lại phần kiểm tra thử
                        </button>
                        <button
                          type="button"
                          onClick={handleSubmitPractice}
                          className="inline-flex items-center justify-center rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-700"
                        >
                          Chấm bài thử
                        </button>
                      </div>
                    </div>
                  </article>
                ) : null}
              </section>
            ) : null}
          </>
        )}
      </section>
    </main>
  );
}

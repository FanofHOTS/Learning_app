"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  EyeOff,
  FileText,
  Globe,
  LoaderCircle,
  Menu,
  Play,
  RefreshCw,
  Settings2,
  ShieldCheck,
  Sparkles,
  Upload,
} from "lucide-react";
import { UserAccountMenu } from "../../components/user-account-menu";
import { NotificationBell } from "../../components/notification-bell";
import { ShowNavigation } from "../../lib/app_nav";
import {
  AI_GENERATOR_MAX_QUESTIONS,
  AI_GENERATOR_PAGE_SIZE,
  AI_GENERATOR_UPLOAD_ACCEPT,
  clampQuestionCount,
  downloadAdminQuestionsAsJson,
  downloadAdminQuestionsAsTxt,
  generateAdminQuestionsFromText,
  generateAdminQuestionsFromUpload,
  generateAdminQuestionsFromUrl,
  getAdminAiGeneratorMetadata,
  getCorrectAnswerLabel,
  getCorrectOption,
  isSelectedAnswerCorrect,
  type AiGeneratorAdminMetadata,
  type AiGeneratorQuestionType,
  type QuestionGenerationResponse,
  getCognitiveDistributionLabel,
  getDifficultyDistributionLabel,
} from "../../lib/api_ai_generator_admin";
import { getLevelLabel, getLevelColor, getDifficultyColor } from "../../lib/api_exam";
import CognitiveSettings from "../../ai-generator/_cognitive-settings";
import type {
  CognitiveSettingsState,
  CategoryOption,
} from "../../ai-generator/_cognitive-settings";
import { getCategoryList } from "../../lib/api_category";
import { ADMIN_DEFAULT_USER, useAdminSession } from "../_lib/use-admin-session";

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
    description: "Phù hợp để kiểm tra nhanh pipeline và độ bám sát nội dung.",
  },
];

type SourceMode = "text" | "upload" | "url";

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
      return "Kiểm tra AI với tệp tải lên";
    case "url":
      return "Kiểm tra AI với URL tài liệu";
    default:
      return "Kiểm tra AI với văn bản";
  }
}

function getDifficultyLabel(value: string, response?: QuestionGenerationResponse): string {
  if (response) {
    const cognitive = getCognitiveDistributionLabel(
      response.difficulty_remember,
      response.difficulty_understand,
      response.difficulty_apply,
    );
    const difficulty = getDifficultyDistributionLabel(
      response.difficulty_easy ?? 34,
      response.difficulty_medium ?? 33,
      response.difficulty_hard ?? 33,
    );
    return `${cognitive} • ${difficulty}`;
  }
  return "NB 34% · TH 33% · VD 33% • Dễ 34% · TB 33% · Khó 33%";
}

function getQuestionTypeLabel(value: string): string {
  return value === "true_false" ? "Đúng hoặc sai" : "Nhiều lựa chọn";
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
      return "Video qua OCR khung hình";
    case "video_visual":
      return "Video qua phân tích hình ảnh";
    default:
      return value;
  }
}

function formatBooleanLabel(value: boolean): string {
  return value ? "Có" : "Không";
}

function formatSuffixList(values: string[]): string {
  return values.length > 0 ? values.join(", ") : "Không có";
}

function truncateMiddle(value: string, maxLength = 64): string {
  if (value.length <= maxLength) {
    return value;
  }

  const sideLength = Math.max(12, Math.floor((maxLength - 3) / 2));
  return `${value.slice(0, sideLength)}...${value.slice(-sideLength)}`;
}

export default function AdminAiGeneratorPage() {
  const router = useRouter();
  const practiceSectionRef = useRef<HTMLDivElement>(null);

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isLoadingPage, setIsLoadingPage] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRefreshingMetadata, setIsRefreshingMetadata] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [runtimeMetadata, setRuntimeMetadata] =
    useState<AiGeneratorAdminMetadata | null>(null);
  const [metadataUpdatedAt, setMetadataUpdatedAt] = useState("");
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
    difficultyEasy: 34,
    difficultyMedium: 33,
    difficultyHard: 33,
  });
  const [questionType, setQuestionType] =
    useState<AiGeneratorQuestionType>("multiple_choice");
  const [generationResponse, setGenerationResponse] =
    useState<QuestionGenerationResponse | null>(null);
  const [requestedQuestionCount, setRequestedQuestionCount] = useState(0);
  const [showCorrectAnswers, setShowCorrectAnswers] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [isPracticeMode, setIsPracticeMode] = useState(false);
  const [practiceAnswers, setPracticeAnswers] = useState<Record<number, string>>({});
  const [practiceSubmitted, setPracticeSubmitted] = useState(false);
  const { currentUser, isCheckingAuth } = useAdminSession();

  useEffect(() => {
    let isMounted = true;

    async function loadPageData() {
      const [metadataResult, categoriesResult] = await Promise.allSettled([
        getAdminAiGeneratorMetadata(),
        getCategoryList(),
      ]);

      if (!isMounted) {
        return;
      }

      const loadErrors: string[] = [];

      if (categoriesResult.status === "fulfilled") {
        setCategories(categoriesResult.value);
      }

      const metadataState = metadataResult;
      if (metadataState.status === "fulfilled") {
        setRuntimeMetadata(metadataState.value);
        setMetadataUpdatedAt(new Date().toLocaleString("vi-VN"));
      } else {
        loadErrors.push(
          metadataState.reason instanceof Error
            ? metadataState.reason.message
            : "Không thể tải cấu hình AI từ FastAPI.",
        );
      }

      setErrorMessage(loadErrors.join(" "));
      setIsLoadingPage(false);
    }

    void loadPageData();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    setCurrentPage(1);
    setShowCorrectAnswers(false);
    setIsPracticeMode(false);
    setPracticeAnswers({});
    setPracticeSubmitted(false);
  }, [generationResponse]);

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

  const user = currentUser ?? ADMIN_DEFAULT_USER;
  const generatedQuestions = generationResponse?.questions ?? [];
  const totalPages =
    generatedQuestions.length > 0
      ? Math.ceil(generatedQuestions.length / AI_GENERATOR_PAGE_SIZE)
      : 1;
  const paginatedQuestions = generatedQuestions.slice(
    (currentPage - 1) * AI_GENERATOR_PAGE_SIZE,
    currentPage * AI_GENERATOR_PAGE_SIZE,
  );
  const practiceAnsweredCount = Object.keys(practiceAnswers).length;
  const practiceCorrectCount = practiceSubmitted
    ? generatedQuestions.filter((question) =>
        isSelectedAnswerCorrect(
          question,
          practiceAnswers[question.sequence] ?? "",
        ),
      ).length
    : 0;
  const practicePercentage =
    generatedQuestions.length > 0
      ? Math.round((practiceCorrectCount / generatedQuestions.length) * 100)
      : 0;
  const isUploadGenerationUnavailable =
    sourceMode === "upload" &&
    runtimeMetadata !== null &&
    !runtimeMetadata.upload_generation_available;

  async function handleRefreshMetadata() {
    try {
      setIsRefreshingMetadata(true);
      const nextMetadata = await getAdminAiGeneratorMetadata();
      setRuntimeMetadata(nextMetadata);
      setMetadataUpdatedAt(new Date().toLocaleString("vi-VN"));
      setErrorMessage("");
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Không thể làm mới cấu hình AI từ FastAPI.",
      );
    } finally {
      setIsRefreshingMetadata(false);
    }
  }

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
  }

  function handleChooseFile(event: React.ChangeEvent<HTMLInputElement>) {
    const nextFile = event.target.files?.[0] ?? null;
    setUploadedFile(nextFile);
    setErrorMessage("");
  }

  async function handleGenerateQuestions() {
    const safeQuestionCount = clampQuestionCount(Number(questionCountInput || "1"));
    setQuestionCountInput(String(safeQuestionCount));
    setErrorMessage("");

    const distributionTotal =
      cognitiveSettings.difficultyRemember +
      cognitiveSettings.difficultyUnderstand +
      cognitiveSettings.difficultyApply;
    if (distributionTotal !== 100) {
      setErrorMessage(
        `Tổng tỷ lệ phân bố cấp độ nhận thức phải bằng 100% (hiện tại: ${distributionTotal}%). Hãy điều chỉnh lại các thanh trượt hoặc nhấn "Cân bằng".`,
      );
      return;
    }

    const difficultyTotal =
      cognitiveSettings.difficultyEasy +
      cognitiveSettings.difficultyMedium +
      cognitiveSettings.difficultyHard;
    if (difficultyTotal !== 100) {
      setErrorMessage(
        `Tổng tỷ lệ phân bố độ khó phải bằng 100% (hiện tại: ${difficultyTotal}%). Hãy điều chỉnh lại các thanh trượt hoặc nhấn "Cân bằng".`,
      );
      return;
    }

    try {
      setIsGenerating(true);

      if (isUploadGenerationUnavailable) {
        throw new Error(
          "Máy chủ hiện chưa bật thư viện hỗ trợ tải tệp lên để kiểm tra AI.",
        );
      }

      let response: QuestionGenerationResponse;

      const baseGenInput = {
        questionCount: safeQuestionCount,
        questionType,
        sourceMode: cognitiveSettings.sourceMode,
        topic: cognitiveSettings.topic,
        topicDescription: cognitiveSettings.topicDescription,
        difficultyRemember: cognitiveSettings.difficultyRemember,
        difficultyUnderstand: cognitiveSettings.difficultyUnderstand,
        difficultyApply: cognitiveSettings.difficultyApply,
        difficultyEasy: cognitiveSettings.difficultyEasy,
        difficultyMedium: cognitiveSettings.difficultyMedium,
        difficultyHard: cognitiveSettings.difficultyHard,
      };

      if (sourceMode === "text") {
        response = await generateAdminQuestionsFromText({
          ...baseGenInput,
          content: plainText,
        });
      } else if (sourceMode === "upload") {
        if (!uploadedFile) {
          throw new Error("Vui lòng chọn một tệp tài liệu trước khi kiểm tra AI.");
        }

        response = await generateAdminQuestionsFromUpload({
          ...baseGenInput,
          file: uploadedFile,
        });
      } else {
        response = await generateAdminQuestionsFromUrl({
          ...baseGenInput,
          documentUrl,
        });
      }

      setRequestedQuestionCount(safeQuestionCount);
      setGenerationResponse(response);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Không thể tạo bộ câu hỏi trắc nghiệm để kiểm tra AI.",
      );
    } finally {
      setIsGenerating(false);
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
      [questionSequence]: optionContent,
    }));

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

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#eef2ff_38%,#ecfeff_100%)] text-slate-900">
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
            <h1 className="text-lg font-semibold">Kiểm tra và quản lý AI tạo câu hỏi</h1>
            <p className="text-sm text-slate-500">
              Quản trị viên có thể theo dõi cấu hình mô hình và kiểm chứng đầu ra tạo đề
            </p>
          </div>
        </div>

        <div className="hidden items-center gap-2 md:flex">
          <NotificationBell userId={user.id} />
          <UserAccountMenu user={user} variant="dashboard" />
        </div>

        <div className="hidden items-center gap-3">
          <div className="rounded-full bg-indigo-100 px-3 py-1 text-sm font-medium text-indigo-700">
            {user.role === "admin" ? "Quản trị viên" : user.role}
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold">{user.username}</p>
            <p className="text-xs text-slate-500">{user.email}</p>
          </div>
        </div>
      </header>

      <section className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-4 pb-14 pt-24 sm:px-6 lg:px-8">
        {isLoadingPage ? (
          <div className="flex min-h-[55vh] items-center justify-center rounded-4xl bg-white shadow-sm ring-1 ring-slate-200">
            <div className="flex items-center gap-3 text-slate-600">
              <LoaderCircle className="h-5 w-5 animate-spin" />
              <span>Đang tải dữ liệu quản trị AI...</span>
            </div>
          </div>
        ) : (
          <>
            <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
              <article className="overflow-hidden rounded-4xl bg-slate-950 text-white shadow-2xl shadow-indigo-950/15">
                <div className="relative px-6 py-7 sm:px-8">
                  <div className="absolute inset-y-0 right-0 hidden w-1/2 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.34),transparent_55%),radial-gradient(circle_at_bottom_right,rgba(34,197,94,0.24),transparent_48%)] lg:block" />
                  <div className="relative max-w-3xl">
                    <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-sm text-cyan-100">
                      <ShieldCheck className="h-4 w-4" />
                      <span>Bảng kiểm tra runtime AI dành cho quản trị viên</span>
                    </div>
                    <h2 className="mt-4 text-3xl font-semibold leading-tight sm:text-4xl">
                      Theo dõi cấu hình mô hình và thử trực tiếp chất lượng bộ câu hỏi mà hệ thống tạo ra
                    </h2>
                    <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-200 sm:text-base">
                      Trang này kế thừa toàn bộ luồng tạo câu hỏi của sinh viên, đồng thời bổ sung
                      khả năng xem trước mô hình văn bản, mô hình thị giác và các ngưỡng xử lý dữ liệu
                      mà FastAPI đang dùng để tạo đề.
                    </p>

                    <div className="mt-7 grid gap-3 sm:grid-cols-3">
                      <div className="rounded-3xl border border-white/10 bg-white/8 px-4 py-4">
                        <p className="text-xs uppercase tracking-[0.18em] text-cyan-100">
                          Nguồn dữ liệu
                        </p>
                        <p className="mt-2 text-lg font-semibold">3 lựa chọn</p>
                        <p className="mt-2 text-sm text-slate-300">
                          Văn bản, tệp tải lên hoặc URL tài liệu.
                        </p>
                      </div>
                      <div className="rounded-3xl border border-white/10 bg-white/8 px-4 py-4">
                        <p className="text-xs uppercase tracking-[0.18em] text-cyan-100">
                          Giới hạn số câu
                        </p>
                        <p className="mt-2 text-lg font-semibold">
                          {runtimeMetadata?.max_question_count ?? AI_GENERATOR_MAX_QUESTIONS} câu
                        </p>
                        <p className="mt-2 text-sm text-slate-300">
                          Đồng bộ với giới hạn ở FastAPI và `.env`.
                        </p>
                      </div>
                      <div className="rounded-3xl border border-white/10 bg-white/8 px-4 py-4">
                        <p className="text-xs uppercase tracking-[0.18em] text-cyan-100">
                          Mô hình văn bản
                        </p>
                        <p className="mt-2 text-lg font-semibold">
                          {runtimeMetadata ? truncateMiddle(runtimeMetadata.text_model, 28) : "Chưa tải"}
                        </p>
                        <p className="mt-2 text-sm text-slate-300">
                          FastAPI sẽ trả về mô hình thực tế sau mỗi lần tạo đề.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </article>

              <aside className="rounded-4xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="rounded-2xl bg-indigo-100 p-3 text-indigo-700">
                      <Settings2 className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold">Cấu hình AI hiện tại</h3>
                      <p className="mt-1 text-sm text-slate-500">
                        Dữ liệu này được lấy trực tiếp từ FastAPI.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleRefreshMetadata}
                    disabled={isRefreshingMetadata}
                    className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <RefreshCw
                      className={`mr-2 h-4 w-4 ${isRefreshingMetadata ? "animate-spin" : ""}`}
                    />
                    Làm mới
                  </button>
                </div>

                <div className="mt-6 space-y-4">
                  <div className="rounded-3xl bg-slate-50 px-4 py-4">
                    <p className="text-sm font-semibold text-slate-900">Nhà cung cấp và client</p>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      {runtimeMetadata
                        ? `${runtimeMetadata.provider_name} qua thư viện ${runtimeMetadata.client_library}.`
                        : "Chưa tải được thông tin client."}
                    </p>
                  </div>

                  <div className="rounded-3xl bg-slate-50 px-4 py-4">
                    <p className="text-sm font-semibold text-slate-900">Mô hình đang cấu hình</p>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      Văn bản: {runtimeMetadata?.text_model ?? "Chưa tải"}
                    </p>
                    <p className="mt-1 text-sm leading-6 text-slate-600">
                      Thị giác: {runtimeMetadata?.vision_model ?? "Chưa tải"}
                    </p>
                  </div>

                  <div className="rounded-3xl bg-slate-50 px-4 py-4">
                    <p className="text-sm font-semibold text-slate-900">Cập nhật lần gần nhất</p>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      {metadataUpdatedAt || "Chưa có dữ liệu thời gian."}
                    </p>
                  </div>
                </div>
              </aside>
            </section>

            {errorMessage ? (
              <div className="rounded-[28px] border border-rose-200 bg-rose-50 px-5 py-4 text-rose-700">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
                  <div>
                    <p className="font-semibold">Có lỗi cần kiểm tra</p>
                    <p className="mt-1 text-sm leading-6">{errorMessage}</p>
                  </div>
                </div>
              </div>
            ) : null}

            <section className="grid gap-6 lg:grid-cols-[1.08fr_0.92fr]">
              <article className="rounded-4xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
                <div className="flex items-center gap-3">
                  <div className="rounded-2xl bg-cyan-100 p-3 text-cyan-700">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-semibold">Tạo bộ câu hỏi để kiểm tra AI</h3>
                    <p className="mt-1 text-sm text-slate-500">
                      Chỉ gửi đúng một loại nguồn dữ liệu trong mỗi lần kiểm tra.
                    </p>
                  </div>
                </div>

                <div className="mt-6 grid gap-3 sm:grid-cols-3">
                  {(["text", "upload", "url"] as SourceMode[]).map((mode) => {
                    const isActive = sourceMode === mode;

                    return (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => handleChangeSourceMode(mode)}
                        className={`rounded-3xl border px-4 py-4 text-left transition ${
                          isActive
                            ? "border-slate-900 bg-slate-900 text-white"
                            : "border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 hover:bg-white"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`rounded-2xl p-3 ${
                              isActive
                                ? "bg-white/10 text-cyan-100"
                                : "bg-white text-slate-500 ring-1 ring-slate-200"
                            }`}
                          >
                            {mode === "text" ? (
                              <FileText className="h-5 w-5" />
                            ) : mode === "upload" ? (
                              <Upload className="h-5 w-5" />
                            ) : (
                              <Globe className="h-5 w-5" />
                            )}
                          </div>
                          <div>
                            <p className="font-semibold">{getSourceLabel(mode)}</p>
                            <p
                              className={`mt-1 text-sm ${
                                isActive ? "text-slate-200" : "text-slate-500"
                              }`}
                            >
                              {mode === "text"
                                ? "Nhập nội dung trực tiếp để kiểm tra nhanh."
                                : mode === "upload"
                                  ? "Tải tệp nguồn để quan sát pipeline OCR hoặc thị giác."
                                  : "Nhập URL tài liệu nội bộ hoặc bên ngoài hệ thống."}
                            </p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="mt-6">
                  {sourceMode === "text" ? (
                    <label className="block">
                      <span className="text-sm font-semibold text-slate-900">
                        Nội dung dùng để tạo câu hỏi
                      </span>
                      <textarea
                        value={plainText}
                        onChange={(event) => setPlainText(event.target.value)}
                        rows={12}
                        placeholder="Nhập nội dung văn bản thuần để quản trị viên kiểm tra chất lượng tạo câu hỏi..."
                        className="mt-3 w-full rounded-[28px] border border-slate-200 bg-slate-50 px-4 py-4 text-sm leading-7 text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-cyan-400 focus:bg-white focus:ring-4 focus:ring-cyan-100"
                      />
                    </label>
                  ) : null}

                  {sourceMode === "upload" ? (
                    <div className="rounded-[28px] border border-dashed border-slate-300 bg-slate-50 px-5 py-6">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">
                            Tải tài liệu để kiểm tra AI
                          </p>
                          <p className="mt-2 text-sm leading-6 text-slate-500">
                            Hỗ trợ: {AI_GENERATOR_UPLOAD_ACCEPT}
                          </p>
                          <p className="mt-1 text-sm leading-6 text-slate-500">
                            Nếu OCR không đủ dữ liệu, backend có thể chuyển sang mô hình thị giác.
                          </p>
                        </div>
                        <label className="inline-flex cursor-pointer items-center justify-center rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-700">
                          <Upload className="mr-2 h-4 w-4" />
                          Chọn tệp
                          <input
                            type="file"
                            accept={AI_GENERATOR_UPLOAD_ACCEPT}
                            onChange={handleChooseFile}
                            className="hidden"
                          />
                        </label>
                      </div>

                      <div className="mt-4 rounded-2xl bg-white px-4 py-3 text-sm text-slate-600 ring-1 ring-slate-200">
                        {uploadedFile ? (
                          <>
                            Đã chọn tệp: <span className="font-semibold">{uploadedFile.name}</span>
                          </>
                        ) : (
                          "Chưa có tệp nào được chọn."
                        )}
                      </div>

                      {isUploadGenerationUnavailable ? (
                        <div className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
                          Máy chủ hiện chưa bật `python-multipart`, nên endpoint tải tệp lên chưa sẵn sàng.
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  {sourceMode === "url" ? (
                    <label className="block">
                      <span className="text-sm font-semibold text-slate-900">
                        URL tài liệu để kiểm tra AI
                      </span>
                      <input
                        type="url"
                        value={documentUrl}
                        onChange={(event) => setDocumentUrl(event.target.value)}
                        placeholder="https://example.com/tai-lieu.pdf hoặc /uploads/tai-lieu.pdf"
                        className="mt-3 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-cyan-400 focus:bg-white focus:ring-4 focus:ring-cyan-100"
                      />
                      <p className="mt-3 text-sm leading-6 text-slate-500">
                        URL nội bộ `/uploads/...` sẽ được gửi trực tiếp tới FastAPI. URL ngoài hệ thống sẽ được frontend tải về thành tệp rồi gửi lại qua endpoint upload.
                      </p>
                    </label>
                  ) : null}
                </div>

                <div className="mt-6 flex flex-col gap-3 rounded-[28px] bg-slate-50 px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      Nút tạo riêng theo loại nguồn dữ liệu
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      Nguồn đang chọn: {getSourceLabel(sourceMode)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleGenerateQuestions}
                    disabled={isGenerating || isUploadGenerationUnavailable}
                    className="inline-flex items-center justify-center rounded-2xl bg-cyan-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-cyan-500 disabled:cursor-not-allowed disabled:bg-cyan-300"
                  >
                    {isGenerating ? (
                      <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="mr-2 h-4 w-4" />
                    )}
                    {getGenerateButtonLabel(sourceMode)}
                  </button>
                </div>
              </article>

              <aside className="space-y-6">
                <article className="rounded-4xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
                  <div className="flex items-center gap-3">
                    <div className="rounded-2xl bg-emerald-100 p-3 text-emerald-700">
                      <BookOpen className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold">Thiết lập kiểm tra</h3>
                      <p className="mt-1 text-sm text-slate-500">
                        Các thông số này được gửi tới FastAPI khi tạo đề.
                      </p>
                    </div>
                  </div>

                  <div className="mt-6 space-y-5">
                    <label className="block">
                      <span className="text-sm font-semibold text-slate-900">
                        Số lượng câu hỏi
                      </span>
                      <input
                        inputMode="numeric"
                        value={questionCountInput}
                        onChange={(event) => handleQuestionCountChange(event.target.value)}
                        onBlur={handleQuestionCountBlur}
                        className="mt-3 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-800 outline-none transition focus:border-cyan-400 focus:bg-white focus:ring-4 focus:ring-cyan-100"
                      />
                      <p className="mt-2 text-sm text-slate-500">
                        Không vượt quá {runtimeMetadata?.max_question_count ?? AI_GENERATOR_MAX_QUESTIONS} câu trong một lần kiểm tra.
                      </p>
                    </label>

                    <CognitiveSettings
                      value={cognitiveSettings}
                      onChange={setCognitiveSettings}
                      categories={categories}
                    />

                    <div>
                      <p className="text-sm font-semibold text-slate-900">Loại câu hỏi</p>
                      <div className="mt-3 grid gap-3">
                        {questionTypeOptions.map((option) => {
                          const isActive = questionType === option.value;
                          return (
                            <button
                              key={option.value}
                              type="button"
                              onClick={() => setQuestionType(option.value)}
                              className={`rounded-3xl border px-4 py-4 text-left transition ${
                                isActive
                                  ? "border-cyan-400 bg-cyan-50"
                                  : "border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-white"
                              }`}
                            >
                              <p className="font-semibold text-slate-900">{option.label}</p>
                              <p className="mt-2 text-sm leading-6 text-slate-500">
                                {option.description}
                              </p>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </article>

                <article className="rounded-4xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
                  <div className="flex items-center gap-3">
                    <div className="rounded-2xl bg-slate-100 p-3 text-slate-700">
                      <Settings2 className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold">Thông số runtime để kiểm tra</h3>
                      <p className="mt-1 text-sm text-slate-500">
                        Giúp quản trị viên biết AI đang xử lý tài liệu theo cách nào.
                      </p>
                    </div>
                  </div>

                  <div className="mt-6 grid gap-4">
                    <div className="rounded-3xl bg-slate-50 px-4 py-4">
                      <p className="text-sm font-semibold text-slate-900">Thông số đầu ra</p>
                      <div className="mt-3 space-y-2 text-sm text-slate-600">
                        <p>Giới hạn số câu: {runtimeMetadata?.max_question_count ?? AI_GENERATOR_MAX_QUESTIONS}</p>
                        <p>
                          Điểm mặc định mỗi câu: {runtimeMetadata?.score_per_question_default ?? 1}
                        </p>
                        <p>
                          Điểm tối đa mỗi câu: {runtimeMetadata?.score_per_question_max ?? 100}
                        </p>
                        <p>
                          Thứ tự bắt đầu mặc định: {runtimeMetadata?.start_sequence_default ?? 1}
                        </p>
                        <p>
                          Persist mặc định: {formatBooleanLabel(runtimeMetadata?.persist_default ?? false)}
                        </p>
                      </div>
                    </div>

                    <div className="rounded-3xl bg-slate-50 px-4 py-4">
                      <p className="text-sm font-semibold text-slate-900">Ngưỡng xử lý nguồn dữ liệu</p>
                      <div className="mt-3 space-y-2 text-sm text-slate-600">
                        <p>
                          Giới hạn rút gọn văn bản nguồn: {runtimeMetadata?.max_source_text_chars ?? 12000} ký tự
                        </p>
                        <p>
                          PDF cần tối thiểu {runtimeMetadata?.min_pdf_ocr_chars ?? 50} ký tự OCR để đi theo nhánh văn bản
                        </p>
                        <p>
                          Ảnh cần tối thiểu {runtimeMetadata?.min_image_ocr_chars ?? 50} ký tự OCR để đi theo nhánh văn bản
                        </p>
                        <p>
                          Video cần tối thiểu {runtimeMetadata?.min_video_ocr_chars ?? 50} ký tự OCR để đi theo nhánh văn bản
                        </p>
                      </div>
                    </div>

                    <div className="rounded-3xl bg-slate-50 px-4 py-4">
                      <p className="text-sm font-semibold text-slate-900">Lấy mẫu và phân tích thị giác</p>
                      <div className="mt-3 space-y-2 text-sm text-slate-600">
                        <p>
                          Số trang PDF tối đa khi phân tích thị giác: {runtimeMetadata?.pdf_visual_max_pages ?? 3}
                        </p>
                        <p>
                          Số khung hình video mẫu: {runtimeMetadata?.video_sample_frame_count ?? 3}
                        </p>
                        <p>
                          Tải tệp lên khả dụng: {formatBooleanLabel(runtimeMetadata?.upload_generation_available ?? false)}
                        </p>
                        <p>
                          Các nguồn hỗ trợ: {runtimeMetadata?.source_modes_supported.join(", ") ?? "text, upload, url"}
                        </p>
                      </div>
                    </div>

                    <div className="rounded-3xl bg-slate-50 px-4 py-4">
                      <p className="text-sm font-semibold text-slate-900">Định dạng hệ thống chấp nhận</p>
                      <div className="mt-3 space-y-2 text-sm text-slate-600">
                        <p>Văn bản: {formatSuffixList(runtimeMetadata?.supported_text_suffixes ?? [])}</p>
                        <p>Hình ảnh: {formatSuffixList(runtimeMetadata?.supported_image_suffixes ?? [])}</p>
                        <p>Video: {formatSuffixList(runtimeMetadata?.supported_video_suffixes ?? [])}</p>
                      </div>
                    </div>
                  </div>
                </article>
              </aside>
            </section>

            {generationResponse ? (
              <section className="space-y-6">
                <article className="rounded-4xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-sm font-medium text-indigo-700">
                        <CheckCircle2 className="h-4 w-4" />
                        <span>Đã nhận phản hồi từ FastAPI</span>
                      </div>
                      <h3 className="mt-4 text-2xl font-semibold">
                        Bảng tóm tắt phiên kiểm tra AI gần nhất
                      </h3>
                      <p className="mt-2 text-sm leading-6 text-slate-500">
                        Dùng các thẻ dưới đây để kiểm tra mô hình, nguồn xử lý thực tế và các cảnh báo khi tạo đề.
                      </p>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                      <div className="rounded-3xl bg-slate-50 px-4 py-4">
                        <p className="text-sm text-slate-500">Mô hình đã dùng</p>
                        <p className="mt-2 text-base font-semibold text-slate-900">
                          {truncateMiddle(generationResponse.model_used, 30)}
                        </p>
                      </div>
                      <div className="rounded-3xl bg-slate-50 px-4 py-4">
                        <p className="text-sm text-slate-500">Nguồn xử lý thực tế</p>
                        <p className="mt-2 text-base font-semibold text-slate-900">
                          {getSourceTypeLabel(generationResponse.source_type)}
                        </p>
                      </div>
                      <div className="rounded-3xl bg-slate-50 px-4 py-4">
                        <p className="text-sm text-slate-500">Câu hỏi trả về</p>
                        <p className="mt-2 text-base font-semibold text-slate-900">
                          {generatedQuestions.length}/{requestedQuestionCount}
                        </p>
                      </div>
                      <div className="rounded-3xl bg-slate-50 px-4 py-4">
                        <p className="text-sm text-slate-500">Số cảnh báo</p>
                        <p className="mt-2 text-base font-semibold text-slate-900">
                          {generationResponse.warnings.length}
                        </p>
                      </div>
                      <div className="rounded-3xl bg-slate-50 px-4 py-4">
                        <p className="text-sm text-slate-500">Chủ đề</p>
                        <p className="mt-2 text-base font-semibold text-slate-900">
                          {generationResponse.topic || "—"}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 grid gap-4 xl:grid-cols-[1fr_0.8fr]">
                    <div className="rounded-[28px] border border-slate-200 bg-slate-50 px-5 py-5">
                      <p className="text-sm font-semibold text-slate-900">Tóm tắt nội dung nguồn</p>
                      <p className="mt-3 text-sm leading-7 text-slate-600">
                        {generationResponse.content_preview.trim()
                          ? generationResponse.content_preview
                          : "Không có phần tóm tắt nội dung nguồn để hiển thị."}
                      </p>
                    </div>

                    <div className="rounded-[28px] border border-slate-200 bg-slate-50 px-5 py-5">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-slate-900">Cảnh báo từ pipeline</p>
                        {generationResponse.warnings.length > 0 ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
                            <AlertTriangle className="h-3.5 w-3.5" />
                            {generationResponse.warnings.length} cảnh báo
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Không có cảnh báo
                          </span>
                        )}
                      </div>
                      {generationResponse.warnings.length > 0 ? (
                        <div className="mt-3 space-y-2">
                          {generationResponse.warnings.map((warning, index) => (
                            <div
                              key={`${warning}-${index}`}
                              className="flex items-start gap-3 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800"
                            >
                              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                              <span>{warning}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-3 text-sm leading-7 text-slate-600">
                          Phiên kiểm tra này không có cảnh báo bổ sung.
                        </p>
                      )}
                    </div>
                  </div>
                </article>

                <article className="rounded-4xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                    <div>
                      <h3 className="text-2xl font-semibold">Hành động với bộ câu hỏi đã tạo</h3>
                      <p className="mt-2 text-sm leading-6 text-slate-500">
                        Quản trị viên có thể tải bộ câu hỏi xuống hoặc bật phần kiểm tra thử để đánh giá đầu ra.
                      </p>
                    </div>

                    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                      <button
                        type="button"
                        onClick={() => downloadAdminQuestionsAsTxt(generationResponse)}
                        className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                      >
                        <Download className="mr-2 h-4 w-4" />
                        Tải xuống .txt
                      </button>
                      <button
                        type="button"
                        onClick={() => downloadAdminQuestionsAsJson(generationResponse)}
                        className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                      >
                        <Download className="mr-2 h-4 w-4" />
                        Tải xuống .json
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowCorrectAnswers((currentValue) => !currentValue)}
                        className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
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
                  </div>
                </article>

                <article className="rounded-4xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h3 className="text-2xl font-semibold">Danh sách câu hỏi đã tạo</h3>
                      <p className="mt-2 text-sm leading-6 text-slate-500">
                        {getDifficultyLabel("", generationResponse)} •{" "}
                        {getQuestionTypeLabel(generationResponse.question_type)} •{" "}
                        {getSourceTypeLabel(generationResponse.source_type)} •{" "}
                        {generationResponse.topic ? `📌 ${generationResponse.topic}` : ""}
                      </p>
                    </div>
                    <div className="rounded-full bg-slate-100 px-4 py-2 text-sm text-slate-600">
                      Trang {currentPage}/{totalPages} • hiển thị {AI_GENERATOR_PAGE_SIZE} câu mỗi lần
                    </div>
                  </div>

                  {generatedQuestions.length !== requestedQuestionCount ? (
                    <div className="mt-5 rounded-2xl bg-amber-50 px-4 py-3 text-sm font-medium text-amber-700">
                      Hệ thống hiện trả về {generatedQuestions.length}/{requestedQuestionCount} câu.
                    </div>
                  ) : null}

                  <div className="mt-6 space-y-4">
                    {paginatedQuestions.map((question) => {
                      const correctOption = getCorrectOption(question);

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
                              {question.difficulty ? (
                                <span
                                  className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium"
                                  style={{
                                    backgroundColor: `${getDifficultyColor(question.difficulty)}18`,
                                    color: getDifficultyColor(question.difficulty),
                                    border: `1px solid ${getDifficultyColor(question.difficulty)}40`,
                                  }}
                                >
                                  <span
                                    className="inline-block h-2 w-2 rounded-full"
                                    style={{ backgroundColor: getDifficultyColor(question.difficulty) }}
                                  />
                                  {{ easy: "Dễ", medium: "Trung bình", hard: "Khó" }[question.difficulty] ?? question.difficulty}
                                </span>
                              ) : null}
                            </div>
                          </div>

                          <div className="mt-5 grid gap-3">
                            {question.options.map((option, optionIndex) => {
                              const isCorrectAnswer =
                                correctOption !== null &&
                                option.content.trim().toLowerCase() ===
                                  correctOption.content.trim().toLowerCase();

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
                          Dùng phần này để đánh giá nhanh chất lượng bộ câu hỏi trên giao diện thực tế.
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
                        const selectedAnswer = practiceAnswers[question.sequence] ?? "";
                        const correctOption = getCorrectOption(question);
                        const isQuestionCorrect = practiceSubmitted
                          ? isSelectedAnswerCorrect(question, selectedAnswer)
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

                            <div className="mt-5 grid gap-3">
                              {question.options.map((option, optionIndex) => {
                                const isSelected = selectedAnswer === option.content;
                                const isCorrectOption =
                                  correctOption !== null &&
                                  option.content.trim().toLowerCase() ===
                                    correctOption.content.trim().toLowerCase();

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
                                      handleSelectPracticeAnswer(
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

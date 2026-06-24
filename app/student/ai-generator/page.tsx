"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
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
  Sparkles,
  Upload,
} from "lucide-react";
import { UserAccountMenu } from "../../components/user-account-menu";
import { NotificationBell } from "../../components/notification-bell";
import { ShowNavigation } from "../../lib/app_nav";
import type { User } from "../../lib/api_user";
import {
  AI_GENERATOR_MAX_QUESTIONS,
  AI_GENERATOR_PAGE_SIZE,
  AI_GENERATOR_UPLOAD_ACCEPT,
  clampQuestionCount,
  downloadQuestionsAsJson,
  downloadQuestionsAsTxt,
  generateQuestionsFromText,
  generateQuestionsFromUpload,
  generateQuestionsFromUrl,
  getCorrectAnswerLabel,
  getCorrectOption,
  isSelectedAnswerCorrect,
  type AiGeneratorQuestionType,
  type QuestionGenerationResponse,
  getCognitiveDistributionLabel,
} from "../../lib/api_ai_generator";
import CognitiveSettings from "../../ai-generator/_cognitive-settings";
import type {
  CognitiveSettingsState,
  CategoryOption,
} from "../../ai-generator/_cognitive-settings";
import { getCategoryList } from "../../lib/api_category";
import {
  STUDENT_DEFAULT_USER,
  useStudentSession,
} from "../_lib/use-student-session";

const initialUser: User = STUDENT_DEFAULT_USER;

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
    description: "Phù hợp cho kiểm tra nhanh các nhận định chính.",
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

function getDifficultyLabel(value: string, response?: QuestionGenerationResponse | null): string {
  if (response) {
    return getCognitiveDistributionLabel(
      response.difficulty_remember,
      response.difficulty_understand,
      response.difficulty_apply,
    );
  }
  return "NB 34% · TH 33% · VD 33%";
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
      return "Video qua OCR";
    case "video_visual":
      return "Video qua phân tích hình ảnh";
    default:
      return value;
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

export default function StudentAiGeneratorPage() {
  const router = useRouter();
  const practiceSectionRef = useRef<HTMLDivElement>(null);

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isLoadingUser, setIsLoadingUser] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
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
  const [practiceAnswers, setPracticeAnswers] = useState<Record<number, string>>({});
  const [practiceSubmitted, setPracticeSubmitted] = useState(false);
  const { currentUser, isCheckingAuth } = useStudentSession();

  useEffect(() => {
    if (!isCheckingAuth) {
      let isMounted = true;
      getCategoryList()
        .then((list) => {
          if (isMounted) setCategories(list);
        })
        .catch(() => {});
      setIsLoadingUser(false);
      return () => { isMounted = false; };
    }
  }, [isCheckingAuth]);

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

  const user = currentUser ?? initialUser;

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

    try {
      setIsGenerating(true);

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
      };

      if (sourceMode === "text") {
        response = await generateQuestionsFromText({
          ...baseGenInput,
          content: plainText,
        });
      } else if (sourceMode === "upload") {
        if (!uploadedFile) {
          throw new Error("Vui lòng chọn một tệp tài liệu trước khi tạo câu hỏi.");
        }

        response = await generateQuestionsFromUpload({
          ...baseGenInput,
          file: uploadedFile,
        });
      } else {
        response = await generateQuestionsFromUrl({
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
          : "Không thể tạo bộ câu hỏi trắc nghiệm.",
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
    <main className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#ecfeff_48%,#eef2ff_100%)] text-slate-900">
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
            <h1 className="text-lg font-semibold">Trợ lý AI hỗ trợ ôn tập</h1>
            <p className="text-sm text-slate-500">
              Tự ôn tập các kiến thức đã học với sự trợ giúp của AI
            </p>
          </div>
        </div>

        <div className="hidden items-center gap-2 md:flex">
          <NotificationBell userId={user.id} />
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

      <section className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-4 pb-14 pt-24 sm:px-6 lg:px-8">
        {isLoadingUser ? (
          <div className="flex min-h-[55vh] items-center justify-center rounded-4xl bg-white shadow-sm ring-1 ring-slate-200">
            <div className="flex items-center gap-3 text-slate-600">
              <LoaderCircle className="h-5 w-5 animate-spin" />
              <span>Đang tải dữ liệu học sinh...</span>
            </div>
          </div>
        ) : (
          <>
            <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
              <article className="overflow-hidden rounded-4xl bg-slate-950 text-white shadow-2xl shadow-cyan-950/15">
                <div className="relative px-6 py-7 sm:px-8">
                  <div className="absolute inset-y-0 right-0 hidden w-1/2 bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.36),transparent_55%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.28),transparent_45%)] lg:block" />
                  <div className="relative max-w-3xl">
                    <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-sm text-cyan-100">
                      <Sparkles className="h-4 w-4" />
                      <span>Trợ lý AI hỗ trợ ôn tập</span>
                    </div>
                    <h2 className="mt-4 text-3xl font-semibold leading-tight sm:text-4xl">
                      Biến tài liệu học tập thành bộ câu hỏi trắc nghiệm chỉ trong vài giây
                    </h2>
                    <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-200 sm:text-base">
                      Bạn có thể tự ôn tập khả năng tiếp thu kiến thức của mình bằng các đưa tài liệu 
                      học tập liên qua cho trợ lý AI để nó tạo ra bộ câu hỏi để bạn tự ôn tập
                    </p>

                    <div className="mt-7 grid gap-3 sm:grid-cols-3">
                      <div className="rounded-3xl border border-white/10 bg-white/8 px-4 py-4">
                        <p className="text-xs uppercase tracking-[0.18em] text-cyan-100">
                          Nguồn dữ liệu
                        </p>
                        <p className="mt-2 text-lg font-semibold">3 lựa chọn</p>
                        <p className="mt-2 text-sm text-slate-300">
                          Văn bản, tệp tải lên hoặc URL tài liệu
                        </p>
                      </div>
                      <div className="rounded-3xl border border-white/10 bg-white/8 px-4 py-4">
                        <p className="text-xs uppercase tracking-[0.18em] text-cyan-100">
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
                        <p className="text-xs uppercase tracking-[0.18em] text-cyan-100">
                          Kiểm tra thử
                        </p>
                        <p className="mt-2 text-lg font-semibold">
                          sau khi tạo câu hỏi
                        </p>
                        <p className="mt-2 text-sm text-slate-300">
                          Có thể kiểm tra thử với bộ câu hỏi đã tạo
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
                      1. Chọn đúng một nguồn nội dung
                    </p>
                  </div>
                  <div className="rounded-3xl bg-slate-50 px-6 py-6">
                    <p className="text-sm font-semibold text-slate-900">
                      2. Tối đa {AI_GENERATOR_MAX_QUESTIONS} câu trong một lần tạo
                    </p>
                  </div>
                  <div className="rounded-3xl bg-slate-50 px-6 py-6">
                    <p className="text-sm font-semibold text-slate-900">
                      3. Có thể tải xuống hoặc kiểm tra thử ngay
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

            <section className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
              <article className="rounded-4xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <h3 className="text-2xl font-semibold">Nguồn dữ liệu đầu vào</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-500">
                      Chọn một cách cung cấp dữ liệu phù hợp nhất với tài liệu bạn đang có.
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
                        ? "border-cyan-400 bg-cyan-50 shadow-sm"
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
                        ? "border-cyan-400 bg-cyan-50 shadow-sm"
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
                        ? "border-cyan-400 bg-cyan-50 shadow-sm"
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
                          Hữu ích khi đã có liên kết.
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
                        placeholder="Nhập hoặc dán nội dung bài học, ghi chú, tóm tắt chương hoặc tài liệu ôn tập tại đây..."
                        className="mt-3 w-full rounded-3xl border border-slate-200 bg-white px-4 py-4 text-sm leading-7 text-slate-800 outline-none transition focus:border-cyan-400"
                      />
                      <p className="mt-3 text-sm text-slate-500">
                        Mẹo: nên dán phần nội dung đã được làm sạch để trợ lý AI tạo câu hỏi chính xác hơn.
                      </p>
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
                        placeholder="Ví dụ: http://127.0.0.1:8000/uploads/tai-lieu.pdf"
                        className="mt-3 w-full rounded-3xl border border-slate-200 bg-white px-4 py-4 text-sm text-slate-800 outline-none transition focus:border-cyan-400"
                      />
                      <p className="mt-3 text-sm leading-6 text-slate-500">
                        Nếu URL là tài liệu cho phép tải trực tiếp, trang web sẽ 
                        tự lấy nội dung để tạo đề.
                      </p>
                    </div>
                  ) : null}

                  <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="rounded-2xl bg-white px-4 py-3 text-sm text-slate-600 ring-1 ring-slate-200">
                      Mỗi lần tạo bộ câu hỏi chỉ dùng một nguồn dữ liệu duy nhất.
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
                        className="mt-3 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-4 text-lg font-semibold text-slate-900 outline-none transition focus:border-cyan-400"
                      />
                      <p className="mt-2 text-sm text-slate-500">
                        Tối đa {AI_GENERATOR_MAX_QUESTIONS} câu trong một lần tạo.
                      </p>
                    </div>

                    <CognitiveSettings
                      value={cognitiveSettings}
                      onChange={setCognitiveSettings}
                      categories={categories}
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
                                ? "border-cyan-400 bg-cyan-50"
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

                <article className="rounded-4xl bg-slate-900 p-6 text-white shadow-sm">
                  <p className="text-sm uppercase tracking-[0.2em] text-cyan-200">
                    Tóm tắt lần tạo tiếp theo
                  </p>
                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-3xl bg-white/8 px-4 py-4">
                      <p className="text-sm text-cyan-100">Nguồn dữ liệu</p>
                      <p className="mt-2 text-lg font-semibold">
                        {getSourceLabel(sourceMode)}
                      </p>
                    </div>
                    <div className="rounded-3xl bg-white/8 px-4 py-4">
                      <p className="text-sm text-cyan-100">Số câu hỏi</p>
                      <p className="mt-2 text-lg font-semibold">
                        {clampQuestionCount(Number(questionCountInput || "1"))}
                      </p>
                    </div>
                    <div className="rounded-3xl bg-white/8 px-4 py-4">
                      <p className="text-sm text-cyan-100">Mức độ</p>
                      <p className="mt-2 text-lg font-semibold">
                        {getDifficultyLabel("", generationResponse)}
                      </p>
                    </div>
                    <div className="rounded-3xl bg-white/8 px-4 py-4">
                      <p className="text-sm text-cyan-100">Loại câu hỏi</p>
                      <p className="mt-2 text-lg font-semibold">
                        {getQuestionTypeLabel(questionType)}
                      </p>
                    </div>
                  </div>
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
                        Bộ câu hỏi trắc nghiệm AI của bạn đã sẵn sàng
                      </h3>
                      <p className="mt-3 text-sm leading-7 text-slate-500">
                        Danh sách bên dưới là bộ câu hỏi mà trợ lý AI đã tạo. Trang
                        chỉ hiển thị tối đa {AI_GENERATOR_PAGE_SIZE} câu mỗi lần để bạn xem
                        thuận tiện hơn.
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
                    </div>
                  </div>

                  <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
                    <div className="rounded-3xl bg-slate-50 px-4 py-4">
                      <p className="text-sm font-semibold text-slate-900">
                        Tóm tắt nội dung nguồn
                      </p>
                      <p className="mt-2 text-sm leading-7 text-slate-600">
                        {generationResponse.content_preview || "Chưa có phần xem trước nội dung."}
                      </p>
                    </div>

                    <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
                      <button
                        type="button"
                        onClick={() => downloadQuestionsAsTxt(generationResponse)}
                        className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                      >
                        <Download className="mr-2 h-4 w-4" />
                        Tải xuống .txt
                      </button>
                      <button
                        type="button"
                        onClick={() => downloadQuestionsAsJson(generationResponse)}
                        className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                      >
                        <Download className="mr-2 h-4 w-4" />
                        Tải xuống .json
                      </button>
                    </div>
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
                        {getDifficultyLabel("", generationResponse)} •{" "}
                        {getQuestionTypeLabel(generationResponse.question_type)} •{" "}
                        {generationResponse.topic ? `📌 ${generationResponse.topic}` : ""}
                      </p>
                    </div>
                    {generatedQuestions.length !== requestedQuestionCount ? (
                      <div className="rounded-full bg-amber-50 px-4 py-2 text-sm font-medium text-amber-700">
                        Hệ thống hiện trả về {generatedQuestions.length}/{requestedQuestionCount} câu
                      </div>
                    ) : null}
                  </div>

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
                            <div className="rounded-2xl bg-white px-3 py-2 text-sm text-slate-500 ring-1 ring-slate-200">
                              {getQuestionTypeLabel(question.question_type)}
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

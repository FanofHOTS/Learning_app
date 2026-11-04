"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";
import {
  BookMarked,
  Check,
  ChevronLeft,
  ChevronRight,
  LoaderCircle,
  Menu,
  PencilLine,
  Plus,
  Search,
  Star,
  Tag,
  Trash2,
  Upload,
  X,
} from "lucide-react";

import { UserAccountMenu } from "../../components/user-account-menu";
import { NotificationBell } from "../../components/notification-bell";
import { ShowNavigation } from "../../lib/app_nav";
import type { User } from "../../lib/api_user";
import { useInstructorSession } from "../_lib/use-instructor-session";
import { getCategoryList, type Category } from "../../lib/api_category";
import {
  getInstructorExamList,
  type InstructorExam,
} from "../../lib/api_exam_instructor";
import {
  formatBlankAnswers,
  getLevelColor,
  getLevelLabel,
  getQuestionTypeLabel,
  isFillInBlankType,
  isMultipleAnswerType,
} from "../../lib/api_exam";
import {
  createQuestionBankQuestion,
  defaultQuestionBankDraft,
  deleteQuestionBankQuestion,
  getQuestionBankPage,
  getQuestionBankTags,
  importQuestionsFromBank,
  MAX_QUESTION_BANK_TAGS,
  normalizeQuestionBankTags,
  rateQuestionBankQuestion,
  removeQuestionBankRating,
  updateQuestionBankQuestion,
  validateQuestionBankDraft,
  type QuestionBankDraft,
  type QuestionBankFilters,
  type QuestionBankItem,
  type QuestionBankQuestionType,
  type QuestionBankSort,
  type QuestionBankTagSummary,
} from "../../lib/api_question_bank";

const initialUser: User = {
  id: 7,
  username: "Giảng viên",
  email: "giang_vien@example.com",
  icon: "/icon.png",
  role: "instructor",
};

const PAGE_SIZE = 12;

const defaultFilters: QuestionBankFilters = {
  keyword: "",
  categoryId: "all",
  questionType: "all",
  bloomLevel: "all",
  tag: "",
  onlyMine: false,
};

const questionTypeOptions: Array<{
  value: QuestionBankQuestionType;
  label: string;
}> = [
  { value: "multiple_choice", label: "Một đáp án" },
  { value: "multiple_answer", label: "Nhiều đáp án" },
  { value: "fill_in_blank", label: "Điền chỗ trống" },
  { value: "true_false", label: "Đúng / Sai" },
];

const bloomOptions = [
  { value: "remember", label: "Nhớ" },
  { value: "understand", label: "Hiểu" },
  { value: "apply", label: "Vận dụng" },
  { value: "analyze", label: "Phân tích" },
  { value: "evaluate", label: "Đánh giá" },
  { value: "create", label: "Sáng tạo" },
];

const sortOptions: Array<{ value: QuestionBankSort; label: string }> = [
  { value: "newest", label: "Mới nhất" },
  { value: "oldest", label: "Cũ nhất" },
  { value: "rating", label: "Đánh giá cao nhất" },
  { value: "popular", label: "Được dùng nhiều" },
  { value: "content_az", label: "Nội dung A → Z" },
];

type EditorState = {
  mode: "create" | "edit";
  bankId: number | null;
  draft: QuestionBankDraft;
};

function draftFromItem(item: QuestionBankItem): QuestionBankDraft {
  return {
    content: item.content,
    question_type: item.question_type as QuestionBankQuestionType,
    answer: item.answer,
    bloom_level: item.bloom_level,
    score: item.score,
    category_id: item.category_id,
    is_active: item.is_active,
    tags: [...item.tags],
    options: item.options.map((option) => ({
      content: option.content,
      is_correct: option.is_correct,
    })),
  };
}

function buildOptionsForType(
  questionType: QuestionBankQuestionType,
  previous: QuestionBankDraft["options"],
): QuestionBankDraft["options"] {
  if (questionType === "fill_in_blank") {
    return [];
  }

  if (questionType === "true_false") {
    return [
      { content: "Đúng", is_correct: true },
      { content: "Sai", is_correct: false },
    ];
  }

  const usable = previous.filter((option) => option.content.trim() !== "");
  if (usable.length >= 2) {
    return usable.map((option, index) => ({
      content: option.content,
      is_correct:
        questionType === "multiple_choice" ? index === 0 : option.is_correct,
    }));
  }

  return [
    { content: "", is_correct: true },
    { content: "", is_correct: false },
    { content: "", is_correct: false },
  ];
}

export default function InstructorQuestionBankPage() {
  const router = useRouter();
  const { currentUser, isCheckingAuth } = useInstructorSession();

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [ratingBusyId, setRatingBusyId] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [editorError, setEditorError] = useState("");
  const [items, setItems] = useState<QuestionBankItem[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<QuestionBankSort>("newest");
  const [tags, setTags] = useState<QuestionBankTagSummary[]>([]);
  const [myQuestionCount, setMyQuestionCount] = useState(0);
  const [categories, setCategories] = useState<Category[]>([]);
  const [exams, setExams] = useState<InstructorExam[]>([]);
  const [filters, setFilters] = useState<QuestionBankFilters>(defaultFilters);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [targetExamId, setTargetExamId] = useState("");
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [tagInput, setTagInput] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!currentUser) {
      return;
    }

    let isMounted = true;

    async function loadPageMeta() {
      try {
        const [categoryItems, examItems, tagItems, minePage] = await Promise.all([
          getCategoryList(),
          getInstructorExamList(currentUser?.id ?? 0),
          getQuestionBankTags(),
          getQuestionBankPage({
            onlyMineUserId: currentUser?.id ?? 0,
            includeInactive: true,
            viewerId: currentUser?.id ?? 0,
            pageSize: 1,
          }),
        ]);

        if (!isMounted) {
          return;
        }
        setCategories(categoryItems);
        setExams(examItems);
        setTags(tagItems);
        setMyQuestionCount(minePage.total);
      } catch {
        // Lỗi tải bộ lọc sẽ được hiển thị ở lần tải danh sách chính.
      }
    }

    void loadPageMeta();

    return () => {
      isMounted = false;
    };
  }, [currentUser, refreshKey]);

  useEffect(() => {
    if (!currentUser) {
      return;
    }

    let isMounted = true;
    const timer = setTimeout(async () => {
      try {
        setIsLoading(true);
        const result = await getQuestionBankPage({
          search: filters.keyword,
          categoryId: filters.categoryId === "all" ? undefined : filters.categoryId,
          questionType:
            filters.questionType === "all" ? undefined : filters.questionType,
          bloomLevel:
            filters.bloomLevel === "all" ? undefined : filters.bloomLevel,
          tag: filters.tag || undefined,
          onlyMineUserId: filters.onlyMine ? currentUser.id : undefined,
          includeInactive: true,
          viewerId: currentUser.id,
          sort,
          page,
          pageSize: PAGE_SIZE,
        });

        if (!isMounted) {
          return;
        }
        setItems(result.items);
        setTotal(result.total);
        setTotalPages(result.total_pages);
        setErrorMessage("");
      } catch (error) {
        if (!isMounted) {
          return;
        }
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Không thể tải ngân hàng câu hỏi chung.",
        );
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }, 250);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [currentUser, filters, sort, page, refreshKey]);

  const user = currentUser ?? initialUser;
  const pageNumbers = useMemo(() => {
    if (totalPages <= 1) {
      return [1];
    }
    const start = Math.max(1, Math.min(page - 2, totalPages - 4));
    const end = Math.min(totalPages, start + 4);
    return Array.from({ length: end - start + 1 }, (_, index) => start + index);
  }, [page, totalPages]);

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

  function refreshBank() {
    setRefreshKey((current) => current + 1);
  }

  function updateFilter<K extends keyof QuestionBankFilters>(
    key: K,
    value: QuestionBankFilters[K],
  ) {
    setFilters((current) => ({ ...current, [key]: value }));
    setSelectedIds([]);
    setPage(1);
  }

  function toggleSelected(bankId: number) {
    const target = items.find((item) => item.id === bankId);
    if (!target /*|| !target.is_active*/) {
      return;
    }

    setSelectedIds((current) =>
      current.includes(bankId)
        ? current.filter((id) => id !== bankId)
        : [...current, bankId],
    );
  }

  function openCreateEditor() {
    setEditor({
      mode: "create",
      bankId: null,
      draft: defaultQuestionBankDraft(),
    });
    setTagInput("");
    setEditorError("");
    setErrorMessage("");
  }

  function openEditEditor(item: QuestionBankItem) {
    const draft = draftFromItem(item);
    setEditor({
      mode: "edit",
      bankId: item.id,
      draft: {
        ...draft,
        options:
          draft.question_type === "fill_in_blank" || draft.options.length >= 2
            ? draft.options
            : buildOptionsForType(draft.question_type, draft.options),
      },
    });
    setTagInput("");
    setEditorError("");
    setErrorMessage("");
  }

  function closeEditor() {
    setEditor(null);
    setTagInput("");
    setEditorError("");
  }

  function updateDraft<K extends keyof QuestionBankDraft>(
    key: K,
    value: QuestionBankDraft[K],
  ) {
    setEditor((current) =>
      current ? { ...current, draft: { ...current.draft, [key]: value } } : current,
    );
  }

  function handleChangeType(nextType: QuestionBankQuestionType) {
    setEditor((current) => {
      if (!current) {
        return current;
      }
      return {
        ...current,
        draft: {
          ...current.draft,
          question_type: nextType,
          answer: nextType === "fill_in_blank" ? current.draft.answer : "",
          options: buildOptionsForType(nextType, current.draft.options),
        },
      };
    });
  }

  function updateOptionContent(index: number, value: string) {
    setEditor((current) => {
      if (!current) {
        return current;
      }
      return {
        ...current,
        draft: {
          ...current.draft,
          options: current.draft.options.map((option, optionIndex) =>
            optionIndex === index ? { ...option, content: value } : option,
          ),
        },
      };
    });
  }

  function toggleOptionCorrect(index: number) {
    setEditor((current) => {
      if (!current) {
        return current;
      }
      const isMulti = current.draft.question_type === "multiple_answer";
      return {
        ...current,
        draft: {
          ...current.draft,
          options: current.draft.options.map((option, optionIndex) => {
            if (optionIndex === index) {
              return { ...option, is_correct: !option.is_correct };
            }
            return isMulti ? option : { ...option, is_correct: false };
          }),
        },
      };
    });
  }

  function addOption() {
    setEditor((current) =>
      current
        ? {
            ...current,
            draft: {
              ...current.draft,
              options: [
                ...current.draft.options,
                { content: "", is_correct: false },
              ],
            },
          }
        : current,
    );
  }

  function removeOption(index: number) {
    setEditor((current) =>
      current
        ? {
            ...current,
            draft: {
              ...current.draft,
              options: current.draft.options.filter(
                (_, optionIndex) => optionIndex !== index,
              ),
            },
          }
        : current,
    );
  }

  function addTag() {
    if (!editor) {
      return;
    }

    const nextTags = normalizeQuestionBankTags([
      ...editor.draft.tags,
      tagInput,
    ]);
    if (nextTags.length === editor.draft.tags.length) {
      setTagInput("");
      return;
    }

    updateDraft("tags", nextTags);
    setTagInput("");
  }

  function removeTag(tag: string) {
    if (!editor) {
      return;
    }
    updateDraft(
      "tags",
      editor.draft.tags.filter((value) => value !== tag),
    );
  }

  async function handleSaveDraft() {
    if (!editor) {
      return;
    }

    const validationMessage = validateQuestionBankDraft(editor.draft);
    if (validationMessage) {
      setEditorError(validationMessage);
      return;
    }

    setIsSaving(true);
    setEditorError("");

    try {
      if (editor.mode === "create") {
        await createQuestionBankQuestion(editor.draft, user.id);
        toast.success("Đã đăng câu hỏi lên ngân hàng câu hỏi chung.");
        // Đưa về trang đầu, sắp xếp mới nhất để giảng viên thấy ngay câu vừa đăng.
        setSort("newest");
        setPage(1);
      } else if (editor.bankId != null) {
        await updateQuestionBankQuestion(editor.bankId, editor.draft, user.id);
        toast.success("Đã cập nhật câu hỏi trong ngân hàng câu hỏi chung.");
      }

      refreshBank();
      closeEditor();
    } catch (error) {
      setEditorError(
        error instanceof Error
          ? error.message
          : "Không thể lưu câu hỏi vào ngân hàng chung.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function confirmDelete(item: QuestionBankItem) {
    try {
      await deleteQuestionBankQuestion(item.id, user.id);
      toast.success("Đã gỡ câu hỏi khỏi ngân hàng câu hỏi chung.");
      refreshBank();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Không thể gỡ câu hỏi khỏi ngân hàng chung.",
      );
    }
  }

  function handleDelete(item: QuestionBankItem) {
    toast.info(
      ({ closeToast }) => (
        <div>
          <p className="font-medium text-slate-900">
            Gỡ câu hỏi này khỏi ngân hàng câu hỏi chung?
          </p>
          <p className="mt-1 text-sm text-slate-600">
            Các bài kiểm tra đã lấy câu hỏi trước đó vẫn giữ bản sao của họ.
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
                void confirmDelete(item);
              }}
            >
              Gỡ câu hỏi
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
  }

  async function handleRate(item: QuestionBankItem, rating: number) {
    if (ratingBusyId !== null) {
      return;
    }

    setRatingBusyId(item.id);

    try {
      const updated = await rateQuestionBankQuestion(item.id, user.id, rating);
      setItems((current) =>
        current.map((entry) => (entry.id === updated.id ? updated : entry)),
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Không thể gửi đánh giá.",
      );
    } finally {
      setRatingBusyId(null);
    }
  }

  async function handleRemoveRating(item: QuestionBankItem) {
    if (ratingBusyId !== null) {
      return;
    }

    setRatingBusyId(item.id);

    try {
      const updated = await removeQuestionBankRating(item.id, user.id);
      setItems((current) =>
        current.map((entry) => (entry.id === updated.id ? updated : entry)),
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Không thể bỏ đánh giá.",
      );
    } finally {
      setRatingBusyId(null);
    }
  }

  async function handleImportToExam() {
    if (selectedIds.length === 0) {
      setErrorMessage("Vui lòng chọn ít nhất một câu hỏi từ ngân hàng chung.");
      return;
    }

    const examId = Number(targetExamId);
    if (!Number.isInteger(examId) || examId <= 0) {
      setErrorMessage("Vui lòng chọn bài kiểm tra để thêm câu hỏi.");
      return;
    }

    setIsImporting(true);
    setErrorMessage("");

    try {
      const result = await importQuestionsFromBank({
        examId,
        questionIds: selectedIds,
        userId: user.id,
      });
      toast.success(
        `Đã thêm ${result.imported} câu hỏi từ ngân hàng chung vào bài kiểm tra.`,
      );
      if (result.skipped > 0) {
        toast.info(
          `Bỏ qua ${result.skipped} câu hỏi không còn hiển thị trong ngân hàng chung.`,
        );
      }
      setSelectedIds([]);
      refreshBank();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Không thể thêm câu hỏi vào bài kiểm tra.",
      );
    } finally {
      setIsImporting(false);
    }
  }

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
            onClick={() => router.push("/instructor")}
          />
          <div>
            <h1 className="text-lg font-semibold">Ngân hàng câu hỏi chung</h1>
            <p className="text-sm text-slate-500">
              Chia sẻ câu hỏi, gắn thẻ chủ đề và đánh giá chất lượng cùng đồng
              nghiệp
            </p>
          </div>
        </div>

        <div className="hidden items-center gap-2 md:flex">
          <NotificationBell userId={user.id} />
          <UserAccountMenu user={user} variant="dashboard" />
        </div>
      </header>

      <section className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-4 pb-10 pt-24 sm:px-6 lg:px-8">
        <section className="rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-600">
                Kho câu hỏi dùng chung
              </p>
              <h2 className="mt-2 text-3xl font-semibold text-slate-900">
                {total} câu hỏi trong ngân hàng
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
                Câu hỏi được sao chép sang bài kiểm tra của bạn khi thêm về. Gắn
                thẻ chủ đề để dễ tìm và đánh giá sao để đồng nghiệp chọn câu hỏi
                chất lượng.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-3xl bg-slate-50 p-4 text-center">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                  Câu của tôi
                </p>
                <p className="mt-2 text-2xl font-semibold text-slate-900">
                  {myQuestionCount}
                </p>
              </div>
              <div className="rounded-3xl bg-slate-50 p-4 text-center">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                  Thẻ chủ đề
                </p>
                <p className="mt-2 text-2xl font-semibold text-slate-900">
                  {tags.length}
                </p>
              </div>
              <button
                type="button"
                onClick={openCreateEditor}
                className="inline-flex items-center justify-center gap-2 rounded-3xl bg-sky-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-sky-700"
              >
                <Plus className="h-4 w-4" />
                Đăng câu hỏi mới
              </button>
            </div>
          </div>
        </section>

        {errorMessage ? (
          <div className="rounded-3xl border border-red-200 bg-red-50 px-5 py-4 text-red-700">
            {errorMessage}
          </div>
        ) : null}

        <section className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[220px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={filters.keyword}
                onChange={(event) => updateFilter("keyword", event.target.value)}
                placeholder="Tìm theo nội dung, đáp án, thẻ, tác giả..."
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm outline-none focus:border-sky-400 focus:bg-white"
              />
            </div>

            <select
              value={filters.categoryId}
              onChange={(event) => updateFilter("categoryId", event.target.value)}
              className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-sky-400 focus:bg-white"
            >
              <option value="all">Mọi phân loại</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>

            <select
              value={filters.questionType}
              onChange={(event) => updateFilter("questionType", event.target.value)}
              className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-sky-400 focus:bg-white"
            >
              <option value="all">Mọi loại câu hỏi</option>
              {questionTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <select
              value={filters.bloomLevel}
              onChange={(event) => updateFilter("bloomLevel", event.target.value)}
              className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-sky-400 focus:bg-white"
            >
              <option value="all">Mọi mức Bloom</option>
              {bloomOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <select
              value={sort}
              onChange={(event) => {
                setSort(event.target.value as QuestionBankSort);
                setPage(1);
                setSelectedIds([]);
              }}
              aria-label="Sắp xếp ngân hàng câu hỏi"
              className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-sky-400 focus:bg-white"
            >
              {sortOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  Sắp xếp: {option.label}
                </option>
              ))}
            </select>

            <label className="flex items-center gap-2 rounded-2xl border border-slate-200 px-3 py-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={filters.onlyMine}
                onChange={(event) => updateFilter("onlyMine", event.target.checked)}
                className="h-4 w-4 rounded border-slate-300"
              />
              Chỉ câu của tôi
            </label>
          </div>

          {tags.length > 0 ? (
            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
              <span className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">
                <Tag className="h-3.5 w-3.5" />
                Chủ đề
              </span>
              <button
                type="button"
                onClick={() => updateFilter("tag", "")}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                  filters.tag === ""
                    ? "bg-slate-900 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                Tất cả
              </button>
              {tags.map((tagItem) => (
                <button
                  key={tagItem.tag}
                  type="button"
                  onClick={() =>
                    updateFilter(
                      "tag",
                      filters.tag === tagItem.tag ? "" : tagItem.tag,
                    )
                  }
                  className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                    filters.tag === tagItem.tag
                      ? "bg-sky-600 text-white"
                      : "bg-sky-50 text-sky-700 hover:bg-sky-100"
                  }`}
                >
                  #{tagItem.tag}
                  <span className="ml-1 opacity-70">{tagItem.count}</span>
                </button>
              ))}
            </div>
          ) : null}
        </section>

        {selectedIds.length > 0 ? (
          <section className="flex flex-col gap-3 rounded-[28px] border border-sky-200 bg-sky-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-medium text-sky-900">
              Đã chọn {selectedIds.length} câu hỏi. Chọn bài kiểm tra để thêm vào.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={targetExamId}
                onChange={(event) => setTargetExamId(event.target.value)}
                className="min-w-[220px] rounded-2xl border border-sky-200 bg-white px-3 py-2 text-sm outline-none focus:border-sky-400"
              >
                <option value="">Chọn bài kiểm tra</option>
                {exams.map((exam) => (
                  <option key={exam.id} value={exam.id}>
                    {exam.title}
                    {exam.course_name ? ` — ${exam.course_name}` : ""}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleImportToExam}
                disabled={isImporting}
                className="inline-flex items-center gap-2 rounded-2xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isImporting ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                Thêm vào bài kiểm tra
              </button>
              <button
                type="button"
                onClick={() => setSelectedIds([])}
                className="rounded-2xl border border-sky-200 bg-white px-3 py-2 text-sm text-slate-600 transition hover:bg-slate-50"
              >
                Bỏ chọn
              </button>
            </div>
          </section>
        ) : null}

        {isLoading ? (
          <div className="flex min-h-[40vh] items-center justify-center rounded-[28px] bg-white shadow-sm">
            <div className="flex items-center gap-3 text-slate-600">
              <LoaderCircle className="h-5 w-5 animate-spin" />
              <span>Đang tải ngân hàng câu hỏi chung...</span>
            </div>
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-[28px] border border-dashed border-slate-300 bg-white px-6 py-14 text-center shadow-sm">
            <BookMarked className="mx-auto h-10 w-10 text-slate-300" />
            <h3 className="mt-4 text-xl font-semibold text-slate-900">
              Chưa có câu hỏi phù hợp
            </h3>
            <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-600">
              Thử đổi bộ lọc hoặc thẻ chủ đề, hoặc đăng câu hỏi đầu tiên của bạn
              lên ngân hàng chung để đồng nghiệp cùng sử dụng.
            </p>
            <button
              type="button"
              onClick={openCreateEditor}
              className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-700"
            >
              <Plus className="h-4 w-4" />
              Đăng câu hỏi mới
            </button>
          </div>
        ) : (
          <div className="grid gap-4">
            {items.map((item) => {
              const isOwner = item.created_by === user.id;
              const isSelected = selectedIds.includes(item.id);

              return (
                <article
                  key={item.id}
                  className={`rounded-[28px] bg-white p-5 shadow-sm ring-1 transition ${
                    isSelected
                      ? "ring-2 ring-sky-400"
                      : "ring-slate-200 hover:ring-sky-200"
                  }`}
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex flex-1 items-start gap-3">
                      <label className="mt-1 flex items-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelected(item.id)}
                          //disabled={!item.is_active}
                          className="h-5 w-5 rounded border-slate-300 disabled:cursor-not-allowed disabled:opacity-40"
                          aria-label="Chọn câu hỏi này"
                        />
                      </label>
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                            {getQuestionTypeLabel(item.question_type)}
                          </span>
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-semibold ${getLevelColor(item.bloom_level)}`}
                          >
                            {getLevelLabel(item.bloom_level)}
                          </span>
                          <span className="text-xs uppercase tracking-[0.2em] text-slate-500">
                            {item.score} điểm
                          </span>
                          {item.category_name ? (
                            <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700">
                              {item.category_name}
                            </span>
                          ) : null}
                          {!item.is_active ? (
                            <span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-semibold text-slate-600">
                              Đang ẩn
                            </span>
                          ) : null}
                          {isOwner ? (
                            <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                              Câu của bạn
                            </span>
                          ) : null}
                        </div>

                        <h3 className="mt-3 text-lg font-semibold text-slate-900">
                          {item.content}
                        </h3>

                        {isFillInBlankType(item.question_type) ? (
                          <p className="mt-2 text-sm text-slate-600">
                            Đáp án:{" "}
                            <span className="font-medium text-slate-900">
                              {formatBlankAnswers(item.answer) || "Chưa có đáp án"}
                            </span>
                          </p>
                        ) : (
                          <ul className="mt-3 space-y-1.5">
                            {item.options.map((option, index) => (
                              <li
                                key={`${item.id}-${index}`}
                                className={`flex items-center gap-2 rounded-2xl px-3 py-2 text-sm ${
                                  option.is_correct
                                    ? "bg-emerald-50 text-emerald-800"
                                    : "bg-slate-50 text-slate-700"
                                }`}
                              >
                                {option.is_correct ? (
                                  <Check className="h-4 w-4 flex-none" />
                                ) : (
                                  <span className="h-4 w-4 flex-none rounded-full border border-slate-300" />
                                )}
                                {option.content}
                              </li>
                            ))}
                          </ul>
                        )}

                        {item.tags.length > 0 ? (
                          <div className="mt-3 flex flex-wrap gap-1.5">
                            {item.tags.map((tag) => (
                              <span
                                key={`${item.id}-${tag}`}
                                className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700"
                              >
                                #{tag}
                              </span>
                            ))}
                          </div>
                        ) : null}

                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <div className="flex items-center gap-0.5">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <button
                                key={star}
                                type="button"
                                onClick={() => handleRate(item, star)}
                                disabled={ratingBusyId === item.id}
                                aria-label={`Đánh giá ${star} sao`}
                                title={`Đánh giá ${star} sao`}
                                className="rounded-md p-0.5 transition hover:scale-110 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                <Star
                                  className={`h-4 w-4 ${
                                    star <= (item.my_rating ?? 0)
                                      ? "fill-amber-400 text-amber-400"
                                      : "text-slate-300"
                                  }`}
                                />
                              </button>
                            ))}
                          </div>
                          <span className="text-xs text-slate-500">
                            {item.rating_count > 0
                              ? `${item.rating_average.toFixed(1)}/5 · ${item.rating_count} đánh giá`
                              : "Chưa có đánh giá"}
                          </span>
                          {item.my_rating ? (
                            <button
                              type="button"
                              onClick={() => handleRemoveRating(item)}
                              disabled={ratingBusyId === item.id}
                              className="text-xs font-semibold text-slate-500 underline-offset-2 hover:text-slate-800 hover:underline disabled:opacity-50"
                            >
                              Bỏ đánh giá của tôi
                            </button>
                          ) : null}
                        </div>

                        <p className="mt-3 text-xs text-slate-500">
                          Đăng bởi {item.created_by_name} · {item.usage_count} lượt
                          được dùng · cập nhật{" "}
                          {new Date(item.updated_at).toLocaleDateString("vi-VN")}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 lg:flex-col lg:items-stretch">
                      <button
                        type="button"
                        onClick={() => toggleSelected(item.id)}
                        //disabled={!item.is_active}
                        className={`inline-flex items-center justify-center gap-2 rounded-2xl px-3 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
                          isSelected
                            ? "bg-sky-600 text-white hover:bg-sky-700"
                            : "border border-slate-200 text-slate-700 hover:bg-slate-100"
                        }`}
                      >
                        <Upload className="h-4 w-4" />
                        {/*!item.is_active
                          ? "Đang ẩn"
                          : */isSelected
                            ? "Đã chọn"
                            : "Chọn để thêm"}
                      </button>

                      {isOwner ? (
                        <>
                          <button
                            type="button"
                            onClick={() => openEditEditor(item)}
                            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-100"
                          >
                            <PencilLine className="h-4 w-4" />
                            Sửa
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(item)}
                            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-red-200 px-3 py-2 text-sm text-red-600 transition hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                            Gỡ
                          </button>
                        </>
                      ) : null}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {!isLoading ? (
          <section className="flex flex-col gap-3 rounded-[28px] bg-white px-5 py-4 shadow-sm ring-1 ring-slate-200 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-600">
              Trang <span className="font-semibold text-slate-900">{page}</span> /{" "}
              {Math.max(totalPages, 1)} · {total} câu hỏi
              {filters.tag ? ` cho thẻ #${filters.tag}` : ""}
            </p>
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setPage((current) => Math.max(1, current - 1));
                  setSelectedIds([]);
                }}
                disabled={page <= 1}
                className="inline-flex items-center gap-1 rounded-2xl border border-slate-200 px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" />
                Trước
              </button>
              {pageNumbers.map((pageNumber) => (
                <button
                  key={pageNumber}
                  type="button"
                  onClick={() => {
                    setPage(pageNumber);
                    setSelectedIds([]);
                  }}
                  aria-current={pageNumber === page ? "page" : undefined}
                  className={`h-9 min-w-9 rounded-2xl px-2 text-sm font-semibold transition ${
                    pageNumber === page
                      ? "bg-sky-600 text-white"
                      : "border border-slate-200 text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  {pageNumber}
                </button>
              ))}
              <button
                type="button"
                onClick={() => {
                  setPage((current) => Math.min(Math.max(totalPages, 1), current + 1));
                  setSelectedIds([]);
                }}
                disabled={page >= Math.max(totalPages, 1)}
                className="inline-flex items-center gap-1 rounded-2xl border border-slate-200 px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Sau
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </section>
        ) : null}

        {!isLoading ? (
          <article className="rounded-[28px] bg-slate-900 px-6 py-6 text-white shadow-sm">
            <h3 className="text-lg font-semibold">Cách ngân hàng câu hỏi hoạt động</h3>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              Câu hỏi bạn đăng lên sẽ hiển thị với mọi giảng viên. Khi ai đó thêm câu
              hỏi vào bài kiểm tra, hệ thống tạo một bản sao trong bài kiểm tra của
              họ và tăng “lượt được dùng”; câu hỏi gốc trong ngân hàng không bị ảnh
              hưởng bởi các chỉnh sửa sau đó. Thẻ chủ đề và điểm đánh giá giúp đồng
              nghiệp chọn đúng câu hỏi chất lượng.
            </p>
          </article>
        ) : null}
      </section>

      {editor ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/50 px-4 py-8 backdrop-blur-[2px]">
          <section className="w-full max-w-3xl rounded-[28px] bg-white p-6 shadow-2xl ring-1 ring-slate-200">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-600">
                  Ngân hàng câu hỏi chung
                </p>
                <h2 className="mt-1 text-xl font-semibold text-slate-900">
                  {editor.mode === "create" ? "Đăng câu hỏi mới" : "Sửa câu hỏi đã đăng"}
                </h2>
              </div>
              <button
                type="button"
                onClick={closeEditor}
                className="rounded-2xl p-2 text-slate-500 transition hover:bg-slate-100"
                aria-label="Đóng biểu mẫu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {editorError ? (
              <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {editorError}
              </div>
            ) : null}

            <div className="mt-5 space-y-4">
              <div>
                <label className="text-sm font-semibold text-slate-700">
                  Nội dung câu hỏi
                </label>
                <textarea
                  value={editor.draft.content}
                  onChange={(event) => updateDraft("content", event.target.value)}
                  rows={3}
                  placeholder="Ví dụ: Thủ đô của Việt Nam là ___."
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-sky-400 focus:bg-white"
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-sm font-semibold text-slate-700">Loại câu hỏi</label>
                  <select
                    value={editor.draft.question_type}
                    onChange={(event) =>
                      handleChangeType(event.target.value as QuestionBankQuestionType)
                    }
                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-sky-400 focus:bg-white"
                  >
                    {questionTypeOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-sm font-semibold text-slate-700">
                    Điểm gợi ý
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={editor.draft.score}
                    onChange={(event) =>
                      updateDraft("score", Number(event.target.value))
                    }
                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-sky-400 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="text-sm font-semibold text-slate-700">
                    Mức độ Bloom
                  </label>
                  <select
                    value={editor.draft.bloom_level}
                    onChange={(event) => updateDraft("bloom_level", event.target.value)}
                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-sky-400 focus:bg-white"
                  >
                    {bloomOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-sm font-semibold text-slate-700">
                    Phân loại
                  </label>
                  <select
                    value={editor.draft.category_id ?? ""}
                    onChange={(event) =>
                      updateDraft(
                        "category_id",
                        event.target.value ? Number(event.target.value) : null,
                      )
                    }
                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-sky-400 focus:bg-white"
                  >
                    <option value="">Không phân loại</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </div>

                <label className="flex items-center gap-2 self-end rounded-2xl border border-slate-200 px-4 py-2.5 text-sm text-slate-600">
                  <input
                    type="checkbox"
                    checked={editor.draft.is_active}
                    onChange={(event) => updateDraft("is_active", event.target.checked)}
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  Hiển thị cho mọi giảng viên
                </label>
              </div>

              <div>
                <label className="text-sm font-semibold text-slate-700">
                  Thẻ / chủ đề
                </label>
                <div className="mt-2 flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
                  {editor.draft.tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-2.5 py-1 text-xs font-semibold text-indigo-700"
                    >
                      #{tag}
                      <button
                        type="button"
                        onClick={() => removeTag(tag)}
                        aria-label={`Bỏ thẻ ${tag}`}
                        className="text-indigo-500 transition hover:text-indigo-800"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                  <input
                    value={tagInput}
                    onChange={(event) => setTagInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === ",") {
                        event.preventDefault();
                        addTag();
                      }
                    }}
                    onBlur={addTag}
                    placeholder="Nhập thẻ rồi nhấn Enter (ví dụ: đại số)"
                    className="min-w-[180px] flex-1 bg-transparent py-1 text-sm outline-none"
                  />
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  Tối đa {MAX_QUESTION_BANK_TAGS} thẻ, mỗi thẻ tối đa 40 ký tự. Thẻ
                  giúp đồng nghiệp lọc câu hỏi theo chủ đề.
                </p>
              </div>

              {editor.draft.question_type === "fill_in_blank" ? (
                <div>
                  <label className="text-sm font-semibold text-slate-700">Đáp án</label>
                  <input
                    value={editor.draft.answer}
                    onChange={(event) => updateDraft("answer", event.target.value)}
                    placeholder="Ví dụ: Hà Nội ~ HN | Tokyo"
                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-sky-400 focus:bg-white"
                  />
                  <p className="mt-2 text-xs text-slate-500">
                    Nhiều chỗ trống phân tách bằng &quot; | &quot;, các cách viết khác
                    nhau của cùng một chỗ trống phân tách bằng &quot;~&quot;.
                  </p>
                </div>
              ) : (
                <div>
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-semibold text-slate-700">
                      Phương án trả lời
                    </label>
                    <button
                      type="button"
                      onClick={addOption}
                      className="inline-flex items-center gap-1 text-sm font-semibold text-sky-600 hover:text-sky-700"
                    >
                      <Plus className="h-4 w-4" />
                      Thêm phương án
                    </button>
                  </div>

                  <div className="mt-2 space-y-2">
                    {editor.draft.options.map((option, index) => (
                      <div
                        key={`editor-option-${index}`}
                        className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2"
                      >
                        <button
                          type="button"
                          onClick={() => toggleOptionCorrect(index)}
                          aria-label={
                            option.is_correct
                              ? "Bỏ đánh dấu đáp án đúng"
                              : "Đánh dấu là đáp án đúng"
                          }
                          className={`flex h-6 w-6 flex-none items-center justify-center border text-white transition ${
                            isMultipleAnswerType(editor.draft.question_type)
                              ? "rounded-md"
                              : "rounded-full"
                          } ${
                            option.is_correct
                              ? "border-emerald-500 bg-emerald-500"
                              : "border-slate-300 bg-white text-transparent hover:border-emerald-400"
                          }`}
                        >
                          <Check className="h-3.5 w-3.5" />
                        </button>
                        <input
                          value={option.content}
                          onChange={(event) =>
                            updateOptionContent(index, event.target.value)
                          }
                          placeholder={`Phương án ${index + 1}`}
                          className="flex-1 bg-transparent text-sm outline-none"
                        />
                        {editor.draft.options.length > 2 ? (
                          <button
                            type="button"
                            onClick={() => removeOption(index)}
                            className="rounded-xl p-1.5 text-slate-400 transition hover:bg-white hover:text-red-500"
                            aria-label="Xóa phương án"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-slate-500">
                Đáp án của câu hỏi có phương án được suy ra từ phương án đúng.
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={closeEditor}
                  className="rounded-2xl border border-slate-200 px-4 py-2 text-sm text-slate-600 transition hover:bg-slate-50"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={handleSaveDraft}
                  disabled={isSaving}
                  className="inline-flex items-center gap-2 rounded-2xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSaving ? (
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4" />
                  )}
                  {editor.mode === "create" ? "Đăng câu hỏi" : "Lưu thay đổi"}
                </button>
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}

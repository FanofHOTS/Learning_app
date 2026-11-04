"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, LoaderCircle, Search, X } from "lucide-react";
import { toast } from "react-toastify";

import {
  filterQuestionBankItems,
  getQuestionBankList,
  importQuestionsFromBank,
  type QuestionBankFilters,
  type QuestionBankImportResult,
  type QuestionBankItem,
} from "../lib/api_question_bank";
import {
  formatBlankAnswers,
  getLevelColor,
  getLevelLabel,
  getQuestionTypeLabel,
  isFillInBlankType,
} from "../lib/api_exam";

type QuestionBankPickerProps = {
  open: boolean;
  examId: number;
  examTitle?: string;
  currentUserId: number;
  onClose: () => void;
  onImported?: (result: QuestionBankImportResult) => void;
};

const defaultFilters: QuestionBankFilters = {
  keyword: "",
  categoryId: "all",
  questionType: "all",
  bloomLevel: "all",
  tag: "",
  onlyMine: false,
};

export function QuestionBankPicker({
  open,
  examId,
  examTitle,
  currentUserId,
  onClose,
  onImported,
}: QuestionBankPickerProps) {
  const [items, setItems] = useState<QuestionBankItem[]>([]);
  const [filters, setFilters] = useState<QuestionBankFilters>(defaultFilters);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!open) {
      return;
    }

    let isMounted = true;
    setFilters(defaultFilters);
    setSelectedIds([]);
    setErrorMessage("");
    setIsLoading(true);

    getQuestionBankList(currentUserId)
      .then((list) => {
        if (isMounted) {
          setItems(list);
        }
      })
      .catch((error: unknown) => {
        if (isMounted) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "Không thể tải ngân hàng câu hỏi chung.",
          );
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [currentUserId, open]);

  // filterQuestionBankItems chỉ giữ câu đang hiển thị hoặc câu ẩn của chính
  // người dùng hiện tại, nên câu đã ẩn của giảng viên vẫn chọn được.
  const visibleItems = useMemo(
    () => filterQuestionBankItems(items, filters, currentUserId),
    [items, filters, currentUserId],
  );

  if (!open) {
    return null;
  }

  function updateFilter<K extends keyof QuestionBankFilters>(
    key: K,
    value: QuestionBankFilters[K],
  ) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function toggleSelected(bankId: number) {
    setSelectedIds((current) =>
      current.includes(bankId)
        ? current.filter((id) => id !== bankId)
        : [...current, bankId],
    );
  }

  async function handleImport() {
    if (selectedIds.length === 0) {
      setErrorMessage("Vui lòng chọn ít nhất một câu hỏi từ ngân hàng chung.");
      return;
    }

    setIsImporting(true);
    setErrorMessage("");

    try {
      const result = await importQuestionsFromBank({
        examId,
        questionIds: selectedIds,
        userId: currentUserId,
      });

      toast.success(
        `Đã thêm ${result.imported} câu hỏi từ ngân hàng chung vào bài kiểm tra.`,
      );
      if (result.skipped > 0) {
        toast.info(
          `Bỏ qua ${result.skipped} câu hỏi không còn hiển thị trong ngân hàng chung.`,
        );
      }

      onImported?.(result);
      onClose();
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4 py-6 backdrop-blur-[2px]">
      <section
        aria-label="Chọn câu hỏi từ ngân hàng chung"
        className="flex max-h-[88vh] w-full max-w-4xl flex-col overflow-hidden rounded-[28px] bg-white shadow-2xl ring-1 ring-slate-200"
      >
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-600">
              Ngân hàng câu hỏi chung
            </p>
            <h2 className="mt-1 text-xl font-semibold text-slate-900">
              Thêm câu hỏi vào bài kiểm tra
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {examTitle
                ? `Câu hỏi được sao chép vào “${examTitle}”, bạn có thể chỉnh sửa sau khi thêm.`
                : "Câu hỏi được sao chép vào bài kiểm tra hiện tại."}
            </p>
            <p className="mt-1 text-xs font-medium text-amber-700">
              Câu hỏi bạn đã ẩn khỏi ngân hàng chung vẫn thêm được vào bài kiểm tra.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl p-2 text-slate-500 transition hover:bg-slate-100"
            aria-label="Đóng hộp chọn câu hỏi"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-6 py-4">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={filters.keyword}
              onChange={(event) => updateFilter("keyword", event.target.value)}
              placeholder="Tìm theo nội dung, đáp án, tác giả..."
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm outline-none focus:border-sky-400 focus:bg-white"
            />
          </div>
          <select
            value={filters.questionType}
            onChange={(event) => updateFilter("questionType", event.target.value)}
            className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-sky-400 focus:bg-white"
          >
            <option value="all">Mọi loại câu hỏi</option>
            <option value="multiple_choice">Một đáp án</option>
            <option value="multiple_answer">Nhiều đáp án</option>
            <option value="fill_in_blank">Điền chỗ trống</option>
            <option value="true_false">Đúng / Sai</option>
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

        {errorMessage ? (
          <div className="mx-6 mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {errorMessage}
          </div>
        ) : null}

        <div className="flex items-center justify-between px-6 py-3 text-xs text-slate-500">
          <span>
            {visibleItems.length} câu hỏi hiển thị · đã chọn {selectedIds.length}
          </span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSelectedIds(visibleItems.map((item) => item.id))}
              className="font-semibold text-sky-600 hover:text-sky-700"
            >
              Chọn tất cả
            </button>
            <button
              type="button"
              onClick={() => setSelectedIds([])}
              className="font-semibold text-slate-500 hover:text-slate-700"
            >
              Bỏ chọn
            </button>
          </div>
        </div>

        <div className="min-h-[200px] flex-1 overflow-y-auto px-6 pb-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-16 text-slate-600">
              <LoaderCircle className="mr-2 h-5 w-5 animate-spin" />
              Đang tải ngân hàng câu hỏi...
            </div>
          ) : visibleItems.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-300 px-6 py-12 text-center text-sm text-slate-500">
              Không tìm thấy câu hỏi phù hợp trong ngân hàng chung.
            </div>
          ) : (
            <ul className="space-y-3">
              {visibleItems.map((item) => {
                const isSelected = selectedIds.includes(item.id);
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => toggleSelected(item.id)}
                      className={`w-full rounded-3xl border px-4 py-4 text-left transition ${
                        isSelected
                          ? "border-sky-400 bg-sky-50 ring-1 ring-sky-200"
                          : "border-slate-200 bg-white hover:border-sky-200 hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <span
                          className={`mt-1 flex h-5 w-5 flex-none items-center justify-center rounded-md border ${
                            isSelected
                              ? "border-sky-500 bg-sky-500 text-white"
                              : "border-slate-300 bg-white text-transparent"
                          }`}
                        >
                          <Check className="h-3.5 w-3.5" />
                        </span>
                        <div className="flex-1">
                          <p className="font-medium text-slate-900">{item.content}</p>
                          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                            <span className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-600">
                              {getQuestionTypeLabel(item.question_type)}
                            </span>
                            <span
                              className={`rounded-full px-2.5 py-1 font-semibold ${getLevelColor(item.bloom_level)}`}
                            >
                              {getLevelLabel(item.bloom_level)}
                            </span>
                            <span className="text-slate-500">
                              {item.score} điểm · {item.usage_count} lượt dùng
                            </span>
                            <span className="text-slate-400">
                              {item.created_by_name}
                            </span>
                            {!item.is_active ? (
                              <span className="rounded-full bg-amber-100 px-2.5 py-1 font-semibold text-amber-700">
                                Đang ẩn
                              </span>
                            ) : null}
                          </div>

                          {isFillInBlankType(item.question_type) ? (
                            <p className="mt-2 text-xs text-slate-500">
                              Đáp án:{" "}
                              <span className="font-medium text-slate-700">
                                {formatBlankAnswers(item.answer) || "Chưa có đáp án"}
                              </span>
                            </p>
                          ) : item.options.length > 0 ? (
                            <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
                              {item.options.slice(0, 4).map((option, index) => (
                                <span
                                  key={`${item.id}-${index}`}
                                  className={`rounded-full px-2.5 py-1 ${
                                    option.is_correct
                                      ? "bg-emerald-100 text-emerald-700"
                                      : "bg-slate-100"
                                  }`}
                                >
                                  {option.content}
                                </span>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <footer className="flex flex-col gap-3 border-t border-slate-200 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-500">
            Đã chọn <span className="font-semibold text-slate-800">{selectedIds.length}</span>{" "}
            câu hỏi
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-2xl border border-slate-200 px-4 py-2 text-sm text-slate-600 transition hover:bg-slate-50"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={handleImport}
              disabled={isImporting || selectedIds.length === 0}
              className="inline-flex items-center gap-2 rounded-2xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isImporting ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : null}
              Thêm vào bài kiểm tra
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
}

export default QuestionBankPicker;

"use client";

import { useCallback } from "react";
import type { AiGeneratorSourceMode } from "../lib/api_ai_generator";

export type CognitiveSettingsState = {
  sourceMode: AiGeneratorSourceMode;
  topic: string;
  topicDescription: string;
  difficultyRemember: number;
  difficultyUnderstand: number;
  difficultyApply: number;
};

export type CategoryOption = {
  id: number;
  name: string;
  description: string;
};

/** Một chủ đề kèm tỷ lệ phần trăm khi tạo câu hỏi từ nhiều chủ đề. */
export type TopicAllocation = {
  id: string;
  topic: string;
  description?: string;
  percentage: number;
};

const SOURCE_MODE_OPTIONS: {
  value: AiGeneratorSourceMode;
  label: string;
  description: string;
  icon: string;
}[] = [
  {
    value: "topic_only",
    label: "Chỉ chủ đề",
    description: "AI tự suy luận từ chủ đề; có thể chọn nhiều chủ đề và chia tỷ lệ câu hỏi.",
    icon: "📝",
  },
  {
    value: "document_only",
    label: "Chỉ tài liệu",
    description: "Dùng nội dung từ văn bản, tệp hoặc URL để tạo câu hỏi.",
    icon: "📄",
  },
  {
    value: "combined",
    label: "Chủ đề + tài liệu",
    description: "Kết hợp chủ đề và tài liệu để tạo câu hỏi phong phú hơn.",
    icon: "🔗",
  },
];

type CognitiveSettingsProps = {
  value: CognitiveSettingsState;
  onChange: (next: CognitiveSettingsState) => void;
  categories?: CategoryOption[];
  /** Bật trình chia nhiều chủ đề (hiện chỉ giảng viên dùng). */
  enableMultipleTopics?: boolean;
  topicAllocations?: TopicAllocation[];
  onTopicAllocationsChange?: (next: TopicAllocation[]) => void;
};

export default function CognitiveSettings({
  value,
  onChange,
  categories,
  enableMultipleTopics = false,
  topicAllocations,
  onTopicAllocationsChange,
}: CognitiveSettingsProps) {
  const cognitiveTotal = value.difficultyRemember + value.difficultyUnderstand + value.difficultyApply;

  const updateSlider = useCallback(
    (field: "difficultyRemember" | "difficultyUnderstand" | "difficultyApply", newValue: number) => {
      const clamped = Math.max(0, Math.min(100, newValue));
      onChange({ ...value, [field]: clamped });
    },
    [value, onChange],
  );

  const normalizeDistribution = useCallback(() => {
    const r = value.difficultyRemember;
    const u = value.difficultyUnderstand;
    const a = value.difficultyApply;
    const sum = r + u + a;
    if (sum === 0) {
      onChange({ ...value, difficultyRemember: 34, difficultyUnderstand: 33, difficultyApply: 33 });
      return;
    }
    if (sum === 100) return;
    const nr = Math.round((r / sum) * 100);
    const nu = Math.round((u / sum) * 100);
    const na = 100 - nr - nu;
    onChange({ ...value, difficultyRemember: nr, difficultyUnderstand: nu, difficultyApply: na });
  }, [value, onChange]);

  const setSourceMode = useCallback(
    (mode: AiGeneratorSourceMode) => {
      onChange({ ...value, sourceMode: mode });
    },
    [value, onChange],
  );

  const setTopic = useCallback(
    (topic: string) => {
      onChange({ ...value, topic, topicDescription: "" });
    },
    [value, onChange],
  );

  const useAllocationEditor = Boolean(
    enableMultipleTopics &&
      value.sourceMode === "topic_only" &&
      onTopicAllocationsChange,
  );
  const allocations = topicAllocations ?? [];
  const allocationTotal = allocations.reduce(
    (sum, item) => sum + (Number.isFinite(item.percentage) ? item.percentage : 0),
    0,
  );

  const spreadEvenly = (items: TopicAllocation[]): TopicAllocation[] => {
    if (items.length === 0) {
      return items;
    }
    const base = Math.floor(100 / items.length);
    const remainder = 100 - base * items.length;
    return items.map((item, index) => ({
      ...item,
      percentage: base + (index === items.length - 1 ? remainder : 0),
    }));
  };

  const updateAllocations = (next: TopicAllocation[]) => {
    onTopicAllocationsChange?.(next);
  };

  const handleCategorySelect = useCallback(
    (categoryId: string) => {
      const selectedId = Number(categoryId);
      if (!selectedId) {
        onChange({ ...value, topic: "", topicDescription: "" });
        return;
      }
      const cat = categories?.find((c) => c.id === selectedId);
      if (cat) {
        onChange({
          ...value,
          topic: cat.name,
          topicDescription: cat.description,
        });
      }
    },
    [value, onChange, categories],
  );

  return (
    <div className="space-y-5">
      {/* Source Mode */}
      <div>
        <p className="text-sm font-semibold text-slate-900">Phạm vi tạo câu hỏi</p>
        <div className="mt-2 grid gap-2">
          {SOURCE_MODE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setSourceMode(opt.value)}
              className={`rounded-2xl border px-3.5 py-3 text-left transition ${
                value.sourceMode === opt.value
                  ? "border-indigo-400 bg-indigo-50 ring-2 ring-indigo-200"
                  : "border-slate-200 bg-slate-50 hover:border-slate-300"
              }`}
            >
              <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <span>{opt.icon}</span>
                <span>{opt.label}</span>
              </p>
              <p className="mt-1 text-xs leading-5 text-slate-500">{opt.description}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Topic input – shown for topic_only and combined */}
      {value.sourceMode !== "document_only" ? (
        <div className="space-y-3">
          {useAllocationEditor ? (
            <div className="space-y-3 rounded-2xl border border-indigo-100 bg-indigo-50/60 p-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm font-semibold text-slate-900">
                  Chủ đề và tỷ lệ câu hỏi
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => updateAllocations(spreadEvenly(allocations))}
                    disabled={allocations.length === 0}
                    className="rounded-xl border border-indigo-200 bg-white px-2.5 py-1.5 text-xs font-medium text-indigo-700 transition hover:bg-indigo-50 disabled:opacity-50"
                  >
                    Chia đều
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      updateAllocations(
                        spreadEvenly([
                          ...allocations,
                          {
                            id: `topic-${Date.now()}-${allocations.length}`,
                            topic: "",
                            description: "",
                            percentage: 0,
                          },
                        ]),
                      )
                    }
                    disabled={allocations.length >= 10}
                    className="rounded-xl bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    + Thêm chủ đề
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                {allocations.map((item, index) => (
                  <div key={item.id} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={item.topic}
                      onChange={(event) =>
                        updateAllocations(
                          allocations.map((row) =>
                            row.id === item.id
                              ? { ...row, topic: event.target.value }
                              : row,
                          ),
                        )
                      }
                      placeholder={`Chủ đề ${index + 1}`}
                      aria-label={`Tên chủ đề ${index + 1}`}
                      className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-indigo-400"
                    />
                    <div className="flex shrink-0 items-center rounded-xl border border-slate-200 bg-white">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={item.percentage}
                        onChange={(event) => {
                          const nextValue = Number(event.target.value);
                          const clamped = Number.isFinite(nextValue)
                            ? Math.min(100, Math.max(0, Math.round(nextValue)))
                            : 0;
                          updateAllocations(
                            allocations.map((row) =>
                              row.id === item.id
                                ? { ...row, percentage: clamped }
                                : row,
                            ),
                          );
                        }}
                        aria-label={`Tỷ lệ chủ đề ${index + 1} (%)`}
                        className="w-16 rounded-l-xl border-0 bg-transparent px-2 py-2 text-right text-sm font-semibold text-slate-900 outline-none"
                      />
                      <span className="pr-2 text-sm text-slate-500">%</span>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        updateAllocations(
                          spreadEvenly(
                            allocations.filter((row) => row.id !== item.id),
                          ),
                        )
                      }
                      disabled={allocations.length <= 1}
                      aria-label={`Xóa chủ đề ${index + 1}`}
                      title="Xóa chủ đề"
                      className="shrink-0 rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-sm font-semibold text-slate-500 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between rounded-xl bg-white px-3 py-2 text-xs">
                <span className="text-slate-600">Tổng tỷ lệ</span>
                <span
                  className={`font-semibold ${
                    allocationTotal === 100 ? "text-emerald-700" : "text-amber-700"
                  }`}
                >
                  {allocationTotal}%
                </span>
              </div>
              <p className="text-xs leading-5 text-slate-500">
                Số câu của mỗi chủ đề được tính theo tỷ lệ phần trăm và luôn đủ
                tổng số câu đã đặt. Nhiều chủ đề chỉ dùng được khi phạm vi là
                “Chỉ chủ đề”.
              </p>
            </div>
          ) : null}

          {/* Category selector */}
          {!useAllocationEditor && categories && categories.length > 0 ? (
            <div>
              <label className="text-sm font-semibold text-slate-900">
                Hoặc chọn từ phân loại khóa học
              </label>
              <select
                value={
                  categories.find((c) => c.name === value.topic)?.id ?? ""
                }
                onChange={(e) => handleCategorySelect(e.target.value)}
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100"
              >
                <option value="">— Tự nhập chủ đề —</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          {/* Free-text topic */}
          {!useAllocationEditor ? (
          <div>
            <label className="text-sm font-semibold text-slate-900">
              {categories && categories.length > 0
                ? "Hoặc tự nhập chủ đề"
                : "Chủ đề / chuyên đề"}
            </label>
            <input
              type="text"
              value={value.topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Ví dụ: Toán rời rạc, Lập trình Python, ..."
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100"
            />
          </div>
          ) : null}

          {!useAllocationEditor && value.topicDescription ? (
            <p className="text-xs leading-5 text-slate-500">
              Ngữ cảnh danh mục:{' '}
              <span className="italic">{value.topicDescription}</span>
            </p>
          ) : null}
        </div>
      ) : null}

      {/* Cognitive Level Sliders */}
      <div>
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-slate-900">Phân bố mức độ nhận thức</p>
          <button
            type="button"
            onClick={normalizeDistribution}
            className="rounded-xl border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            Cân bằng
          </button>
        </div>
        <div className="mt-3 space-y-4">
          {/* Nhận biết */}
          <div>
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-slate-700">Nhận biết</span>
              <span className="font-semibold text-sky-700">{value.difficultyRemember}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={value.difficultyRemember}
              onChange={(e) => updateSlider("difficultyRemember", Number(e.target.value))}
              className="mt-1 h-2 w-full cursor-pointer appearance-none rounded-full bg-slate-200 accent-sky-500"
            />
          </div>

          {/* Thông hiểu */}
          <div>
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-slate-700">Thông hiểu</span>
              <span className="font-semibold text-indigo-700">{value.difficultyUnderstand}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={value.difficultyUnderstand}
              onChange={(e) => updateSlider("difficultyUnderstand", Number(e.target.value))}
              className="mt-1 h-2 w-full cursor-pointer appearance-none rounded-full bg-slate-200 accent-indigo-500"
            />
          </div>

          {/* Vận dụng */}
          <div>
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-slate-700">Vận dụng</span>
              <span className="font-semibold text-violet-700">{value.difficultyApply}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={value.difficultyApply}
              onChange={(e) => updateSlider("difficultyApply", Number(e.target.value))}
              className="mt-1 h-2 w-full cursor-pointer appearance-none rounded-full bg-slate-200 accent-violet-500"
            />
          </div>

          {/* Total indicator */}
          <div className="flex items-center justify-between rounded-xl bg-slate-100 px-3 py-2 text-xs">
            <span className="text-slate-600">Tổng phân bố</span>
            <span className={`font-semibold ${cognitiveTotal === 100 ? "text-emerald-700" : "text-amber-700"}`}>
              {cognitiveTotal}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import { Plus, Trash2 } from "lucide-react";

import {
  EXAM_BLOOM_LEVELS,
  getExamDistributionModeLabel,
  getLevelLabel,
  type ExamDistributionMode,
  type ExamQuestionDistributionItem,
} from "../../lib/api_exam";

type TopicOption = {
  topic: string;
  count: number;
};

type QuestionDistributionEditorProps = {
  mode: ExamDistributionMode;
  items: ExamQuestionDistributionItem[];
  onChange: (next: {
    mode: ExamDistributionMode;
    items: ExamQuestionDistributionItem[];
  }) => void;
  availableTopics?: TopicOption[];
  totalQuestions?: number;
  disabled?: boolean;
};

const MODE_OPTIONS: Array<{ value: ExamDistributionMode; label: string }> = [
  { value: "none", label: "Không chia cấu trúc" },
  { value: "bloom", label: "Theo mức độ nhận thức" },
  { value: "topic", label: "Theo chủ đề/từ khóa" },
];

/** Tạo đủ 6 dòng cho cấu trúc Bloom, giữ tỷ lệ đã có nếu khớp mức độ. */
export function buildBloomDistributionItems(
  items: ExamQuestionDistributionItem[] = [],
): ExamQuestionDistributionItem[] {
  const byLevel = new Map(
    items.map((item) => [item.key.trim().toLowerCase(), item.weight]),
  );
  return EXAM_BLOOM_LEVELS.map((level) => ({
    key: level,
    weight: byLevel.get(level) ?? 0,
  }));
}

/** Chuẩn hóa danh sách dòng khi đổi sang chế độ chủ đề/từ khóa. */
export function buildTopicDistributionItems(
  items: ExamQuestionDistributionItem[] = [],
): ExamQuestionDistributionItem[] {
  const bloomLevels = new Set<string>(EXAM_BLOOM_LEVELS);
  return items
    .filter((item) => !bloomLevels.has(item.key.trim().toLowerCase()))
    .map((item) => ({ key: item.key, weight: item.weight }));
}

export function QuestionDistributionEditor({
  mode,
  items,
  onChange,
  availableTopics = [],
  totalQuestions = 0,
  disabled = false,
}: QuestionDistributionEditorProps) {
  const totalWeight = items.reduce(
    (sum, item) => sum + (Number.isFinite(item.weight) ? item.weight : 0),
    0,
  );
  const bloomValues = new Map(
    items.map((item) => [item.key.trim().toLowerCase(), item.weight]),
  );

  function handleModeChange(nextMode: ExamDistributionMode) {
    if (nextMode === mode) {
      return;
    }

    const nextItems =
      nextMode === "bloom"
        ? buildBloomDistributionItems(mode === "bloom" ? items : [])
        : nextMode === "topic"
          ? buildTopicDistributionItems(mode === "topic" ? items : [])
          : [];

    onChange({ mode: nextMode, items: nextItems });
  }

  function updateBloomWeight(level: string, weight: number) {
    const nextItems = EXAM_BLOOM_LEVELS.map((key) => ({
      key,
      weight:
        key === level
          ? weight
          : (bloomValues.get(key) ?? 0),
    }));
    onChange({ mode: "bloom", items: nextItems });
  }

  function updateTopicItem(
    index: number,
    patch: Partial<ExamQuestionDistributionItem>,
  ) {
    onChange({
      mode: "topic",
      items: items.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item,
      ),
    });
  }

  function addTopicItem(topic = "") {
    onChange({
      mode: "topic",
      items: [...items, { key: topic, weight: 10 }],
    });
  }

  function removeTopicItem(index: number) {
    onChange({
      mode: "topic",
      items: items.filter((_, itemIndex) => itemIndex !== index),
    });
  }

  function addSuggestedTopic(topic: string) {
    if (
      items.some(
        (item) => item.key.trim().toLowerCase() === topic.trim().toLowerCase(),
      )
    ) {
      return;
    }
    addTopicItem(topic);
  }

  const unusedTopics = availableTopics.filter(
    (option) =>
      !items.some(
        (item) =>
          item.key.trim().toLowerCase() === option.topic.trim().toLowerCase(),
      ),
  );

  return (
    <div className="space-y-4 rounded-3xl border border-slate-200 bg-slate-50 p-4">
      <div>
        <p className="text-sm font-semibold text-slate-900">Cấu trúc câu hỏi</p>
        <p className="mt-1 text-xs text-slate-500">
          Khi sinh viên làm bài, hệ thống chọn câu hỏi theo tỷ lệ này nếu bài kiểm
          tra có nhiều câu hơn số lượng cần làm.
        </p>
      </div>

      <label className="block">
        <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">
          Cách chia
        </span>
        <select
          value={mode}
          onChange={(event) =>
            handleModeChange(event.target.value as ExamDistributionMode)
          }
          disabled={disabled}
          className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-sky-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {MODE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      {mode === "bloom" ? (
        <div className="space-y-2">
          {EXAM_BLOOM_LEVELS.map((level) => {
            const weight = bloomValues.get(level) ?? 0;
            const share = totalWeight > 0 ? (weight / totalWeight) * 100 : 0;
            return (
              <div
                key={level}
                className="flex items-center gap-3 rounded-2xl bg-white px-3 py-2"
              >
                <span className="flex-1 text-sm text-slate-700">
                  {getLevelLabel(level)}
                </span>
                <span className="w-16 text-right text-xs text-slate-500">
                  {share.toFixed(0)}%
                </span>
                <input
                  type="number"
                  min={0}
                  value={weight}
                  onChange={(event) =>
                    updateBloomWeight(level, Number(event.target.value))
                  }
                  disabled={disabled}
                  className="w-24 rounded-xl border border-slate-200 px-2 py-1.5 text-right text-sm outline-none focus:border-sky-400 disabled:opacity-60"
                  aria-label={`Tỷ lệ ${getLevelLabel(level)}`}
                />
              </div>
            );
          })}
          <p className="text-xs text-slate-500">
            Tổng tỷ lệ: <span className="font-semibold">{totalWeight}%</span>
            {totalWeight !== 100 && totalWeight > 0
              ? " — hệ thống tự quy đổi theo tổng này."
              : ""}
          </p>
        </div>
      ) : null}

      {mode === "topic" ? (
        <div className="space-y-2">
          {items.length === 0 ? (
            <p className="rounded-2xl bg-white px-3 py-3 text-xs text-slate-500">
              Chưa có chủ đề nào. Thêm chủ đề và tỷ lệ bên dưới.
            </p>
          ) : null}

          {items.map((item, index) => {
            const weight = Number.isFinite(item.weight) ? item.weight : 0;
            const share = totalWeight > 0 ? (weight / totalWeight) * 100 : 0;
            const estimatedCount =
              totalQuestions > 0 && totalWeight > 0
                ? Math.round((weight / totalWeight) * totalQuestions)
                : null;
            return (
              <div
                key={`distribution-topic-${index}`}
                className="flex flex-wrap items-center gap-2 rounded-2xl bg-white px-3 py-2"
              >
                <input
                  type="text"
                  value={item.key}
                  onChange={(event) =>
                    updateTopicItem(index, { key: event.target.value })
                  }
                  placeholder="Chủ đề/từ khóa"
                  disabled={disabled}
                  className="min-w-[140px] flex-1 rounded-xl border border-slate-200 px-3 py-1.5 text-sm outline-none focus:border-sky-400 disabled:opacity-60"
                  aria-label={`Chủ đề dòng ${index + 1}`}
                />
                <span className="w-12 text-right text-xs text-slate-500">
                  {share.toFixed(0)}%
                </span>
                <input
                  type="number"
                  min={0}
                  value={weight}
                  onChange={(event) =>
                    updateTopicItem(index, { weight: Number(event.target.value) })
                  }
                  disabled={disabled}
                  className="w-20 rounded-xl border border-slate-200 px-2 py-1.5 text-right text-sm outline-none focus:border-sky-400 disabled:opacity-60"
                  aria-label={`Tỷ lệ chủ đề dòng ${index + 1}`}
                />
                {estimatedCount !== null ? (
                  <span className="w-16 text-right text-xs text-slate-500">
                    ≈ {estimatedCount} câu
                  </span>
                ) : null}
                <button
                  type="button"
                  onClick={() => removeTopicItem(index)}
                  disabled={disabled}
                  className="rounded-xl p-1.5 text-red-500 transition hover:bg-red-50 disabled:opacity-50"
                  aria-label={`Xóa chủ đề dòng ${index + 1}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            );
          })}

          <button
            type="button"
            onClick={() => addTopicItem()}
            disabled={disabled}
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            Thêm chủ đề
          </button>

          {unusedTopics.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="text-xs text-slate-500">Chủ đề có sẵn:</span>
              {unusedTopics.map((option) => (
                <button
                  key={option.topic}
                  type="button"
                  onClick={() => addSuggestedTopic(option.topic)}
                  disabled={disabled}
                  className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200 transition hover:bg-sky-50 hover:text-sky-700 disabled:opacity-50"
                >
                  {option.topic} ({option.count})
                </button>
              ))}
            </div>
          ) : null}

          <p className="text-xs text-slate-500">
            Tổng tỷ lệ: <span className="font-semibold">{totalWeight}%</span>
            {totalWeight !== 100 && totalWeight > 0
              ? " — hệ thống tự quy đổi theo tổng này."
              : ""}
          </p>
        </div>
      ) : null}

      {mode === "none" ? (
        <p className="rounded-2xl bg-white px-3 py-3 text-xs text-slate-500">
          Bài kiểm tra dùng toàn bộ câu hỏi nếu đủ số lượng, hoặc chọn tự động
          theo tỷ lệ mức độ nhận thức của kho câu hỏi khi cần lấy một phần.
        </p>
      ) : null}

      <p className="text-xs text-slate-400">
        Đang chọn: {getExamDistributionModeLabel(mode)}
      </p>
    </div>
  );
}

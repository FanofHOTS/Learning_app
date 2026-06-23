"use client";

import { useCallback, useMemo } from "react";
import {
  BookMarked,
  BookOpen,
  Lightbulb,
  Plus,
  Search,
  Star,
  Trash2,
  Wrench,
} from "lucide-react";

export type BloomLevelKey =
  | "remember"
  | "understand"
  | "apply"
  | "analyze"
  | "evaluate"
  | "create";

export type BloomObjectivesMap = Record<BloomLevelKey, string[]>;

export const BLOOM_LEVELS: {
  key: BloomLevelKey;
  label: string;
  description: string;
  color: string;
  bgClass: string;
  borderClass: string;
  iconClass: string;
  icon: typeof BookMarked;
}[] = [
  {
    key: "remember",
    label: "Nhớ",
    description: "Ghi nhớ và nhận ra thông tin đã học",
    color: "sky",
    bgClass: "bg-sky-50",
    borderClass: "border-sky-200",
    iconClass: "text-sky-600",
    icon: BookMarked,
  },
  {
    key: "understand",
    label: "Hiểu",
    description: "Giải thích, mô tả ý nghĩa của kiến thức",
    color: "blue",
    bgClass: "bg-blue-50",
    borderClass: "border-blue-200",
    iconClass: "text-blue-600",
    icon: BookOpen,
  },
  {
    key: "apply",
    label: "Áp dụng",
    description: "Sử dụng kiến thức vào tình huống cụ thể",
    color: "indigo",
    bgClass: "bg-indigo-50",
    borderClass: "border-indigo-200",
    iconClass: "text-indigo-600",
    icon: Wrench,
  },
  {
    key: "analyze",
    label: "Phân tích",
    description: "Phân chia thông tin thành phần nhỏ, chỉ ra mối quan hệ",
    color: "violet",
    bgClass: "bg-violet-50",
    borderClass: "border-violet-200",
    iconClass: "text-violet-600",
    icon: Search,
  },
  {
    key: "evaluate",
    label: "Đánh giá",
    description: "Đưa ra nhận xét, phán xét dựa trên tiêu chí",
    color: "amber",
    bgClass: "bg-amber-50",
    borderClass: "border-amber-200",
    iconClass: "text-amber-600",
    icon: Star,
  },
  {
    key: "create",
    label: "Sáng tạo",
    description: "Tổng hợp kiến thức để tạo ra sản phẩm / ý tưởng mới",
    color: "emerald",
    bgClass: "bg-emerald-50",
    borderClass: "border-emerald-200",
    iconClass: "text-emerald-600",
    icon: Lightbulb,
  },
];

export const DEFAULT_EMPTY_BLOOM: BloomObjectivesMap = {
  remember: [],
  understand: [],
  apply: [],
  analyze: [],
  evaluate: [],
  create: [],
};

export function parseBloomObjectives(json: string): BloomObjectivesMap {
  try {
    const parsed = JSON.parse(json);
    // Ensure all 6 keys exist
    const result: BloomObjectivesMap = { ...DEFAULT_EMPTY_BLOOM };
    for (const key of Object.keys(DEFAULT_EMPTY_BLOOM as BloomObjectivesMap)) {
      const k = key as BloomLevelKey;
      if (Array.isArray(parsed[k])) {
        result[k] = parsed[k].filter(
          (item: unknown): item is string => typeof item === "string",
        );
      }
    }
    return result;
  } catch {
    return { ...DEFAULT_EMPTY_BLOOM };
  }
}

export function serializeBloomObjectives(map: BloomObjectivesMap): string {
  return JSON.stringify(map);
}

export function countBloomObjectives(map: BloomObjectivesMap): number {
  let total = 0;
  for (const key of Object.keys(map) as BloomLevelKey[]) {
    total += map[key].length;
  }
  return total;
}

type BloomObjectivesProps = {
  value: string; // JSON string
  onChange?: (json: string) => void;
  readOnly?: boolean;
};

export default function BloomObjectives({
  value,
  onChange,
  readOnly = false,
}: BloomObjectivesProps) {
  const objectives = useMemo(() => parseBloomObjectives(value), [value]);

  const updateLevel = useCallback(
    (level: BloomLevelKey, items: string[]) => {
      if (!onChange) return;
      const next = { ...objectives, [level]: items };
      onChange(serializeBloomObjectives(next));
    },
    [objectives, onChange],
  );

  const addObjective = useCallback(
    (level: BloomLevelKey) => {
      const items = [...objectives[level], ""];
      updateLevel(level, items);
    },
    [objectives, updateLevel],
  );

  const removeObjective = useCallback(
    (level: BloomLevelKey, index: number) => {
      const items = objectives[level].filter((_, i) => i !== index);
      updateLevel(level, items);
    },
    [objectives, updateLevel],
  );

  const setObjective = useCallback(
    (level: BloomLevelKey, index: number, text: string) => {
      const items = [...objectives[level]];
      items[index] = text;
      updateLevel(level, items);
    },
    [objectives, updateLevel],
  );

  const totalObjectives = useMemo(() => countBloomObjectives(objectives), [objectives]);
  const levelsWithObjectives = useMemo(
    () => BLOOM_LEVELS.filter((l) => objectives[l.key].length > 0),
    [objectives],
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-slate-900">
            Mục tiêu học tập theo thang Bloom
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            {readOnly
              ? `${totalObjectives} mục tiêu được phân bổ trên ${levelsWithObjectives.length} cấp độ`
              : "Xác định mục tiêu học tập theo 6 cấp độ tư duy Bloom"}
          </p>
        </div>
        {!readOnly && totalObjectives > 0 && (
          <span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-medium text-sky-700">
            {totalObjectives} mục tiêu
          </span>
        )}
      </div>

      {/* Summary badges in view mode */}
      {readOnly && levelsWithObjectives.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {levelsWithObjectives.map((level) => {
            const count = objectives[level.key].length;
            return (
              <span
                key={level.key}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${level.bgClass} ${level.iconClass}`}
              >
                <level.icon className="h-3 w-3" />
                {level.label}: {count}
              </span>
            );
          })}
        </div>
      )}

      {/* Empty state */}
      {!readOnly && totalObjectives === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 py-6 text-center text-sm text-slate-500">
          Chưa có mục tiêu nào. Nhấn &quot;+ Thêm mục tiêu&quot; ở mỗi cấp độ để bắt đầu.
        </div>
      )}

      {/* Levels */}
      <div className="space-y-3">
        {(readOnly ? levelsWithObjectives : BLOOM_LEVELS).map((level) => {
          const items = objectives[level.key];
          const Icon = level.icon;
          const isEmpty = items.length === 0;

          if (readOnly && isEmpty) return null;

          return (
            <div
              key={level.key}
              className={`rounded-2xl border ${readOnly ? level.borderClass : "border-slate-200"} ${level.bgClass} overflow-hidden`}
            >
              {/* Level header */}
              <div className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-lg bg-white shadow-sm ${level.iconClass}`}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {level.label}
                    </p>
                    <p className="text-xs text-slate-500">{level.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {items.length > 0 && (
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        level.bgClass
                          .replace("bg-", "bg-opacity-50 bg-")
                          .replace("bg-", "")
                          ? ""
                          : ""
                      }`}
                    >
                      <span className="text-slate-600">{items.length}</span>
                    </span>
                  )}
                  {!readOnly && (
                    <button
                      type="button"
                      onClick={() => addObjective(level.key)}
                      className="inline-flex items-center gap-1 rounded-lg bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Thêm
                    </button>
                  )}
                </div>
              </div>

              {/* Objectives list */}
              {isEmpty && !readOnly ? (
                <div className="px-4 pb-3">
                  <p className="text-xs italic text-slate-400">
                    Chưa có mục tiêu nào cho cấp độ này. Nhấn &quot;+ Thêm&quot; để tạo mục tiêu mới.
                  </p>
                </div>
              ) : (
                <div className="space-y-1.5 px-4 pb-3">
                  {items.map((item, index) => (
                    <div key={index} className="flex items-start gap-2">
                      {readOnly ? (
                        <div className="flex min-w-0 flex-1 items-start gap-2 rounded-xl bg-white px-3 py-2.5 shadow-sm ring-1 ring-slate-200/50">
                          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-medium text-slate-500">
                            {index + 1}
                          </span>
                          <p className="text-sm leading-6 text-slate-700">
                            {item}
                          </p>
                        </div>
                      ) : (
                        <>
                          <input
                            type="text"
                            value={item}
                            onChange={(e) =>
                              setObjective(level.key, index, e.target.value)
                            }
                            placeholder={`Nhập mục tiêu cấp độ ${level.label.toLowerCase()}...`}
                            className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-sky-400 focus:ring-1 focus:ring-sky-200"
                          />
                          <button
                            type="button"
                            onClick={() => removeObjective(level.key, index)}
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-slate-400 shadow-sm ring-1 ring-slate-200 hover:bg-red-50 hover:text-red-500"
                            aria-label={`Xóa mục tiêu ${index + 1}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

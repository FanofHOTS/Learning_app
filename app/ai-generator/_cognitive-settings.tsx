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
  difficultyEasy: number;
  difficultyMedium: number;
  difficultyHard: number;
};

export type CategoryOption = {
  id: number;
  name: string;
  description: string;
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
    description: "AI tự suy luận nội dung từ chủ đề để tạo câu hỏi.",
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
};

export default function CognitiveSettings({
  value,
  onChange,
  categories,
}: CognitiveSettingsProps) {
  const cognitiveTotal = value.difficultyRemember + value.difficultyUnderstand + value.difficultyApply;
  const difficultyTotal = value.difficultyEasy + value.difficultyMedium + value.difficultyHard;

  const updateSlider = useCallback(
    (field: "difficultyRemember" | "difficultyUnderstand" | "difficultyApply", newValue: number) => {
      // Clamp and adjust so total stays ~100
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
    // Scale proportionally to 100
    const nr = Math.round((r / sum) * 100);
    const nu = Math.round((u / sum) * 100);
    const na = 100 - nr - nu;
    onChange({ ...value, difficultyRemember: nr, difficultyUnderstand: nu, difficultyApply: na });
  }, [value, onChange]);

  const normalizeDifficulty = useCallback(() => {
    const e = value.difficultyEasy;
    const m = value.difficultyMedium;
    const h = value.difficultyHard;
    const sum = e + m + h;
    if (sum === 0) {
      onChange({ ...value, difficultyEasy: 34, difficultyMedium: 33, difficultyHard: 33 });
      return;
    }
    if (sum === 100) return;
    const ne = Math.round((e / sum) * 100);
    const nm = Math.round((m / sum) * 100);
    const nh = 100 - ne - nm;
    onChange({ ...value, difficultyEasy: ne, difficultyMedium: nm, difficultyHard: nh });
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
          {/* Category selector */}
          {categories && categories.length > 0 ? (
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

          {value.topicDescription ? (
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
          <p className="text-sm font-semibold text-slate-900">Phân bố cấp độ nhận thức</p>
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

      {/* Difficulty Level Sliders */}
      <div>
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-slate-900">Phân bố mức độ khó</p>
          <button
            type="button"
            onClick={normalizeDifficulty}
            className="rounded-xl border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            Cân bằng
          </button>
        </div>
        <div className="mt-3 space-y-4">
          {/* Dễ */}
          <div>
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-1.5 font-medium text-slate-700">
                <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: "#22c55e" }} />
                Dễ
              </span>
              <span className="font-semibold text-emerald-700">{value.difficultyEasy}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={value.difficultyEasy}
              onChange={(e) => {
                const newValue = Number(e.target.value);
                onChange({ ...value, difficultyEasy: newValue });
              }}
              className="mt-1 h-2 w-full cursor-pointer appearance-none rounded-full bg-slate-200 accent-emerald-500"
            />
          </div>

          {/* Trung bình */}
          <div>
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-1.5 font-medium text-slate-700">
                <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: "#f59e0b" }} />
                Trung bình
              </span>
              <span className="font-semibold text-amber-700">{value.difficultyMedium}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={value.difficultyMedium}
              onChange={(e) => {
                const newValue = Number(e.target.value);
                onChange({ ...value, difficultyMedium: newValue });
              }}
              className="mt-1 h-2 w-full cursor-pointer appearance-none rounded-full bg-slate-200 accent-amber-500"
            />
          </div>

          {/* Khó */}
          <div>
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-1.5 font-medium text-slate-700">
                <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: "#ef4444" }} />
                Khó
              </span>
              <span className="font-semibold text-rose-700">{value.difficultyHard}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={value.difficultyHard}
              onChange={(e) => {
                const newValue = Number(e.target.value);
                onChange({ ...value, difficultyHard: newValue });
              }}
              className="mt-1 h-2 w-full cursor-pointer appearance-none rounded-full bg-slate-200 accent-rose-500"
            />
          </div>

          {/* Total indicator */}
          <div className="flex items-center justify-between rounded-xl bg-slate-100 px-3 py-2 text-xs">
            <span className="text-slate-600">Tổng phân bố</span>
            <span className={`font-semibold ${difficultyTotal === 100 ? "text-emerald-700" : "text-amber-700"}`}>
              {difficultyTotal}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

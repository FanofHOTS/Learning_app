"use client";

import { ChevronDown } from "lucide-react";

// ─── Bloom level constants ───

export const BLOOM_LEVELS = [
  { key: "remember", label: "Nhớ", color: "bg-sky-100 text-sky-700" },
  { key: "understand", label: "Hiểu", color: "bg-blue-100 text-blue-700" },
  { key: "apply", label: "Áp dụng", color: "bg-indigo-100 text-indigo-700" },
  { key: "analyze", label: "Phân tích", color: "bg-violet-100 text-violet-700" },
  { key: "evaluate", label: "Đánh giá", color: "bg-amber-100 text-amber-800" },
  { key: "create", label: "Sáng tạo", color: "bg-emerald-100 text-emerald-700" },
] as const;

export type BloomLevelKey = (typeof BLOOM_LEVELS)[number]["key"];

export const BLOOM_DESCRIPTIONS: Record<string, string> = {
  remember: "Nhận biết và nhớ lại thông tin đã học",
  understand: "Hiểu và giải thích được ý nghĩa của thông tin",
  apply: "Vận dụng kiến thức vào tình huống cụ thể",
  analyze: "Phân tích, so sánh và phân loại thông tin",
  evaluate: "Đánh giá, nhận xét và đưa ra quan điểm cá nhân",
  create: "Sáng tạo, tổng hợp và thiết kế ý tưởng mới",
};

export function getBloomLevel(levelKey: string) {
  return BLOOM_LEVELS.find((l) => l.key === levelKey) ?? null;
}

// ─── BloomBadge: simple badge with tooltip ───

type BloomBadgeProps = {
  levelKey: string;
  count?: number;
  className?: string;
};

export function BloomBadge({ levelKey, count, className = "" }: BloomBadgeProps) {
  const level = getBloomLevel(levelKey);
  if (!level) return null;

  return (
    <span
      title={BLOOM_DESCRIPTIONS[levelKey]}
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${level.color} ${className}`}
    >
      {level.label}
      {count !== undefined ? <span>&nbsp;({count})</span> : null}
    </span>
  );
}

// ─── BloomLevelCard: collapsible card with badge, objectives list ───

type BloomLevelCardProps = {
  levelKey: string;
  objectives: string[];
  isExpanded: boolean;
  onToggle: () => void;
};

export function BloomLevelCard({
  levelKey,
  objectives,
  isExpanded,
  onToggle,
}: BloomLevelCardProps) {
  const level = getBloomLevel(levelKey);
  if (!level || objectives.length === 0) return null;

  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/50 px-3 py-2">
      <button
        type="button"
        onClick={onToggle}
        className="inline-flex w-full items-center justify-between gap-2"
      >
        <BloomBadge levelKey={levelKey} count={objectives.length} />
        <ChevronDown
          className={`h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform ${
            isExpanded ? "rotate-0" : "-rotate-90"
          }`}
        />
      </button>
      {isExpanded ? (
        <ul className="mt-1.5 space-y-1">
          {objectives.map((item, idx) => (
            <li
              key={idx}
              className="flex items-start gap-2 text-[11px] leading-5 text-slate-600"
            >
              <span className="mt-[7px] block h-1 w-1 shrink-0 rounded-full bg-slate-400" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

// ─── BloomLevelsSection: full objectives section with all levels ───

type BloomLevelsSectionProps = {
  bloomData: Record<string, string[]>;
  expandedLevels: Record<string, boolean>;
  onToggleLevel: (key: string) => void;
};

export function BloomLevelsSection({
  bloomData,
  expandedLevels,
  onToggleLevel,
}: BloomLevelsSectionProps) {
  const hasBloom = Object.values(bloomData).some((arr) => arr.length > 0);
  if (!hasBloom) return null;

  return (
    <div>
      <p className="mb-2 text-xs font-medium text-slate-500 uppercase tracking-wide">
        Mục tiêu Bloom
      </p>
      <div className="space-y-2">
        {BLOOM_LEVELS.map((level) => {
          const items = bloomData[level.key];
          if (!items || items.length === 0) return null;
          return (
            <BloomLevelCard
              key={level.key}
              levelKey={level.key}
              objectives={items}
              isExpanded={expandedLevels[level.key] !== false}
              onToggle={() => onToggleLevel(level.key)}
            />
          );
        })}
      </div>
    </div>
  );
}

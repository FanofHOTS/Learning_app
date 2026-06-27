"use client";

import { useEffect, useState } from "react";
import { BarChart3, LoaderCircle, SplitSquareVertical } from "lucide-react";
import {
  getInstructorBloomDistribution,
  getInstructorDifficultyDistribution,
  type BloomDistributionResponse,
} from "../../lib/api_exam_instructor";
import { getLevelLabel, getLevelColor, getDifficultyLabel, getDifficultyColor } from "../../lib/api_exam";

type Props = {
  instructorId: number;
};

const BLOOM_ORDER = ["remember", "understand", "apply", "analyze", "evaluate", "create"];
const DIFFICULTY_ORDER = ["easy", "medium", "hard"];

function sortItems(order: string[], items: BloomDistributionResponse["items"]): BloomDistributionResponse["items"] {
  return order
    .map((level) => items.find((i) => i.level === level))
    .filter((i): i is NonNullable<typeof i> => i !== undefined);
}

function DistributionPanel({
  title,
  total,
  items,
  getLabel,
  getColor,
  order,
}: {
  title: string;
  total: number;
  items: BloomDistributionResponse["items"];
  getLabel: (level: string) => string;
  getColor: (level: string) => string;
  order: string[];
}) {
  const sorted = sortItems(order, items);
  if (sorted.length === 0) return null;

  return (
    <div className="flex-1 min-w-0">
      <h4 className="text-sm font-semibold text-slate-700 mb-2">{title}</h4>
      <p className="text-xs text-slate-500 mb-3">{total} câu hỏi</p>

      {/* Stacked bar */}
      {sorted.length > 1 && (
        <div className="mb-3 overflow-hidden rounded-full bg-slate-100">
          <div className="flex h-4">
            {sorted.map((item) => {
              const color = getColor(item.level);
              return (
                <div
                  key={item.level}
                  className="h-full transition-all duration-500 first:rounded-l-full last:rounded-r-full"
                  style={{
                    width: `${item.percentage}%`,
                    backgroundColor: color,
                    opacity: 0.85,
                  }}
                  title={`${getLabel(item.level)}: ${item.count} câu (${item.percentage}%)`}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Per-level bars */}
      <div className="space-y-2">
        {sorted.map((item) => {
          const color = getColor(item.level);
          return (
            <div key={item.level}>
              <div className="mb-0.5 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span
                    className="inline-block h-2 w-2 rounded-full"
                    style={{ backgroundColor: color }}
                  />
                  <span className="text-xs font-medium text-slate-600">
                    {getLabel(item.level)}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                  <span>{item.count}</span>
                  <span className="font-semibold text-slate-600">{item.percentage}%</span>
                </div>
              </div>
              <div className="relative h-1.5 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full transition-all duration-700 ease-out"
                  style={{
                    width: `${item.percentage}%`,
                    backgroundColor: color,
                    opacity: 0.85,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function InstructorComparisonChart({ instructorId }: Props) {
  const [bloomData, setBloomData] = useState<BloomDistributionResponse | null>(null);
  const [difficultyData, setDifficultyData] = useState<BloomDistributionResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        const [bloom, difficulty] = await Promise.all([
          getInstructorBloomDistribution(instructorId),
          getInstructorDifficultyDistribution(instructorId),
        ]);
        if (mounted) {
          setBloomData(bloom);
          setDifficultyData(difficulty);
        }
      } catch {
        // silently fail
      } finally {
        if (mounted) setIsLoading(false);
      }
    }

    void load();
    return () => { mounted = false; };
  }, [instructorId]);

  if (isLoading) {
    return (
      <article className="rounded-4xl border border-slate-200 bg-white/95 p-6 shadow-lg shadow-slate-200/60">
        <div className="flex items-center justify-center py-8">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <LoaderCircle className="h-4 w-4 animate-spin" />
            <span>Đang tải...</span>
          </div>
        </div>
      </article>
    );
  }

  if (!bloomData || !difficultyData || bloomData.total === 0 || difficultyData.total === 0) {
    return null;
  }

  return (
    <article className="rounded-4xl border border-slate-200 bg-white/95 p-6 shadow-lg shadow-slate-200/60">
      <div className="flex items-center justify-between mb-5">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-violet-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-violet-700">
            <SplitSquareVertical className="h-4 w-4" />
            So sánh Bloom & Độ khó
          </div>
          <h3 className="mt-2 text-lg font-semibold text-slate-950">
            Tương quan nhận thức và độ khó
          </h3>
          <p className="mt-0.5 text-xs text-slate-500">
            So sánh cấu trúc ngân hàng câu hỏi theo hai chiều
          </p>
        </div>
        <BarChart3 className="h-7 w-7 text-violet-500" />
      </div>

      <div className="flex flex-col gap-6 sm:flex-row sm:gap-6">
        <div className="flex-1 rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
          <DistributionPanel
            title="🧠 Phân bố Bloom"
            total={bloomData.total}
            items={bloomData.items}
            getLabel={getLevelLabel}
            getColor={getLevelColor}
            order={BLOOM_ORDER}
          />
        </div>

        <div className="hidden sm:flex items-center justify-center">
          <div className="h-24 w-px bg-slate-200" />
        </div>

        <div className="flex-1 rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
          <DistributionPanel
            title="📊 Phân bố độ khó"
            total={difficultyData.total}
            items={difficultyData.items}
            getLabel={getDifficultyLabel}
            getColor={getDifficultyColor}
            order={DIFFICULTY_ORDER}
          />
        </div>
      </div>
    </article>
  );
}

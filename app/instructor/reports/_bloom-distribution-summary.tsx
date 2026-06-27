"use client";

import { useEffect, useState } from "react";
import { BarChart3, Layers, LoaderCircle } from "lucide-react";
import {
  getInstructorBloomDistribution,
  type BloomDistributionResponse,
} from "../../lib/api_exam_instructor";
import { getLevelLabel, getLevelColor } from "../../lib/api_exam";

type Props = {
  instructorId: number;
};

const LEVEL_ORDER = ["remember", "understand", "apply", "analyze", "evaluate", "create"];

export default function InstructorBloomDistributionSummary({ instructorId }: Props) {
  const [data, setData] = useState<BloomDistributionResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        const result = await getInstructorBloomDistribution(instructorId);
        if (mounted) setData(result);
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

  if (!data || data.total === 0) return null;

  const sortedItems = LEVEL_ORDER
    .map((level) => data.items.find((i) => i.level === level))
    .filter((i): i is NonNullable<typeof i> => i !== undefined);

  const isDiverse = sortedItems.length >= 3;

  return (
    <article className="rounded-4xl border border-slate-200 bg-white/95 p-6 shadow-lg shadow-slate-200/60">
      <div className="flex items-center justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-indigo-700">
            <Layers className="h-4 w-4" />
            Phân bố câu hỏi Bloom
          </div>
          <h3 className="mt-2 text-lg font-semibold text-slate-950">
            Cấu trúc ngân hàng câu hỏi
          </h3>
          <p className="mt-0.5 text-xs text-slate-500">
            {data.total} câu hỏi trên tất cả khóa học
          </p>
        </div>
        <BarChart3 className="h-7 w-7 text-indigo-500" />
      </div>

      {/* Stacked overview bar */}
      {isDiverse && (
        <div className="mt-5 overflow-hidden rounded-full bg-slate-100">
          <div className="flex h-5">
            {sortedItems.map((item) => {
              const color = getLevelColor(item.level);
              return (
                <div
                  key={item.level}
                  className="h-full transition-all duration-500 first:rounded-l-full last:rounded-r-full"
                  style={{
                    width: `${item.percentage}%`,
                    backgroundColor: color,
                    opacity: 0.85,
                  }}
                  title={`${getLevelLabel(item.level)}: ${item.count} câu (${item.percentage}%)`}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Per-level bars */}
      <div className="mt-4 space-y-3">
        {sortedItems.map((item) => {
          const color = getLevelColor(item.level);
          return (
            <div key={item.level}>
              <div className="mb-1 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: color }}
                  />
                  <span className="text-xs font-medium text-slate-700">
                    {getLevelLabel(item.level)}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span>{item.count} câu</span>
                  <span className="font-semibold text-slate-700">{item.percentage}%</span>
                </div>
              </div>
              <div className="relative h-2.5 overflow-hidden rounded-full bg-slate-100">
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
    </article>
  );
}

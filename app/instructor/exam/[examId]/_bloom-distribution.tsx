"use client";

import { useEffect, useState } from "react";
import { BarChart3, LoaderCircle } from "lucide-react";
import {
  getExamBloomDistribution,
  type BloomDistributionResponse,
} from "../../../lib/api_exam_instructor";
import { getLevelLabel, getLevelColor } from "../../../lib/api_exam";

type BloomDistributionProps = {
  examId: number;
};

const LEVEL_ORDER = ["remember", "understand", "apply", "analyze", "evaluate", "create"];

export default function BloomDistribution({ examId }: BloomDistributionProps) {
  const [data, setData] = useState<BloomDistributionResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function load() {
      try {
        const result = await getExamBloomDistribution(examId);
        if (!isMounted) return;
        setData(result);
        setError("");
      } catch (err) {
        if (!isMounted) return;
        setError(
          err instanceof Error
            ? err.message
            : "Không thể tải phân bố Bloom.",
        );
      } finally {
        if (!isMounted) return;
        setIsLoading(false);
      }
    }

    void load();
    return () => {
      isMounted = false;
    };
  }, [examId]);

  if (isLoading) {
    return (
      <article className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <div className="flex items-center justify-center py-6">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <LoaderCircle className="h-4 w-4 animate-spin" />
            <span>Đang tải...</span>
          </div>
        </div>
      </article>
    );
  }

  if (error) {
    return (
      <article className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      </article>
    );
  }

  if (!data || data.total === 0) {
    return null;
  }

  // Sắp xếp items theo LEVEL_ORDER
  const sortedItems = LEVEL_ORDER.filter((level) =>
    data.items.some((item) => item.level === level),
  ).map((level) => {
    return data.items.find((item) => item.level === level)!;
  });

  // Stacked bar: tính tỷ lệ phần trăm gộp để tạo thanh stacked
  const hasMultipleLevels = sortedItems.length > 1;

  return (
    <article className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <div className="flex items-center justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-sky-50 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">
            <BarChart3 className="h-3.5 w-3.5" />
            Phân bố Bloom
          </div>
          <h3 className="mt-2 text-lg font-semibold text-slate-900">
            Thang nhận thức
          </h3>
          <p className="mt-0.5 text-xs text-slate-500">
            {data.total} câu hỏi
          </p>
        </div>
      </div>

      {/* Stacked bar */}
      {hasMultipleLevels && (
        <div className="mt-4 overflow-hidden rounded-full bg-slate-100">
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

      {/* Level bars */}
      <div className="mt-4 space-y-2.5">
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
                  <span className="font-semibold text-slate-700">
                    {item.percentage}%
                  </span>
                </div>
              </div>
              <div className="relative h-2 overflow-hidden rounded-full bg-slate-100">
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

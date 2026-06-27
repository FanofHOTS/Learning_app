"use client";

import { useEffect, useState } from "react";
import { BarChart3, LoaderCircle } from "lucide-react";
import {
  getDifficultyLabel,
  getDifficultyColor,
  getDifficultyAnalysisByUser,
} from "../../lib/api_exam";

type DifficultyChartProps = {
  userId: number;
};

type DifficultyItem = {
  level: string;
  correct: number;
  total: number;
  score: number;
};

type DifficultyChartData = {
  breakdown: DifficultyItem[];
};

const DIFFICULTY_ORDER = ["easy", "medium", "hard"];

function ScoreBadge({ score }: { score: number }) {
  let colorClass = "bg-rose-100 text-rose-700 border-rose-200";
  if (score >= 80) colorClass = "bg-emerald-100 text-emerald-700 border-emerald-200";
  else if (score >= 60) colorClass = "bg-amber-100 text-amber-700 border-amber-200";
  else if (score >= 40) colorClass = "bg-orange-100 text-orange-700 border-orange-200";

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${colorClass}`}
    >
      {score.toFixed(1)}%
    </span>
  );
}

function DifficultyBar({
  level,
  correct,
  total,
  score,
  maxScore,
}: {
  level: string;
  correct: number;
  total: number;
  score: number;
  maxScore: number;
}) {
  const barWidth = maxScore > 0 ? (score / maxScore) * 100 : 0;
  const color = getDifficultyColor(level);
  const label = getDifficultyLabel(level);

  return (
    <div className="group">
      <div className="mb-1.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className="inline-block h-3 w-3 rounded-full"
            style={{ backgroundColor: color }}
          />
          <span className="text-sm font-medium text-slate-700">{label}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">
            {correct}/{total}
          </span>
          <ScoreBadge score={score} />
        </div>
      </div>
      <div className="relative h-3 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full transition-all duration-700 ease-out"
          style={{
            width: `${barWidth}%`,
            backgroundColor: color,
            opacity: 0.85,
          }}
        />
      </div>
    </div>
  );
}

export default function StudentDifficultyChart({ userId }: DifficultyChartProps) {
  const [data, setData] = useState<DifficultyChartData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function load() {
      try {
        const response = await getDifficultyAnalysisByUser(userId);
        if (!isMounted) return;

        // Aggregate difficulty data across all exams
        const difficultyCount: Record<string, { correct: number; total: number }> = {};
        let hasData = false;

        for (const result of response.results) {
          for (const item of result.breakdown) {
            hasData = true;
            if (!difficultyCount[item.level]) {
              difficultyCount[item.level] = { correct: 0, total: 0 };
            }
            difficultyCount[item.level].correct += item.correct;
            difficultyCount[item.level].total += item.total;
          }
        }

        if (!hasData) {
          if (!isMounted) return;
          setData(null);
          setIsLoading(false);
          return;
        }

        const breakdown: DifficultyItem[] = Object.entries(difficultyCount).map(
          ([level, data]) => ({
            level,
            correct: data.correct,
            total: data.total,
            score: data.total > 0 ? parseFloat(((data.correct / data.total) * 100).toFixed(1)) : 0,
          }),
        );

        if (!isMounted) return;
        setData({ breakdown });
      } catch {
        // silently fail — component shows empty state
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    void load();
    return () => {
      isMounted = false;
    };
  }, [userId]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center rounded-[28px] border border-slate-200 bg-white p-8">
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <LoaderCircle className="h-4 w-4 animate-spin" />
          <span>Đang tải phân tích độ khó...</span>
        </div>
      </div>
    );
  }

  if (!data || data.breakdown.length === 0) {
    return (
      <div className="rounded-[28px] border border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-center">
        <BarChart3 className="mx-auto h-8 w-8 text-slate-400" />
        <p className="mt-2 text-sm text-slate-500">
          Chưa có dữ liệu phân tích độ khó. Hãy làm bài kiểm tra để xem kết quả!
        </p>
      </div>
    );
  }

  const maxScore = Math.max(
    ...data.breakdown.map((item) => item.score),
    100,
  );

  const totalCorrect = data.breakdown.reduce((sum, item) => sum + item.correct, 0);
  const totalQuestions = data.breakdown.reduce((sum, item) => sum + item.total, 0);
  const overallScore = totalQuestions > 0 ? (totalCorrect / totalQuestions) * 100 : 0;

  return (
    <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/70">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">
            <BarChart3 className="h-4 w-4" />
            Phân tích theo độ khó
          </div>
          <h3 className="mt-2 text-xl font-semibold text-slate-950">
            Kết quả theo mức độ khó
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            {totalQuestions} câu hỏi đã trả lời
          </p>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-xs text-slate-500">Điểm tổng thể</span>
          <span className="text-2xl font-bold text-slate-950">
            {overallScore.toFixed(1)}%
          </span>
        </div>
      </div>

      <div className="space-y-3">
        {DIFFICULTY_ORDER.filter((level) =>
          data.breakdown.some((item) => item.level === level),
        ).map((level) => {
          const item = data.breakdown.find((b) => b.level === level)!;
          return (
            <DifficultyBar
              key={level}
              level={level}
              correct={item.correct}
              total={item.total}
              score={item.score}
              maxScore={maxScore}
            />
          );
        })}
      </div>

      {/* Level legend */}
      <div className="mt-5 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
        {DIFFICULTY_ORDER.filter((level) =>
          data.breakdown.some((item) => item.level === level),
        ).map((level) => (
          <div key={level} className="flex items-center gap-1.5">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: getDifficultyColor(level) }}
            />
            <span className="text-xs text-slate-500">
              {getDifficultyLabel(level)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

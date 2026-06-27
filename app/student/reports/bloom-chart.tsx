"use client";

import { useEffect, useState } from "react";
import { BarChart3, LoaderCircle } from "lucide-react";
import {
  getBloomAnalysisByUser,
  getLevelLabel,
  getLevelColor,
  type BloomAnalysisResult,
} from "../../lib/api_exam";

type BloomChartProps = {
  userId: number;
  courseId?: number;
};

const LEVEL_ORDER = ["remember", "understand", "apply", "analyze", "evaluate", "create"];

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

function BloomBar({
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
  const color = getLevelColor(level);
  const label = getLevelLabel(level);

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

function BloomExamCard({ result }: { result: BloomAnalysisResult }) {
  const maxScore = Math.max(
    ...result.breakdown.map((item) => item.score),
    100,
  );

  return (
    <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/70 transition-all hover:shadow-md">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <h4 className="text-base font-semibold text-slate-900">
          {result.exam_title}
        </h4>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">Tổng thể</span>
          <ScoreBadge score={result.overall_score} />
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {LEVEL_ORDER.filter((level) =>
          result.breakdown.some((item) => item.level === level),
        ).map((level) => {
          const item = result.breakdown.find((b) => b.level === level);
          if (!item) return null;
          return (
            <BloomBar
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
    </div>
  );
}

export default function BloomChart({ userId, courseId }: BloomChartProps) {
  const [results, setResults] = useState<BloomAnalysisResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function load() {
      try {
        const data = await getBloomAnalysisByUser(userId);
        if (!isMounted) return;
        setResults(data.results);
        setError("");
      } catch (err) {
        if (!isMounted) return;
        setError(
          err instanceof Error
            ? err.message
            : "Không thể tải dữ liệu phân tích Bloom.",
        );
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
          <span>Đang tải phân tích Bloom...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-[28px] border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700">
        {error}
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="rounded-[28px] border border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-center">
        <BarChart3 className="mx-auto h-8 w-8 text-slate-400" />
        <p className="mt-2 text-sm text-slate-500">
          Chưa có dữ liệu phân tích Bloom. Hãy làm bài kiểm tra để xem kết quả!
        </p>
      </div>
    );
  }

  // Aggregate scores across all exams
  const aggregated: Record<string, { correct: number; total: number }> = {};
  for (const result of results) {
    for (const item of result.breakdown) {
      if (!aggregated[item.level]) {
        aggregated[item.level] = { correct: 0, total: 0 };
      }
      aggregated[item.level].correct += item.correct;
      aggregated[item.level].total += item.total;
    }
  }

  const maxScore = Math.max(
    ...Object.values(aggregated).map(
      (v) => (v.total > 0 ? (v.correct / v.total) * 100 : 0),
    ),
    100,
  );

  const totalCorrect = Object.values(aggregated).reduce(
    (sum, v) => sum + v.correct,
    0,
  );
  const totalQuestions = Object.values(aggregated).reduce(
    (sum, v) => sum + v.total,
    0,
  );
  const overallScore =
    totalQuestions > 0
      ? (totalCorrect / totalQuestions) * 100
      : 0;

  return (
    <div className="space-y-4">
      {/* Aggregate overview */}
      <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/70">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">
              <BarChart3 className="h-4 w-4" />
              Phân tích theo thang Bloom
            </div>
            <h3 className="mt-2 text-xl font-semibold text-slate-950">
              Năng lực nhận thức theo từng cấp độ
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              {results.length} bài kiểm tra, {totalQuestions} câu hỏi
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
          {LEVEL_ORDER.filter((level) => aggregated[level]).map((level) => {
            const data = aggregated[level];
            const score =
              data.total > 0 ? (data.correct / data.total) * 100 : 0;
            return (
              <BloomBar
                key={level}
                level={level}
                correct={data.correct}
                total={data.total}
                score={score}
                maxScore={maxScore}
              />
            );
          })}
        </div>

        {/* Level legend */}
        <div className="mt-5 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
          {LEVEL_ORDER.filter((level) => aggregated[level]).map((level) => (
            <div key={level} className="flex items-center gap-1.5">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: getLevelColor(level) }}
              />
              <span className="text-xs text-slate-500">
                {getLevelLabel(level)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Per-exam breakdown */}
      {results.length > 1 && (
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-slate-600">
            Chi tiết từng bài kiểm tra
          </h4>
          {results.map((result) => (
            <BloomExamCard key={result.exam_id} result={result} />
          ))}
        </div>
      )}
    </div>
  );
}

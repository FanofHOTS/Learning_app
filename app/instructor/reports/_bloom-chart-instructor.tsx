"use client";

import { useEffect, useState } from "react";
import { BarChart3, GraduationCap, LoaderCircle, Users } from "lucide-react";
import {
  getBloomAnalysisByInstructor,
  getLevelLabel,
  getLevelColor,
  type InstructorBloomCourseDetail,
  type InstructorBloomResponse,
} from "../../lib/api_exam";

type InstructorBloomChartProps = {
  instructorId: number;
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

function CourseBloomCard({ course }: { course: InstructorBloomCourseDetail }) {
  const maxScore = Math.max(
    ...course.breakdown.map((item) => item.score),
    100,
  );

  return (
    <details className="group rounded-[26px] border border-slate-200 bg-white shadow-sm shadow-slate-200/70 transition-all hover:shadow-md">
      <summary className="flex cursor-pointer items-center justify-between p-4 transition-colors hover:bg-slate-50">
        <div className="flex flex-col gap-1">
          <h4 className="text-sm font-semibold text-slate-900">
            {course.course_title}
          </h4>
          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span className="flex items-center gap-1">
              <Users className="h-3.5 w-3.5" />
              {course.total_students} sinh viên
            </span>
            <span>Điểm Bloom: <strong className="text-slate-700">{course.overall_score.toFixed(1)}</strong></span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ScoreBadge score={course.overall_score} />
          <svg
            className="h-5 w-5 text-slate-400 transition-transform group-open:rotate-180"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </summary>
      <div className="border-t border-slate-100 px-4 pb-4 pt-3">
        <div className="space-y-3">
          {LEVEL_ORDER.filter((level) =>
            course.breakdown.some((item) => item.level === level),
          ).map((level) => {
            const item = course.breakdown.find((b) => b.level === level);
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
    </details>
  );
}

export default function InstructorBloomChart({ instructorId }: InstructorBloomChartProps) {
  const [data, setData] = useState<InstructorBloomResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function load() {
      try {
        const result = await getBloomAnalysisByInstructor(instructorId);
        if (!isMounted) return;
        setData(result);
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
  }, [instructorId]);

  if (isLoading) {
    return (
      <article className="rounded-4xl border border-slate-200 bg-white/95 p-6 shadow-lg shadow-slate-200/60">
        <div className="flex items-center justify-center py-8">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <LoaderCircle className="h-4 w-4 animate-spin" />
            <span>Đang tải phân tích Bloom...</span>
          </div>
        </div>
      </article>
    );
  }

  if (error) {
    return (
      <article className="rounded-4xl border border-slate-200 bg-white/95 p-6 shadow-lg shadow-slate-200/60">
        <div className="rounded-[28px] border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700">
          {error}
        </div>
      </article>
    );
  }

  if (!data || data.courses.length === 0) {
    return (
      <article className="rounded-4xl border border-slate-200 bg-white/95 p-6 shadow-lg shadow-slate-200/60">
        <div className="rounded-[28px] border border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-center">
          <BarChart3 className="mx-auto h-8 w-8 text-slate-400" />
          <p className="mt-2 text-sm text-slate-500">
            Chưa có dữ liệu phân tích Bloom. Sinh viên cần làm bài kiểm tra để hiển thị kết quả.
          </p>
        </div>
      </article>
    );
  }

  // Aggregate across all courses
  const aggregated: Record<string, { correct: number; total: number }> = {};
  for (const course of data.courses) {
    for (const item of course.breakdown) {
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
    <article className="rounded-4xl border border-slate-200 bg-white/95 p-6 shadow-lg shadow-slate-200/60">
      <div className="flex items-center justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">
            <BarChart3 className="h-4 w-4" />
            Phân tích Bloom
          </div>
          <h3 className="mt-2 text-lg font-semibold text-slate-950">
            Năng lực nhận thức sinh viên
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            {data.total_students} sinh viên, {data.total_exam_results} lượt kiểm tra, {data.courses.length} khóa học
          </p>
        </div>
        <GraduationCap className="h-7 w-7 text-sky-600" />
      </div>

      {/* Aggregate overview */}
      <div className="mt-5 rounded-[26px] border border-slate-200 bg-slate-50 p-4">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm font-semibold text-slate-700">Tổng hợp tất cả khóa học</span>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Điểm Bloom chung</span>
            <ScoreBadge score={overallScore} />
          </div>
        </div>

        <div className="space-y-2.5">
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
      </div>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap gap-2">
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

      {/* Per-course breakdown */}
      {data.courses.length > 0 && (
        <div className="mt-5 border-t border-slate-200 pt-4">
          <h4 className="mb-3 text-sm font-semibold text-slate-600">
            Chi tiết theo từng khóa học
          </h4>
          <div className="space-y-2">
            {data.courses.map((course) => (
              <CourseBloomCard key={course.course_id} course={course} />
            ))}
          </div>
        </div>
      )}
    </article>
  );
}

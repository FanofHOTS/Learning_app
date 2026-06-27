"use client";

import {
  BarChart3,
  BookOpen,
  ClipboardList,
  NotebookPen,
  School,
} from "lucide-react";
import type {
  CourseProgressStats,
  InstructorCourseComponent,
  InstructorCourseModule,
} from "../../../lib/api_course_instructor";

type ProgressChartProps = {
  stats: CourseProgressStats;
  modules: InstructorCourseModule[];
  components: InstructorCourseComponent[];
};

const TYPE_COLORS: Record<
  InstructorCourseComponent["component_type"],
  { bar: string; bg: string; text: string }
> = {
  document: {
    bar: "bg-cyan-500",
    bg: "bg-cyan-100",
    text: "text-cyan-700",
  },
  exam: {
    bar: "bg-emerald-500",
    bg: "bg-emerald-100",
    text: "text-emerald-700",
  },
  assignment: {
    bar: "bg-violet-500",
    bg: "bg-violet-100",
    text: "text-violet-700",
  },
};

function getComponentTypeLabel(
  componentType: InstructorCourseComponent["component_type"],
) {
  switch (componentType) {
    case "exam":
      return "Bài kiểm tra";
    case "assignment":
      return "Bài tập";
    default:
      return "Tài liệu";
  }
}

function AnimatedBar({
  value,
  max,
  label,
  color = "bg-sky-500",
  showValue = true,
}: {
  value: number;
  max: number;
  label: string;
  color?: string;
  showValue?: boolean;
}) {
  const percent = max > 0 ? Math.round((value / max) * 100) : 0;

  return (
    <div className="group flex items-center gap-3">
      <span className="w-8 text-right text-sm font-semibold tabular-nums text-slate-900">
        {value}
      </span>
      <div className="relative h-6 flex-1 overflow-hidden rounded-full bg-slate-100 ring-1 ring-inset ring-slate-200">
        <div
          className={`h-full rounded-full transition-all duration-700 ease-out ${color}`}
          style={{ width: `${percent}%` }}
        />
      </div>
      <span className="min-w-0 flex-1 truncate text-sm text-slate-600 group-hover:text-slate-900">
        {label}
      </span>
      {showValue && max > 0 ? (
        <span className="w-10 text-right text-xs font-medium text-slate-400">
          {percent}%
        </span>
      ) : null}
    </div>
  );
}

export default function ProgressChart({
  stats,
  modules,
  components,
}: ProgressChartProps) {
  const enrolled = stats.total_enrolled;
  const completed = stats.completed_course;
  const completionPercent = enrolled > 0 ? Math.round((completed / enrolled) * 100) : 0;

  return (
    <section className="rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-slate-200">
      <div className="flex items-center justify-between border-b border-slate-200 pb-4">
        <div>
          <h3 className="text-xl font-semibold">Tiến độ sinh viên</h3>
          <p className="mt-1 text-sm text-slate-500">
            Biểu đồ trực quan hóa số lượng sinh viên đã hoàn thành từng phần của khóa học.
          </p>
        </div>
        <BarChart3 className="h-6 w-6 text-sky-600" />
      </div>

      {/* Course completion overview */}
      <div className="mt-6">
        <div className="flex items-center gap-2">
          <School className="h-4 w-4 text-slate-500" />
          <h4 className="text-sm font-semibold text-slate-900">
            Hoàn thành toàn khóa
          </h4>
        </div>
        <div className="mt-3">
          <div className="relative h-8 overflow-hidden rounded-full bg-slate-100 ring-1 ring-inset ring-slate-200">
            <div
              className="h-full rounded-full bg-linear-to-r from-sky-500 via-sky-500 to-emerald-500 transition-all duration-1000 ease-out"
              style={{ width: `${completionPercent}%` }}
            />
          </div>
          <div className="mt-2 flex items-center justify-between text-sm">
            <span className="font-semibold text-slate-900">
              {completed}/{enrolled} sinh viên
            </span>
            <span className="font-medium text-emerald-600">
              {completionPercent}%
            </span>
          </div>
        </div>
      </div>

      {/* Module completion chart */}
      {modules.length > 0 ? (
        <div className="mt-8">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-slate-500" />
            <h4 className="text-sm font-semibold text-slate-900">
              Hoàn thành theo module
            </h4>
          </div>
          <div className="mt-4 space-y-3">
            {modules.map((module) => {
              const moduleCompleted =
                stats.module_completion_counts.find(
                  (m) => m.module_id === module.id,
                )?.completed_count ?? 0;

              return (
                <AnimatedBar
                  key={module.id}
                  value={moduleCompleted}
                  max={enrolled}
                  label={module.title}
                  color="bg-sky-400"
                />
              );
            })}
          </div>
        </div>
      ) : null}

      {/* Component completion chart */}
      {components.length > 0 ? (
        <div className="mt-8">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-slate-500" />
            <h4 className="text-sm font-semibold text-slate-900">
              Hoàn thành theo thành phần
            </h4>
          </div>

          {/* Legend */}
          <div className="mt-3 flex flex-wrap gap-4">
            {(Object.keys(TYPE_COLORS) as (keyof typeof TYPE_COLORS)[]).map(
              (type) => (
                <div key={type} className="flex items-center gap-1.5 text-xs text-slate-600">
                  <span
                    className={`inline-block h-3 w-3 rounded-full ${TYPE_COLORS[type].bg}`}
                  >
                    <span
                      className={`block h-full w-full rounded-full ${TYPE_COLORS[type].bar}`}
                    />
                  </span>
                  <span>{getComponentTypeLabel(type)}</span>
                </div>
              ),
            )}
          </div>

          <div className="mt-4 space-y-3">
            {components.map((component) => {
              const componentType = component.component_type;
              const colors = TYPE_COLORS[componentType];
              const componentCompleted =
                stats.component_completion_counts.find(
                  (c) => c.component_id === component.id,
                )?.completed_count ?? 0;

              return (
                <AnimatedBar
                  key={component.id}
                  value={componentCompleted}
                  max={enrolled}
                  label={component.title}
                  color={colors.bar}
                />
              );
            })}
          </div>
        </div>
      ) : null}

      {enrolled === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-500">
          Chưa có sinh viên nào tham gia khóa học, chưa có dữ liệu để hiển thị biểu đồ.
        </div>
      ) : null}
    </section>
  );
}

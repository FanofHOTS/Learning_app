"use client";

import { useCallback, useMemo, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  NotebookPen,
} from "lucide-react";
import { BLOOM_LEVELS, type BloomLevelKey } from "./_bloom-objectives";
import BloomRadar from "./_bloom-radar";
export type AssessmentMatrixMap = Record<BloomLevelKey, number[]>; // Bloom level → component IDs

type AssessmentComponent = {
  id: number;
  component_type: string;
  title: string;
};

export const DEFAULT_EMPTY_MATRIX: AssessmentMatrixMap = {
  remember: [],
  understand: [],
  apply: [],
  analyze: [],
  evaluate: [],
  create: [],
};

export function parseMatrix(json: string): AssessmentMatrixMap {
  try {
    const parsed = JSON.parse(json);
    const result: AssessmentMatrixMap = { ...DEFAULT_EMPTY_MATRIX };
    for (const key of Object.keys(DEFAULT_EMPTY_MATRIX) as BloomLevelKey[]) {
      if (Array.isArray(parsed[key])) {
        result[key] = parsed[key].filter(
          (id: unknown): id is number => typeof id === "number",
        );
      }
    }
    return result;
  } catch {
    return { ...DEFAULT_EMPTY_MATRIX };
  }
}

export function serializeMatrix(map: AssessmentMatrixMap): string {
  return JSON.stringify(map);
}

type MatrixProps = {
  value: string; // JSON string
  components: AssessmentComponent[];
  onChange?: (json: string) => void;
};

export default function AssessmentMatrix({
  value,
  components,
  onChange,
}: MatrixProps) {
  const matrix = useMemo(() => parseMatrix(value), [value]);

  // Only exam and assignment components can be assessed
  const assessmentComponents = useMemo(
    () =>
      components.filter(
        (c) => c.component_type === "exam" || c.component_type === "assignment",
      ),
    [components],
  );

  const toggleMapping = useCallback(
    (level: BloomLevelKey, componentId: number) => {
      if (!onChange) return;
      const current = matrix[level];
      const next = current.includes(componentId)
        ? current.filter((id) => id !== componentId)
        : [...current, componentId];
      const newMatrix = { ...matrix, [level]: next };
      onChange(serializeMatrix(newMatrix));
    },
    [matrix, onChange],
  );

  // Gap analysis
  const uncoveredLevels = useMemo(() => {
    return BLOOM_LEVELS.filter(
      (level) =>
        assessmentComponents.length > 0 && matrix[level.key].length === 0,
    ).map((l) => l.label);
  }, [assessmentComponents.length, matrix]);

  const uncoveredComponents = useMemo(() => {
    if (Object.keys(matrix).length === 0) return [];
    const allMapped = new Set<number>();
    for (const key of Object.keys(matrix) as BloomLevelKey[]) {
      for (const id of matrix[key]) {
        allMapped.add(id);
      }
    }
    return assessmentComponents.filter((c) => !allMapped.has(c.id));
  }, [matrix, assessmentComponents]);

  const totalMapped = useMemo(() => {
    const all = new Set<number>();
    for (const key of Object.keys(matrix) as BloomLevelKey[]) {
      for (const id of matrix[key]) {
        all.add(id);
      }
    }
    return all.size;
  }, [matrix]);

  const totalAssessments = assessmentComponents.length;
  const [showRadar, setShowRadar] = useState(false);

  if (assessmentComponents.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 px-5 py-6 text-center text-sm text-slate-500">
        Khóa học chưa có bài kiểm tra hoặc bài tập nào.
        <br />
        Thêm thành phần loại bài kiểm tra hoặc bài tập để sử dụng ma trận đánh giá.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-slate-900">
            🔗 Ma trận đánh giá
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            Kết nối mục tiêu Bloom với bài kiểm tra / bài tập
          </p>
        </div>
        {totalMapped > 0 && (
          <span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-medium text-sky-700">
            {totalMapped}/{totalAssessments} đã gán
          </span>
        )}
      </div>

      {/* Gap analysis alert */}
      {uncoveredLevels.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <div>
              <p className="text-sm font-medium text-amber-800">
                Cấp độ Bloom chưa được đánh giá
              </p>
              <p className="mt-1 text-xs text-amber-700">
                {uncoveredLevels.join(", ")} — Cân nhắc thêm câu hỏi ở các cấp
                độ này vào bài kiểm tra/bài tập hiện có.
              </p>
            </div>
          </div>
        </div>
      )}

      {uncoveredComponents.length > 0 && (
        <div className="rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-orange-600" />
            <div>
              <p className="text-sm font-medium text-orange-800">
                Thành phần chưa gán mục tiêu
              </p>
              <p className="mt-1 text-xs text-orange-700">
                {uncoveredComponents.length} thành phần chưa được kết nối với
                mục tiêu Bloom nào.
              </p>
            </div>
          </div>
        </div>
      )}

      {totalAssessments > 0 && totalMapped === totalAssessments && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
            <div>
              <p className="text-sm font-medium text-emerald-800">
                Đầy đủ! Tất cả thành phần đã được gán mục tiêu
              </p>
              <p className="mt-1 text-xs text-emerald-700">
                {uncoveredLevels.length > 0
                  ? `Tuy nhiên, ${uncoveredLevels.join(", ")} chưa có thành phần đánh giá tương ứng.`
                  : "Tất cả cấp độ Bloom đều có ít nhất một thành phần đánh giá."}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Matrix table */}
      <div className="overflow-x-auto rounded-2xl border border-slate-200">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="px-4 py-3 font-semibold text-slate-700">
                Cấp độ Bloom
              </th>
              {assessmentComponents.map((c) => (
                <th
                  key={c.id}
                  className="px-3 py-3 font-medium text-slate-600"
                >
                  <div className="flex items-center gap-1.5 whitespace-nowrap">
                    {c.component_type === "exam" ? (
                      <NotebookPen className="h-3.5 w-3.5 text-emerald-600" />
                    ) : (
                      <ClipboardList className="h-3.5 w-3.5 text-violet-600" />
                    )}
                    <span className="max-w-28 truncate" title={c.title}>
                      {c.title.length > 20
                        ? c.title.slice(0, 18) + "…"
                        : c.title}
                    </span>
                  </div>
                </th>
              ))}
              {onChange && (
                <th className="px-3 py-3 font-semibold text-slate-700">
                  Trạng thái
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {BLOOM_LEVELS.map((level, rowIdx) => {
              const isCovered = matrix[level.key].length > 0;
              const mappedCount = matrix[level.key].length;

              return (
                <tr
                  key={level.key}
                  className={`border-b border-slate-100 transition-colors ${
                    rowIdx % 2 === 0 ? "bg-white" : "bg-slate-50/50"
                  } ${!isCovered && assessmentComponents.length > 0 ? "bg-amber-50/50" : ""}`}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div
                        className={`flex h-6 w-6 items-center justify-center rounded-md bg-white shadow-sm ${level.iconClass}`}
                      >
                        <level.icon className="h-3.5 w-3.5" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-900">
                          {level.label}
                        </p>
                        <p className="text-xs text-slate-400">
                          {mappedCount}/{totalAssessments} TP
                        </p>
                      </div>
                    </div>
                  </td>
                  {assessmentComponents.map((c) => {
                    const isMapped = matrix[level.key].includes(c.id);
                    return (
                      <td key={c.id} className="px-3 py-3">
                        {onChange ? (
                          <button
                            type="button"
                            onClick={() => toggleMapping(level.key, c.id)}
                            className={`flex h-8 w-8 items-center justify-center rounded-lg border-2 transition-all ${
                              isMapped
                                ? "border-sky-400 bg-sky-100 text-sky-600 shadow-sm"
                                : "border-slate-200 bg-white text-slate-300 hover:border-sky-300 hover:bg-sky-50"
                            }`}
                            title={
                              isMapped
                                ? `Bỏ gán ${level.label}`
                                : `Gán ${level.label}`
                            }
                          >
                            {isMapped ? (
                              <CheckCircle2 className="h-4 w-4" />
                            ) : (
                              <span className="text-xs">—</span>
                            )}
                          </button>
                        ) : (
                          <div className="flex justify-center">
                            {isMapped ? (
                              <CheckCircle2 className="h-5 w-5 text-sky-500" />
                            ) : (
                              <span className="text-sm text-slate-300">—</span>
                            )}
                          </div>
                        )}
                      </td>
                    );
                  })}
                  {onChange && (
                    <td className="px-3 py-3">
                      {isCovered ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                          <CheckCircle2 className="h-3 w-3" /> {mappedCount} TP
                        </span>
                      ) : (
                        <span className="text-xs text-amber-600">
                          <AlertTriangle className="mr-0.5 inline-block h-3 w-3" />
                          Thiếu
                        </span>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Radar chart toggle */}
      <div className="flex justify-center">
        <button
          type="button"
          onClick={() => setShowRadar(!showRadar)}
          className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-600 shadow-sm transition-colors hover:bg-slate-50 hover:text-slate-800"
        >
          <BarChart3 className="h-3.5 w-3.5" />
          <span>{showRadar ? "Ẩn biểu đồ" : "Xem biểu đồ coverage"}</span>
          {showRadar ? (
            <ChevronUp className="h-3.5 w-3.5" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" />
          )}
        </button>
      </div>

      {showRadar && (
        <BloomRadar matrix={matrix} totalAssessments={totalAssessments} />
      )}

      {/* Coverage summary */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
          <p className="text-xs text-slate-500">Tổng số thành phần</p>
          <p className="mt-1 text-lg font-semibold text-slate-900">
            {totalAssessments}
          </p>
        </div>
        <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3">
          <p className="text-xs text-sky-600">Đã gán mục tiêu</p>
          <p className="mt-1 text-lg font-semibold text-sky-900">
            {totalMapped}
          </p>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-xs text-amber-600">Cấp độ Bloom được đánh giá</p>
          <p className="mt-1 text-lg font-semibold text-amber-900">
            {
              BLOOM_LEVELS.filter((l) => matrix[l.key].length > 0).length
            }
            /6
          </p>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs text-slate-500">
        <span className="flex items-center gap-1">
          <NotebookPen className="h-3.5 w-3.5 text-emerald-600" />
          Bài kiểm tra
        </span>
        <span className="flex items-center gap-1">
          <ClipboardList className="h-3.5 w-3.5 text-violet-600" />
          Bài tập
        </span>
      </div>
    </div>
  );
}

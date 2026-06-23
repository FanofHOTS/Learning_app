"use client";

import { useMemo } from "react";
import { AlertTriangle, CheckCircle2, Crosshair } from "lucide-react";
import { BLOOM_LEVELS } from "./_bloom-objectives";
import { parseBloomObjectives } from "./_bloom-objectives";
import { parseMatrix } from "./_assessment-matrix";

type BloomGapAlertProps = {
  bloomObjectivesJson: string;
  assessmentMatrixJson: string;
  /** Nếu có ít nhất 1 component (exam/assignment), đánh giá có ý nghĩa */
  hasAssessmentComponents: boolean;
};

export default function BloomGapAlert({
  bloomObjectivesJson,
  assessmentMatrixJson,
  hasAssessmentComponents,
}: BloomGapAlertProps) {
  const gaps = useMemo(() => {
    const objectives = parseBloomObjectives(bloomObjectivesJson);
    const matrix = parseMatrix(assessmentMatrixJson);

    // Gap 1: có mục tiêu nhưng không có assessment
    const objectivesWithoutAssessment = BLOOM_LEVELS.filter(
      (level) => objectives[level.key].length > 0 && matrix[level.key].length === 0,
    );

    // Gap 2: có assessment nhưng không có mục tiêu
    const assessmentWithoutObjectives = BLOOM_LEVELS.filter(
      (level) => matrix[level.key].length > 0 && objectives[level.key].length === 0,
    );

    // Tổng số mục tiêu
    const totalObjectives = Object.values(objectives).reduce(
      (sum, items) => sum + items.length,
      0,
    );

    // Số cấp độ Bloom có mục tiêu
    const levelsWithObjectives = BLOOM_LEVELS.filter(
      (l) => objectives[l.key].length > 0,
    ).length;

    // Số cấp độ Bloom có assessment
    const levelsWithAssessments = BLOOM_LEVELS.filter(
      (l) => matrix[l.key].length > 0,
    ).length;

    const isFullyAligned =
      totalObjectives > 0 &&
      hasAssessmentComponents &&
      objectivesWithoutAssessment.length === 0 &&
      assessmentWithoutObjectives.length === 0;

    const isEmpty =
      totalObjectives === 0 && !hasAssessmentComponents;

    return {
      objectivesWithoutAssessment,
      assessmentWithoutObjectives,
      totalObjectives,
      levelsWithObjectives,
      levelsWithAssessments,
      isFullyAligned,
      isEmpty,
    };
  }, [bloomObjectivesJson, assessmentMatrixJson, hasAssessmentComponents]);

  if (gaps.isEmpty) return null;

  // Trạng thái hoàn hảo
  if (gaps.isFullyAligned) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
        <div className="flex items-start gap-2">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
          <div>
            <p className="text-sm font-medium text-emerald-800">
              🎯 Mục tiêu Bloom và đánh giá đã khớp
            </p>
            <p className="mt-1 text-xs text-emerald-700">
              {gaps.totalObjectives} mục tiêu trên {gaps.levelsWithObjectives}/6 cấp độ —
              tất cả đều có bài kiểm tra/bài tập đánh giá tương ứng.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Gap 1: có mục tiêu nhưng chưa có assessment */}
      {gaps.objectivesWithoutAssessment.length > 0 && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3">
          <div className="flex items-start gap-2">
            <Crosshair className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
            <div>
              <p className="text-sm font-medium text-rose-800">
                ⚠️ Mục tiêu chưa có bài đánh giá
              </p>
              <p className="mt-1 text-xs text-rose-700">
                Bạn đã đặt mục tiêu ở cấp độ{" "}
                <strong>
                  {gaps.objectivesWithoutAssessment.map((l) => l.label).join(", ")}
                </strong>{" "}
                nhưng chưa có bài kiểm tra/bài tập nào đánh giá các cấp độ này.
                {hasAssessmentComponents
                  ? " Hãy gán bài kiểm tra/bài tập hiện có vào ma trận đánh giá."
                  : " Hãy thêm bài kiểm tra hoặc bài tập trước."}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Gap 2: có assessment nhưng chưa có mục tiêu */}
      {gaps.assessmentWithoutObjectives.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <div>
              <p className="text-sm font-medium text-amber-800">
                📋 Có đánh giá nhưng chưa có mục tiêu
              </p>
              <p className="mt-1 text-xs text-amber-700">
                Cấp độ{" "}
                <strong>
                  {gaps.assessmentWithoutObjectives.map((l) => l.label).join(", ")}
                </strong>{" "}
                có bài kiểm tra/bài tập được gán nhưng chưa có mục tiêu học tập tương ứng.
                Hãy thêm mục tiêu cho các cấp độ này trong phần Mục tiêu Bloom.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tóm tắt nhanh */}
      {!gaps.isFullyAligned && (gaps.totalObjectives > 0 || hasAssessmentComponents) && (
        <div className="flex items-center gap-3 rounded-2xl bg-slate-50 px-4 py-2.5 text-xs text-slate-500">
          <span>
            🎯 {gaps.levelsWithObjectives}/6 cấp độ có mục tiêu
          </span>
          <span className="text-slate-300">·</span>
          <span>
            📊 {gaps.levelsWithAssessments}/6 cấp độ có đánh giá
          </span>
        </div>
      )}
    </div>
  );
}

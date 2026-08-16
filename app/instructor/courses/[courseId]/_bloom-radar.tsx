"use client";

import { useMemo } from "react";
import { BLOOM_LEVELS } from "./_bloom-objectives";
import type { AssessmentMatrixMap } from "./_assessment-matrix";

type BloomRadarProps = {
  matrix: AssessmentMatrixMap;
  totalAssessments: number;
};

// Hexagon vertex math
function vertex(index: number, radius: number, cx: number, cy: number) {
  const angle = (index * 60 - 90) * (Math.PI / 180);
  return {
    x: cx + radius * Math.cos(angle),
    y: cy + radius * Math.sin(angle),
  };
}

function polygonPoints(radius: number, cx: number, cy: number) {
  return Array.from({ length: 6 }, (_, i) => {
    const v = vertex(i, radius, cx, cy);
    return `${v.x},${v.y}`;
  }).join(" ");
}

function dataPoints(
  values: number[],
  maxVal: number,
  radius: number,
  cx: number,
  cy: number,
) {
  return values
    .map((val, i) => {
      const r = maxVal > 0 ? (val / maxVal) * radius : 0;
      const v = vertex(i, Math.max(r, 0), cx, cy);
      return `${v.x},${v.y}`;
    })
    .join(" ");
}

export default function BloomRadar({ matrix, totalAssessments }: BloomRadarProps) {
  const cx = 200;
  const cy = 200;
  const maxRadius = 140;
  const labelRadius = 175;
  const valueRadius = 118;

  const values = useMemo(
    () => BLOOM_LEVELS.map((l) => matrix[l.key].length),
    [matrix],
  );

  const maxVal = useMemo(
    () => Math.max(1, ...values),
    [values],
  );

  const gridRadii = useMemo(
    () => [0.25, 0.5, 0.75, 1].map((f) => maxRadius * f),
    [maxRadius],
  );

  const coveredCount = useMemo(
    () => values.filter((v) => v > 0).length,
    [values],
  );

  if (totalAssessments === 0) return null;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h4 className="text-sm font-semibold text-slate-900">
            🎯 Biểu đồ coverage theo mức độ Bloom
          </h4>
          <p className="mt-0.5 text-xs text-slate-500">
            Số lượng thành phần đánh giá gán cho mỗi mức độ
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="rounded-full bg-sky-100 px-2.5 py-1 font-medium text-sky-700">
            {coveredCount}/6
          </span>
          <span className="text-slate-400">mức độ</span>
        </div>
      </div>

      <svg
        viewBox="0 0 400 400"
        className="mx-auto h-auto w-full max-w-[320px]"
        role="img"
        aria-label="Biểu đồ radar coverage đánh giá theo 6 mức độ Bloom"
      >
        {/* Grid hexagons */}
        {gridRadii.map((r) => (
          <polygon
            key={r}
            points={polygonPoints(r, cx, cy)}
            fill="none"
            stroke="#e2e8f0"
            strokeWidth={1}
          />
        ))}

        {/* Axes lines */}
        {Array.from({ length: 6 }, (_, i) => {
          const v = vertex(i, maxRadius, cx, cy);
          return (
            <line
              key={i}
              x1={cx}
              y1={cy}
              x2={v.x}
              y2={v.y}
              stroke="#e2e8f0"
              strokeWidth={1}
            />
          );
        })}

        {/* Data polygon fill */}
        <polygon
          points={dataPoints(values, maxVal, maxRadius, cx, cy)}
          fill="rgba(14, 165, 233, 0.12)"
          stroke="rgba(14, 165, 233, 0.6)"
          strokeWidth={2}
          strokeLinejoin="round"
        />

        {/* Data points and value labels */}
        {values.map((val, i) => {
          const r = maxVal > 0 ? (val / maxVal) * maxRadius : 0;
          const v = vertex(i, Math.max(r, 0), cx, cy);
          const labelV = vertex(i, valueRadius, cx, cy);
          const hasValue = val > 0;

          return (
            <g key={i}>
              {hasValue && (
                <>
                  <circle cx={v.x} cy={v.y} r={5} fill="#0ea5e9" stroke="white" strokeWidth={2} />
                  <text
                    x={labelV.x}
                    y={labelV.y}
                    textAnchor="middle"
                    dominantBaseline="central"
                    className="text-[11px] font-bold"
                    fill="#0ea5e9"
                  >
                    {val}
                  </text>
                </>
              )}
            </g>
          );
        })}

        {/* Axis labels */}
        {BLOOM_LEVELS.map((level, i) => {
          const v = vertex(i, labelRadius, cx, cy);
          const isLeft = v.x < cx - 10;
          const isRight = v.x > cx + 10;
          const textAnchor = isLeft ? "end" : isRight ? "start" : "middle";
          const offsetX = isLeft ? -6 : isRight ? 6 : 0;
          const offsetY = v.y < cy - 5 ? -4 : v.y > cy + 5 ? 4 : 0;

          return (
            <g key={level.key}>
              <text
                x={v.x + offsetX}
                y={v.y + offsetY}
                textAnchor={textAnchor}
                dominantBaseline="central"
                className="text-[11px] font-medium"
                fill="#475569"
              >
                {level.label}
              </text>
            </g>
          );
        })}

        {/* Center value */}
        <text
          x={cx}
          y={cy}
          textAnchor="middle"
          dominantBaseline="central"
          className="text-[22px] font-bold"
          fill="#0f172a"
        >
          {coveredCount}
        </text>
        <text
          x={cx}
          y={cy + 18}
          textAnchor="middle"
          dominantBaseline="central"
          className="text-[9px]"
          fill="#94a3b8"
        >
          /6
        </text>
      </svg>

      {/* Color legend by Bloom level */}
      <div className="mt-2 grid grid-cols-3 gap-1.5 text-xs text-slate-600">
        {BLOOM_LEVELS.map((level, i) => {
          const dotColors = [
            "bg-sky-500",
            "bg-blue-500",
            "bg-indigo-500",
            "bg-violet-500",
            "bg-amber-500",
            "bg-emerald-500",
          ];
          return (
            <div key={level.key} className="flex items-center gap-1.5">
              <span className={`inline-block h-2.5 w-2.5 rounded-full ${dotColors[i]}`} />
              <span className="truncate">
                {level.label}: {values[i]}
              </span>
            </div>
          );
        })}
      </div>

      {/* Progress bar */}
      <div className="mt-3">
        <div className="relative h-2 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-linear-to-r from-sky-400 via-sky-500 to-emerald-500 transition-all duration-700"
            style={{ width: `${(coveredCount / 6) * 100}%` }}
          />
        </div>
        <div className="mt-1 flex items-center justify-between text-[10px] text-slate-400">
          <span>0/6</span>
          <span className="font-medium text-slate-600">
            {coveredCount === 6
              ? "Toàn diện 🎉"
              : coveredCount >= 4
                ? "Khá tốt ✅"
                : coveredCount >= 2
                  ? "Đang phát triển 📈"
                  : "Cần cải thiện ⚠️"}
          </span>
          <span>6/6</span>
        </div>
      </div>
    </div>
  );
}



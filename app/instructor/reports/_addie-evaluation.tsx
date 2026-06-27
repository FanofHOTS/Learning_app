"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import {
  BarChart3,
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  FileDown,
  GraduationCap,
  Lightbulb,
  LoaderCircle,
  Square,
  SquareCheck,
  Target,
  TrendingUp,
  Users,
} from "lucide-react";
import type { InstructorReportData } from "../../lib/api_instructor_reports";

type AddieDimension = {
  id: string;
  label: string;
  icon: typeof Lightbulb;
  description: string;
  score: number;
  maxScore: number;
  status: "excellent" | "good" | "needs-improvement" | "critical";
  evaluation: string;
  recommendations: string[];
};

type AddieResult = {
  overallScore: number;
  overallStatus: AddieDimension["status"];
  dimensions: AddieDimension[];
  summary: string;
};

const SCORE_THRESHOLDS = {
  excellent: 85,
  good: 65,
  "needs-improvement": 45,
} as const;

function computeStatus(score: number, maxScore: number): AddieDimension["status"] {
  const pct = maxScore > 0 ? (score / maxScore) * 100 : 0;
  if (pct >= SCORE_THRESHOLDS.excellent) return "excellent";
  if (pct >= SCORE_THRESHOLDS.good) return "good";
  if (pct >= SCORE_THRESHOLDS["needs-improvement"]) return "needs-improvement";
  return "critical";
}

function computeOverallStatus(dimensions: AddieDimension[]): AddieDimension["status"] {
  const avg =
    dimensions.reduce((s, d) => s + (d.maxScore > 0 ? (d.score / d.maxScore) * 100 : 0), 0) /
    dimensions.length;
  if (avg >= SCORE_THRESHOLDS.excellent) return "excellent";
  if (avg >= SCORE_THRESHOLDS.good) return "good";
  if (avg >= SCORE_THRESHOLDS["needs-improvement"]) return "needs-improvement";
  return "critical";
}

function computeAddieResult(data: InstructorReportData): AddieResult {
  const { summary, courses } = data;

  // === 1. Formative Evaluation (Đánh giá quá trình) ===
  // Measures: assessment distribution across courses, exam attempts vs students
  const totalCoursesWithExams = courses.filter((c) => c.totalExamAttempts > 0).length;
  const formativeScore = Math.min(
    100,
    Math.round(
      (totalCoursesWithExams / Math.max(1, courses.length)) * 40 +
        (summary.overallCompletionRate > 0 ? (summary.overallCompletionRate / 100) * 30 : 0) +
        (summary.examPassRate > 50 ? 30 : summary.examPassRate > 30 ? 20 : 10),
    ),
  );

  // === 2. Summative Evaluation (Đánh giá tổng kết) ===
  // Measures: completion rates, exam pass rates, average scores
  const summativeScore = Math.min(
    100,
    Math.round(
      (Math.min(summary.overallCompletionRate, 100) * 0.35 +
        Math.min(summary.examPassRate, 100) * 0.35 +
        Math.min((summary.averageCourseScore / 100) * 100, 100) * 0.3),
    ),
  );

  // === 3. Learner Progression & Engagement (Tiến độ & tương tác) ===
  // Measures: unique students vs total students, drop-off rate
  const totalEnrolled = courses.reduce((s, c) => s + c.uniqueStudents, 0);
  const totalCompleted = courses.reduce((s, c) => s + c.completedProgressRecords, 0);
  const progressionScore = Math.min(
    100,
    Math.round(
      (totalEnrolled > 0 ? Math.min((totalCompleted / totalEnrolled) * 50, 50) : 0) +
        (summary.uniqueStudentsCount > 0
          ? Math.min(
              (summary.completedCourseProgressCount / summary.uniqueStudentsCount) * 50,
              50,
            )
          : 0),
    ),
  );

  // === 4. Assessment Quality & Alignment (Chất lượng đánh giá) ===
  // Measures: exam pass rate (meaningful assessment), score spread
  const assessmentQualityScore = Math.min(
    100,
    Math.round(
      (summary.examPassRate >= 40 && summary.examPassRate <= 85 ? 40 : 20) +
        (summary.averageCourseScore >= 50 ? 30 : 10) +
        (courses.some((c) => c.totalExamAttempts > 5) ? 30 : 10),
    ),
  );

  // === 5. Data Completeness & Actionability (Tính đầy đủ dữ liệu) ===
  // Measures: how many courses have progress data, exam data
  const coursesWithProgress = courses.filter((c) => c.totalProgressRecords > 0).length;
  const dataCompletenessScore = Math.min(
    100,
    Math.round(
      ((coursesWithProgress / Math.max(1, courses.length)) * 40 +
        (totalCoursesWithExams / Math.max(1, courses.length)) * 30 +
        (summary.totalExamAttempts > 0 ? 30 : 0)),
    ),
  );

  // Build dimension objects
  const formativeDim: AddieDimension = {
    id: "formative",
    label: "Đánh giá quá trình (Formative)",
    icon: ClipboardCheck,
    description:
      "Mức độ phân bổ bài kiểm tra, đánh giá thường xuyên xuyên suốt khóa học để đo tiến bộ người học.",
    score: formativeScore,
    maxScore: 100,
    status: computeStatus(formativeScore, 100),
    evaluation:
      formativeScore >= 80
        ? `Khóa học có ${totalCoursesWithExams}/${courses.length} khóa có bài kiểm tra, đạt tỉ lệ hoàn thành ${summary.overallCompletionRate.toFixed(1)}% — cho thấy hệ thống đánh giá quá trình đang hoạt động tốt.`
        : formativeScore >= 60
          ? `Có ${totalCoursesWithExams}/${courses.length} khóa có bài kiểm tra, tỉ lệ hoàn thành ${summary.overallCompletionRate.toFixed(1)}%. Cần tăng cường phân bổ kiểm tra đều các module.`
          : `Chỉ ${totalCoursesWithExams}/${courses.length} khóa có bài kiểm tra. Cần bổ sung đánh giá thường xuyên hơn để theo dõi tiến bộ sinh viên.`,
    recommendations:
      formativeScore >= 80
        ? [
            "Duy trì phân bổ bài kiểm tra đều đặn giữa các module.",
            "Thêm câu hỏi tự luận ngắn để đánh giá sâu hơn.",
            "Tích hợp phản hồi tự động sau mỗi bài kiểm tra.",
          ]
        : formativeScore >= 60
          ? [
              "Phân bổ ít nhất một bài kiểm tra cho mỗi module trong khóa học.",
              "Thiết kế bài kiểm tra ngắn (5-10 câu) cuối mỗi module.",
              "Sử dụng kết quả kiểm tra để điều chỉnh nội dung giảng dạy.",
            ]
          : [
              "Bổ sung bài kiểm tra vào các module còn thiếu.",
              "Bắt đầu với bài kiểm tra ngắn ở module đầu tiên để tạo thói quen.",
              "Theo dõi tỉ lệ hoàn thành bài kiểm tra để phát hiện sớm sinh viên yếu.",
            ],
  };

  const summativeDim: AddieDimension = {
    id: "summative",
    label: "Đánh giá tổng kết (Summative)",
    icon: Target,
    description:
      "Đo lường kết quả đầu ra: tỉ lệ hoàn thành khóa học, điểm số, tỉ lệ đạt bài kiểm tra cuối.",
    score: summativeScore,
    maxScore: 100,
    status: computeStatus(summativeScore, 100),
    evaluation:
      summativeScore >= 80
        ? `Kết quả tổng kết rất tốt: tỉ lệ hoàn thành ${summary.overallCompletionRate.toFixed(1)}%, tỉ lệ đạt kiểm tra ${summary.examPassRate.toFixed(1)}%, điểm TB ${summary.averageCourseScore.toFixed(1)}/100.`
        : summativeScore >= 60
          ? `Kết quả tổng kết ở mức khá: tỉ lệ hoàn thành ${summary.overallCompletionRate.toFixed(1)}%, tỉ lệ đạt kiểm tra ${summary.examPassRate.toFixed(1)}%. Cần cải thiện để đạt chuẩn đầu ra.`
          : `Kết quả tổng kết cần cải thiện: tỉ lệ hoàn thành ${summary.overallCompletionRate.toFixed(1)}%, tỉ lệ đạt kiểm tra ${summary.examPassRate.toFixed(1)}%. Xem xét lại chuẩn đầu ra và nội dung đào tạo.`,
    recommendations:
      summativeScore >= 80
        ? [
            "Đối chiếu kết quả với mục tiêu học tập ban đầu để xác nhận đạt chuẩn.",
            "Phân tích điểm yếu theo từng module để cải tiến nội dung.",
            "Khảo sát ý kiến sinh viên về chất lượng khóa học.",
          ]
        : summativeScore >= 60
          ? [
              "Rà soát lại chuẩn đầu ra và đảm bảo bài kiểm tra cuối khóa đánh giá đúng mục tiêu.",
              "Xem xét điều chỉnh điểm đạt (pass_score) nếu quá cao hoặc quá thấp.",
              "Bổ sung tài liệu ôn tập trước bài kiểm tra tổng kết.",
            ]
          : [
              "Đánh giá lại toàn bộ chuẩn đầu ra khóa học.",
              "Kiểm tra độ khó và độ phù hợp của bài kiểm tra cuối khóa.",
              "Xem xét thiết kế lại nội dung các module có tỉ lệ hoàn thành thấp.",
            ],
  };

  const progressionDim: AddieDimension = {
    id: "progression",
    label: "Tiến độ & Tương tác",
    icon: TrendingUp,
    description:
      "Đo lường mức độ sinh viên duy trì tiến độ, tỉ lệ hoàn thành so với tham gia ban đầu.",
    score: progressionScore,
    maxScore: 100,
    status: computeStatus(progressionScore, 100),
    evaluation:
      progressionScore >= 80
        ? `${summary.uniqueStudentsCount} sinh viên tham gia, ${summary.completedCourseProgressCount} tiến độ đã hoàn thành — tỉ lệ duy trì tốt.`
        : progressionScore >= 60
          ? `${summary.uniqueStudentsCount} sinh viên tham gia, ${summary.completedCourseProgressCount} hoàn thành. Cần theo dõi tỉ lệ rơi rụng giữa chừng.`
          : `Tỉ lệ hoàn thành thấp so với số sinh viên tham gia (${summary.uniqueStudentsCount}). Cần khảo sát nguyên nhân bỏ học giữa chừng.`,
    recommendations:
      progressionScore >= 80
        ? [
            "Duy trì cấu trúc module hợp lý giúp sinh viên giữ nhịp học.",
            "Ghi nhận sinh viên xuất sắc để làm gương và khuyến khích.",
            "Theo dõi điểm rơi phổ biến để tinh chỉnh độ dài module.",
          ]
        : progressionScore >= 60
          ? [
              "Xác định module có tỉ lệ bỏ học cao nhất và điều chỉnh nội dung.",
              "Thêm thông báo nhắc nhở khi sinh viên không hoạt động quá 3 ngày.",
              "Chia nhỏ module dài thành các phần ngắn hơn để dễ tiếp thu.",
            ]
          : [
              "Khảo sát sinh viên bỏ học giữa chừng để hiểu nguyên nhân.",
              "Thiết kế lại module đầu tiên để tạo trải nghiệm tích cực ngay từ đầu.",
              "Cân nhắc giảm độ dài hoặc độ khó của khóa học.",
            ],
  };

  const qualityDim: AddieDimension = {
    id: "assessment-quality",
    label: "Chất lượng & Độ phủ đánh giá",
    icon: CheckCircle2,
    description:
      "Đánh giá chất lượng bài kiểm tra: độ khó phù hợp, khả năng phân loại sinh viên, bao phủ mục tiêu.",
    score: assessmentQualityScore,
    maxScore: 100,
    status: computeStatus(assessmentQualityScore, 100),
    evaluation:
      assessmentQualityScore >= 80
        ? `Tỉ lệ đạt ${summary.examPassRate.toFixed(1)}% ở mức hợp lý, điểm TB ${summary.averageCourseScore.toFixed(1)} — bài kiểm tra có độ phân biệt tốt.`
        : assessmentQualityScore >= 60
          ? `Tỉ lệ đạt ${summary.examPassRate.toFixed(1)}% và điểm TB ${summary.averageCourseScore.toFixed(1)}. Cần kiểm tra nếu quá nhiều sinh viên đạt điểm tuyệt đối hoặc quá thấp.`
          : `Tỉ lệ đạt ${summary.examPassRate.toFixed(1)}% cần xem xét lại. Kiểm tra nếu bài kiểm tra quá khó hoặc quá dễ so với nội dung giảng dạy.`,
    recommendations:
      assessmentQualityScore >= 80
        ? [
            "Duy trì độ khó ổn định và phân bổ câu hỏi theo các cấp độ Bloom.",
            "Bổ sung câu hỏi tình huống để đánh giá khả năng ứng dụng.",
            "Rà soát định kỳ ngân hàng câu hỏi để loại bỏ câu hỏi mờ hoặc sai.",
          ]
        : assessmentQualityScore >= 60
          ? [
              "Kiểm tra độ khó từng câu hỏi dựa trên tỉ lệ trả lời đúng.",
              "Cân bằng giữa câu hỏi dễ, trung bình và khó (tỉ lệ 30-50-20).",
              "Đảm bảo mỗi bài kiểm tra có ít nhất 10 câu hỏi để đủ tin cậy.",
            ]
          : [
              "Xem xét lại toàn bộ ngân hàng câu hỏi — loại bỏ câu hỏi quá khó hoặc mơ hồ.",
              "Chuẩn hóa điểm đạt (pass_score) theo chuẩn 50-60% tổng điểm.",
              "Thêm câu hỏi trắc nghiệm nhiều lựa chọn để dễ chấm và phân tích.",
            ],
  };

  const dataQualityDim: AddieDimension = {
    id: "data-completeness",
    label: "Tính đầy đủ dữ liệu",
    icon: BarChart3,
    description:
      "Đánh giá mức độ đầy đủ của dữ liệu để đưa ra quyết định cải tiến khóa học.",
    score: dataCompletenessScore,
    maxScore: 100,
    status: computeStatus(dataCompletenessScore, 100),
    evaluation:
      dataCompletenessScore >= 80
        ? `${coursesWithProgress}/${courses.length} khóa có dữ liệu tiến độ, ${totalCoursesWithExams} khóa có dữ liệu kiểm tra. Dữ liệu khá đầy đủ.`
        : dataCompletenessScore >= 60
          ? `${coursesWithProgress}/${courses.length} khóa có dữ liệu tiến độ. Cần thu thập thêm dữ liệu kiểm tra.`
          : `Chưa có đủ dữ liệu ở nhiều khóa học để đánh giá toàn diện. Cần khuyến khích sinh viên tham gia kiểm tra.`,
    recommendations:
      dataCompletenessScore >= 80
        ? [
            "Tiếp tục duy trì thu thập dữ liệu đều đặn.",
            "Bổ sung khảo sát ý kiến sinh viên cuối khóa (Level 1 Kirkpatrick).",
            "Phân tích dữ liệu theo từng kỳ học để phát hiện xu hướng.",
          ]
        : dataCompletenessScore >= 60
          ? [
              "Kích hoạt thu thập dữ liệu cho các khóa học chưa có.",
              "Đảm bảo mỗi khóa học có ít nhất một bài kiểm tra để có dữ liệu đánh giá.",
              "Theo dõi số lượng sinh viên tham gia để có đủ mẫu thống kê.",
            ]
          : [
              "Tập trung thu thập dữ liệu cơ bản: tiến độ học tập và kết quả kiểm tra.",
              "Công bố khóa học để sinh viên có thể tham gia và tạo dữ liệu.",
              "Bắt đầu với một khóa học mẫu để xây dựng quy trình đánh giá.",
            ],
  };

  const dimensions = [
    formativeDim,
    summativeDim,
    progressionDim,
    qualityDim,
    dataQualityDim,
  ];

  const overallStatus = computeOverallStatus(dimensions);
  const overallScore = Math.round(
    dimensions.reduce((s, d) => s + (d.maxScore > 0 ? (d.score / d.maxScore) * 100 : 0), 0) /
      dimensions.length,
  );

  const summaryText: Record<AddieDimension["status"], string> = {
    excellent:
      `Hệ thống đánh giá đạt chuẩn ADDIE (E) ở mức ${overallScore}/100 — Xuất sắc! Khóa học của bạn có cấu trúc đánh giá quá trình và tổng kết tốt, dữ liệu đầy đủ để ra quyết định cải tiến. Tiếp tục duy trì và tinh chỉnh theo khuyến nghị bên dưới.`,
    good:
      `Hệ thống đánh giá đạt chuẩn ADDIE (E) ở mức ${overallScore}/100 — Khá tốt. Các khía cạnh đánh giá cơ bản đã được đáp ứng. Tập trung cải thiện các mục điểm thấp để nâng lên mức Xuất sắc.`,
    "needs-improvement":
      `Hệ thống đánh giá đạt chuẩn ADDIE (E) ở mức ${overallScore}/100 — Cần cải thiện. Một số khía cạnh đánh giá quá trình hoặc tổng kết chưa đạt yêu cầu. Ưu tiên thực hiện các khuyến nghị cho mục có điểm thấp nhất.`,
    critical:
      `Hệ thống đánh giá đạt chuẩn ADDIE (E) ở mức ${overallScore}/100 — Cần can thiệp khẩn! Hệ thống đánh giá chưa đáp ứng yêu cầu cơ bản. Cần xây dựng lại cấu trúc đánh giá từ nền tảng theo các khuyến nghị.`,
  };

  return {
    overallScore,
    overallStatus,
    dimensions,
    summary: summaryText[overallStatus],
  };
}

function StatusBadge({ status }: { status: AddieDimension["status"] }) {
  const classes: Record<AddieDimension["status"], string> = {
    excellent: "bg-emerald-100 text-emerald-700 border-emerald-300",
    good: "bg-sky-100 text-sky-700 border-sky-300",
    "needs-improvement": "bg-amber-100 text-amber-700 border-amber-300",
    critical: "bg-rose-100 text-rose-700 border-rose-300",
  };

  const labels: Record<AddieDimension["status"], string> = {
    excellent: "Xuất sắc",
    good: "Khá tốt",
    "needs-improvement": "Cần cải thiện",
    critical: "Khẩn cấp",
  };

  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold ${classes[status]}`}
    >
      {labels[status]}
    </span>
  );
}

function ScoreGauge({ score, size = "md" }: { score: number; size?: "sm" | "md" | "lg" }) {
  const color =
    score >= 85
      ? "stroke-emerald-500"
      : score >= 65
        ? "stroke-sky-500"
        : score >= 45
          ? "stroke-amber-500"
          : "stroke-rose-500";
  const circumference = size === "lg" ? 251.2 : size === "sm" ? 125.6 : 188.4;
  const offset = circumference - (score / 100) * circumference;
  const dimensions = size === "lg" ? 96 : size === "sm" ? 48 : 72;

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={dimensions} height={dimensions} className="-rotate-90">
        <circle
          cx={dimensions / 2}
          cy={dimensions / 2}
          r={circumference / (2 * Math.PI)}
          fill="none"
          stroke="currentColor"
          strokeWidth={size === "sm" ? 4 : 6}
          className="text-slate-200"
        />
        <circle
          cx={dimensions / 2}
          cy={dimensions / 2}
          r={circumference / (2 * Math.PI)}
          fill="none"
          strokeWidth={size === "sm" ? 4 : 6}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={`transition-all duration-1000 ease-out ${color}`}
        />
      </svg>
      <span
        className={`absolute font-semibold ${size === "sm" ? "text-sm" : size === "lg" ? "text-2xl" : "text-lg"}`}
      >
        {score}
      </span>
    </div>
  );
}

function DimensionCard({
  dimension,
  isSelected,
  onToggle,
}: {
  dimension: AddieDimension;
  isSelected: boolean;
  onToggle: () => void;
}) {
  const Icon = dimension.icon;

  return (
    <div
      data-dim-id={dimension.id}
      className={`rounded-3xl border p-5 shadow-sm transition-all ${
        isSelected
          ? "border-slate-200 bg-white hover:shadow-md"
          : "border-slate-100 bg-slate-50/50 opacity-50"
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onToggle}
            className="flex h-5 w-5 items-center justify-center rounded-md border-2 transition-colors"
            aria-label={isSelected ? "Bỏ chọn" : "Chọn"}
          >
            {isSelected ? (
              <SquareCheck className="h-5 w-5 text-indigo-600" />
            ) : (
              <Square className="h-5 w-5 text-slate-300" />
            )}
          </button>
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-50">
            <Icon className="h-5 w-5 text-sky-600" />
          </div>
        </div>
        <ScoreGauge score={dimension.score} size="sm" />
      </div>

      <h4 className="mt-4 text-base font-semibold text-slate-900">{dimension.label}</h4>
      <p className="mt-1 text-xs leading-5 text-slate-500">{dimension.description}</p>

      <div className="mt-3">
        <StatusBadge status={dimension.status} />
      </div>

      <p className="mt-3 text-sm leading-6 text-slate-700">{dimension.evaluation}</p>

      <div className="mt-4 space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Khuyến nghị
        </p>
        {dimension.recommendations.map((rec, idx) => (
          <div key={idx} className="flex gap-2 text-sm leading-5 text-slate-600">
            <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
            <span>{rec}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AddieEvaluation({ data }: { data: InstructorReportData }) {
  const result = useMemo(() => computeAddieResult(data), [data]);
  const sectionRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [pdfOrientation, setPdfOrientation] = useState<"portrait" | "landscape">("portrait");

  // Selection state for customizable export
  const allDimIds = useMemo(
    () => result.dimensions.map((d) => d.id),
    [result.dimensions],
  );
  const [selectedDimIds, setSelectedDimIds] = useState<Set<string>>(
    new Set(allDimIds),
  );
  const allSelected = selectedDimIds.size === allDimIds.length;

  const toggleDim = useCallback((id: string) => {
    setSelectedDimIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    setSelectedDimIds((prev) =>
      prev.size === allDimIds.length ? new Set() : new Set(allDimIds),
    );
  }, [allDimIds]);

  async function handleExportPDF() {
    if (!sectionRef.current || isExporting) return;

    // Temporarily hide unselected dimensions for PDF capture
    const grid = sectionRef.current.querySelector<HTMLDivElement>(
      "[data-dimension-grid]",
    );
    const cards: HTMLDivElement[] = [];

    if (grid) {
      grid.querySelectorAll<HTMLDivElement>("div").forEach((card) => {
        cards.push(card);
        if (!selectedDimIds.has(card.dataset.dimId ?? "")) {
          card.style.display = "none";
        }
      });
    }

    setIsExporting(true);
    try {
      const html2canvas = (await import("html2canvas-pro")).default;
      const { default: jsPDF } = await import("jspdf");
      const element = sectionRef.current;

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        scrollY: 0,
        windowHeight: element.scrollHeight,
      });

      const pdf = new jsPDF({
        unit: "mm",
        format: "a4",
        orientation: pdfOrientation,
      });

      const margin = 10;
      const contentWidth = pdf.internal.pageSize.getWidth() - margin * 2;
      const contentHeight = pdf.internal.pageSize.getHeight() - margin * 2;

      const canvasWidth = canvas.width;
      const canvasHeight = canvas.height;

      // Scale canvas to fit PDF content width
      const scale = contentWidth / canvasWidth;
      const scaledHeight = canvasHeight * scale;

      if (scaledHeight <= contentHeight) {
        // Single page
        pdf.addImage(
          canvas.toDataURL("image/jpeg", 0.95),
          "JPEG",
          margin,
          margin,
          contentWidth,
          scaledHeight,
        );
      } else {
        // Multi-page: split canvas into page-sized slices
        const pageHeightPx = contentHeight / scale;
        let yOffset = 0;
        let pageNum = 0;

        while (yOffset < canvasHeight) {
          if (pageNum > 0) pdf.addPage();

          const sliceHeight = Math.min(pageHeightPx, canvasHeight - yOffset);
          const pageCanvas = document.createElement("canvas");
          pageCanvas.width = canvasWidth;
          pageCanvas.height = sliceHeight;

          const ctx = pageCanvas.getContext("2d")!;
          ctx.drawImage(
            canvas,
            0, yOffset, canvasWidth, sliceHeight,
            0, 0, canvasWidth, sliceHeight,
          );

          pdf.addImage(
            pageCanvas.toDataURL("image/jpeg", 0.95),
            "JPEG",
            margin,
            margin,
            contentWidth,
            sliceHeight * scale,
          );

          yOffset += pageHeightPx;
          pageNum++;
        }
      }

      pdf.save(`bao_cao_ADDIE_E_${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (error) {
      console.error("PDF export failed:", error);
    } finally {
      // Restore all cards
      cards.forEach((card) => {
        card.style.display = "";
      });
      setIsExporting(false);
    }
  }

  return (
    <section
      ref={sectionRef}
      className="rounded-4xl border border-slate-200 bg-linear-to-br from-slate-50 to-white p-6 shadow-lg shadow-slate-200/60"
    >
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-indigo-700">
            <GraduationCap className="h-4 w-4" />
            Phân tích mô hình ADDIE — Giai đoạn Đánh giá (E)
          </div>
          <h3 className="mt-3 text-2xl font-semibold text-slate-950">
            Đánh giá mức độ đạt chuẩn phần E (Evaluation)
          </h3>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Mô hình ADDIE (Analysis — Design — Development — Implementation — Evaluation)
            là khung thiết kế dạy học phổ biến. Phần E (Đánh giá) bao gồm đánh giá quá trình
            (formative) và đánh giá tổng kết (summative). Dưới đây là phân tích dựa trên dữ
            liệu thực tế từ hệ thống.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() =>
              setPdfOrientation((o) => (o === "portrait" ? "landscape" : "portrait"))
            }
            className={`inline-flex items-center gap-1.5 rounded-2xl border px-3 py-2 text-xs font-semibold transition-colors ${
              pdfOrientation === "landscape"
                ? "border-indigo-200 bg-indigo-50 text-indigo-700"
                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            <span className="uppercase tracking-wide">
              {pdfOrientation === "portrait" ? "Dọc" : "Ngang"}
            </span>
          </button>

          <button
            type="button"
            onClick={handleExportPDF}
            disabled={isExporting}
            className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-semibold transition-colors ${
              isExporting
                ? "cursor-not-allowed bg-slate-300 text-slate-500"
                : "bg-indigo-600 text-white hover:bg-indigo-700"
            }`}
          >
            {isExporting ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <FileDown className="h-4 w-4" />
            )}
            <span>{isExporting ? "Đang xuất..." : "Xuất PDF"}</span>
          </button>
        </div>
      </div>

      {/* Overall Score */}
      <div className="mt-6 flex flex-col items-center gap-4 rounded-3xl border border-indigo-100 bg-indigo-50/60 px-6 py-6 sm:flex-row sm:justify-between">
        <div>
          <p className="text-sm font-medium text-indigo-700">Tổng điểm đánh giá ADDIE (E)</p>
          <div className="mt-2 flex items-center gap-3">
            <StatusBadge status={result.overallStatus} />
            <span className="text-sm text-indigo-600">/100</span>
          </div>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-indigo-800">
            {result.summary}
          </p>
        </div>
        <ScoreGauge score={result.overallScore} size="lg" />
      </div>

      {/* Dimension selection controls */}
      <div className="mt-6 flex items-center justify-between">
        <p className="text-sm text-slate-500">
          Chọn các khía cạnh muốn xuất PDF{" "}
          <span className="font-medium text-slate-700">
            ({selectedDimIds.size}/{allDimIds.length})
          </span>
        </p>
        <button
          type="button"
          onClick={toggleAll}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100"
        >
          {allSelected ? (
            <Square className="h-3.5 w-3.5" />
          ) : (
            <SquareCheck className="h-3.5 w-3.5 text-indigo-600" />
          )}
          <span>{allSelected ? "Bỏ chọn tất cả" : "Chọn tất cả"}</span>
        </button>
      </div>

      {/* Dimension Cards */}
      <div data-dimension-grid className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {result.dimensions.map((dim) => (
          <DimensionCard
            key={dim.id}
            dimension={dim}
            isSelected={selectedDimIds.has(dim.id)}
            onToggle={() => toggleDim(dim.id)}
          />
        ))}
      </div>

      {/* Footer: ADDIE reference */}
      <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 px-4 py-4">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
          <BookOpen className="h-4 w-4" />
          <span>Về mô hình ADDIE</span>
        </div>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          ADDIE là mô hình thiết kế dạy học có hệ thống gồm 5 bước: Phân tích (Analysis),
          Thiết kế (Design), Phát triển (Development), Triển khai (Implementation) và
          Đánh giá (Evaluation). Giai đoạn Đánh giá đo lường hiệu quả đào tạo thông qua
          đánh giá quá trình (formative — diễn ra liên tục) và đánh giá tổng kết
          (summative — sau khi kết thúc). Dữ liệu từ đánh giá được dùng để cải tiến các
          giai đoạn trước, tạo thành vòng lặp cải tiến liên tục.
        </p>
      </div>
    </section>
  );
}

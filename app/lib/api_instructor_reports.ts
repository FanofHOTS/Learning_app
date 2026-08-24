import type { FastAPICourse } from "./api_course";
import type {
  CourseCategoryOption,
  InstructorCourseFilterState,
} from "./api_course_instructor";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";
const USE_MOCK_REPORT_DATA =
  process.env.NEXT_PUBLIC_USE_MOCK_DATA !== "false";

type FastApiError = {
  detail?: string;
};

type ReportCourseProgressRecord = {
  course_id: number;
  user_id: number;
  module_completed: number;
  is_complete: boolean;
  final_score: number;
  completed_at?: string | null;
};

type ReportExamRecord = {
  id: number;
  title: string;
  description?: string | null;
  module_id?: number | null;
  course_id?: number | null;
  duration_minutes: number;
  total_questions: number;
  is_active: boolean;
  pass_score: number;
  max_score: number;
};

type ReportExamResultRecord = {
  id: number;
  user_id: number;
  exam_id: number;
  score: number;
  total_questions: number;
  correct_answers: number;
  is_passed: boolean;
};

type ReportCourseSource = FastAPICourse & {
  category_name: string;
  instructor_name: string;
};

type InstructorReportSource = {
  instructorId: number;
  categories: CourseCategoryOption[];
  courses: ReportCourseSource[];
  courseProgressesByCourse: Record<number, ReportCourseProgressRecord[]>;
  examsByCourse: Record<number, ReportExamRecord[]>;
  examResultsByCourse: Record<number, ReportExamResultRecord[]>;
};

export type InstructorReportTheme = "sky" | "emerald" | "amber" | "rose";

export type InstructorReportMetric = {
  id: string;
  label: string;
  value: string;
  note: string;
  theme: InstructorReportTheme;
};

export type InstructorReportCourse = ReportCourseSource & {
  totalProgressRecords: number;
  uniqueStudents: number;
  completedProgressRecords: number;
  completionRate: number;
  averageCourseScore: number;
  totalExamAttempts: number;
  passedExamAttempts: number;
  examPassRate: number;
};

export type InstructorReportSummary = {
  totalCourseCount: number;
  totalCourseProgressRecords: number;
  uniqueStudentsCount: number;
  completedCourseProgressCount: number;
  overallCompletionRate: number;
  averageCourseScore: number;
  totalExamAttempts: number;
  passedExamAttempts: number;
  examPassRate: number;
  publishedCourseCount: number;
  activeCourseCount: number;
};

export type InstructorReportData = {
  generatedAt: string;
  summary: InstructorReportSummary;
  mainMetrics: InstructorReportMetric[];
  secondaryMetrics: InstructorReportMetric[];
  categories: CourseCategoryOption[];
  levels: string[];
  courses: InstructorReportCourse[];
  highlights: string[];
};

function getEmptyInstructorReportData(): InstructorReportData {
  return {
    generatedAt: new Date().toISOString(),
    summary: {
      totalCourseCount: 0,
      totalCourseProgressRecords: 0,
      uniqueStudentsCount: 0,
      completedCourseProgressCount: 0,
      overallCompletionRate: 0,
      averageCourseScore: 0,
      totalExamAttempts: 0,
      passedExamAttempts: 0,
      examPassRate: 0,
      publishedCourseCount: 0,
      activeCourseCount: 0,
    },
    mainMetrics: [],
    secondaryMetrics: [],
    categories: [],
    levels: [],
    courses: [],
    highlights: [],
  };
}

const endpoints = {
  categories: () => `${API_BASE_URL}/category/`,
  coursesByInstructor: (instructorId: number) =>
    `${API_BASE_URL}/course/instructor/${instructorId}`,
  courseProgressByCourse: (courseId: number) =>
    `${API_BASE_URL}/course_progress/course/${courseId}`,
  examsByCourse: (courseId: number) => `${API_BASE_URL}/exam/course/${courseId}`,
  examResultsByExam: (examId: number) => `${API_BASE_URL}/exam_result/exam/${examId}`,
};

const NOT_FOUND = Symbol("not-found");

const defaultInstructorReportFilters: InstructorCourseFilterState = {
  keyword: "",
  categoryId: "all",
  isPublic: "all",
  isActive: "all",
  level: "all",
};

function roundToOneDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}

function clampPercentage(value: number): number {
  return roundToOneDecimal(Math.min(100, Math.max(0, value)));
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return roundToOneDecimal(
    values.reduce((total, current) => total + current, 0) / values.length,
  );
}

function formatPercent(value: number): string {
  return `${value.toFixed(Number.isInteger(value) ? 0 : 1)}%`;
}

async function parseError(response: Response): Promise<string> {
  try {
    const error = (await response.json()) as FastApiError;
    if (typeof error.detail === "string" && error.detail.trim()) {
      return error.detail;
    }
  } catch {
    // Giữ nguyên thông báo mặc định nếu phản hồi không có JSON hợp lệ.
  }

  return "Không thể kết nối tới máy chủ FastAPI.";
}

async function getJson<T>(
  url: string,
  fallbackWhenNotFound: T | typeof NOT_FOUND = NOT_FOUND,
): Promise<T> {
  const response = await fetch(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (response.status === 404 && fallbackWhenNotFound !== NOT_FOUND) {
    return fallbackWhenNotFound as T;
  }

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  return (await response.json()) as T;
}

function buildCourseRows(source: InstructorReportSource): InstructorReportCourse[] {
  return source.courses.map((course) => {
    const courseProgresses = source.courseProgressesByCourse[course.id] ?? [];
    const examResults = source.examResultsByCourse[course.id] ?? [];
    const uniqueStudents = new Set(
      courseProgresses.map((courseProgress) => courseProgress.user_id),
    );
    const completedCourseProgressCount = courseProgresses.filter(
      (courseProgress) => courseProgress.is_complete,
    ).length;
    const passedExamAttempts = examResults.filter((examResult) => examResult.is_passed)
      .length;

    return {
      ...course,
      totalProgressRecords: courseProgresses.length,
      uniqueStudents: uniqueStudents.size,
      completedProgressRecords: completedCourseProgressCount,
      completionRate:
        courseProgresses.length > 0
          ? clampPercentage(
              (completedCourseProgressCount / courseProgresses.length) * 100,
            )
          : 0,
      averageCourseScore: average(
        courseProgresses
          .filter((courseProgress) => courseProgress.final_score > 0)
          .map((courseProgress) => courseProgress.final_score),
      ),
      totalExamAttempts: examResults.length,
      passedExamAttempts,
      examPassRate:
        examResults.length > 0
          ? clampPercentage((passedExamAttempts / examResults.length) * 100)
          : 0,
    };
  });
}

function buildSummaryFromRows(
  courses: InstructorReportCourse[],
  progressSources: Record<number, ReportCourseProgressRecord[]>,
): InstructorReportSummary {
  const allProgressRecords = courses.reduce(
    (total, course) => total + course.totalProgressRecords,
    0,
  );
  const uniqueUsers = new Set<number>();

  courses.forEach((course) => {
    const courseProgresses = progressSources[course.id] ?? [];
    courseProgresses.forEach((courseProgress) => {
      uniqueUsers.add(courseProgress.user_id);
    });
  });

  const completedCourseProgressCount = courses.reduce(
    (total, course) => total + course.completedProgressRecords,
    0,
  );
  const totalExamAttempts = courses.reduce(
    (total, course) => total + course.totalExamAttempts,
    0,
  );
  const passedExamAttempts = courses.reduce(
    (total, course) => total + course.passedExamAttempts,
    0,
  );

  return {
    totalCourseCount: courses.length,
    totalCourseProgressRecords: allProgressRecords,
    uniqueStudentsCount: uniqueUsers.size,
    completedCourseProgressCount,
    overallCompletionRate:
      allProgressRecords > 0
        ? clampPercentage((completedCourseProgressCount / allProgressRecords) * 100)
        : 0,
    averageCourseScore: average(
        courses
          .filter((course) => course.completedProgressRecords > 0)
          .map((course) => course.averageCourseScore),
      ),
    totalExamAttempts,
    passedExamAttempts,
    examPassRate:
      totalExamAttempts > 0
        ? clampPercentage((passedExamAttempts / totalExamAttempts) * 100)
        : 0,
    publishedCourseCount: courses.filter((course) => course.is_public).length,
    activeCourseCount: courses.filter((course) => course.is_active).length,
  };
}

function buildMainMetrics(
  summary: InstructorReportSummary,
): InstructorReportMetric[] {
  return [
    {
      id: "course-progress-records",
      label: "Tổng số tiến độ học khóa học",
      value: `${summary.totalCourseProgressRecords}`,
      note: "Tổng số bản ghi tiến độ học tập liên quan tới các khóa học do giảng viên mở.",
      theme: "sky",
    },
    {
      id: "unique-students",
      label: "Số lượng sinh viên thật sự tham gia",
      value: `${summary.uniqueStudentsCount}`,
      note: "Đếm theo số lượng sinh viên thực tế tham gia các khóa học của bạn.",
      theme: "emerald",
    },
    {
      id: "completed-progress-records",
      label: "Số lượng tiến độ khóa học đã hoàn thành",
      value: `${summary.completedCourseProgressCount}`,
      note: "Tổng số bản ghi tiến độ có trạng thái đã hoàn thành.",
      theme: "amber",
    },
    {
      id: "overall-completion-rate",
      label: "Tỉ lệ hoàn thành khóa học chung",
      value: formatPercent(summary.overallCompletionRate),
      note: "Tính trên toàn bộ tiến độ khóa học của sinh viên trong các khóa học này.",
      theme: "sky",
    },
    {
      id: "average-course-score",
      label: "Điểm trung bình các khóa học",
      value: `${summary.averageCourseScore.toFixed(1)}`,
      note: "Lấy trung bình điểm cuối khóa của từng khóa học do giảng viên mở.",
      theme: "rose",
    },
    {
      id: "total-exam-attempts",
      label: "Tổng số lần kiểm tra",
      value: `${summary.totalExamAttempts}`,
      note: "Tổng số lượt làm bài kiểm tra trên tất cả các khóa học của giảng viên.",
      theme: "amber",
    },
    {
      id: "passed-exam-attempts",
      label: "Số lần kiểm tra đạt",
      value: `${summary.passedExamAttempts}`,
      note: "Tổng số lượt làm bài có kết quả đạt yêu cầu.",
      theme: "emerald",
    },
    {
      id: "exam-pass-rate",
      label: "Tỉ lệ đạt bài kiểm tra",
      value: formatPercent(summary.examPassRate),
      note: "Tỉ lệ đạt trên toàn bộ số lần kiểm tra của các khóa học đang hoạt động.",
      theme: "rose",
    },
  ];
}

function buildSecondaryMetrics(
  summary: InstructorReportSummary,
): InstructorReportMetric[] {
  return [
    {
      id: "total-courses",
      label: "Tổng số khóa học đang theo dõi",
      value: `${summary.totalCourseCount}`,
      note: "Bao gồm tất cả các khóa học do giảng viên mở có trong báo cáo.",
      theme: "sky",
    },
    {
      id: "published-courses",
      label: "Số khóa học đã công bố",
      value: `${summary.publishedCourseCount}`,
      note: "Số khóa học đang ở trạng thái công bố cho người học.",
      theme: "emerald",
    },
    {
      id: "active-courses",
      label: "Số khóa học đang kích hoạt",
      value: `${summary.activeCourseCount}`,
      note: "Số khóa học vẫn đang ở trạng thái hoạt động.",
      theme: "amber",
    },
  ];
}

function buildHighlights(
  summary: InstructorReportSummary,
  courses: InstructorReportCourse[],
): string[] {
  const bestCompletionCourse = [...courses].sort(
    (left, right) => right.completionRate - left.completionRate,
  )[0];
  const hasAnyCompletionData = courses.some((c) => c.completionRate > 0);
  const largestClassCourse = [...courses].sort(
    (left, right) => right.uniqueStudents - left.uniqueStudents,
  )[0];

  const highlights = [
    `Giảng viên hiện có ${summary.totalCourseProgressRecords} bản ghi tiến độ học tập từ ${summary.uniqueStudentsCount} sinh viên thực sự tham gia.`,
    `Tỉ lệ hoàn thành khóa học chung đang ở mức ${formatPercent(summary.overallCompletionRate)} và tỉ lệ đạt bài kiểm tra đạt ${formatPercent(summary.examPassRate)}.`,
  ];

  if (bestCompletionCourse && hasAnyCompletionData) {
    highlights.push(
      `Khóa học có tỉ lệ hoàn thành cao nhất hiện tại là "${bestCompletionCourse.title}" với mức ${formatPercent(bestCompletionCourse.completionRate)}.`,
    );
  }

  if (largestClassCourse) {
    highlights.push(
      `Khóa học có nhiều sinh viên tham gia nhất là "${largestClassCourse.title}" với ${largestClassCourse.uniqueStudents} sinh viên.`,
    );
  }

  return highlights;
}

function buildInstructorReportData(
  source: InstructorReportSource,
): InstructorReportData {
  const courses = buildCourseRows(source).sort(
    (left, right) => right.uniqueStudents - left.uniqueStudents,
  );
  const summary = buildSummaryFromRows(courses, source.courseProgressesByCourse);

  return {
    generatedAt: new Date().toISOString(),
    summary,
    mainMetrics: buildMainMetrics(summary),
    secondaryMetrics: buildSecondaryMetrics(summary),
    categories: source.categories,
    levels: getInstructorReportLevels(courses),
    courses,
    highlights: buildHighlights(summary, courses),
  };
}

const mockCategories: CourseCategoryOption[] = [
  {
    id: 1,
    name: "Lập trình web",
    description: "Các khóa học về giao diện, hệ thống web và tích hợp API.",
  },
  {
    id: 2,
    name: "Trí tuệ nhân tạo",
    description: "Các khóa học về AI, tạo câu hỏi và đánh giá bằng mô hình thông minh.",
  },
  {
    id: 3,
    name: "Khoa học dữ liệu",
    description: "Các khóa học về phân tích dữ liệu, trực quan hóa và báo cáo.",
  },
];

const mockCourses: ReportCourseSource[] = [
  {
    id: 301,
    title: "Xây dựng ứng dụng học tập với Next.js",
    category_id: 1,
    category_name: "Lập trình web",
    instructor_id: 7,
    instructor_name: "Nguyễn Thiên Long",
    introduction: "Tạo giao diện học tập trực tuyến với Next.js và Tailwind CSS.",
    description: "Khóa học hướng dẫn xây dựng khu vực sinh viên, giảng viên và báo cáo tiến độ.",
    level: "Trung bình",
    total_module: 6,
    total_student: 120,
    image: "/logo.png",
    is_active: true,
    is_public: true,
  },
  {
    id: 302,
    title: "Thiết kế ngân hàng câu hỏi bằng AI",
    category_id: 2,
    category_name: "Trí tuệ nhân tạo",
    instructor_id: 7,
    instructor_name: "Nguyễn Thiên Long",
    introduction: "Tạo câu hỏi kiểm tra từ nội dung bài học bằng AI.",
    description: "Khóa học tập trung vào quy trình tạo, đánh giá và tinh chỉnh ngân hàng câu hỏi.",
    level: "Nâng cao",
    total_module: 4,
    total_student: 60,
    image: "/logo.png",
    is_active: true,
    is_public: false,
  },
  {
    id: 303,
    title: "Phân tích dữ liệu học tập cho giảng viên",
    category_id: 3,
    category_name: "Khoa học dữ liệu",
    instructor_id: 7,
    instructor_name: "Nguyễn Thiên Long",
    introduction: "Đọc dữ liệu học tập và phát hiện điểm nghẽn trong hành trình học của sinh viên.",
    description: "Khóa học giúp giảng viên tạo dashboard theo dõi chất lượng học tập theo thời gian.",
    level: "Cơ bản",
    total_module: 5,
    total_student: 78,
    image: "/logo.png",
    is_active: false,
    is_public: false,
  },
  {
    id: 304,
    title: "Quản trị khóa học trực tuyến quy mô lớn",
    category_id: 1,
    category_name: "Lập trình web",
    instructor_id: 7,
    instructor_name: "Nguyễn Thiên Long",
    introduction: "Quản lý cấu trúc khóa học, nội dung và quy trình vận hành số lượng lớn sinh viên.",
    description: "Khóa học phục vụ giảng viên cần tổ chức nhiều lớp học trên cùng hệ thống.",
    level: "Trung bình",
    total_module: 8,
    total_student: 234,
    image: "/logo.png",
    is_active: true,
    is_public: true,
  },
  {
    id: 305,
    title: "Đánh giá kết quả học tập bằng dữ liệu",
    category_id: 3,
    category_name: "Khoa học dữ liệu",
    instructor_id: 7,
    instructor_name: "Nguyễn Thiên Long",
    introduction: "Xây dựng chỉ số chất lượng dạy học từ dữ liệu tiến độ và kiểm tra.",
    description: "Khóa học thiên về tạo báo cáo và đưa ra quyết định cải tiến khóa học.",
    level: "Nâng cao",
    total_module: 7,
    total_student: 88,
    image: "/logo.png",
    is_active: true,
    is_public: true,
  },
  {
    id: 306,
    title: "Tổ chức học phần và bài kiểm tra hiệu quả",
    category_id: 1,
    category_name: "Lập trình web",
    instructor_id: 7,
    instructor_name: "Nguyễn Thiên Long",
    introduction: "Cấu trúc lại module, học phần và chuỗi bài kiểm tra theo mục tiêu học tập.",
    description: "Khóa học tập trung vào cải thiện trải nghiệm học và giảm rơi rụng giữa chừng.",
    level: "Cơ bản",
    total_module: 5,
    total_student: 69,
    image: "/logo.png",
    is_active: false,
    is_public: true,
  },
  {
    id: 307,
    title: "Thiết kế dashboard cho giảng viên",
    category_id: 3,
    category_name: "Khoa học dữ liệu",
    instructor_id: 7,
    instructor_name: "Nguyễn Thiên Long",
    introduction: "Xây dashboard theo dõi học tập phục vụ giảng viên và quản trị viên.",
    description: "Khóa học giúp xây dựng trang báo cáo trực quan, rõ tín hiệu và dễ hành động.",
    level: "Trung bình",
    total_module: 6,
    total_student: 94,
    image: "/logo.png",
    is_active: true,
    is_public: false,
  },
];

const mockCourseProgressesByCourse: Record<number, ReportCourseProgressRecord[]> = {
  301: [
    { course_id: 301, user_id: 101, module_completed: 6, is_complete: true, final_score: 92 },
    { course_id: 301, user_id: 102, module_completed: 6, is_complete: true, final_score: 89 },
    { course_id: 301, user_id: 103, module_completed: 4, is_complete: false, final_score: 80 },
    { course_id: 301, user_id: 104, module_completed: 5, is_complete: false, final_score: 84 },
    { course_id: 301, user_id: 105, module_completed: 6, is_complete: true, final_score: 94 },
    { course_id: 301, user_id: 106, module_completed: 3, is_complete: false, final_score: 76 },
  ],
  302: [
    { course_id: 302, user_id: 102, module_completed: 4, is_complete: true, final_score: 90 },
    { course_id: 302, user_id: 107, module_completed: 2, is_complete: false, final_score: 72 },
    { course_id: 302, user_id: 108, module_completed: 4, is_complete: true, final_score: 87 },
    { course_id: 302, user_id: 109, module_completed: 3, is_complete: false, final_score: 78 },
    { course_id: 302, user_id: 110, module_completed: 4, is_complete: true, final_score: 91 },
  ],
  303: [
    { course_id: 303, user_id: 101, module_completed: 5, is_complete: true, final_score: 86 },
    { course_id: 303, user_id: 111, module_completed: 5, is_complete: true, final_score: 88 },
    { course_id: 303, user_id: 112, module_completed: 1, is_complete: false, final_score: 65 },
    { course_id: 303, user_id: 113, module_completed: 3, is_complete: false, final_score: 73 },
  ],
  304: [
    { course_id: 304, user_id: 103, module_completed: 8, is_complete: true, final_score: 95 },
    { course_id: 304, user_id: 104, module_completed: 6, is_complete: false, final_score: 82 },
    { course_id: 304, user_id: 105, module_completed: 7, is_complete: false, final_score: 88 },
    { course_id: 304, user_id: 114, module_completed: 8, is_complete: true, final_score: 91 },
    { course_id: 304, user_id: 115, module_completed: 8, is_complete: true, final_score: 90 },
    { course_id: 304, user_id: 116, module_completed: 5, is_complete: false, final_score: 77 },
    { course_id: 304, user_id: 117, module_completed: 8, is_complete: true, final_score: 93 },
  ],
  305: [
    { course_id: 305, user_id: 101, module_completed: 7, is_complete: true, final_score: 93 },
    { course_id: 305, user_id: 118, module_completed: 6, is_complete: false, final_score: 84 },
    { course_id: 305, user_id: 119, module_completed: 7, is_complete: true, final_score: 89 },
    { course_id: 305, user_id: 120, module_completed: 4, is_complete: false, final_score: 75 },
    { course_id: 305, user_id: 121, module_completed: 7, is_complete: true, final_score: 90 },
  ],
  306: [
    { course_id: 306, user_id: 122, module_completed: 5, is_complete: true, final_score: 86 },
    { course_id: 306, user_id: 123, module_completed: 2, is_complete: false, final_score: 67 },
    { course_id: 306, user_id: 124, module_completed: 4, is_complete: false, final_score: 78 },
    { course_id: 306, user_id: 107, module_completed: 5, is_complete: true, final_score: 88 },
  ],
  307: [
    { course_id: 307, user_id: 102, module_completed: 5, is_complete: false, final_score: 82 },
    { course_id: 307, user_id: 103, module_completed: 6, is_complete: true, final_score: 90 },
    { course_id: 307, user_id: 125, module_completed: 4, is_complete: false, final_score: 76 },
    { course_id: 307, user_id: 126, module_completed: 6, is_complete: true, final_score: 92 },
    { course_id: 307, user_id: 127, module_completed: 3, is_complete: false, final_score: 70 },
  ],
};

const mockExamsByCourse: Record<number, ReportExamRecord[]> = {
  301: [
    { id: 9001, title: "Kiểm tra Next.js nền tảng", description: "Kiểm tra khái niệm cơ bản.", module_id: 30101, course_id: 301, duration_minutes: 25, total_questions: 15, is_active: true, pass_score: 50, max_score: 100 },
    { id: 9002, title: "Kiểm tra tích hợp API", description: "Kiểm tra kết nối dữ liệu.", module_id: 30104, course_id: 301, duration_minutes: 30, total_questions: 20, is_active: true, pass_score: 55, max_score: 100 },
  ],
  302: [
    { id: 9011, title: "Kiểm tra phân loại câu hỏi", description: "Đánh giá loại câu hỏi phù hợp.", module_id: 30202, course_id: 302, duration_minutes: 20, total_questions: 12, is_active: true, pass_score: 50, max_score: 100 },
    { id: 9012, title: "Kiểm tra phản biện đầu ra AI", description: "Đánh giá chất lượng ngân hàng câu hỏi.", module_id: 30204, course_id: 302, duration_minutes: 25, total_questions: 14, is_active: true, pass_score: 55, max_score: 100 },
  ],
  303: [
    { id: 9021, title: "Kiểm tra đọc báo cáo học tập", description: "Diễn giải tín hiệu từ dashboard.", module_id: 30303, course_id: 303, duration_minutes: 20, total_questions: 10, is_active: true, pass_score: 50, max_score: 100 },
  ],
  304: [
    { id: 9031, title: "Kiểm tra điều phối khóa học", description: "Tình huống vận hành lớp đông.", module_id: 30404, course_id: 304, duration_minutes: 30, total_questions: 18, is_active: true, pass_score: 55, max_score: 100 },
    { id: 9032, title: "Kiểm tra quản trị module", description: "Theo dõi chuỗi module và nội dung.", module_id: 30407, course_id: 304, duration_minutes: 30, total_questions: 18, is_active: true, pass_score: 55, max_score: 100 },
  ],
  305: [
    { id: 9041, title: "Kiểm tra KPI khóa học", description: "Xây dựng và đọc chỉ số chất lượng.", module_id: 30505, course_id: 305, duration_minutes: 25, total_questions: 16, is_active: true, pass_score: 55, max_score: 100 },
    { id: 9042, title: "Kiểm tra tối ưu báo cáo", description: "Tối ưu cấu trúc báo cáo học tập.", module_id: 30507, course_id: 305, duration_minutes: 25, total_questions: 16, is_active: true, pass_score: 55, max_score: 100 },
  ],
  306: [
    { id: 9051, title: "Kiểm tra thiết kế học phần", description: "Sắp xếp học phần hợp lý.", module_id: 30603, course_id: 306, duration_minutes: 20, total_questions: 12, is_active: true, pass_score: 50, max_score: 100 },
  ],
  307: [
    { id: 9061, title: "Kiểm tra thiết kế dashboard", description: "Đánh giá cấu trúc dashboard.", module_id: 30703, course_id: 307, duration_minutes: 25, total_questions: 15, is_active: true, pass_score: 55, max_score: 100 },
    { id: 9062, title: "Kiểm tra đọc dữ liệu tổng hợp", description: "Đọc chỉ số đa nguồn.", module_id: 30706, course_id: 307, duration_minutes: 25, total_questions: 15, is_active: true, pass_score: 55, max_score: 100 },
  ],
};

const mockExamResultsByCourse: Record<number, ReportExamResultRecord[]> = {
  301: [
    { id: 1, user_id: 101, exam_id: 9001, score: 88, total_questions: 15, correct_answers: 13, is_passed: true },
    { id: 2, user_id: 103, exam_id: 9001, score: 64, total_questions: 15, correct_answers: 10, is_passed: true },
    { id: 3, user_id: 104, exam_id: 9002, score: 52, total_questions: 20, correct_answers: 11, is_passed: false },
    { id: 4, user_id: 105, exam_id: 9002, score: 86, total_questions: 20, correct_answers: 17, is_passed: true },
    { id: 5, user_id: 106, exam_id: 9002, score: 58, total_questions: 20, correct_answers: 12, is_passed: true },
  ],
  302: [
    { id: 6, user_id: 102, exam_id: 9011, score: 78, total_questions: 12, correct_answers: 9, is_passed: true },
    { id: 7, user_id: 107, exam_id: 9011, score: 49, total_questions: 12, correct_answers: 5, is_passed: false },
    { id: 8, user_id: 108, exam_id: 9012, score: 84, total_questions: 14, correct_answers: 11, is_passed: true },
    { id: 9, user_id: 110, exam_id: 9012, score: 89, total_questions: 14, correct_answers: 12, is_passed: true },
  ],
  303: [
    { id: 10, user_id: 101, exam_id: 9021, score: 76, total_questions: 10, correct_answers: 8, is_passed: true },
    { id: 11, user_id: 112, exam_id: 9021, score: 40, total_questions: 10, correct_answers: 4, is_passed: false },
    { id: 12, user_id: 113, exam_id: 9021, score: 60, total_questions: 10, correct_answers: 6, is_passed: true },
  ],
  304: [
    { id: 13, user_id: 103, exam_id: 9031, score: 91, total_questions: 18, correct_answers: 16, is_passed: true },
    { id: 14, user_id: 104, exam_id: 9031, score: 65, total_questions: 18, correct_answers: 11, is_passed: true },
    { id: 15, user_id: 114, exam_id: 9032, score: 93, total_questions: 18, correct_answers: 17, is_passed: true },
    { id: 16, user_id: 116, exam_id: 9032, score: 51, total_questions: 18, correct_answers: 9, is_passed: false },
    { id: 17, user_id: 117, exam_id: 9032, score: 87, total_questions: 18, correct_answers: 15, is_passed: true },
  ],
  305: [
    { id: 18, user_id: 101, exam_id: 9041, score: 92, total_questions: 16, correct_answers: 15, is_passed: true },
    { id: 19, user_id: 118, exam_id: 9041, score: 55, total_questions: 16, correct_answers: 9, is_passed: true },
    { id: 20, user_id: 119, exam_id: 9042, score: 81, total_questions: 16, correct_answers: 13, is_passed: true },
    { id: 21, user_id: 120, exam_id: 9042, score: 46, total_questions: 16, correct_answers: 7, is_passed: false },
    { id: 22, user_id: 121, exam_id: 9042, score: 88, total_questions: 16, correct_answers: 14, is_passed: true },
  ],
  306: [
    { id: 23, user_id: 122, exam_id: 9051, score: 75, total_questions: 12, correct_answers: 9, is_passed: true },
    { id: 24, user_id: 123, exam_id: 9051, score: 42, total_questions: 12, correct_answers: 4, is_passed: false },
    { id: 25, user_id: 124, exam_id: 9051, score: 63, total_questions: 12, correct_answers: 7, is_passed: true },
  ],
  307: [
    { id: 26, user_id: 102, exam_id: 9061, score: 70, total_questions: 15, correct_answers: 10, is_passed: true },
    { id: 27, user_id: 103, exam_id: 9061, score: 90, total_questions: 15, correct_answers: 14, is_passed: true },
    { id: 28, user_id: 125, exam_id: 9062, score: 50, total_questions: 15, correct_answers: 8, is_passed: false },
    { id: 29, user_id: 126, exam_id: 9062, score: 91, total_questions: 15, correct_answers: 14, is_passed: true },
    { id: 30, user_id: 127, exam_id: 9062, score: 54, total_questions: 15, correct_answers: 8, is_passed: false },
  ],
};

function getMockInstructorReportData(instructorId: number): InstructorReportData {
  return buildInstructorReportData({
    instructorId,
    categories: mockCategories,
    courses: mockCourses.map((course) => ({
      ...course,
      instructor_id: instructorId,
    })),
    courseProgressesByCourse: mockCourseProgressesByCourse,
    examsByCourse: mockExamsByCourse,
    examResultsByCourse: mockExamResultsByCourse,
  });
}

async function getLiveInstructorReportData(
  instructorId: number,
): Promise<InstructorReportData> {
  const [categories, courses] = await Promise.all([
    getJson<CourseCategoryOption[]>(endpoints.categories(), []),
    getJson<FastAPICourse[]>(endpoints.coursesByInstructor(instructorId), []),
  ]);

  const categoryMap = new Map(categories.map((category) => [category.id, category]));

  const courseEntries = await Promise.all(
    courses.map(async (course) => {
      const [courseProgresses, exams] = await Promise.all([
        getJson<ReportCourseProgressRecord[]>(
          endpoints.courseProgressByCourse(course.id),
          [],
        ),
        getJson<ReportExamRecord[]>(endpoints.examsByCourse(course.id), []),
      ]);

      const examResultsLists = await Promise.all(
        exams.map((exam) =>
          getJson<ReportExamResultRecord[]>(endpoints.examResultsByExam(exam.id), []),
        ),
      );

      return {
        course: {
          ...course,
          category_name:
            categoryMap.get(course.category_id)?.name ??
            `Phân loại #${course.category_id}`,
          instructor_name: `Giảng viên #${course.instructor_id}`,
        },
        courseProgresses,
        exams,
        examResults: examResultsLists.flat(),
      };
    }),
  );

  return buildInstructorReportData({
    instructorId,
    categories,
    courses: courseEntries.map((entry) => entry.course),
    courseProgressesByCourse: Object.fromEntries(
      courseEntries.map((entry) => [entry.course.id, entry.courseProgresses]),
    ) as Record<number, ReportCourseProgressRecord[]>,
    examsByCourse: Object.fromEntries(
      courseEntries.map((entry) => [entry.course.id, entry.exams]),
    ) as Record<number, ReportExamRecord[]>,
    examResultsByCourse: Object.fromEntries(
      courseEntries.map((entry) => [entry.course.id, entry.examResults]),
    ) as Record<number, ReportExamResultRecord[]>,
  });
}

export function getDefaultInstructorReportFilters(): InstructorCourseFilterState {
  return { ...defaultInstructorReportFilters };
}

export function filterInstructorReportCourses(
  courses: InstructorReportCourse[],
  filters: InstructorCourseFilterState,
): InstructorReportCourse[] {
  const keyword = filters.keyword.trim().toLowerCase();

  return courses.filter((course) => {
    const matchesKeyword =
      keyword.length === 0 ||
      course.title.toLowerCase().includes(keyword) ||
      course.introduction.toLowerCase().includes(keyword) ||
      course.description.toLowerCase().includes(keyword) ||
      course.category_name.toLowerCase().includes(keyword) ||
      course.instructor_name.toLowerCase().includes(keyword);

    const matchesCategory =
      filters.categoryId === "all" ||
      `${course.category_id}` === filters.categoryId;

    const matchesPublic =
      filters.isPublic === "all" ||
      (filters.isPublic === "public" && course.is_public) ||
      (filters.isPublic === "private" && !course.is_public);

    const matchesActive =
      filters.isActive === "all" ||
      (filters.isActive === "active" && course.is_active) ||
      (filters.isActive === "inactive" && !course.is_active);

    const matchesLevel =
      filters.level === "all" || course.level === filters.level;

    return (
      matchesKeyword &&
      matchesCategory &&
      matchesPublic &&
      matchesActive &&
      matchesLevel
    );
  });
}

export function getInstructorReportLevels(
  courses: InstructorReportCourse[],
): string[] {
  return Array.from(new Set(courses.map((course) => course.level)));
}

export async function getInstructorReportData(
  instructorId: number,
): Promise<InstructorReportData> {
  if (USE_MOCK_REPORT_DATA) {
    return Promise.resolve(getMockInstructorReportData(instructorId));
  }

  try {
    return await getLiveInstructorReportData(instructorId);
  } catch {
    return getEmptyInstructorReportData();
  }
}

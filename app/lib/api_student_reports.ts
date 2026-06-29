const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";
const USE_MOCK_REPORT_DATA =
  process.env.NEXT_PUBLIC_USE_MOCK_DATA !== "false";

type FastApiError = {
  detail?: string;
};

const endpoints = {
  courseProgressByUser: (userId: number) =>
    `${API_BASE_URL}/course_progress/user/${userId}`,
  moduleProgressByUser: (userId: number) =>
    `${API_BASE_URL}/module_progress/user/${userId}`,
  examResultsByUser: (userId: number) =>
    `${API_BASE_URL}/exam_result/user/${userId}`,
  courseById: (courseId: number) => `${API_BASE_URL}/course/${courseId}`,
  examsByCourse: (courseId: number) => `${API_BASE_URL}/exam/course/${courseId}`,
  componentProgressByUserAndCourse: (userId: number, courseId: number) =>
    `${API_BASE_URL}/course_component_progress/user/${userId}/course/${courseId}`,
};

export type StudentReportTheme = "sky" | "emerald" | "amber" | "rose";

export type ReportCourseRecord = {
  id: number;
  title: string;
  category_id: number | null;
  category_name: string | null;
  instructor_id: number | null;
  instructor_name: string | null;
  introduction: string;
  description: string;
  level: string;
  total_module: number;
  total_student: number;
  image: string;
  is_active: boolean;
  is_public: boolean;
};

export type ReportCourseProgressRecord = {
  course_id: number;
  user_id: number;
  module_completed: number;
  is_complete: boolean;
  final_score: number;
  completed_at?: string | null;
};

export type ReportModuleProgressRecord = {
  course_id: number;
  module_id: number;
  user_id: number;
  components_completed: number;
  is_complete: boolean;
  completed_at?: string | null;
};

export type ReportCourseComponentProgressRecord = {
  id: number;
  user_id: number;
  course_id: number;
  module_id: number;
  course_component_id: number;
  is_completed: boolean;
  completed_at?: string | null;
};

export type ReportExamRecord = {
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

export type ReportExamResultRecord = {
  id: number;
  user_id: number;
  exam_id: number;
  score: number;
  total_questions: number;
  correct_answers: number;
  is_passed: boolean;
};

export type StudentReportMetric = {
  id: string;
  label: string;
  value: string;
  note: string;
  theme: StudentReportTheme;
};

export type StudentReportCourse = {
  courseId: number;
  title: string;
  level: string;
  progressPercent: number;
  completedModules: number;
  totalModules: number;
  completedComponents: number;
  totalComponents: number;
  totalExamAttempts: number;
  passedExamAttempts: number;
  totalCourseExams: number;
  finalScore: number;
  isComplete: boolean;
};

export type StudentReportSummary = {
  totalJoinedCourses: number;
  activeCourses: number;
  completedCourses: number;
  courseCompletionRate: number;
  totalExamAttempts: number;
  passedExamAttempts: number;
  examPassRate: number;
  totalCompletedModules: number;
  totalCompletedComponents: number;
  averageFinalScore: number;
  averageExamScore: number;
};

export type StudentReportData = {
  generatedAt: string;
  summary: StudentReportSummary;
  mainMetrics: StudentReportMetric[];
  secondaryMetrics: StudentReportMetric[];
  activeCourses: StudentReportCourse[];
  allCourses: StudentReportCourse[];
  highlights: string[];
};

type ReportSource = {
  userId: number;
  courses: ReportCourseRecord[];
  courseProgresses: ReportCourseProgressRecord[];
  moduleProgresses: ReportModuleProgressRecord[];
  componentProgressesByCourse: Record<number, ReportCourseComponentProgressRecord[]>;
  examsByCourse: Record<number, ReportExamRecord[]>;
  examResults: ReportExamResultRecord[];
};

const NOT_FOUND = Symbol("not-found");

function formatPercent(value: number): string {
  const rounded = Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1);
  return `${rounded}%`;
}

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

async function parseError(response: Response): Promise<string> {
  try {
    const error = (await response.json()) as FastApiError;
    if (typeof error.detail === "string" && error.detail.trim()) {
      return error.detail;
    }
  } catch {
    // Giữ thông báo mặc định nếu phản hồi không có JSON hợp lệ.
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

function createFallbackCourse(courseId: number): ReportCourseRecord {
  return {
    id: courseId,
    title: `Khóa học #${courseId}`,
    category_id: null,
    category_name: null,
    instructor_id: null,
    instructor_name: null,
    introduction: "Chưa có dữ liệu giới thiệu khóa học.",
    description: "Chưa có dữ liệu mô tả khóa học.",
    level: "Đang cập nhật",
    total_module: 0,
    total_student: 0,
    image: "/logo.png",
    is_active: true,
    is_public: false,
  };
}

function buildCourseReports(source: ReportSource): StudentReportCourse[] {
  const examsById = new Map<number, ReportExamRecord>();

  Object.values(source.examsByCourse).forEach((exams) => {
    exams.forEach((exam) => {
      examsById.set(exam.id, exam);
    });
  });

  const courseById = new Map(
    source.courses.map((course) => [course.id, course] satisfies [number, ReportCourseRecord]),
  );

  return source.courseProgresses.map((courseProgress) => {
    const course =
      courseById.get(courseProgress.course_id) ??
      createFallbackCourse(courseProgress.course_id);
    const componentProgresses =
      source.componentProgressesByCourse[courseProgress.course_id] ?? [];
    const courseExams = source.examsByCourse[courseProgress.course_id] ?? [];
    const courseExamIds = new Set(courseExams.map((exam) => exam.id));
    const courseExamResults = source.examResults.filter((examResult) => {
      const exam = examsById.get(examResult.exam_id);
      return exam ? courseExamIds.has(exam.id) : false;
    });

    const totalModules = Math.max(course.total_module, courseProgress.module_completed);
    const progressPercent =
      totalModules > 0
        ? clampPercentage((courseProgress.module_completed / totalModules) * 100)
        : courseProgress.is_complete
          ? 100
          : 0;

    return {
      courseId: course.id,
      title: course.title,
      level: course.level,
      progressPercent,
      completedModules: courseProgress.module_completed,
      totalModules,
      completedComponents: componentProgresses.filter(
        (componentProgress) => componentProgress.is_completed,
      ).length,
      totalComponents: componentProgresses.length,
      totalExamAttempts: courseExamResults.length,
      passedExamAttempts: courseExamResults.filter((examResult) => examResult.is_passed)
        .length,
      totalCourseExams: courseExams.length,
      finalScore: courseProgress.final_score,
      isComplete: courseProgress.is_complete,
    };
  });
}

function buildSummary(
  courseReports: StudentReportCourse[],
  moduleProgresses: ReportModuleProgressRecord[],
  examResults: ReportExamResultRecord[],
): StudentReportSummary {
  const totalJoinedCourses = courseReports.length;
  const completedCourses = courseReports.filter((course) => course.isComplete).length;
  const activeCourses = totalJoinedCourses - completedCourses;
  const passedExamAttempts = examResults.filter((result) => result.is_passed).length;

  return {
    totalJoinedCourses,
    activeCourses,
    completedCourses,
    courseCompletionRate:
      totalJoinedCourses > 0
        ? clampPercentage((completedCourses / totalJoinedCourses) * 100)
        : 0,
    totalExamAttempts: examResults.length,
    passedExamAttempts,
    examPassRate:
      examResults.length > 0
        ? clampPercentage((passedExamAttempts / examResults.length) * 100)
        : 0,
    totalCompletedModules: moduleProgresses.filter((module) => module.is_complete).length,
    totalCompletedComponents: courseReports.reduce(
      (total, course) => total + course.completedComponents,
      0,
    ),
    averageFinalScore: average(
      courseReports
        .filter((course) => course.finalScore > 0)
        .map((course) => course.finalScore),
    ),
    averageExamScore: average(
      examResults
        .filter((result) => result.score > 0)
        .map((result) => result.score),
    ),
  };
}

function buildMainMetrics(summary: StudentReportSummary): StudentReportMetric[] {
  return [
    {
      id: "joined-courses",
      label: "Số khóa học đã tham gia",
      value: `${summary.totalJoinedCourses}`,
      note: "Tổng số khóa học có dữ liệu tiến độ của sinh viên.",
      theme: "sky",
    },
    {
      id: "active-courses",
      label: "Số khóa học đang học",
      value: `${summary.activeCourses}`,
      note: "Các khóa học đang theo học nhưng chưa hoàn thành.",
      theme: "amber",
    },
    {
      id: "completed-courses",
      label: "Số khóa học đã hoàn thành",
      value: `${summary.completedCourses}`,
      note: "Các khóa học có trạng thái hoàn thành trong dữ liệu tiến độ.",
      theme: "emerald",
    },
    {
      id: "course-completion-rate",
      label: "Tỉ lệ hoàn thành khóa học",
      value: formatPercent(summary.courseCompletionRate),
      note: "Tính trên tổng số khóa học đã tham gia.",
      theme: "sky",
    },
    {
      id: "total-exam-attempts",
      label: "Tổng số lần kiểm tra",
      value: `${summary.totalExamAttempts}`,
      note: "Tổng số lần nộp kết quả bài kiểm tra của sinh viên.",
      theme: "rose",
    },
    {
      id: "passed-exam-attempts",
      label: "Số lần kiểm tra đạt",
      value: `${summary.passedExamAttempts}`,
      note: "Số lượt kiểm tra có trạng thái đạt yêu cầu.",
      theme: "emerald",
    },
    {
      id: "exam-pass-rate",
      label: "Tỉ lệ đạt bài kiểm tra",
      value: formatPercent(summary.examPassRate),
      note: "Tính trên toàn bộ số lần kiểm tra đã làm.",
      theme: "rose",
    },
    {
      id: "average-exam-score",
      label: "Điểm kiểm tra trung bình",
      value: `${summary.averageExamScore.toFixed(1)}`,
      note: "Điểm trung bình của các lượt kiểm tra đã ghi nhận.",
      theme: "sky",
    },
  ];
}

function buildSecondaryMetrics(summary: StudentReportSummary): StudentReportMetric[] {
  return [
    {
      id: "completed-modules",
      label: "Tổng module đã hoàn thành",
      value: `${summary.totalCompletedModules}`,
      note: "Dựa trên bảng tiến độ module của sinh viên.",
      theme: "emerald",
    },
    {
      id: "completed-components",
      label: "Tổng học phần đã hoàn thành",
      value: `${summary.totalCompletedComponents}`,
      note: "Dựa trên bảng tiến độ học phần trong các khóa học.",
      theme: "amber",
    },
    {
      id: "average-final-score",
      label: "Điểm cuối khóa trung bình",
      value: `${summary.averageFinalScore.toFixed(1)}`,
      note: "Tính từ trường điểm cuối khóa trong tiến độ khóa học.",
      theme: "sky",
    },
  ];
}

function buildHighlights(
  summary: StudentReportSummary,
  activeCourses: StudentReportCourse[],
): string[] {
  const mostAdvancedCourse = activeCourses[0];
  const mostExamActiveCourse = [...activeCourses].sort(
    (left, right) => right.totalExamAttempts - left.totalExamAttempts,
  )[0];

  const highlights = [
    `Sinh viên hiện đã hoàn thành ${summary.completedCourses}/${summary.totalJoinedCourses} khóa học và duy trì tỉ lệ đạt kiểm tra ${formatPercent(summary.examPassRate)}.`,
    `Tổng cộng ${summary.totalCompletedModules} module và ${summary.totalCompletedComponents} học phần đã được hoàn tất theo dữ liệu tiến độ hiện có.`,
  ];

  if (mostAdvancedCourse) {
    highlights.push(
      `Khóa học tiến xa nhất hiện tại là "${mostAdvancedCourse.title}" với mức hoàn thành ${formatPercent(mostAdvancedCourse.progressPercent)}.`,
    );
  }

  if (mostExamActiveCourse && mostExamActiveCourse.totalExamAttempts > 0) {
    highlights.push(
      `Khóa học có nhiều lượt kiểm tra nhất là "${mostExamActiveCourse.title}" với ${mostExamActiveCourse.totalExamAttempts} lượt làm bài.`,
    );
  }

  return highlights;
}

function buildStudentReportData(source: ReportSource): StudentReportData {
  const courseReports = buildCourseReports(source);
  const activeCourses = [...courseReports]
    .filter((course) => !course.isComplete)
    .sort((left, right) => right.progressPercent - left.progressPercent);
  const summary = buildSummary(
    courseReports,
    source.moduleProgresses,
    source.examResults,
  );

  return {
    generatedAt: new Date().toISOString(),
    summary,
    mainMetrics: buildMainMetrics(summary),
    secondaryMetrics: buildSecondaryMetrics(summary),
    activeCourses,
    allCourses: [...courseReports].sort(
      (left, right) => right.progressPercent - left.progressPercent,
    ),
    highlights: buildHighlights(summary, activeCourses),
  };
}

function createMockModuleProgresses(
  userId: number,
  courseId: number,
  totalModules: number,
  completedModules: number,
): ReportModuleProgressRecord[] {
  return Array.from({ length: totalModules }, (_, index) => {
    const moduleNumber = index + 1;
    const isComplete = moduleNumber <= completedModules;

    return {
      course_id: courseId,
      module_id: courseId * 100 + moduleNumber,
      user_id: userId,
      components_completed: isComplete ? 4 : moduleNumber === completedModules + 1 ? 2 : 0,
      is_complete: isComplete,
      completed_at: isComplete ? "2026-05-06T08:00:00Z" : null,
    };
  });
}

function createMockComponentProgresses(
  userId: number,
  courseId: number,
  totalModules: number,
  totalComponents: number,
  completedComponents: number,
): ReportCourseComponentProgressRecord[] {
  return Array.from({ length: totalComponents }, (_, index) => {
    const componentNumber = index + 1;
    const moduleOffset = Math.floor(index / Math.max(1, Math.ceil(totalComponents / totalModules)));

    return {
      id: courseId * 1000 + componentNumber,
      user_id: userId,
      course_id: courseId,
      module_id: courseId * 100 + moduleOffset + 1,
      course_component_id: courseId * 1000 + componentNumber,
      is_completed: componentNumber <= completedComponents,
      completed_at:
        componentNumber <= completedComponents ? "2026-05-08T08:00:00Z" : null,
    };
  });
}

const mockUserId = 1;

const mockCourses: ReportCourseRecord[] = [
  {
    id: 101,
    title: "Python căn bản cho người mới bắt đầu",
    category_id: 1,
    category_name: "Lập trình",
    instructor_id: 7,
    instructor_name: "Nguyễn Thiên Long",
    introduction: "Làm quen với cú pháp và tư duy lập trình Python.",
    description: "Khóa học giúp sinh viên xây nền tảng Python và giải bài tập cơ bản.",
    level: "Cơ bản",
    total_module: 6,
    total_student: 120,
    image: "/logo.png",
    is_active: true,
    is_public: true,
  },
  {
    id: 102,
    title: "Phát triển giao diện với Next.js",
    category_id: 1,
    category_name: "Lập trình",
    instructor_id: 7,
    instructor_name: "Nguyễn Thiên Long",
    introduction: "Xây dựng giao diện học tập hiện đại với Next.js.",
    description: "Khóa học tập trung vào App Router, dữ liệu và giao diện.",
    level: "Trung bình",
    total_module: 8,
    total_student: 96,
    image: "/logo.png",
    is_active: true,
    is_public: true,
  },
  {
    id: 103,
    title: "Cơ sở dữ liệu SQL thực hành",
    category_id: 2,
    category_name: "Cơ sở dữ liệu",
    instructor_id: 7,
    instructor_name: "Nguyễn Thiên Long",
    introduction: "Thực hành truy vấn và thiết kế dữ liệu với SQL.",
    description: "Từ câu lệnh cơ bản tới tối ưu truy vấn và báo cáo.",
    level: "Cơ bản",
    total_module: 5,
    total_student: 84,
    image: "/logo.png",
    is_active: true,
    is_public: true,
  },
  {
    id: 104,
    title: "Nhập môn Machine Learning",
    category_id: 3,
    category_name: "Trí tuệ nhân tạo",
    instructor_id: 7,
    instructor_name: "Nguyễn Thiên Long",
    introduction: "Nắm những khái niệm đầu tiên về học máy.",
    description: "Khóa học mở đầu với dữ liệu, mô hình và đánh giá.",
    level: "Trung bình",
    total_module: 7,
    total_student: 73,
    image: "/logo.png",
    is_active: true,
    is_public: true,
  },
  {
    id: 105,
    title: "Tư duy thuật toán và giải quyết vấn đề",
    category_id: 1,
    category_name: "Lập trình",
    instructor_id: 7,
    instructor_name: "Nguyễn Thiên Long",
    introduction: "Rèn luyện tư duy giải thuật qua bài toán thực tế.",
    description: "Khóa học giúp cải thiện cách phân tích và xây dựng lời giải.",
    level: "Cơ bản",
    total_module: 4,
    total_student: 110,
    image: "/logo.png",
    is_active: true,
    is_public: true,
  },
  {
    id: 106,
    title: "Phân tích dữ liệu với Pandas",
    category_id: 3,
    category_name: "Khoa học dữ liệu",
    instructor_id: 7,
    instructor_name: "Nguyễn Thiên Long",
    introduction: "Làm sạch, phân tích và trực quan hóa dữ liệu bằng Pandas.",
    description: "Thực hành xử lý dữ liệu dạng bảng cho người mới học dữ liệu.",
    level: "Trung bình",
    total_module: 6,
    total_student: 67,
    image: "/logo.png",
    is_active: true,
    is_public: true,
  },
  {
    id: 107,
    title: "Xử lý ảnh với OpenCV",
    category_id: 3,
    category_name: "Thị giác máy tính",
    instructor_id: 7,
    instructor_name: "Nguyễn Thiên Long",
    introduction: "Tìm hiểu các thao tác xử lý ảnh cơ bản và ứng dụng thực tế.",
    description: "Khóa học giới thiệu OpenCV qua nhiều bài tập thực hành nhỏ.",
    level: "Nâng cao",
    total_module: 5,
    total_student: 48,
    image: "/logo.png",
    is_active: true,
    is_public: true,
  },
  {
    id: 108,
    title: "Luyện đề kiểm tra cuối kỳ môn tin học",
    category_id: 4,
    category_name: "Luyện tập",
    instructor_id: 7,
    instructor_name: "Nguyễn Thiên Long",
    introduction: "Ôn tập theo bộ đề có cấu trúc gần với kiểm tra thật.",
    description: "Hệ thống lại kiến thức trọng tâm và luyện phản xạ làm bài.",
    level: "Cơ bản",
    total_module: 3,
    total_student: 135,
    image: "/logo.png",
    is_active: true,
    is_public: true,
  },
];

const mockCourseProgresses: ReportCourseProgressRecord[] = [
  {
    course_id: 101,
    user_id: mockUserId,
    module_completed: 6,
    is_complete: true,
    final_score: 92,
    completed_at: "2026-04-20T08:00:00Z",
  },
  {
    course_id: 102,
    user_id: mockUserId,
    module_completed: 6,
    is_complete: false,
    final_score: 88,
    completed_at: null,
  },
  {
    course_id: 103,
    user_id: mockUserId,
    module_completed: 5,
    is_complete: true,
    final_score: 90,
    completed_at: "2026-05-02T08:00:00Z",
  },
  {
    course_id: 104,
    user_id: mockUserId,
    module_completed: 4,
    is_complete: false,
    final_score: 84,
    completed_at: null,
  },
  {
    course_id: 105,
    user_id: mockUserId,
    module_completed: 3,
    is_complete: false,
    final_score: 79,
    completed_at: null,
  },
  {
    course_id: 106,
    user_id: mockUserId,
    module_completed: 2,
    is_complete: false,
    final_score: 74,
    completed_at: null,
  },
  {
    course_id: 107,
    user_id: mockUserId,
    module_completed: 1,
    is_complete: false,
    final_score: 68,
    completed_at: null,
  },
  {
    course_id: 108,
    user_id: mockUserId,
    module_completed: 2,
    is_complete: false,
    final_score: 81,
    completed_at: null,
  },
];

const mockModuleProgresses: ReportModuleProgressRecord[] = [
  ...createMockModuleProgresses(mockUserId, 101, 6, 6),
  ...createMockModuleProgresses(mockUserId, 102, 8, 6),
  ...createMockModuleProgresses(mockUserId, 103, 5, 5),
  ...createMockModuleProgresses(mockUserId, 104, 7, 4),
  ...createMockModuleProgresses(mockUserId, 105, 4, 3),
  ...createMockModuleProgresses(mockUserId, 106, 6, 2),
  ...createMockModuleProgresses(mockUserId, 107, 5, 1),
  ...createMockModuleProgresses(mockUserId, 108, 3, 2),
];

const mockComponentProgressesByCourse: Record<
  number,
  ReportCourseComponentProgressRecord[]
> = {
  101: createMockComponentProgresses(mockUserId, 101, 6, 24, 24),
  102: createMockComponentProgresses(mockUserId, 102, 8, 32, 24),
  103: createMockComponentProgresses(mockUserId, 103, 5, 20, 20),
  104: createMockComponentProgresses(mockUserId, 104, 7, 28, 16),
  105: createMockComponentProgresses(mockUserId, 105, 4, 16, 12),
  106: createMockComponentProgresses(mockUserId, 106, 6, 24, 8),
  107: createMockComponentProgresses(mockUserId, 107, 5, 20, 4),
  108: createMockComponentProgresses(mockUserId, 108, 3, 12, 8),
};

const mockExamsByCourse: Record<number, ReportExamRecord[]> = {
  101: [
    {
      id: 2001,
      title: "Kiểm tra Python giữa khóa",
      description: "Đánh giá cú pháp và cấu trúc điều khiển.",
      module_id: 10101,
      course_id: 101,
      duration_minutes: 30,
      total_questions: 20,
      is_active: true,
      pass_score: 50,
      max_score: 100,
    },
    {
      id: 2002,
      title: "Kiểm tra Python cuối khóa",
      description: "Tổng hợp bài tập lập trình Python.",
      module_id: 10106,
      course_id: 101,
      duration_minutes: 45,
      total_questions: 25,
      is_active: true,
      pass_score: 60,
      max_score: 100,
    },
  ],
  102: [
    {
      id: 2101,
      title: "Kiểm tra App Router",
      description: "Đánh giá định tuyến và cấu trúc trang.",
      module_id: 10203,
      course_id: 102,
      duration_minutes: 25,
      total_questions: 15,
      is_active: true,
      pass_score: 50,
      max_score: 100,
    },
    {
      id: 2102,
      title: "Kiểm tra dữ liệu phía client",
      description: "Đánh giá cách gọi API và quản lý trạng thái.",
      module_id: 10205,
      course_id: 102,
      duration_minutes: 30,
      total_questions: 18,
      is_active: true,
      pass_score: 55,
      max_score: 100,
    },
    {
      id: 2103,
      title: "Kiểm tra giao diện báo cáo",
      description: "Bài đánh giá tổng hợp về UI và tích hợp dữ liệu.",
      module_id: 10208,
      course_id: 102,
      duration_minutes: 35,
      total_questions: 20,
      is_active: true,
      pass_score: 60,
      max_score: 100,
    },
  ],
  103: [
    {
      id: 2201,
      title: "Kiểm tra truy vấn SQL",
      description: "Đánh giá SELECT, JOIN và GROUP BY.",
      module_id: 10303,
      course_id: 103,
      duration_minutes: 25,
      total_questions: 20,
      is_active: true,
      pass_score: 50,
      max_score: 100,
    },
  ],
  104: [
    {
      id: 2301,
      title: "Kiểm tra mô hình hồi quy",
      description: "Đánh giá kiến thức về pipeline học máy cơ bản.",
      module_id: 10404,
      course_id: 104,
      duration_minutes: 35,
      total_questions: 22,
      is_active: true,
      pass_score: 55,
      max_score: 100,
    },
    {
      id: 2302,
      title: "Kiểm tra đánh giá mô hình",
      description: "Thực hành độ chính xác, precision và recall.",
      module_id: 10406,
      course_id: 104,
      duration_minutes: 30,
      total_questions: 20,
      is_active: true,
      pass_score: 55,
      max_score: 100,
    },
  ],
  105: [
    {
      id: 2401,
      title: "Kiểm tra tư duy thuật toán",
      description: "Bài kiểm tra phân tích đề và xây dựng lời giải.",
      module_id: 10503,
      course_id: 105,
      duration_minutes: 20,
      total_questions: 12,
      is_active: true,
      pass_score: 50,
      max_score: 100,
    },
  ],
  106: [
    {
      id: 2501,
      title: "Kiểm tra làm sạch dữ liệu",
      description: "Đánh giá xử lý thiếu dữ liệu và chuyển đổi cột.",
      module_id: 10602,
      course_id: 106,
      duration_minutes: 25,
      total_questions: 15,
      is_active: true,
      pass_score: 50,
      max_score: 100,
    },
  ],
  107: [
    {
      id: 2601,
      title: "Kiểm tra thao tác ảnh cơ bản",
      description: "Đánh giá xử lý ảnh và lọc ảnh với OpenCV.",
      module_id: 10702,
      course_id: 107,
      duration_minutes: 25,
      total_questions: 14,
      is_active: true,
      pass_score: 50,
      max_score: 100,
    },
  ],
  108: [
    {
      id: 2701,
      title: "Đề luyện tập số 1",
      description: "Bài luyện tập tổng hợp kiến thức cuối kỳ.",
      module_id: 10801,
      course_id: 108,
      duration_minutes: 35,
      total_questions: 20,
      is_active: true,
      pass_score: 55,
      max_score: 100,
    },
    {
      id: 2702,
      title: "Đề luyện tập số 2",
      description: "Bài luyện tập tổng hợp lần 2.",
      module_id: 10803,
      course_id: 108,
      duration_minutes: 35,
      total_questions: 20,
      is_active: true,
      pass_score: 55,
      max_score: 100,
    },
  ],
};

const mockExamResults: ReportExamResultRecord[] = [
  { id: 1, user_id: mockUserId, exam_id: 2001, score: 85, total_questions: 20, correct_answers: 17, is_passed: true },
  { id: 2, user_id: mockUserId, exam_id: 2002, score: 91, total_questions: 25, correct_answers: 23, is_passed: true },
  { id: 3, user_id: mockUserId, exam_id: 2101, score: 78, total_questions: 15, correct_answers: 12, is_passed: true },
  { id: 4, user_id: mockUserId, exam_id: 2102, score: 62, total_questions: 18, correct_answers: 11, is_passed: true },
  { id: 5, user_id: mockUserId, exam_id: 2103, score: 58, total_questions: 20, correct_answers: 10, is_passed: false },
  { id: 6, user_id: mockUserId, exam_id: 2103, score: 81, total_questions: 20, correct_answers: 16, is_passed: true },
  { id: 7, user_id: mockUserId, exam_id: 2201, score: 88, total_questions: 20, correct_answers: 18, is_passed: true },
  { id: 8, user_id: mockUserId, exam_id: 2301, score: 73, total_questions: 22, correct_answers: 15, is_passed: true },
  { id: 9, user_id: mockUserId, exam_id: 2302, score: 49, total_questions: 20, correct_answers: 9, is_passed: false },
  { id: 10, user_id: mockUserId, exam_id: 2401, score: 67, total_questions: 12, correct_answers: 8, is_passed: true },
  { id: 11, user_id: mockUserId, exam_id: 2501, score: 54, total_questions: 15, correct_answers: 8, is_passed: true },
  { id: 12, user_id: mockUserId, exam_id: 2601, score: 45, total_questions: 14, correct_answers: 6, is_passed: false },
  { id: 13, user_id: mockUserId, exam_id: 2701, score: 76, total_questions: 20, correct_answers: 15, is_passed: true },
  { id: 14, user_id: mockUserId, exam_id: 2702, score: 83, total_questions: 20, correct_answers: 17, is_passed: true },
];

function getMockStudentReportData(userId: number): StudentReportData {
  return buildStudentReportData({
    userId,
    courses: mockCourses,
    courseProgresses: mockCourseProgresses.map((courseProgress) => ({
      ...courseProgress,
      user_id: userId,
    })),
    moduleProgresses: mockModuleProgresses.map((moduleProgress) => ({
      ...moduleProgress,
      user_id: userId,
    })),
    componentProgressesByCourse: Object.fromEntries(
      Object.entries(mockComponentProgressesByCourse).map(([courseId, progressList]) => [
        Number(courseId),
        progressList.map((progress) => ({
          ...progress,
          user_id: userId,
        })),
      ]),
    ),
    examsByCourse: mockExamsByCourse,
    examResults: mockExamResults.map((examResult) => ({
      ...examResult,
      user_id: userId,
    })),
  });
}

async function getLiveStudentReportData(userId: number): Promise<StudentReportData> {
  const [courseProgresses, moduleProgresses, examResults] = await Promise.all([
    getJson<ReportCourseProgressRecord[]>(endpoints.courseProgressByUser(userId), []),
    getJson<ReportModuleProgressRecord[]>(endpoints.moduleProgressByUser(userId), []),
    getJson<ReportExamResultRecord[]>(endpoints.examResultsByUser(userId), []),
  ]);

  const courseIds = [...new Set(courseProgresses.map((courseProgress) => courseProgress.course_id))];

  const courseEntries = await Promise.all(
    courseIds.map(async (courseId) => {
      const [course, exams, componentProgresses] = await Promise.all([
        getJson<ReportCourseRecord | null>(endpoints.courseById(courseId), null),
        getJson<ReportExamRecord[]>(endpoints.examsByCourse(courseId), []),
        getJson<ReportCourseComponentProgressRecord[]>(
          endpoints.componentProgressByUserAndCourse(userId, courseId),
          [],
        ),
      ]);

      return {
        course: course ?? createFallbackCourse(courseId),
        exams,
        componentProgresses,
      };
    }),
  );

  const courses = courseEntries.map((entry) => entry.course);
  const examsByCourse = Object.fromEntries(
    courseEntries.map((entry) => [entry.course.id, entry.exams]),
  ) as Record<number, ReportExamRecord[]>;
  const componentProgressesByCourse = Object.fromEntries(
    courseEntries.map((entry) => [entry.course.id, entry.componentProgresses]),
  ) as Record<number, ReportCourseComponentProgressRecord[]>;

  return buildStudentReportData({
    userId,
    courses,
    courseProgresses,
    moduleProgresses,
    componentProgressesByCourse,
    examsByCourse,
    examResults,
  });
}

export async function getStudentReportData(
  userId: number,
): Promise<StudentReportData> {
  if (USE_MOCK_REPORT_DATA) {
    return Promise.resolve(getMockStudentReportData(userId));
  }

  return getLiveStudentReportData(userId);
}

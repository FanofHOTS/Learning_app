import type { FastAPICourse } from "./api_course";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";
const USE_MOCK_REPORT_DATA =
  process.env.NEXT_PUBLIC_USE_MOCK_DATA !== "false";

type FastApiError = {
  detail?: string;
};

type AdminReportUser = {
  id: number;
  username: string;
  email: string;
  icon: string;
  role: string;
};

type AdminReportDocument = {
  id: number;
  title: string;
  document_type: string | null;
  content: string | null;
  file_url: string | null;
  course_id: number | null;
  module_id: number | null;
  created_at?: string;
  updated_at?: string;
};

type AdminReportExam = {
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

export type AdminMonthlyMetricKey =
  | "accountsCreated"
  | "coursesCreated"
  | "examAttempts"
  | "completedCourseProgresses";

export type AdminReportTheme = "sky" | "emerald" | "amber" | "rose";

export type AdminReportMetric = {
  id: string;
  label: string;
  value: string;
  note: string;
  theme: AdminReportTheme;
};

export type AdminMonthlySeriesPoint = {
  monthKey: string;
  monthLabel: string;
  value: number;
};

export type AdminMonthlyMetric = {
  id: AdminMonthlyMetricKey;
  label: string;
  shortLabel: string;
  description: string;
  summaryValue: number;
  summaryNote: string;
  theme: AdminReportTheme;
  data: AdminMonthlySeriesPoint[];
};

export type AdminReportsSummary = {
  totalUsers: number;
  totalStudents: number;
  totalInstructors: number;
  totalAdmins: number;
  totalCourses: number;
  totalPublishedCourses: number;
  totalDocuments: number;
  totalExams: number;
  totalMaterialsAndExams: number;
};

export type AdminReportsData = {
  generatedAt: string;
  summary: AdminReportsSummary;
  mainMetrics: AdminReportMetric[];
  monthlyMetrics: AdminMonthlyMetric[];
  highlights: string[];
  chartLibraryNote: string;
};

const endpoints = {
  users: () => `${API_BASE_URL}/user/`,
  courses: () => `${API_BASE_URL}/course/`,
  documents: () => `${API_BASE_URL}/document/`,
  exams: () => `${API_BASE_URL}/exam/`,
  courseProgresses: () => `${API_BASE_URL}/course_progress/`,
  examResults: () => `${API_BASE_URL}/exam_result/`,
};

async function parseError(response: Response): Promise<string> {
  try {
    const error = (await response.json()) as FastApiError;
    if (typeof error.detail === "string" && error.detail.trim()) {
      return error.detail;
    }
  } catch {
    // Dùng thông báo mặc định nếu không có JSON hợp lệ.
  }

  return "Không thể kết nối tới máy chủ FastAPI.";
}

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  return (await response.json()) as T;
}

function buildMainMetrics(summary: AdminReportsSummary): AdminReportMetric[] {
  return [
    {
      id: "total-users",
      label: "Tổng số người dùng trên hệ thống",
      value: `${summary.totalUsers}`,
      note: "Bao gồm toàn bộ sinh viên, giảng viên và quản trị viên hiện có.",
      theme: "sky",
    },
    {
      id: "student-users",
      label: "Số lượng sinh viên",
      value: `${summary.totalStudents}`,
      note: "Người dùng có vai trò sinh viên trong hệ thống.",
      theme: "emerald",
    },
    {
      id: "instructor-users",
      label: "Số lượng giảng viên",
      value: `${summary.totalInstructors}`,
      note: "Người dùng có vai trò giảng viên đang hoạt động trên nền tảng.",
      theme: "amber",
    },
    {
      id: "admin-users",
      label: "Số lượng quản trị viên",
      value: `${summary.totalAdmins}`,
      note: "Nhóm người dùng phụ trách quản lý và vận hành hệ thống.",
      theme: "rose",
    },
    {
      id: "total-courses",
      label: "Tổng số khóa học hiện có",
      value: `${summary.totalCourses}`,
      note: "Tất cả khóa học đã được tạo trên hệ thống ở mọi trạng thái.",
      theme: "sky",
    },
    {
      id: "published-courses",
      label: "Tổng số khóa học được công bố",
      value: `${summary.totalPublishedCourses}`,
      note: "Các khóa học hiện ở trạng thái công bố cho người học.",
      theme: "emerald",
    },
    {
      id: "total-materials-and-exams",
      label: "Tổng số tài liệu và bài kiểm tra",
      value: `${summary.totalMaterialsAndExams}`,
      note: `${summary.totalDocuments} tài liệu và ${summary.totalExams} bài kiểm tra đang có trên hệ thống.`,
      theme: "amber",
    },
  ];
}

function buildHighlights(summary: AdminReportsSummary): string[] {
  return [
    `Hệ thống hiện có ${summary.totalUsers} người dùng, trong đó ${summary.totalStudents} sinh viên là nhóm đông nhất.`,
    `Tổng cộng ${summary.totalCourses} khóa học đang được quản lý và ${summary.totalPublishedCourses} khóa học đã sẵn sàng cho người học.`,
    `Kho nội dung hiện ghi nhận ${summary.totalDocuments} tài liệu và ${summary.totalExams} bài kiểm tra phục vụ học tập.`,
  ];
}

function buildAdminReportsData(
  summary: AdminReportsSummary,
  monthlyMetrics: AdminMonthlyMetric[],
): AdminReportsData {
  return {
    generatedAt: new Date().toISOString(),
    summary,
    mainMetrics: buildMainMetrics(summary),
    monthlyMetrics,
    highlights: buildHighlights(summary),
    chartLibraryNote:
      "Trang hiện dùng SVG thuần để vẽ biểu đồ nên không cần cài thêm thư viện. Nếu muốn nâng cấp tương tác và tooltip sau này, có thể cài `recharts` bằng lệnh `npm install recharts`.",
  };
}

function createLast12MonthSeries(
  values: number[],
  referenceDate = new Date("2026-05-13T00:00:00+07:00"),
): AdminMonthlySeriesPoint[] {
  return Array.from({ length: 12 }, (_, index) => {
    const monthDate = new Date(
      referenceDate.getFullYear(),
      referenceDate.getMonth() - (11 - index),
      1,
    );
    const monthKey = `${monthDate.getFullYear()}-${`${monthDate.getMonth() + 1}`.padStart(2, "0")}`;
    const monthLabel = new Intl.DateTimeFormat("vi-VN", {
      month: "2-digit",
      year: "2-digit",
    }).format(monthDate);

    return {
      monthKey,
      monthLabel,
      value: values[index] ?? 0,
    };
  });
}

const mockMonthlyMetrics: AdminMonthlyMetric[] = [
  {
    id: "accountsCreated",
    label: "Số lượng tài khoản đã được tạo",
    shortLabel: "Tài khoản mới",
    description: "Biểu đồ cho thấy số lượng tài khoản mới trong 12 tháng gần nhất.",
    summaryValue: 26,
    summaryNote: "Trong tháng này, hệ thống ghi nhận 26 tài khoản mới.",
    theme: "sky",
    data: createLast12MonthSeries([12, 14, 18, 17, 20, 19, 22, 21, 24, 23, 25, 26]),
  },
  {
    id: "coursesCreated",
    label: "Số lượng khóa học đã tạo",
    shortLabel: "Khóa học mới",
    description: "Biểu đồ cho thấy số khóa học mới được mở trong 12 tháng gần nhất.",
    summaryValue: 8,
    summaryNote: "Trong tháng này, có 8 khóa học mới được tạo.",
    theme: "emerald",
    data: createLast12MonthSeries([3, 4, 5, 4, 6, 5, 7, 6, 5, 7, 8, 8]),
  },
  {
    id: "examAttempts",
    label: "Số lần kiểm tra",
    shortLabel: "Lượt kiểm tra",
    description: "Biểu đồ cho thấy tổng số lượt làm bài kiểm tra trong 12 tháng gần nhất.",
    summaryValue: 184,
    summaryNote: "Trong tháng này, sinh viên đã thực hiện 184 lượt kiểm tra.",
    theme: "amber",
    data: createLast12MonthSeries([92, 104, 118, 115, 129, 136, 148, 153, 161, 170, 177, 184]),
  },
  {
    id: "completedCourseProgresses",
    label: "Số lượng tiến độ học khóa học đã hoàn thành",
    shortLabel: "Tiến độ hoàn thành",
    description: "Biểu đồ cho thấy số bản ghi tiến độ học tập hoàn thành trong 12 tháng gần nhất.",
    summaryValue: 41,
    summaryNote: "Trong tháng này, có 41 tiến độ khóa học được đánh dấu hoàn thành.",
    theme: "rose",
    data: createLast12MonthSeries([15, 18, 22, 20, 24, 26, 29, 31, 34, 36, 39, 41]),
  },
];

const mockUsers: AdminReportUser[] = [
  { id: 1, username: "Nguyễn Văn An", email: "nguyenvanan@student.edu.vn", icon: "/icon.png", role: "student" },
  { id: 2, username: "Võ Thiên Sơn", email: "vothienson@admin.edu.vn", icon: "/icon.png", role: "admin" },
  { id: 3, username: "Nguyễn Thiên Long", email: "nguyenthienlong@instructor.edu.vn", icon: "/icon.png", role: "instructor" },
  { id: 4, username: "Trần Thị Ngọc Sanh", email: "tranngocsanh@student.edu.vn", icon: "/icon.png", role: "student" },
  { id: 5, username: "Lê Minh Khang", email: "leminhkhang@student.edu.vn", icon: "/icon.png", role: "student" },
  { id: 6, username: "Phạm Gia Hân", email: "phamgiahan@student.edu.vn", icon: "/icon.png", role: "student" },
  { id: 7, username: "Nguyễn Quốc Bảo", email: "nguyenquocbao@student.edu.vn", icon: "/icon.png", role: "student" },
  { id: 8, username: "Lê Hải Yến", email: "lehaiyen@student.edu.vn", icon: "/icon.png", role: "student" },
  { id: 9, username: "Đỗ Đức Minh", email: "doducminh@student.edu.vn", icon: "/icon.png", role: "student" },
  { id: 10, username: "Võ Thăng Tiến", email: "vothangtien@instructor.edu.vn", icon: "/icon.png", role: "instructor" },
  { id: 11, username: "Trần Thị Ngọc Nhung", email: "tranngocnhung@instructor.edu.vn", icon: "/icon.png", role: "instructor" },
  { id: 12, username: "Ngô Nhật Hào", email: "ngonhathao@student.edu.vn", icon: "/icon.png", role: "student" },
  { id: 13, username: "Phạm Xuân Huy", email: "phamxuanhuy@student.edu.vn", icon: "/icon.png", role: "student" },
  { id: 14, username: "Lý Bảo Trân", email: "lybaotran@student.edu.vn", icon: "/icon.png", role: "student" },
  { id: 15, username: "Phạm Quốc Việt", email: "phamquocviet@admin.edu.vn", icon: "/icon.png", role: "admin" },
];

const mockCourses: FastAPICourse[] = [
  { id: 1, title: "Nền tảng xây dựng ứng dụng học tập với AI", category_id: 1, instructor_id: 2, introduction: "Giới thiệu nền tảng học tập.", description: "Khóa học nền tảng.", level: "Cơ bản", total_module: 3, total_student: 42, image: "/logo.png", is_active: true, is_public: true },
  { id: 2, title: "Lập trình cơ bản", category_id: 2, instructor_id: 7, introduction: "Học lập trình với C++.", description: "Khóa học lập trình cơ bản.", level: "Cơ bản", total_module: 6, total_student: 123, image: "/logo.png", is_active: true, is_public: true },
  { id: 3, title: "Cơ sở toán trong CNTT", category_id: 3, instructor_id: 3, introduction: "Toán cho CNTT.", description: "Kiến thức toán nền tảng.", level: "Cơ bản", total_module: 7, total_student: 125, image: "/logo.png", is_active: true, is_public: true },
  { id: 4, title: "Toán rời rạc", category_id: 3, instructor_id: 4, introduction: "Toán rời rạc ứng dụng.", description: "Khóa học toán rời rạc.", level: "Trung cấp", total_module: 5, total_student: 115, image: "/logo.png", is_active: true, is_public: true },
  { id: 5, title: "Sử dụng công cụ AI tự động tạo câu hỏi", category_id: 1, instructor_id: 2, introduction: "Dùng AI tạo câu hỏi.", description: "Tự động hóa câu hỏi kiểm tra.", level: "Cơ bản", total_module: 3, total_student: 35, image: "/logo.png", is_active: true, is_public: true },
  { id: 6, title: "Lập trình bằng Python", category_id: 2, instructor_id: 5, introduction: "Python cho người mới học.", description: "Lập trình cơ bản với Python.", level: "Cơ bản", total_module: 7, total_student: 122, image: "/logo.png", is_active: true, is_public: true },
  { id: 7, title: "Cơ sở dữ liệu", category_id: 4, instructor_id: 6, introduction: "Kiến thức cơ sở dữ liệu.", description: "SQL và dữ liệu quan hệ.", level: "Trung cấp", total_module: 7, total_student: 102, image: "/logo.png", is_active: true, is_public: true },
  { id: 8, title: "Lập trình hướng đối tượng", category_id: 2, instructor_id: 7, introduction: "OOP với C++.", description: "Lập trình hướng đối tượng.", level: "Nâng cao", total_module: 7, total_student: 113, image: "/logo.png", is_active: true, is_public: true },
  { id: 9, title: "Mô hình hóa dữ liệu thực hành", category_id: 4, instructor_id: 6, introduction: "Mô hình hóa dữ liệu.", description: "Thực hành mô hình dữ liệu.", level: "Nâng cao", total_module: 4, total_student: 48, image: "/logo.png", is_active: false, is_public: true },
  { id: 10, title: "Thiết kế dashboard cho giảng viên", category_id: 4, instructor_id: 7, introduction: "Thiết kế dashboard.", description: "Dashboard và báo cáo.", level: "Trung cấp", total_module: 6, total_student: 94, image: "/logo.png", is_active: true, is_public: false },
];

const mockDocuments: AdminReportDocument[] = Array.from({ length: 28 }, (_, index) => ({
  id: index + 1,
  title: `Tài liệu #${index + 1}`,
  document_type: index % 3 === 0 ? "pdf" : "other",
  content: null,
  file_url: `/uploads/document-${index + 1}.pdf`,
  course_id: (index % 10) + 1,
  module_id: (index % 6) + 1,
}));

const mockExams: AdminReportExam[] = Array.from({ length: 16 }, (_, index) => ({
  id: index + 1,
  title: `Bài kiểm tra #${index + 1}`,
  description: "Bài kiểm tra đánh giá tiến độ học tập.",
  module_id: (index % 8) + 1,
  course_id: (index % 10) + 1,
  duration_minutes: 30,
  total_questions: 15,
  is_active: true,
  pass_score: 50,
  max_score: 100,
}));

function buildSummaryFromCollections(
  users: AdminReportUser[],
  courses: FastAPICourse[],
  documents: AdminReportDocument[],
  exams: AdminReportExam[],
): AdminReportsSummary {
  const totalStudents = users.filter((user) => user.role === "student").length;
  const totalInstructors = users.filter((user) => user.role === "instructor").length;
  const totalAdmins = users.filter((user) => user.role === "admin").length;
  const totalPublishedCourses = courses.filter((course) => course.is_public).length;

  return {
    totalUsers: users.length,
    totalStudents,
    totalInstructors,
    totalAdmins,
    totalCourses: courses.length,
    totalPublishedCourses,
    totalDocuments: documents.length,
    totalExams: exams.length,
    totalMaterialsAndExams: documents.length + exams.length,
  };
}

function getMockAdminReportsData(): AdminReportsData {
  const summary = buildSummaryFromCollections(
    mockUsers,
    mockCourses,
    mockDocuments,
    mockExams,
  );

  return buildAdminReportsData(summary, mockMonthlyMetrics);
}

async function getLiveAdminReportsData(): Promise<AdminReportsData> {
  const [users, courses, documents, exams] = await Promise.all([
    getJson<AdminReportUser[]>(endpoints.users()),
    getJson<FastAPICourse[]>(endpoints.courses()),
    getJson<AdminReportDocument[]>(endpoints.documents()),
    getJson<AdminReportExam[]>(endpoints.exams()),
  ]);

  const summary = buildSummaryFromCollections(users, courses, documents, exams);

  return buildAdminReportsData(summary, mockMonthlyMetrics);
}

export async function getAdminReportsData(): Promise<AdminReportsData> {
  if (USE_MOCK_REPORT_DATA) {
    return Promise.resolve(getMockAdminReportsData());
  }

  try {
    return await getLiveAdminReportsData();
  } catch {
    return getMockAdminReportsData();
  }
}

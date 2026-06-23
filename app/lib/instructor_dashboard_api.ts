import type { FastAPICourse } from "./api_course";
import type { User } from "./api_user";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";
const USE_MOCK_DASHBOARD_DATA =
  process.env.NEXT_PUBLIC_USE_MOCK_DATA !== "false";

export type InstructorProfile = {
  user_id: number;
  name: string;
  email: string;
  location: string;
  organization: string;
  description: string;
  specialization?: string;
};

export type InstructorCourse = FastAPICourse & {
  active_students: number;
  avg_student_score: number;
};

export type InstructorDashboardCard = {
  id: string;
  label: string;
  value: string;
  note: string;
};

export type InstructorQuickAction = {
  id: string;
  label: string;
  href: string;
  description: string;
};

export type InstructorDashboardData = {
  user: User;
  profile: InstructorProfile;
  courses: InstructorCourse[];
  summaryCards: InstructorDashboardCard[];
  quickActions: InstructorQuickAction[];
};

type FastApiError = {
  detail?: string;
};

type CourseProgressRecord = {
  id: number;
  course_id: number;
  user_id: number;
  module_completed: number;
  is_complete: boolean;
  final_score: number;
  completed_at?: string | null;
};

const fastApiEndpoints = {
  userById: (userId: number) => `${API_BASE_URL}/user/${userId}`,
  profileByUserId: (userId: number) => `${API_BASE_URL}/profile/${userId}`,
  coursesByInstructorId: (instructorId: number) =>
    `${API_BASE_URL}/course/instructor/${instructorId}`,
  courseProgressList: () => `${API_BASE_URL}/course_progress/`,
};

const quickActions: InstructorQuickAction[] = [
  {
    id: "create-course",
    label: "Tạo khóa học mới",
    href: "/instructor/courses/create_course",
    description: "Khởi tạo khóa học mới và bổ sung module học tập.",
  },
  {
    id: "manage-courses",
    label: "Quản lý khóa học",
    href: "/instructor/courses",
    description: "Theo dõi danh sách khóa học và chỉnh sửa nội dung đang dạy.",
  },
  {
    id: "view-reports",
    label: "Xem báo cáo",
    href: "/instructor/reports",
    description: "Phân tích tiến độ và kết quả học tập của học sinh.",
  },
  {
    id: "manage-exams",
    label: "Quản lý bài kiểm tra",
    href: "/instructor/exam",
    description: "Quản lý các bài kiểm tra của mình.",
  },
  {
    id: "manage-documents",
    label: "Quản lý tài liệu",
    href: "/instructor/document",
    description: "Quản lý các tài liệu học tập do mình cung cấp.",
  },
  {
    id: "manage-assignments",
    label: "Quản lý bài tập",
    href: "/instructor/assignment",
    description: "Quản lý bài tập và chấm điểm bài nộp từ học sinh.",
  },
  {
    id: "ai-generator",
    label: "Trợ lý AI",
    href: "/instructor/ai-generator",
    description: "Tạo câu hỏi và nội dung hỗ trợ giảng dạy bằng AI.",
  },
];

const mockDashboardData: InstructorDashboardData = {
  user: {
    id: 7,
    username: "Nguyễn Thiên Long",
    email: "nguyenthienlong@instructor.edu.vn",
    icon: "/icon.png",
    role: "instructor",
  },
  profile: {
    user_id: 7,
    name: "Nguyễn Thiên Long",
    email: "nguyenthienlong@instructor.edu.vn",
    location: "Thành phố Hồ Chí Minh",
    organization: "Đại học Công nghệ Thông tin",
    description: "Chuyên gia về AI và Machine Learning với 10 năm kinh nghiệm giảng dạy.",
    specialization: "AI, Machine Learning, Python",
  },
  courses: [
    {
      id: 101,
      instructor_id: 7,
      category_id: 1,
      introduction: "Khóa học nhập môn về Machine Learning, dành cho người mới bắt đầu.",
      is_active: true,
      is_public: true,
      description: "Khóa học nhập môn về Machine Learning, dành cho người mới bắt đầu.",
      level: "Cơ bản",
      image: "/logo.png",
      title: "Nhập môn Machine Learning",
      total_student: 45,
      active_students: 38,
      total_module: 12,
      avg_student_score: 82,
    },
    {
      id: 102,
      instructor_id: 7,
      category_id: 1,
      introduction: "Khóa học về Deep Learning, dành cho người đã có kiến thức cơ bản.",
      is_active: true,
      is_public: true,
      description: "Khóa học về Deep Learning, dành cho người đã có kiến thức cơ bản.",
      level: "Nâng cao",
      image: "/logo.png",
      title: "Deep Learning Nâng cao",
      total_student: 32,
      active_students: 28,
      total_module: 15,
      avg_student_score: 79,
    },
    {
      id: 103,
      instructor_id: 7,
      category_id: 1,
      introduction: "Khóa học về Python cho Data Science.",
      is_active: true,
      is_public: true,
      description: "Khóa học về Python cho Data Science.",
      level: "Cơ bản",
      image: "/logo.png",
      title: "Python cho Data Science",
      total_student: 56,
      active_students: 42,
      total_module: 10,
      avg_student_score: 85,
    },
  ],
  summaryCards: [
    {
      id: "total-courses",
      label: "Khóa học giảng dạy",
      value: "3",
      note: "Tất cả đang hoạt động tích cực",
    },
    {
      id: "total-students",
      label: "Học sinh tổng cộng",
      value: "133",
      note: "108 học sinh đang tham gia",
    },
    {
      id: "average-score",
      label: "Điểm trung bình lớp",
      value: "82",
      note: "Dựa trên điểm đánh giá hiện tại",
    },
  ],
  quickActions: quickActions,
};

async function parseError(response: Response): Promise<string> {
  try {
    const error = (await response.json()) as FastApiError;
    if (typeof error.detail === "string" && error.detail.trim()) {
      return error.detail;
    }
  } catch {
    // Bỏ qua lỗi đọc JSON để dùng thông báo mặc định.
  }

  return "Không thể kết nối tới máy chủ FastAPI.";
}

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  return (await response.json()) as T;
}

async function getJsonOrFallback<T>(url: string, fallbackValue: T): Promise<T> {
  const response = await fetch(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    return fallbackValue;
  }

  return (await response.json()) as T;
}

function buildFallbackProfile(user: User): InstructorProfile {
  return {
    user_id: user.id,
    name: user.username,
    email: user.email,
    location: "Chưa cập nhật",
    organization: "Chưa cập nhật",
    description:
      "Hồ sơ giảng viên chưa có dữ liệu. Bạn vẫn có thể theo dõi khóa học và cập nhật thông tin sau.",
    specialization: "Chưa cập nhật",
  };
}

function buildDashboardCourse(
  course: FastAPICourse,
  progressRecords: CourseProgressRecord[],
): InstructorCourse {
  const activeStudents = progressRecords.length;
  const averageScore =
    progressRecords.length > 0
      ? Number(
          (
            progressRecords.reduce(
              (total, record) => total + (Number.isFinite(record.final_score) ? record.final_score : 0),
              0,
            ) / progressRecords.length
          ).toFixed(1),
        )
      : 0;

  return {
    ...course,
    total_student: Math.max(course.total_student, progressRecords.length),
    active_students: activeStudents,
    avg_student_score: averageScore,
  };
}

function buildSummaryCards(courses: InstructorCourse[]): InstructorDashboardCard[] {
  const totalCourses = courses.length;
  const totalStudents = courses.reduce(
    (total, course) => total + course.total_student,
    0,
  );
  const activeStudents = courses.reduce(
    (total, course) => total + course.active_students,
    0,
  );
  const coursesWithScores = courses.filter((course) => course.avg_student_score > 0);
  const averageScore =
    coursesWithScores.length > 0
      ? (
          coursesWithScores.reduce(
            (total, course) => total + course.avg_student_score,
            0,
          ) / coursesWithScores.length
        ).toFixed(1)
      : "0.0";

  return [
    {
      id: "total-courses",
      label: "Khóa học giảng dạy",
      value: `${totalCourses}`,
      note: `${courses.filter((course) => course.is_active).length} khóa học đang hoạt động`,
    },
    {
      id: "total-students",
      label: "Tổng số học sinh",
      value: `${totalStudents}`,
      note: `${activeStudents} học sinh đang có tiến trình học tập`,
    },
    {
      id: "average-score",
      label: "Điểm trung bình",
      value: averageScore,
      note: "Tính từ các khóa học đã có dữ liệu tiến trình",
    },
  ];
}

export async function getInstructorDashboardData(
  instructorId: number,
): Promise<InstructorDashboardData> {
  if (USE_MOCK_DASHBOARD_DATA) {
    return Promise.resolve(mockDashboardData);
  }

  const user = await getJson<User>(fastApiEndpoints.userById(instructorId));

  const [profile, courses, allCourseProgresses] = await Promise.all([
    getJsonOrFallback<InstructorProfile>(
      fastApiEndpoints.profileByUserId(instructorId),
      buildFallbackProfile(user),
    ),
    getJsonOrFallback<FastAPICourse[]>(
      fastApiEndpoints.coursesByInstructorId(instructorId),
      [],
    ),
    getJsonOrFallback<CourseProgressRecord[]>(
      fastApiEndpoints.courseProgressList(),
      [],
    ),
  ]);

  const courseIds = new Set(courses.map((course) => course.id));
  const courseProgressesByCourse = new Map<number, CourseProgressRecord[]>();

  allCourseProgresses.forEach((record) => {
    if (!courseIds.has(record.course_id)) {
      return;
    }

    const current = courseProgressesByCourse.get(record.course_id) ?? [];
    current.push(record);
    courseProgressesByCourse.set(record.course_id, current);
  });

  const dashboardCourses = courses.map((course) =>
    buildDashboardCourse(course, courseProgressesByCourse.get(course.id) ?? []),
  );

  return {
    user,
    profile: profile.user_id === user.id ? profile : { ...profile, user_id: user.id },
    courses: dashboardCourses,
    summaryCards: buildSummaryCards(dashboardCourses),
    quickActions,
  };
}

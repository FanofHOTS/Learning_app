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

export type InstructorCourse = {
  course_id: number;
  instructor_id: number;
  course_name: string;
  total_students: number;
  active_students: number;
  total_modules: number;
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

const fastApiEndpoints = {
  userById: (userId: number) => `${API_BASE_URL}/user/${userId}`,
  profileByUserId: (userId: number) => `${API_BASE_URL}/profile/${userId}`,
  coursesByInstructorId: (instructorId: number) =>
    `${API_BASE_URL}/course/instructor/${instructorId}`,
};

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
      course_id: 101,
      instructor_id: 7,
      course_name: "Nhập môn Machine Learning",
      total_students: 45,
      active_students: 38,
      total_modules: 12,
      avg_student_score: 82,
    },
    {
      course_id: 102,
      instructor_id: 7,
      course_name: "Deep Learning Nâng cao",
      total_students: 32,
      active_students: 28,
      total_modules: 15,
      avg_student_score: 79,
    },
    {
      course_id: 103,
      instructor_id: 7,
      course_name: "Python cho Data Science",
      total_students: 56,
      active_students: 42,
      total_modules: 10,
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
  quickActions: [
    {
      id: "create-course",
      label: "Tạo khóa học mới",
      href: "/instructor/courses/create",
      description: "Khởi tạo một khóa học mới cho học sinh.",
    },
    {
      id: "manage-courses",
      label: "Quản lý khóa học",
      href: "/instructor/my_courses",
      description: "Chỉnh sửa và quản lý các khóa học của bạn.",
    },
    {
      id: "view-reports",
      label: "Xem báo cáo",
      href: "/instructor/reports",
      description: "Phân tích tiến độ và kết quả học sinh.",
    },
    {
      id: "ai-generator",
      label: "Tạo câu hỏi AI",
      href: "/instructor/ai-generator",
      description: "Sử dụng AI để tạo câu hỏi kiểm tra.",
    },
  ],
};

async function parseError(response: Response): Promise<string> {
  try {
    const error = (await response.json()) as FastApiError;
    if (typeof error.detail === "string" && error.detail.trim()) {
      return error.detail;
    }
  } catch {
    // Bỏ qua lỗi parse JSON để dùng thông báo mặc định.
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

async function getJsonOrFallback<T>(url: string, fallbackValue: T): Promise<T> {
  const response = await fetch(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
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
      "Hồ sơ giảng viên chưa có dữ liệu. Bạn vẫn có thể quản lý khóa học và cập nhật thông tin sau.",
    specialization: "Chưa cập nhật",
  };
}

function buildSummaryCards(courses: InstructorCourse[]): InstructorDashboardCard[] {
  const totalCourses = courses.length;
  const totalStudents = courses.reduce(
    (total, course) => total + course.total_students,
    0,
  );
  const activeStudents = courses.reduce(
    (total, course) => total + course.active_students,
    0,
  );
  const averageScore =
    courses.length > 0
      ? (
          courses.reduce(
            (total, course) => total + course.avg_student_score,
            0,
          ) / courses.length
        ).toFixed(1)
      : "0.0";

  return [
    {
      id: "total-courses",
      label: "Khóa học giảng dạy",
      value: `${totalCourses}`,
      note: "Tất cả khóa học đang hoạt động",
    },
    {
      id: "total-students",
      label: "Học sinh tổng cộng",
      value: `${totalStudents}`,
      note: `${activeStudents} học sinh đang tham gia`,
    },
    {
      id: "average-score",
      label: "Điểm trung bình lớp",
      value: averageScore,
      note: "Tính từ tất cả các khóa học",
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

  const [profile, courses] = await Promise.all([
    getJsonOrFallback<InstructorProfile>(
      fastApiEndpoints.profileByUserId(instructorId),
      buildFallbackProfile(user),
    ),
    getJsonOrFallback<InstructorCourse[]>(
      fastApiEndpoints.coursesByInstructorId(instructorId),
      [],
    ),
  ]);

  return {
    user,
    profile: profile.user_id === user.id ? profile : { ...profile, user_id: user.id },
    courses,
    summaryCards: buildSummaryCards(courses),
    quickActions: mockDashboardData.quickActions,
  };
}

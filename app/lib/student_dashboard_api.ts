import type { User } from "./api_user";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";
const USE_MOCK_DASHBOARD_DATA =
  process.env.NEXT_PUBLIC_USE_MOCK_DATA !== "false";

export type StudentProfile = {
  user_id: number;
  name: string;
  email: string;
  location: string;
  organization: string;
  description: string;
};

export type StudentCourseProgress = {
  course_id: number;
  user_id: number;
  module_completed: number;
  is_complete: boolean;
  final_score: number;
};

export type StudentDashboardCard = {
  id: string;
  label: string;
  value: string;
  note: string;
};

export type StudentQuickAction = {
  id: string;
  label: string;
  href: string;
  description: string;
};

export type StudentDashboardData = {
  user: User;
  profile: StudentProfile;
  courseProgresses: StudentCourseProgress[];
  summaryCards: StudentDashboardCard[];
  quickActions: StudentQuickAction[];
};

type FastApiError = {
  detail?: string;
};

const fastApiEndpoints = {
  userById: (userId: number) => `${API_BASE_URL}/user/${userId}`,
  profileByUserId: (userId: number) => `${API_BASE_URL}/profile/${userId}`,
  courseProgressesByUserId: (userId: number) =>
    `${API_BASE_URL}/course_progress/user/${userId}`,
};

const mockDashboardData: StudentDashboardData = {
  user: {
    id: 1,
    username: "Nguyễn Văn An",
    email: "nguyenvanan@student.edu.vn",
    icon: "/icon.png",
    role: "student",
  },
  profile: {
    user_id: 1,
    name: "Nguyễn Văn An",
    email: "nguyenvanan@student.edu.vn",
    location: "Thành phố Hồ Chí Minh",
    organization: "Đại học Công nghệ Thông tin",
    description: "Yêu thích AI, phát triển web và học theo dự án thực tế.",
  },
  courseProgresses: [
    {
      course_id: 101,
      user_id: 1,
      module_completed: 8,
      is_complete: false,
      final_score: 88,
    },
    {
      course_id: 102,
      user_id: 1,
      module_completed: 12,
      is_complete: true,
      final_score: 93,
    },
    {
      course_id: 103,
      user_id: 1,
      module_completed: 4,
      is_complete: false,
      final_score: 76,
    },
  ],
  summaryCards: [
    {
      id: "active-courses",
      label: "Khóa học đang theo",
      value: "3",
      note: "1 khóa đã hoàn thành rất tốt",
    },
    {
      id: "completed-modules",
      label: "Mô-đun đã học",
      value: "24",
      note: "Tăng 5 mô-đun trong tuần này",
    },
    {
      id: "average-score",
      label: "Điểm trung bình",
      value: "85.7",
      note: "Giữ phong độ ổn định qua các bài đánh giá",
    },
  ],
  quickActions: [
    {
      id: "profile",
      label: "Cập nhật hồ sơ",
      href: "/student/profile",
      description: "Chỉnh sửa thông tin cá nhân và nơi học tập.",
    },
    {
      id: "courses",
      label: "Xem khóa học",
      href: "/student/courses",
      description: "Tiếp tục các khóa học đang theo dõi.",
    },
    {
      id: "reports",
      label: "Xem báo cáo",
      href: "/student/reports",
      description: "Theo dõi tiến độ và điểm số gần đây.",
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

function buildFallbackProfile(user: User): StudentProfile {
  return {
    user_id: user.id,
    name: user.username,
    email: user.email,
    location: "Chưa cập nhật",
    organization: "Chưa cập nhật",
    description:
      "Hồ sơ học sinh chưa có dữ liệu. Bạn vẫn có thể bắt đầu sử dụng bảng điều khiển và cập nhật thông tin sau.",
  };
}

function buildSummaryCards(
  courseProgresses: StudentCourseProgress[],
): StudentDashboardCard[] {
  const totalCourses = courseProgresses.length;
  const completedCourses = courseProgresses.filter(
    (courseProgress) => courseProgress.is_complete,
  ).length;
  const totalModules = courseProgresses.reduce(
    (total, courseProgress) => total + courseProgress.module_completed,
    0,
  );
  const averageScore =
    courseProgresses.length > 0
      ? (
          courseProgresses.reduce(
            (total, courseProgress) => total + courseProgress.final_score,
            0,
          ) / courseProgresses.length
        ).toFixed(1)
      : "0.0";

  return [
    {
      id: "active-courses",
      label: "Khóa học đang theo",
      value: `${totalCourses}`,
      note: `${completedCourses} khóa đã hoàn thành`,
    },
    {
      id: "completed-modules",
      label: "Mô-đun đã học",
      value: `${totalModules}`,
      note: "Dữ liệu tổng hợp từ tiến trình khóa học",
    },
    {
      id: "average-score",
      label: "Điểm trung bình",
      value: averageScore,
      note: "Tính từ các bài đánh giá hiện có",
    },
  ];
}

export async function getStudentDashboardData(
  userId: number,
): Promise<StudentDashboardData> {
  if (USE_MOCK_DASHBOARD_DATA) {
    return Promise.resolve(mockDashboardData);
  }

  const user = await getJson<User>(fastApiEndpoints.userById(userId));

  const [profile, courseProgresses] = await Promise.all([
    getJsonOrFallback<StudentProfile>(
      fastApiEndpoints.profileByUserId(userId),
      buildFallbackProfile(user),
    ),
    getJsonOrFallback<StudentCourseProgress[]>(
      fastApiEndpoints.courseProgressesByUserId(userId),
      [],
    ),
  ]);

  const normalizedProfile =
    profile.user_id === user.id ? profile : { ...profile, user_id: user.id };

  return {
    user,
    profile: normalizedProfile,
    courseProgresses,
    summaryCards: buildSummaryCards(courseProgresses),
    quickActions: mockDashboardData.quickActions,
  };
}

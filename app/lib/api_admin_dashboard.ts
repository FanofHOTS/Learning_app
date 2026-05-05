import { type User } from "./api_user";
import { type FastAPICourse } from "./api_course";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";
const USE_MOCK_DASHBOARD_DATA =
  process.env.NEXT_PUBLIC_USE_MOCK_DATA !== "false";

export type AdminProfile = {
  user_id: number;
  name: string;
  email: string;
  location: string;
  organization: string;
  description: string;
  specialization?: string;
};

export type AdminDashboardCard = {
  id: string;
  label: string;
  value: string;
  note: string;
};

export type AdminQuickAction = {
  id: string;
  label: string;
  href: string;
  description: string;
};

type FastApiError = {
  detail?: string;
};

export type AdminDashboardData = {
  user: User;
  profile: AdminProfile;
  courseCount: number;
  activeAndPublicCourseCount: number;
  userCount: number;
  instuctorUserCount: number;
  summaryCards: AdminDashboardCard[];
  quickActions: AdminQuickAction[];
};

const mockDashboardData: AdminDashboardData = {
  user: {
    id: 2,
    username: "Võ Thiên Sơn",
    email: "vothienson@admin.edu.vn",
    icon: "/icon.png",
    role: "admin",
  },
  profile: {
    user_id: 2,
    name: "Võ Thiên Sơn",
    email: "vothienson@admin.edu.vn",
    location: "Thành phố Hồ Chí Minh",
    organization: "Đại học Su Phạm Thành Phố Hồ Chí Minh",
    description: "Một trong số những người quản lý trang web dạy học này.",
    specialization: "Quản lý trang Web",
  },
  courseCount: 30,
  activeAndPublicCourseCount: 24,
  userCount: 329,
  instuctorUserCount: 7,
  summaryCards: [
    {
      id: "total-active-and-public-courses",
      label: "Tổng số khóa học được công bố trên hệ thống",
      value: "24",
      note: "Tất cả đang khóa học đang hoạt động tích cực",
    },
    {
      id: "total-user",
      label: "Số lượng tài khoản người dùng",
      value: "329",
      note: "Đang tồn tại trên hệ thống này",
    },
    {
      id: "total-instuctor-user",
      label: "Số lượng giảng viên",
      value: "7",
      note: "Đã lựa chọn giảng dạy tên trang web này",
    },
  ],
  quickActions: [
    {
      id: "manage-categoty",
      label: "Quản lý phân loại",
      href: "/admin/category",
      description: "Quản lý phân loại trên hệ thống.",
    },
    {
      id: "manage-courses",
      label: "Quản lý khóa học",
      href: "/admin/courses",
      description: "Quản lý các khóa học trên hệ thống.",
    },
    {
      id: "manage-user",
      label: "Quản lý người dùng",
      href: "/admin/users",
      description: "Quản lý người dùng trên hệ thống.",
    },
    {
      id: "view-reports",
      label: "Xem báo cáo",
      href: "/admin/reports",
      description: "Phân tích tình hình của trang web.",
    },
    {
      id: "ai-generator",
      label: "Tạo câu hỏi AI",
      href: "/admin/ai-generator",
      description: "Sử dụng AI để tạo câu hỏi kiểm tra.",
    },
  ],
};

const endpoints = {
  userById: (userId: number) => `${API_BASE_URL}/user/${userId}`,
  profileByUserId: (userId: number) => `${API_BASE_URL}/profile/${userId}`,
  allUsers: () => `${API_BASE_URL}/user/`,
  allCourses: () => `${API_BASE_URL}/course/`,
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

function buildSummaryCards(
  courseCount: number,
  activeAndPublicCourseCount: number,
  userCount: number,
  instructorUserCount: number,
): AdminDashboardCard[] {
  return [
    {
      id: "total-active-and-public-courses",
      label: "Tổng số khóa học được công bố trên hệ thống",
      value: `${activeAndPublicCourseCount}`,
      note: `Trong tổng số ${courseCount} khóa học`,
    },
    {
      id: "total-user",
      label: "Số lượng tài khoản người dùng",
      value: `${userCount}`,
      note: "Tất cả người dùng trong hệ thống",
    },
    {
      id: "total-instuctor-user",
      label: "Số lượng giảng viên",
      value: `${instructorUserCount}`,
      note: "Người dùng có vai trò giáo viên/giảng viên",
    },
  ];
}

export async function getAdminDashboardData(
  userId: number,
): Promise<AdminDashboardData> {
  if (USE_MOCK_DASHBOARD_DATA) {
    return Promise.resolve({
      ...mockDashboardData,
      summaryCards: buildSummaryCards(
        mockDashboardData.courseCount,
        mockDashboardData.activeAndPublicCourseCount,
        mockDashboardData.userCount,
        mockDashboardData.instuctorUserCount,
      ),
    });
  }

  try {
    const [user, profile, allUsers, allCourses] = await Promise.all([
      getJson<User>(endpoints.userById(userId)),
      getJson<AdminProfile>(endpoints.profileByUserId(userId)),
      getJson<User[]>(endpoints.allUsers()),
      getJson<FastAPICourse[]>(endpoints.allCourses()),
    ]);

    const courseCount = allCourses.length;
    const activeAndPublicCourseCount = allCourses.filter(
      (course) => course.is_active && course.is_public,
    ).length;
    const userCount = allUsers.length;
    const instructorUserCount = allUsers.filter(
      (user) => user.role === "instructor",
    ).length;

    return {
      user,
      profile,
      courseCount,
      activeAndPublicCourseCount,
      userCount,
      instuctorUserCount: instructorUserCount,
      summaryCards: buildSummaryCards(
        courseCount,
        activeAndPublicCourseCount,
        userCount,
        instructorUserCount,
      ),
      quickActions: mockDashboardData.quickActions,
    };
  } catch (error) {
    // Fallback to mock data on error
    return Promise.resolve({
      ...mockDashboardData,
      summaryCards: buildSummaryCards(
        mockDashboardData.courseCount,
        mockDashboardData.activeAndPublicCourseCount,
        mockDashboardData.userCount,
        mockDashboardData.instuctorUserCount,
      ),
    });
  }
}
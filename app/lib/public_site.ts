import type { User } from "./api_user";
import { getRedirectPathByRole } from "./auth_paths";

export type UserRole = "admin" | "instructor" | "student";

const TRUE_ENV_VALUES = new Set(["1", "true", "yes", "on"]);

export const PUBLIC_NAV_ITEMS = [
  { href: "/", label: "Trang chủ" },
  { href: "/ai-generator", label: "AI tạo câu hỏi" },
  { href: "/courses", label: "Khóa học" },
  { href: "/contact", label: "Liên hệ" },
] as const;

const MOCK_USERS_BY_ROLE: Record<UserRole, User> = {
  admin: {
    id: 2,
    username: "Võ Thiên Sơn",
    email: "vothienson@admin.edu.vn",
    icon: "/icon.png",
    role: "admin",
  },
  instructor: {
    id: 7,
    username: "Nguyễn Thiên Long",
    email: "nguyenthienlong@instructor.edu.vn",
    icon: "/icon.png",
    role: "instructor",
  },
  student: {
    id: 1,
    username: "Nguyễn Văn An",
    email: "nguyenvanan@student.edu.vn",
    icon: "/icon.png",
    role: "student",
  },
};

export function isMockDataEnabled(): boolean {
  const rawValue = process.env.NEXT_PUBLIC_USE_MOCK_DATA;

  if (rawValue == null) {
    return true;
  }

  return rawValue.trim().toLowerCase() !== "false";
}

export function isRegistrationEnabledFromEnv(): boolean {
  const rawValue = process.env.REGISTER_ALLOWED;

  if (rawValue == null) {
    return false;
  }

  return TRUE_ENV_VALUES.has(rawValue.trim().toLowerCase());
}

export function isUserRole(value: string): value is UserRole {
  return value === "admin" || value === "instructor" || value === "student";
}

export function getMockUserByAccessToken(accessToken: string): User | null {
  return isUserRole(accessToken) ? MOCK_USERS_BY_ROLE[accessToken] : null;
}

export function getRoleLabel(role: string): string {
  if (role === "admin") {
    return "Quản trị viên";
  }

  if (role === "instructor") {
    return "Giảng viên";
  }

  return "Học viên";
}

export function getRoleDescription(role: string): string {
  if (role === "admin") {
    return "Theo dõi toàn bộ hệ thống, người dùng và chất lượng vận hành.";
  }

  if (role === "instructor") {
    return "Thiết kế khóa học, tài liệu và hoạt động đánh giá cho lớp học.";
  }

  return "Tham gia khóa học, làm bài tập và theo dõi tiến độ học tập mỗi ngày.";
}

export function getProfilePathByRole(role: string): string {
  if (role === "admin") {
    return "/admin/profile";
  }

  if (role === "instructor") {
    return "/instructor/profile";
  }

  return "/student/profile";
}

export function getDashboardPathByRole(role: string): string {
  return getRedirectPathByRole({ role });
}

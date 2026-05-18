import type { User } from "./api_user";
const USE_MOCK_USER_ADMIN_DATA =
  process.env.NEXT_PUBLIC_USE_MOCK_DATA !== "false";

export type AdminUserRole = "admin" | "instructor" | "student";
export type AdminUserRoleFilter = AdminUserRole | "all";

export type AdminManagedUser = User & {
  is_password_reset: boolean;
};

export type AdminCreateUserInput = {
  username: string;
  email: string;
  role: AdminUserRole;
  icon: string;
  name: string;
  location: string;
  organization: string;
  description: string;
  specialization: string;
};

export type AdminCreateUserResponse = {
  user: AdminManagedUser;
  generated_password: string;
  email_delivery_status: string;
};

export type AdminUserSummary = {
  total: number;
  adminCount: number;
  instructorCount: number;
  studentCount: number;
};

type FastApiError = {
  detail?: string;
};

type FastApiAdminCreateResponse = {
  user: AdminManagedUser;
  generated_password: string;
  email_delivery_status: string;
};

const endpoints = {
  listUsers: () => "/api/admin/users",
  createUser: () => "/api/admin/users",
};

const mockUsers: AdminManagedUser[] = [
  {
    id: 2,
    username: "Võ Thiên Sơn",
    email: "vothienson@admin.edu.vn",
    icon: "/icon.png",
    role: "admin",
    is_password_reset: false,
  },
  {
    id: 7,
    username: "Nguyễn Thiên Long",
    email: "nguyenthienlong@instructor.edu.vn",
    icon: "/icon.png",
    role: "instructor",
    is_password_reset: true,
  },
  {
    id: 11,
    username: "Lê Hải An",
    email: "lehaian@student.edu.vn",
    icon: "/icon.png",
    role: "student",
    is_password_reset: false,
  },
  {
    id: 14,
    username: "Phạm Minh Khôi",
    email: "phamminhkhoi@student.edu.vn",
    icon: "/icon.png",
    role: "student",
    is_password_reset: true,
  },
  {
    id: 19,
    username: "Trần Nhã Uyên",
    email: "trannhauyen@instructor.edu.vn",
    icon: "/icon.png",
    role: "instructor",
    is_password_reset: false,
  },
];

const allowedMockEmailDomains = new Set([
  "admin.edu.vn",
  "example.com",
  "instructor.edu.vn",
  "student.edu.vn",
]);

const allowedEmailDomains = new Set([
  "gmail.com",
  "outlook.com.vn",
  "outlook.com",
]);

export const adminRoleOptions: Array<{
  value: AdminUserRoleFilter;
  label: string;
}> = [
  { value: "all", label: "Tất cả vai trò" },
  { value: "admin", label: "Quản trị viên" },
  { value: "instructor", label: "Giảng viên" },
  { value: "student", label: "Học viên" },
];

export const defaultAdminCreateUserForm: AdminCreateUserInput = {
  username: "",
  email: "",
  role: "student",
  icon: "/icon.png",
  name: "",
  location: "Thành phố Hồ Chí Minh",
  organization: "Đơn vị chưa cập nhật",
  description: "Tài khoản được tạo bởi quản trị viên.",
  specialization: "Chưa cập nhật",
};

async function parseError(response: Response): Promise<string> {
  try {
    const error = (await response.json()) as FastApiError;
    if (typeof error.detail === "string" && error.detail.trim()) {
      return error.detail;
    }
  } catch {
    // Bỏ qua lỗi parse để dùng thông báo mặc định.
  }

  return "Không thể kết nối tới máy chủ FastAPI.";
}

function buildHeaders(): HeadersInit {
  return {
    "Content-Type": "application/json",
  };
}

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    credentials: "same-origin",
    headers: buildHeaders(),
    method: "GET",
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  return (await response.json()) as T;
}

async function postJson<T>(
  url: string,
  body: unknown,
): Promise<T> {
  const response = await fetch(url, {
    body: JSON.stringify(body),
    credentials: "same-origin",
    headers: buildHeaders(),
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  return (await response.json()) as T;
}

export function assertAdminRole(role: string | null | undefined): void {
  if (role !== "admin") {
    throw new Error("Bạn không có quyền quản trị viên để dùng chức năng này.");
  }
}

export function getAdminRoleLabel(role: AdminUserRole | string): string {
  if (role === "admin") {
    return "Quản trị viên";
  }

  if (role === "instructor") {
    return "Giảng viên";
  }

  return "Học viên";
}

export function buildAdminUserSummary(users: AdminManagedUser[]): AdminUserSummary {
  return {
    total: users.length,
    adminCount: users.filter((user) => user.role === "admin").length,
    instructorCount: users.filter((user) => user.role === "instructor").length,
    studentCount: users.filter((user) => user.role === "student").length,
  };
}

export function filterAdminUsers(
  users: AdminManagedUser[],
  keyword: string,
  role: AdminUserRoleFilter,
): AdminManagedUser[] {
  const normalizedKeyword = keyword.trim().toLowerCase();

  return users.filter((user) => {
    const matchesRole = role === "all" ? true : user.role === role;
    const matchesKeyword =
      normalizedKeyword.length === 0
        ? true
        : [user.id, user.username, user.email, user.role]
            .join(" ")
            .toLowerCase()
            .includes(normalizedKeyword);

    return matchesRole && matchesKeyword;
  });
}

export function isValidEmailFormat(email: string): boolean {
  return /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(
    email.trim().toLowerCase(),
  );
}

export function isAllowedMockEmail(email: string): boolean {
  const normalizedEmail = email.trim().toLowerCase();
  if (!isValidEmailFormat(normalizedEmail)) {
    return false;
  }

  const domain = normalizedEmail.split("@")[1] ?? "";
  if (USE_MOCK_USER_ADMIN_DATA){
    return allowedMockEmailDomains.has(domain);
  }
  return allowedEmailDomains.has(domain);
}

export function validateAdminCreateUserInput(
  payload: AdminCreateUserInput,
  existingUsers: AdminManagedUser[],
): string[] {
  const errors: string[] = [];
  const username = payload.username.trim();
  const email = payload.email.trim().toLowerCase();
  const name = payload.name.trim();
  const location = payload.location.trim();
  const organization = payload.organization.trim();
  const description = payload.description.trim();

  if (!username) {
    errors.push("Tên đăng nhập không được để trống.");
  }

  if (!email) {
    errors.push("Email không được để trống.");
  } else if (!isValidEmailFormat(email)) {
    errors.push("Email không đúng định dạng.");
  } else if (!isAllowedMockEmail(email)) {
    if (USE_MOCK_USER_ADMIN_DATA){
      errors.push(
        "Tạm thời chỉ chấp nhận các email mẫu thuộc miền student.edu.vn, instructor.edu.vn, admin.edu.vn hoặc example.com.",
      );
    }
    else {
      errors.push(
        "Hệ thống chưa hỗ trợ gửi email thuộc miền trên hoặc miền đó chưa tồn tại.",
      );
    }
  }

  if (!name) {
    errors.push("Họ và tên không được để trống.");
  }

  if (!location) {
    errors.push("Địa điểm không được để trống.");
  }

  if (!organization) {
    errors.push("Tổ chức không được để trống.");
  }

  if (!description) {
    errors.push("Mô tả không được để trống.");
  }

  const hasDuplicateUsername = existingUsers.some(
    (user) => user.username.trim().toLowerCase() === username.toLowerCase(),
  );
  if (hasDuplicateUsername) {
    errors.push("Tên đăng nhập đã tồn tại trong hệ thống.");
  }

  const hasDuplicateEmail = existingUsers.some(
    (user) => user.email.trim().toLowerCase() === email,
  );
  if (hasDuplicateEmail) {
    errors.push("Email đã tồn tại trong hệ thống.");
  }

  return errors;
}

export function generateRandomPassword(length = 12): string {
  const uppercase = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lowercase = "abcdefghijkmnopqrstuvwxyz";
  const digits = "23456789";
  const pool = `${uppercase}${lowercase}${digits}`;
  const chars = [
    uppercase[Math.floor(Math.random() * uppercase.length)],
    lowercase[Math.floor(Math.random() * lowercase.length)],
    digits[Math.floor(Math.random() * digits.length)],
  ];

  for (let index = chars.length; index < length; index += 1) {
    chars.push(pool[Math.floor(Math.random() * pool.length)]);
  }

  return chars.sort(() => Math.random() - 0.5).join("");
}

export function downloadUserCredentialFile(params: {
  email: string;
  fullName: string;
  password: string;
  role: string;
  username: string;
}): void {
  if (typeof window === "undefined") {
    return;
  }

  const content = [
    "THÔNG TIN TÀI KHOẢN NGƯỜI DÙNG MỚI",
    `Họ và tên: ${params.fullName}`,
    `Vai trò: ${getAdminRoleLabel(params.role)}`,
    `Email: ${params.email}`,
    `Tên đăng nhập: ${params.username}`,
    `Mật khẩu tạm thời: ${params.password}`,
    "",
    "Ghi chú: Người dùng cần đổi mật khẩu ngay sau lần đăng nhập đầu tiên.",
  ].join("\n");

  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const fileName = `tai-khoan-${params.username}.txt`;
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

function createMockUserFromPayload(
  payload: AdminCreateUserInput,
  generatedPassword: string,
): AdminCreateUserResponse {
  const nextId =
    mockUsers.reduce((highestId, user) => Math.max(highestId, user.id), 0) + 1;

  const newUser: AdminManagedUser = {
    id: nextId,
    username: payload.username.trim(),
    email: payload.email.trim().toLowerCase(),
    icon: payload.icon.trim() || "/icon.png",
    role: payload.role,
    is_password_reset: true,
  };

  mockUsers.unshift(newUser);

  return {
    user: newUser,
    generated_password: generatedPassword,
    email_delivery_status:
      "Chế độ tạm thời đang bật nên hệ thống chưa gửi email thật. Hãy dùng file .txt vừa tải về để gửi thủ công cho người dùng.",
  };
}

export async function getAdminUsers(): Promise<AdminManagedUser[]> {
  if (USE_MOCK_USER_ADMIN_DATA) {
    return Promise.resolve(mockUsers.map((user) => ({ ...user })));
  }

  return getJson<AdminManagedUser[]>(endpoints.listUsers());
}

export async function createAdminUser(
  payload: AdminCreateUserInput,
  existingUsers: AdminManagedUser[],
): Promise<AdminCreateUserResponse> {
  const validationErrors = validateAdminCreateUserInput(payload, existingUsers);
  if (validationErrors.length > 0) {
    throw new Error(validationErrors[0]);
  }

  if (USE_MOCK_USER_ADMIN_DATA) {
    const generatedPassword = generateRandomPassword();
    return Promise.resolve(createMockUserFromPayload(payload, generatedPassword));
  }

  return postJson<FastApiAdminCreateResponse>(
    endpoints.createUser(),
    {
      ...payload,
      username: payload.username.trim(),
      email: payload.email.trim().toLowerCase(),
      name: payload.name.trim(),
      location: payload.location.trim(),
      organization: payload.organization.trim(),
      description: payload.description.trim(),
      specialization: payload.specialization.trim(),
      icon: payload.icon.trim() || "/icon.png",
    },
  );
}

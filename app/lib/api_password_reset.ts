import type { User } from "./api_user";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";
const USE_MOCK_USER_DATA = process.env.NEXT_PUBLIC_USE_MOCK_DATA !== "false";

type PasswordResetApiResponse = {
  message: string;
};

type FastApiError = {
  detail?: string;
};

export type PasswordResetPayload = {
  currentPassword: string;
  newPassword: string;
};

export type PasswordResetResult = {
  message: string;
  usedMockData: boolean;
  user: User;
};

export class PasswordResetSessionError extends Error {
  constructor(message = "Phiên đăng nhập không còn hợp lệ.") {
    super(message);
    this.name = "PasswordResetSessionError";
  }
}

const mockPasswordsByUserId: Record<number, string> = {
  1: "student123",
  2: "admin123",
  7: "instructor123",
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

function normalizePassword(value: string): string {
  return value.trim();
}

export async function verifyPasswordResetSession(): Promise<User> {
  const response = await fetch("/api/auth/me", {
    method: "GET",
    credentials: "same-origin",
    cache: "no-store",
  });

  if (!response.ok) {
    throw new PasswordResetSessionError(
      response.status === 401
        ? "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại."
        : "Không thể xác minh phiên đăng nhập hiện tại.",
    );
  }

  return (await response.json()) as User;
}

export function getMockCurrentPasswordHint(user: User | null): string | null {
  if (!USE_MOCK_USER_DATA || !user) {
    return null;
  }

  return mockPasswordsByUserId[user.id] ?? `${user.role}123`;
}

export async function resetPasswordWithSessionCheck(
  payload: PasswordResetPayload,
): Promise<PasswordResetResult> {
  const user = await verifyPasswordResetSession();
  const currentPassword = normalizePassword(payload.currentPassword);
  const newPassword = normalizePassword(payload.newPassword);

  if (!currentPassword || !newPassword) {
    throw new Error("Vui lòng nhập đầy đủ mật khẩu hiện tại và mật khẩu mới.");
  }

  if (newPassword.length < 8) {
    throw new Error("Mật khẩu mới cần có ít nhất 8 ký tự.");
  }

  if (currentPassword === newPassword) {
    throw new Error("Mật khẩu mới cần khác mật khẩu hiện tại.");
  }

  if (USE_MOCK_USER_DATA) {
    const savedPassword = mockPasswordsByUserId[user.id] ?? `${user.role}123`;

    if (currentPassword !== savedPassword) {
      throw new Error("Mật khẩu hiện tại không đúng.");
    }

    mockPasswordsByUserId[user.id] = newPassword;

    return {
      message:
        "Đã cập nhật mật khẩu mới thành công trong chế độ dữ liệu mô phỏng.",
      usedMockData: true,
      user,
    };
  }

  const response = await fetch(`${API_BASE_URL}/user/reset_password/${user.id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      current_password: currentPassword,
      new_password: newPassword,
    }),
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  const result = (await response.json()) as PasswordResetApiResponse;

  return {
    message: result.message,
    usedMockData: false,
    user,
  };
}

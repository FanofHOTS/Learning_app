const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";
const USE_MOCK_PASSWORD_RECOVERY =
  process.env.NEXT_PUBLIC_USE_MOCK_DATA !== "false";

type FastApiError = {
  detail?: string;
};

type FastApiPasswordRecoveryResponse = {
  message: string;
};

export type PasswordRecoveryPayload = {
  userdata: string;
};

export type PasswordRecoveryResult = {
  message: string;
  usedMockData: boolean;
};

type MockRecoverableUser = {
  email: string;
  username: string;
};

const passwordRecoveryEndpoint = () => `${API_BASE_URL}/user/recover_password`;

const mockRecoverableUsers: MockRecoverableUser[] = [
  {
    email: "nguyenvanan@student.edu.vn",
    username: "Nguyễn Văn An",
  },
  {
    email: "vothienson@admin.edu.vn",
    username: "Võ Thiên Sơn",
  },
  {
    email: "nguyenthienlong@instructor.edu.vn",
    username: "Nguyễn Thiên Long",
  },
];

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

function normalizeUserdata(value: string): string {
  return value.trim();
}

function findMockRecoverableUser(userdata: string): MockRecoverableUser | null {
  const normalizedUserdata = userdata.trim().toLowerCase();

  return (
    mockRecoverableUsers.find(
      (user) =>
        user.username.trim().toLowerCase() === normalizedUserdata ||
        user.email.trim().toLowerCase() === normalizedUserdata,
    ) ?? null
  );
}

export async function requestPasswordRecovery(
  payload: PasswordRecoveryPayload,
): Promise<PasswordRecoveryResult> {
  const userdata = normalizeUserdata(payload.userdata);

  if (!userdata) {
    throw new Error("Vui lòng nhập tên đăng nhập hoặc email cần phục hồi.");
  }

  if (USE_MOCK_PASSWORD_RECOVERY) {
    const mockUser = findMockRecoverableUser(userdata);

    if (mockUser) {
      return {
        message:
          "Chế độ dữ liệu mô phỏng đang bật. Hệ thống đã mô phỏng việc gửi mật khẩu tạm thời tới email gắn với tài khoản. Vui lòng kiểm tra hộp thư của bạn.",
        usedMockData: true,
      };
    }

    return {
      message:
        "Chế độ dữ liệu mô phỏng đang bật. Nếu thông tin tài khoản chính xác, hệ thống sẽ gửi mật khẩu tạm thời tới email gắn với tài khoản khi kết nối FastAPI thật.",
      usedMockData: true,
    };
  }

  const response = await fetch(passwordRecoveryEndpoint(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      userdata,
    }),
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  const result =
    (await response.json()) as FastApiPasswordRecoveryResponse;

  return {
    message: result.message,
    usedMockData: false,
  };
}

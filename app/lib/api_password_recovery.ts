const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";
const USE_MOCK_PASSWORD_RECOVERY =
  process.env.NEXT_PUBLIC_USE_MOCK_DATA !== "false";
const NEXT_PASSWORD_RECOVERY_CODE_EXPIRE_MINUTES = Number.parseInt(
  process.env.PASSWORD_RECOVERY_CODE_EXPIRE_MINUTES ?? "5",
  10,
);

type FastApiError = {
  detail?: string;
};

type FastApiRequestCodeResponse = {
  message: string;
  expires_in_seconds: number;
};

type FastApiVerifyCodeResponse = {
  message: string;
};

export type PasswordRecoveryRequestPayload = {
  userdata: string;
};

export type PasswordRecoveryVerifyPayload = {
  userdata: string;
  verificationCode: string;
};

export type PasswordRecoveryRequestResult = {
  message: string;
  expiresInSeconds: number;
  usedMockData: boolean;
  debugCode?: string;
};

export type PasswordRecoveryVerifyResult = {
  message: string;
  usedMockData: boolean;
  debugTemporaryPassword?: string;
};

type MockRecoverableUser = {
  email: string;
  username: string;
};

type MockChallenge = {
  code: string;
  expiresAt: number;
  user: MockRecoverableUser;
};

const passwordRecoveryRequestEndpoint = () =>
  `${API_BASE_URL}/user/recover_password/request`;
const passwordRecoveryVerifyEndpoint = () =>
  `${API_BASE_URL}/user/recover_password/verify`;

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

const mockChallenges = new Map<string, MockChallenge>();

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

function normalizeVerificationCode(value: string): string {
  return value.trim().replace(/\s+/g, "").toUpperCase();
}

function getExpireSeconds(): number {
  const expireMinutes =
    Number.isFinite(NEXT_PASSWORD_RECOVERY_CODE_EXPIRE_MINUTES) &&
    NEXT_PASSWORD_RECOVERY_CODE_EXPIRE_MINUTES > 0
      ? NEXT_PASSWORD_RECOVERY_CODE_EXPIRE_MINUTES
      : 5;

  return expireMinutes * 60;
}

function generateMockVerificationCode(length = 6): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length }, () =>
    alphabet[Math.floor(Math.random() * alphabet.length)],
  ).join("");
}

function generateMockTemporaryPassword(length = 12): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  return Array.from({ length }, () =>
    alphabet[Math.floor(Math.random() * alphabet.length)],
  ).join("");
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

function getMockChallengeKey(user: MockRecoverableUser): string {
  return user.email.trim().toLowerCase();
}

export async function requestPasswordRecoveryCode(
  payload: PasswordRecoveryRequestPayload,
): Promise<PasswordRecoveryRequestResult> {
  const userdata = normalizeUserdata(payload.userdata);

  if (!userdata) {
    throw new Error("Vui lòng nhập tên đăng nhập hoặc email cần phục hồi.");
  }

  if (USE_MOCK_PASSWORD_RECOVERY) {
    const mockUser = findMockRecoverableUser(userdata);
    const expiresInSeconds = getExpireSeconds();

    if (mockUser) {
      const code = generateMockVerificationCode();
      mockChallenges.set(getMockChallengeKey(mockUser), {
        code,
        expiresAt: Date.now() + expiresInSeconds * 1000,
        user: mockUser,
      });

      return {
        message:
          "Chế độ dữ liệu mẫu đang bật. Hệ thống đã mô phỏng việc gửi mã xác nhận tới email gắn với tài khoản của bạn.",
        expiresInSeconds,
        usedMockData: true,
        debugCode: code,
      };
    }

    return {
      message:
        "Chế độ dữ liệu mẫu đang bật. Nếu thông tin tài khoản chính xác, hệ thống sẽ gửi mã xác nhận tới email gắn với tài khoản khi kết nối dữ liệu thật.",
      expiresInSeconds,
      usedMockData: true,
    };
  }

  const response = await fetch(passwordRecoveryRequestEndpoint(), {
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

  const result = (await response.json()) as FastApiRequestCodeResponse;

  return {
    message: result.message,
    expiresInSeconds: result.expires_in_seconds,
    usedMockData: false,
  };
}

export async function verifyPasswordRecoveryCode(
  payload: PasswordRecoveryVerifyPayload,
): Promise<PasswordRecoveryVerifyResult> {
  const userdata = normalizeUserdata(payload.userdata);
  const verificationCode = normalizeVerificationCode(payload.verificationCode);

  if (!userdata) {
    throw new Error("Vui lòng nhập lại tên đăng nhập hoặc email cần phục hồi.");
  }

  if (!verificationCode) {
    throw new Error("Vui lòng nhập mã xác nhận gồm 6 ký tự.");
  }

  if (USE_MOCK_PASSWORD_RECOVERY) {
    const mockUser = findMockRecoverableUser(userdata);
    const invalidCodeMessage =
      "Mã xác nhận không đúng hoặc đã hết hạn. Vui lòng kiểm tra lại hoặc gửi lại mã mới.";

    if (!mockUser) {
      throw new Error(invalidCodeMessage);
    }

    const challenge = mockChallenges.get(getMockChallengeKey(mockUser));

    if (!challenge || challenge.expiresAt <= Date.now()) {
      throw new Error(invalidCodeMessage);
    }

    if (challenge.code !== verificationCode) {
      throw new Error(invalidCodeMessage);
    }

    mockChallenges.delete(getMockChallengeKey(mockUser));

    return {
      message:
        "Chế độ dữ liệu mẫu đang bật. Hệ thống đã mô phỏng việc gửi mật khẩu tạm thời tới email gắn với tài khoản của bạn.",
      usedMockData: true,
      debugTemporaryPassword: generateMockTemporaryPassword(),
    };
  }

  const response = await fetch(passwordRecoveryVerifyEndpoint(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      userdata,
      verification_code: verificationCode,
    }),
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  const result = (await response.json()) as FastApiVerifyCodeResponse;

  return {
    message: result.message,
    usedMockData: false,
  };
}

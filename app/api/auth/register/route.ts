import { NextResponse } from "next/server";

import type { User } from "@/app/lib/api_user";
import {
  buildAuthErrorResponse,
  getFastApiCurrentUser,
  isRegistrationAllowed,
  requestFastApiJson,
  setAuthCookie,
  type AuthToken,
} from "@/app/lib/auth_server";

type RegisterPayload = {
  email?: string;
  password?: string;
  username?: string;
};

const emailVerificationRequired =
  process.env.EMAIL_VERIFICATION_REQUIRED?.trim().toLowerCase() === "true";

export async function POST(request: Request) {
  if (!isRegistrationAllowed()) {
    return NextResponse.json(
      { detail: "Chức năng đăng ký hiện đang tạm khóa." },
      { status: 403 },
    );
  }

  let payload: RegisterPayload;

  try {
    payload = (await request.json()) as RegisterPayload;
  } catch {
    return NextResponse.json(
      { detail: "Dữ liệu đăng ký không hợp lệ." },
      { status: 400 },
    );
  }

  const username = payload.username?.trim() ?? "";
  const email = payload.email?.trim() ?? "";
  const password = payload.password?.trim() ?? "";

  if (!username || !email || !password) {
    return NextResponse.json(
      { detail: "Vui lòng nhập đầy đủ tên đăng nhập, email và mật khẩu." },
      { status: 422 },
    );
  }

  try {
    const user = await requestFastApiJson<User>("/user/create", {
      body: JSON.stringify({
        email,
        password,
        username,
      }),
      headers: {
        "Content-Type": "application/json",
      },
      method: "POST",
    });

    if (!emailVerificationRequired) {
      const token = await requestFastApiJson<AuthToken>("/user/login", {
        body: JSON.stringify({
          login_password: password,
          userdata: username,
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const authenticatedUser = await getFastApiCurrentUser(
        token.access_token,
      );
      const response = NextResponse.json({
        user: authenticatedUser,
        message: "Đăng ký tài khoản thành công.",
        requiresEmailVerification: false,
      });
      setAuthCookie(response, token.access_token);
      return response;
    }

    return NextResponse.json({
      user,
      message: emailVerificationRequired
        ? "Đăng ký tài khoản thành công. Vui lòng kiểm tra email để xác thực tài khoản trước khi đăng nhập."
        : "Đăng ký tài khoản thành công.",
      requiresEmailVerification: emailVerificationRequired,
    });
  } catch (error) {
    return buildAuthErrorResponse(
      error,
      "Không thể hoàn tất đăng ký lúc này.",
    );
  }
}

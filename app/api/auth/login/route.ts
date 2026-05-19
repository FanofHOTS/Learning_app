import { NextResponse } from "next/server";

import {
  buildAuthErrorResponse,
  getFastApiCurrentUser,
  requestFastApiJson,
  setAuthCookie,
  type AuthToken,
} from "@/app/lib/auth_server";

type LoginPayload = {
  login_password?: string;
  userdata?: string;
};

export async function POST(request: Request) {
  let payload: LoginPayload;

  try {
    payload = (await request.json()) as LoginPayload;
  } catch {
    return NextResponse.json(
      { detail: "Dữ liệu đăng nhập không hợp lệ." },
      { status: 400 },
    );
  }

  const userdata = payload.userdata?.trim() ?? "";
  const loginPassword = payload.login_password?.trim() ?? "";

  if (!userdata || !loginPassword) {
    return NextResponse.json(
      { detail: "Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu." },
      { status: 422 },
    );
  }

  try {
    const token = await requestFastApiJson<AuthToken>("/user/login", {
      body: JSON.stringify({
        login_password: loginPassword,
        userdata,
      }),
      headers: {
        "Content-Type": "application/json",
      },
      method: "POST",
    });

    const user = await getFastApiCurrentUser(token.access_token);
    const response = NextResponse.json({ user });
    setAuthCookie(response, token.access_token);
    return response;
  } catch (error) {
    return buildAuthErrorResponse(
      error,
      "Không thể đăng nhập vào hệ thống lúc này.",
    );
  }
}

import { NextResponse } from "next/server";

import {
  buildAuthErrorResponse,
  clearAuthCookie,
  getFastApiCurrentUser,
  getSessionAccessToken,
} from "@/app/lib/auth_server";

export async function GET() {
  const accessToken = await getSessionAccessToken();

  if (!accessToken) {
    return NextResponse.json(
      { detail: "Chưa có phiên đăng nhập hợp lệ." },
      { status: 401 },
    );
  }

  try {
    const user = await getFastApiCurrentUser(accessToken);
    return NextResponse.json(user);
  } catch (error) {
    const response = buildAuthErrorResponse(
      error,
      "Không thể xác minh phiên đăng nhập hiện tại.",
    );

    if (response.status === 401) {
      clearAuthCookie(response);
    }

    return response;
  }
}

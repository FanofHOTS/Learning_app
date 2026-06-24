import { NextResponse } from "next/server";

import {
  buildAuthErrorResponse,
  getSessionAccessToken,
  requestFastApiJson,
} from "@/app/lib/auth_server";

export async function POST(request: Request) {
  const accessToken = await getSessionAccessToken();
  if (!accessToken) {
    return NextResponse.json(
      { detail: "Chưa có phiên đăng nhập hợp lệ." },
      { status: 401 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { detail: "Dữ liệu bình luận không hợp lệ." },
      { status: 400 },
    );
  }

  try {
    const data = await requestFastApiJson<unknown>("/course_discussion/create", {
      body: JSON.stringify(body),
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      method: "POST",
    });
    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    return buildAuthErrorResponse(
      error,
      "Không thể gửi bình luận đến máy chủ.",
    );
  }
}

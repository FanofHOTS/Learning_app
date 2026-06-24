import { NextResponse } from "next/server";

import {
  buildAuthErrorResponse,
  getSessionAccessToken,
  requestFastApiJson,
} from "@/app/lib/auth_server";

type RouteParams = { params: Promise<{ commentId: string }> };

export async function PUT(request: Request, { params }: RouteParams) {
  const { commentId } = await params;

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
      { detail: "Dữ liệu chỉnh sửa không hợp lệ." },
      { status: 400 },
    );
  }

  try {
    const data = await requestFastApiJson<unknown>(
      `/discussion/update/${commentId}`,
      {
        body: JSON.stringify(body),
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        method: "PUT",
      },
    );
    return NextResponse.json(data);
  } catch (error) {
    return buildAuthErrorResponse(
      error,
      "Không thể chỉnh sửa bình luận trên máy chủ.",
    );
  }
}

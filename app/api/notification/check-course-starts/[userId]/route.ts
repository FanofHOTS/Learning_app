import { NextRequest, NextResponse } from "next/server";

import {
  buildAuthErrorResponse,
  getSessionAccessToken,
  requestFastApiJson,
} from "@/app/lib/auth_server";

type RouteParams = { params: Promise<{ userId: string }> };

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { userId } = await params;

  const accessToken = await getSessionAccessToken();
  if (!accessToken) {
    return NextResponse.json(
      { detail: "Chưa có phiên đăng nhập hợp lệ." },
      { status: 401 },
    );
  }

  try {
    const data = await requestFastApiJson<{ created: number; message: string }>(
      `/notification/check-course-starts/${userId}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        method: "GET",
      },
    );
    return NextResponse.json(data);
  } catch (error) {
    return buildAuthErrorResponse(
      error,
      "Không thể kiểm tra khóa học sẵn sàng trên máy chủ.",
    );
  }
}

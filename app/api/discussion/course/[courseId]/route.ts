import { NextRequest, NextResponse } from "next/server";

import {
  buildAuthErrorResponse,
  getSessionAccessToken,
  requestFastApiJson,
} from "@/app/lib/auth_server";

type RouteParams = { params: Promise<{ courseId: string }> };

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { courseId } = await params;

  const accessToken = await getSessionAccessToken();
  if (!accessToken) {
    return NextResponse.json(
      { detail: "Chưa có phiên đăng nhập hợp lệ." },
      { status: 401 },
    );
  }

  try {
    const data = await requestFastApiJson<unknown>(
      `/course_discussion/course/${courseId}`,
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
      "Không thể lấy bình luận khóa học từ máy chủ.",
    );
  }
}

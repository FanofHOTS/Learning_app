import { NextResponse } from "next/server";

import {
  buildAuthErrorResponse,
  getSessionAccessToken,
  requestFastApiJson,
} from "@/app/lib/auth_server";

type RouteParams = { params: Promise<{ commentId: string }> };

export async function DELETE(_request: Request, { params }: RouteParams) {
  const { commentId } = await params;

  const accessToken = await getSessionAccessToken();
  if (!accessToken) {
    return NextResponse.json(
      { detail: "Chưa có phiên đăng nhập hợp lệ." },
      { status: 401 },
    );
  }

  try {
    const data = await requestFastApiJson<unknown>(
      `/course_discussion/delete/${commentId}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        method: "DELETE",
      },
    );
    return NextResponse.json(data);
  } catch (error) {
    return buildAuthErrorResponse(
      error,
      "Không thể xóa bình luận trên máy chủ.",
    );
  }
}

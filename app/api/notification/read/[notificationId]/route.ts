import { NextResponse } from "next/server";

import {
  buildAuthErrorResponse,
  getSessionAccessToken,
  requestFastApiJson,
} from "@/app/lib/auth_server";

type RouteParams = { params: Promise<{ notificationId: string }> };

export async function PUT(_request: Request, { params }: RouteParams) {
  const { notificationId } = await params;

  const accessToken = await getSessionAccessToken();
  if (!accessToken) {
    return NextResponse.json(
      { detail: "Chưa có phiên đăng nhập hợp lệ." },
      { status: 401 },
    );
  }

  try {
    const data = await requestFastApiJson<unknown>(
      `/notification/read/${notificationId}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        method: "PUT",
      },
    );
    return NextResponse.json(data);
  } catch (error) {
    return buildAuthErrorResponse(
      error,
      "Không thể cập nhật thông báo trên máy chủ.",
    );
  }
}

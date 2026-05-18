import { NextResponse } from "next/server";

import {
  buildAuthErrorResponse,
  clearAuthCookie,
  getSessionAccessToken,
  requestFastApiJson,
} from "@/app/lib/auth_server";

type AdminCreateUserPayload = {
  description?: string;
  email?: string;
  icon?: string;
  location?: string;
  name?: string | null;
  organization?: string;
  role?: string;
  specialization?: string;
  username?: string;
};

function buildUnauthorizedResponse() {
  return NextResponse.json(
    { detail: "Phiên đăng nhập không còn hợp lệ. Vui lòng đăng nhập lại." },
    { status: 401 },
  );
}

export async function GET() {
  const accessToken = await getSessionAccessToken();

  if (!accessToken) {
    return buildUnauthorizedResponse();
  }

  try {
    const users = await requestFastApiJson("/user/admin/list", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      method: "GET",
    });

    return NextResponse.json(users);
  } catch (error) {
    const response = buildAuthErrorResponse(
      error,
      "Không thể tải danh sách người dùng từ FastAPI.",
    );

    if (response.status === 401) {
      clearAuthCookie(response);
    }

    return response;
  }
}

export async function POST(request: Request) {
  const accessToken = await getSessionAccessToken();

  if (!accessToken) {
    return buildUnauthorizedResponse();
  }

  let payload: AdminCreateUserPayload;

  try {
    payload = (await request.json()) as AdminCreateUserPayload;
  } catch {
    return NextResponse.json(
      { detail: "Dữ liệu tạo người dùng không hợp lệ." },
      { status: 400 },
    );
  }

  try {
    const createdUser = await requestFastApiJson("/user/admin/create", {
      body: JSON.stringify(payload),
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      method: "POST",
    });

    return NextResponse.json(createdUser, { status: 201 });
  } catch (error) {
    const response = buildAuthErrorResponse(
      error,
      "Không thể tạo người dùng mới trên FastAPI.",
    );

    if (response.status === 401) {
      clearAuthCookie(response);
    }

    return response;
  }
}

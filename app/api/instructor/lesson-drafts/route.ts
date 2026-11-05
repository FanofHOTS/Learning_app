import { NextResponse } from "next/server";

import {
  buildAuthErrorResponse,
  clearAuthCookie,
  getSessionAccessToken,
  requestFastApiJson,
} from "@/app/lib/auth_server";

function unauthorizedResponse() {
  return NextResponse.json(
    { detail: "Phiên đăng nhập không còn hợp lệ. Vui lòng đăng nhập lại." },
    { status: 401 },
  );
}

export async function GET() {
  const accessToken = await getSessionAccessToken();
  if (!accessToken) {
    return unauthorizedResponse();
  }

  try {
    const drafts = await requestFastApiJson<unknown>("/lesson-draft/", {
      headers: { Authorization: `Bearer ${accessToken}` },
      method: "GET",
    });
    return NextResponse.json(drafts);
  } catch (error) {
    const response = buildAuthErrorResponse(
      error,
      "Không thể tải bản nháp từ máy chủ.",
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
    return unauthorizedResponse();
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { detail: "Dữ liệu bản nháp không hợp lệ." },
      { status: 400 },
    );
  }

  try {
    const draft = await requestFastApiJson<unknown>("/lesson-draft/", {
      body: JSON.stringify(payload),
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      method: "POST",
    });
    return NextResponse.json(draft, { status: 201 });
  } catch (error) {
    const response = buildAuthErrorResponse(
      error,
      "Không thể tạo bản nháp trên máy chủ.",
    );
    if (response.status === 401) {
      clearAuthCookie(response);
    }
    return response;
  }
}

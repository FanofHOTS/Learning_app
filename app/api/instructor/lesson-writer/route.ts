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

export async function POST(request: Request) {
  const accessToken = await getSessionAccessToken();
  if (!accessToken) {
    return unauthorizedResponse();
  }

  if (request.headers.get("content-type")?.includes("multipart/form-data")) {
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return NextResponse.json(
        { detail: "Không thể đọc tệp tải lên." },
        { status: 400 },
      );
    }

    if (!(formData.get("file") instanceof File)) {
      return NextResponse.json(
        { detail: "Vui lòng chọn tệp tài liệu." },
        { status: 400 },
      );
    }

    try {
      const result = await requestFastApiJson<unknown>(
        "/lesson-writer/generate-upload",
        {
          body: formData,
          headers: { Authorization: `Bearer ${accessToken}` },
          method: "POST",
        },
      );
      return NextResponse.json(result);
    } catch (error) {
      const response = buildAuthErrorResponse(
        error,
        "Không thể tạo nội dung từ tệp tài liệu.",
      );
      if (response.status === 401) {
        clearAuthCookie(response);
      }
      return response;
    }
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { detail: "Yêu cầu soạn bài bằng AI không hợp lệ." },
      { status: 400 },
    );
  }

  try {
    const result = await requestFastApiJson<unknown>("/lesson-writer/generate", {
      body: JSON.stringify(payload),
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      method: "POST",
    });
    return NextResponse.json(result);
  } catch (error) {
    const response = buildAuthErrorResponse(
      error,
      "Không thể tạo nội dung bài giảng bằng AI.",
    );
    if (response.status === 401) {
      clearAuthCookie(response);
    }
    return response;
  }
}

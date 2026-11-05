import { NextResponse } from "next/server";

import {
  buildAuthErrorResponse,
  clearAuthCookie,
  getSessionAccessToken,
  requestFastApiJson,
} from "@/app/lib/auth_server";

type RouteParams = { params: Promise<{ draftId: string }> };

function unauthorizedResponse() {
  return NextResponse.json(
    { detail: "Phiên đăng nhập không còn hợp lệ. Vui lòng đăng nhập lại." },
    { status: 401 },
  );
}

function parseDraftId(rawDraftId: string): number | null {
  const draftId = Number(rawDraftId);
  return Number.isSafeInteger(draftId) && draftId > 0 ? draftId : null;
}

export async function GET(_request: Request, { params }: RouteParams) {
  const { draftId: rawDraftId } = await params;
  const draftId = parseDraftId(rawDraftId);
  if (draftId === null) {
    return NextResponse.json(
      { detail: "Mã bản nháp không hợp lệ." },
      { status: 400 },
    );
  }

  const accessToken = await getSessionAccessToken();
  if (!accessToken) {
    return unauthorizedResponse();
  }

  try {
    const draft = await requestFastApiJson<unknown>(
      `/lesson-draft/${draftId}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        method: "GET",
      },
    );
    return NextResponse.json(draft);
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

export async function PUT(request: Request, { params }: RouteParams) {
  const { draftId: rawDraftId } = await params;
  const draftId = parseDraftId(rawDraftId);
  if (draftId === null) {
    return NextResponse.json(
      { detail: "Mã bản nháp không hợp lệ." },
      { status: 400 },
    );
  }

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
    const draft = await requestFastApiJson<unknown>(
      `/lesson-draft/${draftId}`,
      {
        body: JSON.stringify(payload),
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        method: "PUT",
      },
    );
    return NextResponse.json(draft);
  } catch (error) {
    const response = buildAuthErrorResponse(
      error,
      "Không thể lưu bản nháp trên máy chủ.",
    );
    if (response.status === 401) {
      clearAuthCookie(response);
    }
    return response;
  }
}

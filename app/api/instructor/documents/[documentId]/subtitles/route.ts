import { NextResponse } from "next/server";

import {
  buildAuthErrorResponse,
  clearAuthCookie,
  getSessionAccessToken,
  requestFastApiJson,
} from "@/app/lib/auth_server";

type RouteParams = { params: Promise<{ documentId: string }> };

function parseDocumentId(rawDocumentId: string): number | null {
  const documentId = Number(rawDocumentId);
  return Number.isSafeInteger(documentId) && documentId > 0
    ? documentId
    : null;
}

function unauthorizedResponse() {
  return NextResponse.json(
    { detail: "Phiên đăng nhập không còn hợp lệ. Vui lòng đăng nhập lại." },
    { status: 401 },
  );
}

async function forwardError(error: unknown, fallback: string) {
  const response = buildAuthErrorResponse(error, fallback);
  if (response.status === 401) {
    clearAuthCookie(response);
  }
  return response;
}

export async function GET(_request: Request, { params }: RouteParams) {
  const { documentId: rawDocumentId } = await params;
  const documentId = parseDocumentId(rawDocumentId);
  if (documentId === null) {
    return NextResponse.json(
      { detail: "Mã tài liệu không hợp lệ." },
      { status: 400 },
    );
  }

  const accessToken = await getSessionAccessToken();
  if (!accessToken) return unauthorizedResponse();

  try {
    const subtitles = await requestFastApiJson<unknown>(
      `/document/${documentId}/subtitles/manage`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        method: "GET",
      },
    );
    return NextResponse.json(subtitles);
  } catch (error) {
    return forwardError(error, "Không thể tải phụ đề từ máy chủ.");
  }
}

export async function PUT(request: Request, { params }: RouteParams) {
  const { documentId: rawDocumentId } = await params;
  const documentId = parseDocumentId(rawDocumentId);
  if (documentId === null) {
    return NextResponse.json(
      { detail: "Mã tài liệu không hợp lệ." },
      { status: 400 },
    );
  }

  const accessToken = await getSessionAccessToken();
  if (!accessToken) return unauthorizedResponse();

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { detail: "Dữ liệu phụ đề không hợp lệ." },
      { status: 400 },
    );
  }

  try {
    const subtitle = await requestFastApiJson<unknown>(
      `/document/${documentId}/subtitles`,
      {
        body: JSON.stringify(payload),
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        method: "PUT",
      },
    );
    return NextResponse.json(subtitle);
  } catch (error) {
    return forwardError(error, "Không thể lưu phụ đề lên máy chủ.");
  }
}

export async function DELETE(request: Request, { params }: RouteParams) {
  const { documentId: rawDocumentId } = await params;
  const documentId = parseDocumentId(rawDocumentId);
  const subtitleId = Number(new URL(request.url).searchParams.get("subtitle_id"));
  if (
    documentId === null ||
    !Number.isSafeInteger(subtitleId) ||
    subtitleId <= 0
  ) {
    return NextResponse.json(
      { detail: "Mã tài liệu hoặc mã phụ đề không hợp lệ." },
      { status: 400 },
    );
  }

  const accessToken = await getSessionAccessToken();
  if (!accessToken) return unauthorizedResponse();

  try {
    const result = await requestFastApiJson<unknown>(
      `/document/${documentId}/subtitles?subtitle_id=${subtitleId}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        method: "DELETE",
      },
    );
    return NextResponse.json(result);
  } catch (error) {
    return forwardError(error, "Không thể xóa phụ đề trên máy chủ.");
  }
}

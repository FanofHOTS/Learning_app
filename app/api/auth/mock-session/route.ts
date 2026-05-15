import { NextResponse } from "next/server";

import { clearAuthCookie, setAuthCookie } from "@/app/lib/auth_server";
import { isMockDataEnabled, isUserRole } from "@/app/lib/public_site";

type MockSessionPayload = {
  role?: string;
};

export async function POST(request: Request) {
  if (!isMockDataEnabled()) {
    return NextResponse.json(
      { detail: "Chế độ dữ liệu giả lập hiện không được bật." },
      { status: 403 },
    );
  }

  let payload: MockSessionPayload;

  try {
    payload = (await request.json()) as MockSessionPayload;
  } catch {
    return NextResponse.json(
      { detail: "Dữ liệu mô phỏng không hợp lệ." },
      { status: 400 },
    );
  }

  const role = payload.role?.trim() ?? "";

  if (!isUserRole(role)) {
    return NextResponse.json(
      { detail: "Vai trò mô phỏng không hợp lệ." },
      { status: 422 },
    );
  }

  const response = NextResponse.json({ ok: true, role });
  setAuthCookie(response, role);
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  clearAuthCookie(response);
  return response;
}

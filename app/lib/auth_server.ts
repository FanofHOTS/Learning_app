import "server-only";

import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import type { User } from "./api_user";
import { getMockUserByAccessToken, isMockDataEnabled } from "./public_site";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";
const DEFAULT_ACCESS_TOKEN_EXPIRE_MINUTES = 120;
const TRUE_ENV_VALUES = new Set(["1", "true", "yes", "on"]);

export const AUTH_COOKIE_NAME =
  process.env.NODE_ENV === "production"
    ? "__Secure-trang-web-hoc-tap-token"
    : "trang-web-hoc-tap-token";

type FastApiError = {
  detail?: string;
};

export type AuthToken = {
  access_token: string;
  token_type: string;
};

class FastApiRequestError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "FastApiRequestError";
    this.status = status;
  }
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
  const parsedValue = Number.parseInt(value?.trim() ?? "", 10);

  if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
    return fallback;
  }

  return parsedValue;
}

function parseBooleanEnv(value: string | undefined, fallback = false): boolean {
  if (value == null) {
    return fallback;
  }

  return TRUE_ENV_VALUES.has(value.trim().toLowerCase());
}

async function parseFastApiError(
  response: Response,
  fallbackMessage: string,
): Promise<string> {
  try {
    const error = (await response.json()) as FastApiError;

    if (typeof error.detail === "string" && error.detail.trim()) {
      return error.detail;
    }
  } catch {
    // Bỏ qua lỗi parse để dùng thông báo mặc định.
  }

  return fallbackMessage;
}

function getAuthCookieMaxAgeSeconds(): number {
  return (
    parsePositiveInt(
      process.env.ACCESS_TOKEN_EXPIRE_MINUTES,
      DEFAULT_ACCESS_TOKEN_EXPIRE_MINUTES,
    ) * 60
  );
}

function getAuthCookieOptions(maxAge = getAuthCookieMaxAgeSeconds()) {
  return {
    httpOnly: true,
    maxAge,
    path: "/",
    priority: "high" as const,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
  };
}

export function isRegistrationAllowed(): boolean {
  return parseBooleanEnv(process.env.REGISTER_ALLOWED, false);
}

export async function requestFastApiJson<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      Accept: "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    throw new FastApiRequestError(
      response.status,
      await parseFastApiError(
        response,
        "Không thể kết nối tới máy chủ FastAPI.",
      ),
    );
  }

  return (await response.json()) as T;
}

export async function getFastApiCurrentUser(
  accessToken: string,
): Promise<User> {
  const mockUser =
    isMockDataEnabled() ? getMockUserByAccessToken(accessToken) : null;

  if (mockUser) {
    return mockUser;
  }

  return requestFastApiJson<User>("/user/me", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    method: "GET",
  });
}

export function setAuthCookie(
  response: NextResponse,
  accessToken: string,
): void {
  response.cookies.set({
    name: AUTH_COOKIE_NAME,
    value: accessToken,
    ...getAuthCookieOptions(),
  });
}

export function clearAuthCookie(response: NextResponse): void {
  response.cookies.set({
    name: AUTH_COOKIE_NAME,
    value: "",
    ...getAuthCookieOptions(0),
  });
}

export async function getSessionAccessToken(): Promise<string | null> {
  return (await cookies()).get(AUTH_COOKIE_NAME)?.value ?? null;
}

export async function getAuthenticatedUser(): Promise<User | null> {
  const accessToken = await getSessionAccessToken();

  if (!accessToken) {
    return null;
  }

  const mockUser =
    isMockDataEnabled() ? getMockUserByAccessToken(accessToken) : null;

  if (mockUser) {
    return mockUser;
  }

  try {
    return await getFastApiCurrentUser(accessToken);
  } catch {
    return null;
  }
}

export function buildAuthErrorResponse(
  error: unknown,
  fallbackMessage: string,
): NextResponse {
  if (error instanceof FastApiRequestError) {
    return NextResponse.json(
      { detail: error.message },
      { status: error.status },
    );
  }

  return NextResponse.json({ detail: fallbackMessage }, { status: 500 });
}

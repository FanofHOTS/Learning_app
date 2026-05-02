"use client";

import path from "path/win32";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";

export type LoginPayload = {
  userdata: string;
  login_password: string;
};

export type RegisterPayload = {
  username: string;
  email: string;
  password: string;
};

export type AuthToken = {
  access_token: string;
  token_type: string;
};

export type CurrentUser = {
  id: number;
  username: string;
  email: string;
  icon: string;
  role: string;
};

type FastApiError = {
  detail?: string;
};

async function parseError(response: Response): Promise<string> {
  try {
    const error = (await response.json()) as FastApiError;
    if (typeof error.detail === "string" && error.detail.trim()) {
      return error.detail;
    }
  } catch {
    // Ignore JSON parse failures and fall back to a generic error.
  }

  return "Không thể kết nối tới máy chủ FastAPI.";
}

export async function loginWithFastApi(payload: LoginPayload): Promise<AuthToken> {
  const response = await fetch(`${API_BASE_URL}/user/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  return (await response.json()) as AuthToken;
}

export async function registerWithFastApi(
  payload: RegisterPayload,
): Promise<CurrentUser> {
  const response = await fetch(`${API_BASE_URL}/user/create`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  return (await response.json()) as CurrentUser;
}

export async function getCurrentUser(accessToken: string): Promise<CurrentUser> {
  const response = await fetch(`${API_BASE_URL}/user/me`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  return (await response.json()) as CurrentUser;
}

export function saveAuthSession(accessToken: string, currentUser: CurrentUser) {
  localStorage.setItem("accessToken", accessToken);
  localStorage.setItem("currentUser_id", `${currentUser.id}`);
  //  Sử dụng secure cookie
  document.cookie = `accessToken=${accessToken}; path=/; secure; HttpOnly`;
  document.cookie = `currentUser_id=${currentUser.id}; path=/; secure; HttpOnly`;
  //  Sử dụng sessionStorage
  sessionStorage.setItem("accessToken", accessToken);
  sessionStorage.setItem("currentUser_id", `${currentUser.id}`);
}

export function getRedirectPathByRole(user: CurrentUser): string {
  if (user.role === "admin") {
    return `/admin`;
  }

  if (user.role === "instructor") {
    return `/instructor`;
  }

  return `/student`;
}
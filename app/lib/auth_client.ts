"use client";
import type { User } from "./api_user";

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

type FastApiError = {
  detail?: string;
};

const mockUser: User[] = [
    {
    id: 1,
    username: "Nguyễn Văn An",
    email: "nguyenvanan@student.edu.vn",
    icon: "/icon.png",
    role: "student",
    },
    {
    id: 7,
    username: "Nguyễn Thiên Long",
    email: "nguyenthienlong@instructor.edu.vn",
    icon: "/icon.png",
    role: "instructor",
    },
    {
    id: 2,
    username: "Võ Thiên Sơn",
    email: "vothienson@admin.edu.vn",
    icon: "/icon.png",
    role: "admin", 
    }
]

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
): Promise<User> {
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

  return (await response.json()) as User;
}

export async function getCurrentUser(accessToken: string): Promise<User> {
  if (accessToken == "admin"){
    const currentUser: User = {
      id: 2,
      username: "Võ Thiên Sơn",
      email: "vothienson@admin.edu.vn",
      icon: "/icon.png",
      role: "admin", 
    } 
    return Promise.resolve(currentUser)
  }
  if (accessToken == "instructor"){
    const currentUser: User = {
      id: 7,
      username: "Nguyễn Thiên Long",
      email: "nguyenthienlong@instructor.edu.vn",
      icon: "/icon.png",
      role: "instructor",
    } 
    return Promise.resolve(currentUser)
  }
  if (accessToken == "student"){
    const currentUser: User = {
      id: 1,
      username: "Nguyễn Văn An",
      email: "nguyenvanan@student.edu.vn",
      icon: "/icon.png",
      role: "student",
    } 
    return Promise.resolve(currentUser)
  }
  const response = await fetch(`${API_BASE_URL}/user/me`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(await parseError(response));
  }

  return (await response.json()) as User;
}

export function saveAuthSession(accessToken: string, User: User) {
  localStorage.setItem("accessToken", accessToken);
  localStorage.setItem("currentUser_id", `${User.id}`);
  //  Sử dụng secure cookie
  document.cookie = `accessToken=${accessToken}; path=/; secure; HttpOnly`;
  document.cookie = `currentUser_id=${User.id}; path=/; secure; HttpOnly`;
  //  Sử dụng sessionStorage
  sessionStorage.setItem("accessToken", accessToken);
  sessionStorage.setItem("currentUser_id", `${User.id}`);
}

export function getRedirectPathByRole(user: User): string {
  if (user.role === "admin") {
    return `/admin`;
  }

  if (user.role === "instructor") {
    return `/instructor`;
  }

  return `/student`;
}
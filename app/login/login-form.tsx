"use client";

import Link from "next/link";
import { ArrowRight, LoaderCircle } from "lucide-react";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import { AuthPasswordField } from "@/app/components/auth-password-field";
import type { User } from "@/app/lib/api_user";
import { getRedirectPathByRole } from "@/app/lib/auth_paths";

type LoginResponse = {
  user: User;
};

type ErrorResponse = {
  detail?: string;
};

async function parseResponseError(response: Response): Promise<string> {
  try {
    const error = (await response.json()) as ErrorResponse;

    if (typeof error.detail === "string" && error.detail.trim()) {
      return error.detail;
    }
  } catch {
    // Bỏ qua lỗi parse để dùng thông báo mặc định.
  }

  return "Đăng nhập thất bại. Vui lòng thử lại.";
}

export function LoginForm() {
  const router = useRouter();
  const [userdata, setUserdata] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth/login", {
        body: JSON.stringify({
          login_password: password,
          userdata,
        }),
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });

      if (!response.ok) {
        throw new Error(await parseResponseError(response));
      }

      const result = (await response.json()) as LoginResponse;
      const redirectPath = getRedirectPathByRole(result.user);
      router.replace(redirectPath);
      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Đăng nhập thất bại. Vui lòng thử lại.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <div className="mb-8">
        <p className="text-sm font-semibold uppercase tracking-[0.22em] text-sky-700">
          Đăng nhập
        </p>
        <h2 className="mt-3 text-3xl font-semibold text-slate-900">
          Truy cập tài khoản của bạn
        </h2>
        <p className="mt-3 text-sm leading-6 text-slate-500">
          Nhập tên đăng nhập hoặc email để tiếp tục vào hệ thống học tập.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <label
            htmlFor="userdata"
            className="text-sm font-medium text-slate-700"
          >
            Email hoặc tên đăng nhập
          </label>
          <input
            id="userdata"
            type="text"
            value={userdata}
            onChange={(event) => setUserdata(event.target.value)}
            autoComplete="username"
            required
            placeholder="vd: nguyenvanan@student.edu.vn"
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-400 focus:bg-white focus:shadow-[0_0_0_4px_rgba(14,165,233,0.15)]"
          />
        </div>

        <AuthPasswordField
          id="password"
          label="Mật khẩu"
          value={password}
          onChange={setPassword}
          autoComplete="current-password"
          placeholder="Nhập mật khẩu của bạn"
        />

        {errorMessage ? (
          <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {errorMessage}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-sky-700 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-sky-200 transition hover:bg-sky-800 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isSubmitting ? (
            <>
              <LoaderCircle className="h-4 w-4 animate-spin" />
              <span>Đang đăng nhập...</span>
            </>
          ) : (
            <>
              <span>Đăng nhập</span>
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </button>
      </form>

      <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-500">
        <span>Nếu quên thông tin đăng nhập, vui lòng liên hệ quản trị viên.</span>
        <Link href="/register" className="font-medium text-sky-700 hover:text-sky-900">
          Tạo tài khoản mới
        </Link>
      </div>
    </>
  );
}

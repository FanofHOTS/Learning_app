"use client";

import Link from "next/link";
import { ArrowRight, LoaderCircle } from "lucide-react";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import { AuthPasswordField } from "@/app/components/auth-password-field";
import type { User } from "@/app/lib/api_user";
import { getRedirectPathByRole } from "@/app/lib/auth_paths";

type RegisterResponse = {
  user: User;
  message?: string;
  requiresEmailVerification?: boolean;
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

  return "Đăng ký thất bại. Vui lòng thử lại.";
}

export function RegisterForm() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    if (password !== confirmPassword) {
      setErrorMessage("Mật khẩu xác nhận không khớp.");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth/register", {
        body: JSON.stringify({
          email,
          password,
          username,
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

      const result = (await response.json()) as RegisterResponse;

      if (result.requiresEmailVerification) {
        setSuccessMessage(
          result.message ??
            "Đăng ký thành công. Vui lòng kiểm tra email để xác thực tài khoản.",
        );
        setUsername("");
        setEmail("");
        setPassword("");
        setConfirmPassword("");
        return;
      }

      const redirectPath = getRedirectPathByRole(result.user);
      router.replace(redirectPath);
      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Đăng ký thất bại. Vui lòng thử lại.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <div className="mb-8">
        <p className="text-sm font-semibold uppercase tracking-[0.22em] text-sky-700">
          Đăng ký
        </p>
        <h2 className="mt-3 text-3xl font-semibold text-slate-900">
          Tạo tài khoản học tập mới
        </h2>
        <p className="mt-3 text-sm leading-6 text-slate-500">
          Điền đầy đủ thông tin để khởi tạo tài khoản sinh viên và bắt đầu sử
          dụng hệ thống.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <label
            htmlFor="username"
            className="text-sm font-medium text-slate-700"
          >
            Tên đăng nhập
          </label>
          <input
            id="username"
            type="text"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            autoComplete="username"
            required
            placeholder="Nhập tên đăng nhập"
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-400 focus:bg-white focus:shadow-[0_0_0_4px_rgba(14,165,233,0.15)]"
          />
        </div>

        <div className="space-y-2">
          <label
            htmlFor="email"
            className="text-sm font-medium text-slate-700"
          >
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            required
            placeholder="vd: tenban@student.edu.vn"
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-400 focus:bg-white focus:shadow-[0_0_0_4px_rgba(14,165,233,0.15)]"
          />
          <p className="text-xs leading-5 text-slate-500">
            Hệ thống hiện hỗ trợ các miền email sau:
            {" "}
            <span className="font-medium text-slate-700">
              gmail.com, yahoo.com, outlook.com.vn, outlook.com
            </span>
            .
          </p>
        </div>

        <AuthPasswordField
          id="password"
          label="Mật khẩu"
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
          minLength={8}
          placeholder="Tối thiểu 8 ký tự"
        />

        <AuthPasswordField
          id="confirmPassword"
          label="Xác nhận mật khẩu"
          value={confirmPassword}
          onChange={setConfirmPassword}
          autoComplete="new-password"
          minLength={8}
          placeholder="Nhập lại mật khẩu"
        />

        {errorMessage ? (
          <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {errorMessage}
          </p>
        ) : null}

        {successMessage ? (
          <div className="rounded-3xl border border-emerald-200 bg-gradient-to-r from-emerald-50 via-white to-sky-50 px-4 py-4 shadow-sm">
            <p className="text-sm font-semibold text-emerald-800">
              Đăng ký thành công
            </p>
            <p className="mt-2 text-sm leading-6 text-emerald-700">
              {successMessage}
            </p>
            <p className="mt-2 text-xs leading-5 text-emerald-700/90">
              Hãy mở hộp thư đến hoặc thư rác để bấm vào liên kết xác thực email đã được gửi.
            </p>
          </div>
        ) : null}

        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-sky-700 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-sky-200 transition hover:bg-sky-800 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isSubmitting ? (
            <>
              <LoaderCircle className="h-4 w-4 animate-spin" />
              <span>Đang tạo tài khoản...</span>
            </>
          ) : (
            <>
              <span>Đăng ký ngay</span>
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </button>
      </form>

      <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-500">
        <span>Đã có tài khoản?</span>
        <Link href="/login" className="font-medium text-sky-700 hover:text-sky-900">
          Quay về trang đăng nhập
        </Link>
      </div>
    </>
  );
}

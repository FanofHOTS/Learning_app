"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import {
  getCurrentUser,
  getRedirectPathByRole,
  loginWithFastApi,
  saveAuthSession,
} from "../lib/auth_client";

function LoginForm() {
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
      const token = await loginWithFastApi({
        userdata,
        login_password: password,
      });

      const currentUser = await getCurrentUser(token.access_token);
      saveAuthSession(token.access_token, currentUser);
      router.push(getRedirectPathByRole(currentUser));
      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Đăng nhập thất bại.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="w-full max-w-sm" onSubmit={handleSubmit}>
      <div className="mb-4">
        <label htmlFor="userdata" className="mb-2 block font-bold text-gray-700">
          Email hoặc tên đăng nhập
        </label>
        <input
          type="text"
          id="userdata"
          value={userdata}
          onChange={(event) => setUserdata(event.target.value)}
          className="w-full rounded border px-3 py-2 leading-tight text-gray-700 shadow appearance-none focus:outline-none focus:shadow-outline"
          placeholder="Nhập email hoặc tên đăng nhập"
          required
        />
      </div>

      <div className="mb-6">
        <label htmlFor="password" className="mb-2 block font-bold text-gray-700">
          Mật khẩu
        </label>
        <input
          type="password"
          id="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="w-full rounded border px-3 py-2 leading-tight text-gray-700 shadow appearance-none focus:outline-none focus:shadow-outline"
          placeholder="Nhập mật khẩu"
          required
        />
      </div>

      {errorMessage ? (
        <p className="mb-4 rounded bg-red-50 px-3 py-2 text-sm text-red-600">
          {errorMessage}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isSubmitting}
        className="rounded bg-blue-500 px-4 py-2 font-bold text-white focus:outline-none focus:shadow-outline hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {isSubmitting ? "Đang đăng nhập..." : "Đăng nhập"}
      </button>
    </form>
  );
}

export default function Home() {
  return (
    <main className="min-h-screen items-center justify-between pt-32">
      <div className="flex flex-col items-center justify-center flex-1 px-4 text-center">
        <h1 className="mb-4 text-5xl font-bold">Trang Đăng Nhập</h1>
        <p className="mb-8 text-xl text-gray-600">
          Vui lòng nhập thông tin đăng nhập của bạn để tiếp tục.
        </p>
        <LoginForm />
      </div>
      <div className="w-full bg-gray-100 py-4 text-center">
        <p className="text-gray-600">
          &copy; 2026 Trang Web Học Tập. Mọi quyền được bảo lưu.
        </p>
      </div>
    </main>
  );
}
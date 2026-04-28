"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

import {
  getCurrentUser,
  getRedirectPathByRole,
  loginWithFastApi,
  registerWithFastApi,
  saveAuthSession,
} from "../lib/auth_client";

function RegisterForm() {
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
      await registerWithFastApi({
        username,
        email,
        password,
      });

      const token = await loginWithFastApi({
        userdata: username,
        login_password: password,
      });

      const currentUser = await getCurrentUser(token.access_token);
      saveAuthSession(token.access_token, currentUser);
      setSuccessMessage("Đăng ký thành công. Đang chuyển hướng...");
      router.push(getRedirectPathByRole(currentUser));
      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Đăng ký thất bại.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="w-full max-w-sm" onSubmit={handleSubmit}>
      <div className="mb-4">
        <label htmlFor="username" className="mb-2 block font-bold text-gray-700">
          Tên đăng nhập
        </label>
        <input
          type="text"
          id="username"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          className="w-full rounded border px-3 py-2 leading-tight text-gray-700 shadow appearance-none focus:outline-none focus:shadow-outline"
          placeholder="Tên đăng nhập"
          required
        />
      </div>

      <div className="mb-4">
        <label htmlFor="email" className="mb-2 block font-bold text-gray-700">
          Email
        </label>
        <input
          type="email"
          id="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="w-full rounded border px-3 py-2 leading-tight text-gray-700 shadow appearance-none focus:outline-none focus:shadow-outline"
          placeholder="Email"
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
          placeholder="Mật khẩu"
          required
        />
      </div>

      <div className="mb-6">
        <label
          htmlFor="confirmPassword"
          className="mb-2 block font-bold text-gray-700"
        >
          Xác nhận mật khẩu
        </label>
        <input
          type="password"
          id="confirmPassword"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          className="w-full rounded border px-3 py-2 leading-tight text-gray-700 shadow appearance-none focus:outline-none focus:shadow-outline"
          placeholder="Nhập lại mật khẩu"
          required
        />
      </div>

      {errorMessage ? (
        <p className="mb-4 rounded bg-red-50 px-3 py-2 text-sm text-red-600">
          {errorMessage}
        </p>
      ) : null}

      {successMessage ? (
        <p className="mb-4 rounded bg-green-50 px-3 py-2 text-sm text-green-700">
          {successMessage}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isSubmitting}
        className="rounded bg-blue-500 px-4 py-2 font-bold text-white focus:outline-none focus:shadow-outline hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {isSubmitting ? "Đang đăng ký..." : "Đăng ký"}
      </button>
    </form>
  );
}

export default function Home() {
  const router = useRouter();
  return (
    <main className="min-h-screen items-center justify-between pt-20">
      <header className="flex flex-row items-center fixed z-50 top-0 left-0 w-full bg-white shadow-md px-3">
        <div className= "flex-4 flex items-center">
          <Image
            className=""
            src="/logo.png"
            alt="Logo"
            width={40}
            height={40}
            onClick={() =>router.push("/")}
          />
          <p className= "pl-1.5 font-bold flex-auto" onClick={() =>router.push("/")}>Trang Web Học Tập</p>
        </div>
      </header>
      <div className="flex flex-col items-center justify-center flex-1 px-4 text-center">
        <h1 className="mb-4 text-5xl font-bold">Trang Đăng Ký</h1>
        <p className="mb-8 text-xl text-gray-600">
          Vui lòng nhập thông tin đăng ký của bạn để tiếp tục.
        </p>
        <RegisterForm />
      </div>
    </main>
  );
}
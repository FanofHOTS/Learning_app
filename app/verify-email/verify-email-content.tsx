"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AlertCircle, CheckCircle2, LoaderCircle, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";

type VerifyEmailResponse = {
  message?: string;
  detail?: string;
};

export default function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("Đang xác thực email của bạn...");

  useEffect(() => {
    async function verifyEmail() {
      if (!token) {
        setStatus("error");
        setMessage("Liên kết xác thực không hợp lệ hoặc thiếu token xác thực.");
        return;
      }

      try {
        const apiBaseUrl =
          process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";
        const response = await fetch(
          `${apiBaseUrl}/user/verify-email?token=${encodeURIComponent(token)}`,
          {
            method: "GET",
            headers: {
              Accept: "application/json",
            },
          },
        );

        const data = (await response.json()) as VerifyEmailResponse;

        if (!response.ok) {
          const errorMessage =
            typeof data.detail === "string" && data.detail.trim()
              ? data.detail
              : "Xác thực email thất bại. Vui lòng thử lại hoặc liên hệ quản trị viên.";
          setStatus("error");
          setMessage(errorMessage);
          return;
        }

        setStatus("success");
        setMessage(
          typeof data.message === "string" && data.message.trim()
            ? data.message
            : "Email của bạn đã được xác thực thành công.",
        );
      } catch {
        setStatus("error");
        setMessage("Không thể kết nối tới máy chủ để xác thực email. Vui lòng thử lại sau.");
      }
    }

    void verifyEmail();
  }, [token]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.16),transparent_30%),linear-gradient(135deg,#f1f8ff_0%,#f8fbff_55%,#eefcf8_100%)] px-4 py-12">
      <div className="w-full max-w-xl overflow-hidden rounded-[32px] border border-white/80 bg-white/90 p-8 shadow-[0_30px_80px_rgba(15,23,42,0.12)] backdrop-blur-sm sm:p-10">
        <div className="flex justify-center">
          <div
            className={[
              "flex h-16 w-16 items-center justify-center rounded-full",
              status === "success"
                ? "bg-emerald-100 text-emerald-700"
                : status === "error"
                  ? "bg-rose-100 text-rose-700"
                  : "bg-sky-100 text-sky-700",
            ].join(" ")}
          >
            {status === "loading" ? (
              <LoaderCircle className="h-7 w-7 animate-spin" />
            ) : status === "success" ? (
              <CheckCircle2 className="h-8 w-8" />
            ) : (
              <AlertCircle className="h-8 w-8" />
            )}
          </div>
        </div>

        <div className="mt-6 text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-sky-700">
            Xác thực email
          </p>

          <h1 className="mt-3 text-3xl font-semibold text-slate-900">
            {status === "success"
              ? "Xác thực thành công"
              : status === "error"
                ? "Xác thực thất bại"
                : "Đang xử lý..."}
          </h1>

          <p className="mt-4 text-sm leading-7 text-slate-600">{message}</p>
        </div>

        {status === "success" ? (
          <div className="mt-7 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" />
              <span>
                Bạn đã xác thực email thành công. Giờ đây có thể quay lại trang đăng nhập để tiếp tục sử dụng tài khoản.
              </span>
            </div>
          </div>
        ) : null}

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/login"
            className="inline-flex items-center justify-center rounded-2xl bg-sky-700 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-sky-200 transition hover:bg-sky-800"
          >
            Đi tới đăng nhập
          </Link>
          <Link
            href="/register"
            className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Đăng ký lại
          </Link>
        </div>
      </div>
    </main>
  );
}

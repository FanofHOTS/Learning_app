"use client";

import Link from "next/link";
import { ArrowRight, LoaderCircle, MailCheck } from "lucide-react";
import { FormEvent, useState } from "react";

import {
  requestPasswordRecovery,
  type PasswordRecoveryResult,
} from "@/app/lib/api_password_recovery";

export function PasswordRecoveryForm() {
  const [userdata, setUserdata] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [successResult, setSuccessResult] =
    useState<PasswordRecoveryResult | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");
    setSuccessResult(null);
    setIsSubmitting(true);

    try {
      const result = await requestPasswordRecovery({ userdata });
      setSuccessResult(result);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Không thể xử lý yêu cầu phục hồi mật khẩu.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <div className="mb-8">
        <p className="text-sm font-semibold uppercase tracking-[0.22em] text-sky-700">
          Phục hồi mật khẩu
        </p>
        <h2 className="mt-3 text-3xl font-semibold text-slate-900">
          Khôi phục quyền truy cập tài khoản
        </h2>
        <p className="mt-3 text-sm leading-6 text-slate-500">
          Nhập tên đăng nhập hoặc email đã đăng ký. Nếu thông tin khớp, hệ thống
          sẽ gửi mật khẩu tạm thời tới email gắn với tài khoản của bạn.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <label
            htmlFor="userdata"
            className="text-sm font-medium text-slate-700"
          >
            Tên đăng nhập hoặc email
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
          <p className="text-xs leading-5 text-slate-500">
            Mật khẩu phục hồi nên được dùng tạm thời, sau đó bạn cần đổi lại mật
            khẩu mới ngay khi đăng nhập thành công.
          </p>
        </div>

        {errorMessage ? (
          <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {errorMessage}
          </p>
        ) : null}

        {successResult ? (
          <div className="rounded-[24px] border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-800">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 rounded-full bg-emerald-100 p-2 text-emerald-700">
                <MailCheck className="h-4 w-4" />
              </div>
              <div>
                <p className="font-semibold">Yêu cầu đã được tiếp nhận</p>
                <p className="mt-1 leading-6">{successResult.message}</p>
                {successResult.usedMockData ? (
                  <p className="mt-2 leading-6 text-emerald-700/90">
                    Hiện tại ứng dụng đang dùng dữ liệu mẫu nên chưa gửi email thật,
                    nhưng luồng giao diện và lời gọi API đã sẵn sàng để nối với
                    FastAPI.
                  </p>
                ) : null}
              </div>
            </div>
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
              <span>Đang gửi yêu cầu phục hồi...</span>
            </>
          ) : (
            <>
              <span>Gửi mật khẩu phục hồi</span>
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </button>
      </form>

      <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-500">
        <span>Đã nhớ lại mật khẩu hoặc vừa nhận được mật khẩu tạm thời?</span>
        <Link href="/login" className="font-medium text-sky-700 hover:text-sky-900">
          Quay về trang đăng nhập
        </Link>
      </div>
    </>
  );
}

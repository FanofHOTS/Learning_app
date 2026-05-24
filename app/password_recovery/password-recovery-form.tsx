"use client";

import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  LoaderCircle,
  MailCheck,
  RotateCw,
  ShieldCheck,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";

import {
  requestPasswordRecoveryCode,
  verifyPasswordRecoveryCode,
  type PasswordRecoveryRequestResult,
  type PasswordRecoveryVerifyResult,
} from "@/app/lib/api_password_recovery";

type RecoveryStep = "request" | "verify" | "completed";

function formatCountdown(secondsLeft: number): string {
  const safeSeconds = Math.max(secondsLeft, 0);
  const minutes = Math.floor(safeSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (safeSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

export function PasswordRecoveryForm() {
  const [userdata, setUserdata] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [requestResult, setRequestResult] =
    useState<PasswordRecoveryRequestResult | null>(null);
  const [verifyResult, setVerifyResult] =
    useState<PasswordRecoveryVerifyResult | null>(null);
  const [currentStep, setCurrentStep] = useState<RecoveryStep>("request");
  const [isRequestingCode, setIsRequestingCode] = useState(false);
  const [isVerifyingCode, setIsVerifyingCode] = useState(false);
  const [isResendingCode, setIsResendingCode] = useState(false);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);

  useEffect(() => {
    if (currentStep !== "verify" || expiresAt === null) {
      setSecondsLeft(0);
      return;
    }

    function updateCountdown() {
      setSecondsLeft(Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000)));
    }

    updateCountdown();
    const timerId = window.setInterval(updateCountdown, 1000);
    return () => window.clearInterval(timerId);
  }, [currentStep, expiresAt]);

  const isCodeExpired = currentStep === "verify" && secondsLeft === 0;
  const countdownLabel = useMemo(
    () => formatCountdown(secondsLeft),
    [secondsLeft],
  );

  async function sendCode(options?: { isResend?: boolean }) {
    const isResend = options?.isResend ?? false;

    if (isResend) {
      setIsResendingCode(true);
    } else {
      setIsRequestingCode(true);
      setVerifyResult(null);
    }

    setErrorMessage("");

    try {
      const result = await requestPasswordRecoveryCode({ userdata });
      setRequestResult(result);
      setVerificationCode("");
      setCurrentStep("verify");
      setExpiresAt(Date.now() + result.expiresInSeconds * 1000);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Không thể gửi mã xác nhận phục hồi mật khẩu.",
      );
    } finally {
      if (isResend) {
        setIsResendingCode(false);
      } else {
        setIsRequestingCode(false);
      }
    }
  }

  async function handleRequestSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await sendCode();
  }

  async function handleVerifySubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");
    setIsVerifyingCode(true);

    try {
      const result = await verifyPasswordRecoveryCode({
        userdata,
        verificationCode,
      });
      setVerifyResult(result);
      setCurrentStep("completed");
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Không thể xác minh mã phục hồi.",
      );
    } finally {
      setIsVerifyingCode(false);
    }
  }

  function handleBackToRequest() {
    setCurrentStep("request");
    setVerificationCode("");
    setVerifyResult(null);
    setRequestResult(null);
    setErrorMessage("");
    setExpiresAt(null);
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
          Hệ thống sẽ xác minh theo hai bước: gửi mã xác nhận tới email gắn với
          tài khoản, sau đó chỉ gửi mật khẩu tạm thời khi mã được nhập đúng.
        </p>
      </div>

      {currentStep === "request" ? (
        <form onSubmit={handleRequestSubmit} className="space-y-5">
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
              Nếu thông tin chính xác, hệ thống sẽ gửi mã xác nhận gồm 6 ký tự
              chữ và số tới email gắn với tài khoản của bạn.
            </p>
          </div>

          {errorMessage ? (
            <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {errorMessage}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={isRequestingCode}
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-sky-700 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-sky-200 transition hover:bg-sky-800 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isRequestingCode ? (
              <>
                <LoaderCircle className="h-4 w-4 animate-spin" />
                <span>Đang gửi mã xác nhận...</span>
              </>
            ) : (
              <>
                <span>Nhận mã xác nhận</span>
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </form>
      ) : null}

      {currentStep === "verify" ? (
        <form onSubmit={handleVerifySubmit} className="space-y-5">
          <div className="rounded-[24px] border border-sky-200 bg-sky-50 px-5 py-4 text-sm text-sky-900">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 rounded-full bg-white p-2 text-sky-700 shadow-sm">
                <ShieldCheck className="h-4 w-4" />
              </div>
              <div className="flex-1">
                <p className="font-semibold">Bước 2: nhập mã xác nhận</p>
                <p className="mt-1 leading-6">
                  {requestResult?.message}
                </p>
                <p className="mt-3 text-sm font-medium text-sky-800">
                  {isCodeExpired
                    ? "Mã xác nhận đã hết hạn. Bạn có thể gửi lại mã mới."
                    : `Mã xác nhận còn hiệu lực trong ${countdownLabel}.`}
                </p>
                {requestResult?.usedMockData && requestResult.debugCode ? (
                  <p className="mt-3 rounded-2xl border border-sky-200 bg-white px-4 py-3 text-sm text-sky-800">
                    Chế độ dữ liệu mẫu đang bật. Mã xác nhận mô phỏng hiện tại là{" "}
                    <span className="font-semibold tracking-[0.28em]">
                      {requestResult.debugCode}
                    </span>
                    .
                  </p>
                ) : null}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label
              htmlFor="verificationCode"
              className="text-sm font-medium text-slate-700"
            >
              Mã xác nhận gồm 6 ký tự
            </label>
            <input
              id="verificationCode"
              type="text"
              value={verificationCode}
              onChange={(event) =>
                setVerificationCode(
                  event.target.value.replace(/\s+/g, "").toUpperCase(),
                )
              }
              autoComplete="one-time-code"
              inputMode="text"
              maxLength={6}
              required
              placeholder="VD: A1B2C3"
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-center text-lg font-semibold tracking-[0.35em] text-slate-900 outline-none transition focus:border-sky-400 focus:bg-white focus:shadow-[0_0_0_4px_rgba(14,165,233,0.15)]"
            />
            <p className="text-xs leading-5 text-slate-500">
              Sau khi xác minh thành công, hệ thống sẽ gửi mật khẩu tạm thời tới
              email của bạn thay vì đăng nhập trực tiếp để tăng an toàn.
            </p>
          </div>

          {errorMessage ? (
            <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {errorMessage}
            </p>
          ) : null}

          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="submit"
              disabled={isVerifyingCode}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-sky-700 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-sky-200 transition hover:bg-sky-800 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isVerifyingCode ? (
                <>
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                  <span>Đang xác minh mã...</span>
                </>
              ) : (
                <>
                  <span>Xác minh mã</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => void sendCode({ isResend: true })}
              disabled={isResendingCode || isVerifyingCode}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-sky-300 hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isResendingCode ? (
                <>
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                  <span>Đang gửi lại mã...</span>
                </>
              ) : (
                <>
                  <RotateCw className="h-4 w-4" />
                  <span>{isCodeExpired ? "Gửi mã mới" : "Gửi lại mã"}</span>
                </>
              )}
            </button>
          </div>

          <button
            type="button"
            onClick={handleBackToRequest}
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Đổi tên đăng nhập hoặc email</span>
          </button>
        </form>
      ) : null}

      {currentStep === "completed" && verifyResult ? (
        <div className="space-y-5">
          <div className="rounded-[24px] border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-800">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 rounded-full bg-emerald-100 p-2 text-emerald-700">
                <MailCheck className="h-4 w-4" />
              </div>
              <div>
                <p className="font-semibold">Phục hồi tài khoản thành công</p>
                <p className="mt-1 leading-6">{verifyResult.message}</p>
                {verifyResult.usedMockData && verifyResult.debugTemporaryPassword ? (
                  <p className="mt-3 rounded-2xl border border-emerald-200 bg-white px-4 py-3 text-sm text-emerald-800">
                    Chế độ dữ liệu mẫu đang bật. Mật khẩu tạm thời mô phỏng là{" "}
                    <span className="font-semibold">
                      {verifyResult.debugTemporaryPassword}
                    </span>
                    .
                  </p>
                ) : null}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleBackToRequest}
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Phục hồi cho tài khoản khác</span>
          </button>
        </div>
      ) : null}

      <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-500">
        <span>Đã nhớ lại mật khẩu hoặc đã nhận được mật khẩu tạm thời?</span>
        <Link href="/login" className="font-medium text-sky-700 hover:text-sky-900">
          Quay về trang đăng nhập
        </Link>
      </div>
    </>
  );
}

"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  Award,
  BadgeCheck,
  CalendarDays,
  CheckCircle2,
  FileImage,
  IdCard,
  LoaderCircle,
  Search,
  ShieldCheck,
  Trophy,
  UserRound,
  XCircle,
} from "lucide-react";
import {
  verifyCertificate,
  type Certificate,
} from "../lib/api_certificate";

function formatIssuedDate(value: string): string {
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(value));
}

function VerificationResult({
  certificate,
  onReset,
}: {
  certificate: Certificate;
  onReset: () => void;
}) {
  const apiBaseUrl =
    process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";
  const imageUrl = certificate.certificate_file
    ? certificate.certificate_file.startsWith("http")
      ? certificate.certificate_file
      : `${apiBaseUrl}${certificate.certificate_file}`
    : null;

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
      {/* Success banner */}
      <div className="rounded-[28px] border border-emerald-200 bg-emerald-50 px-6 py-5 text-center shadow-sm">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
          <CheckCircle2 className="h-7 w-7 text-emerald-700" />
        </div>
        <h2 className="mt-4 text-2xl font-semibold text-emerald-900">
          Chứng chỉ hợp lệ
        </h2>
        <p className="mt-2 text-sm text-emerald-700">
          Mã chứng chỉ{" "}
          <span className="font-mono font-bold">
            {certificate.certificate_code}
          </span>{" "}
          được xác nhận là hợp lệ trên hệ thống.
        </p>
      </div>

      {/* Certificate info card */}
      <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
        {/* Certificate preview */}
        <div className="flex items-center justify-center bg-linear-to-br from-sky-50 via-cyan-50 to-emerald-50 px-6 py-8">
          <div className="flex w-full max-w-sm flex-col items-center rounded-xl border-2 border-slate-200 bg-white p-8 text-center shadow-inner">
            <Trophy className="h-14 w-14 text-amber-500" />
            <p className="mt-4 text-xl font-bold text-slate-900">
              CHỨNG CHỈ HOÀN THÀNH
            </p>
            <div className="my-4 h-0.5 w-16 rounded-full bg-amber-400" />
            <p className="text-lg font-semibold text-slate-800">
              {certificate.student_name ?? "Học viên"}
            </p>
            <p className="mt-2 text-sm text-slate-500">đã hoàn thành khóa học</p>
            <p className="mt-1 text-lg font-semibold text-slate-800">
              {certificate.course_title ?? "Khóa học"}
            </p>
            <p className="mt-4 text-sm text-slate-500">
              Ngày cấp: {formatIssuedDate(certificate.issued_at)}
            </p>
            <div className="mt-3 rounded-full bg-slate-100 px-4 py-1.5">
              <p className="font-mono text-xs text-slate-500">
                {certificate.certificate_code}
              </p>
            </div>
          </div>
        </div>

        {/* Details */}
        <div className="space-y-4 px-6 pb-6 pt-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl bg-sky-50 px-4 py-3">
              <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-sky-700">
                <UserRound className="h-3.5 w-3.5" />
                Học viên
              </p>
              <p className="mt-1.5 text-base font-semibold text-slate-900">
                {certificate.student_name ?? "Học viên"}
              </p>
            </div>
            <div className="rounded-2xl bg-emerald-50 px-4 py-3">
              <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">
                <CalendarDays className="h-3.5 w-3.5" />
                Ngày cấp
              </p>
              <p className="mt-1.5 text-base font-semibold text-slate-900">
                {formatIssuedDate(certificate.issued_at)}
              </p>
            </div>
            <div className="rounded-2xl bg-amber-50 px-4 py-3">
              <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-amber-700">
                <Award className="h-3.5 w-3.5" />
                Khóa học
              </p>
              <p className="mt-1.5 text-base font-semibold text-slate-900">
                {certificate.course_title ?? "Không có thông tin"}
              </p>
            </div>
          </div>

          <div className="rounded-2xl bg-slate-50 px-4 py-3">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              <IdCard className="h-3.5 w-3.5" />
              Mã chứng chỉ
            </p>
            <p className="mt-1.5 font-mono text-base font-semibold text-slate-900">
              {certificate.certificate_code}
            </p>
          </div>

          <div className="flex items-center gap-2 rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            <ShieldCheck className="h-5 w-5 shrink-0 text-emerald-600" />
            <span>
              Chứng chỉ này đã được xác minh thành công và hợp lệ trên hệ thống.
            </span>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            {imageUrl ? (
              <a
                href={imageUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-slate-800"
              >
                <FileImage className="h-4 w-4" />
                Xem chứng chỉ
              </a>
            ) : null}
            <button
              type="button"
              onClick={onReset}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
            >
              <Search className="h-4 w-4" />
              Tra mã khác
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function InvalidResult({
  code,
  onReset,
}: {
  code: string;
  onReset: () => void;
}) {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
      <div className="rounded-[28px] border border-rose-200 bg-rose-50 px-6 py-5 text-center shadow-sm">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-rose-100">
          <XCircle className="h-7 w-7 text-rose-600" />
        </div>
        <h2 className="mt-4 text-2xl font-semibold text-rose-900">
          Không tìm thấy chứng chỉ
        </h2>
        <p className="mt-2 text-sm text-rose-700">
          Mã{" "}
          <span className="font-mono font-bold">{code}</span>{" "}
          không tồn tại trong hệ thống hoặc không hợp lệ.
        </p>
      </div>

      <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
          <AlertTriangle className="h-5 w-5 text-amber-600" />
          Một số lý do có thể
        </h3>
        <ul className="mt-4 space-y-2 text-sm leading-6 text-slate-600">
          <li>• Mã chứng chỉ nhập sai hoặc thiếu ký tự.</li>
          <li>• Chứng chỉ chưa được cấp do khóa học chưa hoàn thành.</li>
          <li>• Chứng chỉ đã bị thu hồi hoặc xóa khỏi hệ thống.</li>
        </ul>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={onReset}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-slate-800"
          >
            <Search className="h-4 w-4" />
            Thử lại
          </button>
          <Link
            href="/"
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
          >
            Về trang chủ
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function VerifyPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Certificate | null>(null);
  const [notFound, setNotFound] = useState(false);

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    const trimmedCode = code.trim();
    if (!trimmedCode) {
      setError("Vui lòng nhập mã chứng chỉ.");
      return;
    }

    setIsVerifying(true);
    setError("");
    setResult(null);
    setNotFound(false);

    try {
      const certificate = await verifyCertificate(trimmedCode);
      if (certificate) {
        setResult(certificate);
      } else {
        setNotFound(true);
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Không thể kết nối tới hệ thống xác minh.",
      );
    } finally {
      setIsVerifying(false);
    }
  }

  function handleReset() {
    setCode("");
    setResult(null);
    setNotFound(false);
    setError("");
  }

  const isValidCode = /^CERT-/i.test(code.trim());

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.18),transparent_30%),radial-gradient(circle_at_top_right,rgba(251,191,36,0.12),transparent_28%),linear-gradient(180deg,#f8fbff_0%,#eef4fb_55%,#f8fafc_100%)] text-slate-900">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 pb-10 sm:px-6 lg:px-8">
        <header className="sticky top-0 z-20 pt-4">
          <div className="rounded-4xl border border-white/75 bg-white/82 px-5 py-4 shadow-[0_30px_80px_-50px_rgba(15,23,42,0.6)] backdrop-blur">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => router.push("/")}
                className="flex h-14 w-14 items-center justify-center rounded-[22px] bg-slate-950 shadow-[0_18px_40px_-24px_rgba(15,23,42,0.9)] transition-transform hover:scale-[1.02]"
              >
                <Image
                  src="/logo.png"
                  alt="Trang web học tập"
                  width={42}
                  height={42}
                  className="h-10 w-10 object-contain"
                  priority
                />
              </button>
              <div>
                <Link
                  href="/"
                  className="text-lg font-semibold tracking-tight text-slate-950"
                >
                  Trang web học tập trực tuyến
                </Link>
                <p className="text-sm text-slate-500">
                  Xác minh chứng chỉ hoàn thành khóa học
                </p>
              </div>
            </div>
          </div>
        </header>

        <div className="flex flex-1 flex-col items-center justify-center py-8">
          <div className="w-full max-w-2xl">
            {/* Intro section */}
            {!result && !notFound ? (
              <div className="text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-50">
                  <ShieldCheck className="h-8 w-8 text-amber-600" />
                </div>
                <h1 className="mt-5 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
                  Xác minh chứng chỉ
                </h1>
                <p className="mx-auto mt-3 max-w-lg text-sm leading-7 text-slate-600">
                  Nhập mã chứng chỉ để kiểm tra tính hợp lệ. Mỗi chứng chỉ được
                  cấp sau khi hoàn thành khóa học đều có mã duy nhất để xác minh.
                </p>
              </div>
            ) : null}

            {/* Search form */}
            {!result && !notFound ? (
              <form
                onSubmit={handleVerify}
                className="mt-8 space-y-4"
              >
                {error ? (
                  <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                    {error}
                  </div>
                ) : null}

                <div className="flex flex-col gap-3 sm:flex-row">
                  <div className="relative flex-1">
                    <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      placeholder="Nhập mã chứng chỉ (VD: CERT-20260420-101-1-A3F8C2)"
                      className="w-full rounded-2xl border border-slate-300 py-3.5 pl-12 pr-4 text-base outline-none transition-colors focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                      autoFocus
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isVerifying}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-6 py-3.5 text-base font-semibold text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isVerifying ? (
                      <LoaderCircle className="h-5 w-5 animate-spin" />
                    ) : (
                      <ShieldCheck className="h-5 w-5" />
                    )}
                    Xác minh
                  </button>
                </div>

                <p className="text-center text-xs text-slate-400">
                  Mã chứng chỉ thường bắt đầu bằng{" "}
                  <span className="font-mono font-semibold text-slate-600">
                    CERT-
                  </span>
                  {isValidCode ? (
                    <span className="ml-2 inline-flex items-center gap-1 text-emerald-600">
                      <CheckCircle2 className="h-3 w-3" />
                      Định dạng hợp lệ
                    </span>
                  ) : null}
                </p>
              </form>
            ) : null}

            {/* Loading state */}
            {isVerifying ? (
              <div className="mt-8 flex items-center justify-center rounded-[28px] border border-slate-200 bg-white p-10 shadow-sm">
                <div className="flex items-center gap-3 text-slate-600">
                  <LoaderCircle className="h-5 w-5 animate-spin" />
                  <span>Đang xác minh mã chứng chỉ...</span>
                </div>
              </div>
            ) : null}

            {/* Verification result */}
            {result ? (
              <div className="mt-8">
                <VerificationResult
                  certificate={result}
                  onReset={handleReset}
                />
              </div>
            ) : null}

            {notFound ? (
              <div className="mt-8">
                <InvalidResult code={code.trim()} onReset={handleReset} />
              </div>
            ) : null}

            {/* Info cards */}
            {!result && !notFound ? (
              <div className="mt-10 grid gap-4 sm:grid-cols-2">
                <div className="rounded-[28px] border border-slate-200 bg-white/80 p-5 shadow-sm backdrop-blur">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-100">
                    <Award className="h-5 w-5 text-sky-700" />
                  </div>
                  <h3 className="mt-4 text-lg font-semibold text-slate-950">
                    Chứng chỉ hợp lệ
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    Kết quả xác minh sẽ hiển thị thông tin học viên, khóa học và
                    ngày cấp nếu mã chứng chỉ hợp lệ.
                  </p>
                </div>

                <div className="rounded-[28px] border border-slate-200 bg-white/80 p-5 shadow-sm backdrop-blur">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-100">
                    <BadgeCheck className="h-5 w-5 text-amber-700" />
                  </div>
                  <h3 className="mt-4 text-lg font-semibold text-slate-950">
                    Bảo mật & minh bạch
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    Mỗi chứng chỉ được gắn một mã duy nhất, không thể chỉnh sửa
                    và có thể tra cứu công khai.
                  </p>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </main>
  );
}

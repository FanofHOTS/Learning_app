"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Award,
  BadgeCheck,
  CalendarDays,
  ChevronRight,
  Download,
  ExternalLink,
  FileImage,
  GraduationCap,
  IdCard,
  LoaderCircle,
  Medal,
  Menu,
  ScrollText,
  Search,
  ShieldCheck,
  Trophy,
  X,
} from "lucide-react";
import { UserAccountMenu } from "../../components/user-account-menu";
import { NotificationBell } from "../../components/notification-bell";
import { ShowNavigation } from "../../lib/app_nav";
import type { User } from "../../lib/api_user";
import {
  getCertificatesByUser,
  type Certificate,
} from "../../lib/api_certificate";
import {
  STUDENT_DEFAULT_USER,
  useStudentSession,
} from "../_lib/use-student-session";

const initialUser: User = STUDENT_DEFAULT_USER;

function formatIssuedDate(value: string): string {
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(value));
}

function formatIssuedDateShort(value: string): string {
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}

function CertificateCard({
  certificate,
  onView,
}: {
  certificate: Certificate;
  onView: (cert: Certificate) => void;
}) {
  return (
    <article className="group relative overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm shadow-slate-200/60 transition-all hover:-translate-y-1 hover:shadow-lg hover:shadow-slate-300/50">
      {/* Certificate preview area */}
      <div className="relative flex aspect-[1.414/1] items-center justify-center overflow-hidden bg-linear-to-br from-sky-50 via-cyan-50 to-emerald-50 p-6">
        {/* Decorative background pattern */}
        <div className="pointer-events-none absolute inset-0 opacity-[0.03]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_30%,#0284c7_0%,transparent_40%),radial-gradient(circle_at_80%_70%,#059669_0%,transparent_40%)]" />
        </div>

        {/* Certificate thumbnail */}
        <div className="relative z-10 flex h-full w-full items-center justify-center rounded-xl border-2 border-slate-200 bg-white shadow-inner">
          <div className="flex flex-col items-center gap-2 px-4 text-center">
            <Award className="h-10 w-10 text-amber-500" />
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
              Chứng chỉ
            </p>
            <p className="line-clamp-2 text-sm font-semibold text-slate-800">
              {certificate.course_title ?? "Khóa học"}
            </p>
            <div className="mt-1 h-0.5 w-12 rounded-full bg-amber-400" />
            <p className="text-[10px] text-slate-400">
              {certificate.certificate_code}
            </p>
          </div>
        </div>

        {/* Hover overlay */}
        <button
          type="button"
          onClick={() => onView(certificate)}
          className="absolute inset-0 z-20 flex items-center justify-center bg-slate-950/60 opacity-0 backdrop-blur-[2px] transition-opacity group-hover:opacity-100"
          aria-label={`Xem chứng chỉ: ${certificate.course_title ?? "Không có tiêu đề"}`}
        >
          <span className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-lg">
            <ExternalLink className="h-4 w-4" />
            Xem chứng chỉ
          </span>
        </button>
      </div>

      {/* Info section */}
      <div className="space-y-4 p-5">
        <div>
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-lg font-semibold leading-7 text-slate-950">
              {certificate.course_title ?? "Không có tiêu đề"}
            </h3>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
              <Medal className="h-3.5 w-3.5" />
              Chứng chỉ hoàn thành
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700">
              <IdCard className="h-3.5 w-3.5" />
              {certificate.certificate_code}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 text-sm text-slate-500">
          <CalendarDays className="h-4 w-4 text-slate-400" />
          <span>
            Cấp ngày{" "}
            {formatIssuedDate(certificate.issued_at)}
          </span>
        </div>

        <div className="flex items-center gap-2 rounded-2xl bg-slate-50 px-4 py-3">
          <BadgeCheck className="h-5 w-5 text-emerald-600" />
          <div className="text-sm">
            <span className="font-semibold text-slate-900">
              {certificate.student_name ?? "Học viên"}
            </span>
            <span className="text-slate-500">
              {" "}— {formatIssuedDateShort(certificate.issued_at)}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-slate-100 pt-1">
          <p className="text-xs text-slate-400">
            Mã: {certificate.certificate_code}
          </p>
          <div className="flex items-center gap-2">
            {certificate.certificate_file ? (
              <a
                href={certificate.certificate_file.startsWith("http")
                  ? certificate.certificate_file
                  : `${process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000"}${certificate.certificate_file}`}
                download
                className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-700 transition-colors hover:bg-sky-100"
              >
                <FileImage className="h-3.5 w-3.5" />
                Tải xuống
              </a>
            ) : null}
            <button
              type="button"
              onClick={() => onView(certificate)}
              className="inline-flex items-center gap-1 text-sm font-semibold text-sky-700 transition-colors hover:text-sky-800"
            >
              Chi tiết
              <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

function CertificateDetailModal({
  certificate,
  onClose,
}: {
  certificate: Certificate;
  onClose: () => void;
}) {
  const apiBaseUrl =
    process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";
  const imageUrl = certificate.certificate_file
    ? certificate.certificate_file.startsWith("http")
      ? certificate.certificate_file
      : `${apiBaseUrl}${certificate.certificate_file}`
    : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex w-full max-w-2xl flex-col rounded-[32px] bg-white shadow-2xl shadow-slate-950/30">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
              <Trophy className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                Chi tiết chứng chỉ
              </h2>
              <p className="text-sm text-slate-500">
                {certificate.course_title ?? "Khóa học"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
            aria-label="Đóng cửa sổ chi tiết"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Certificate image */}
        <div className="flex items-center justify-center bg-slate-50 px-6 py-8">
          <div className="flex w-full max-w-md items-center justify-center rounded-xl border-2 border-slate-200 bg-white p-8 shadow-inner">
            <div className="flex flex-col items-center gap-3 text-center">
              <Trophy className="h-16 w-16 text-amber-500" />
              <p className="text-2xl font-bold text-slate-900">
                CHỨNG CHỈ HOÀN THÀNH
              </p>
              <div className="h-0.5 w-20 rounded-full bg-amber-400" />
              <p className="text-lg font-semibold text-slate-800">
                {certificate.student_name ?? "Học viên"}
              </p>
              <p className="text-sm text-slate-500">đã hoàn thành khóa học</p>
              <p className="text-lg font-semibold text-slate-800">
                {certificate.course_title ?? "Khóa học"}
              </p>
              <p className="text-sm text-slate-500">
                Ngày cấp: {formatIssuedDate(certificate.issued_at)}
              </p>
              <div className="mt-2 rounded-full bg-slate-100 px-4 py-1.5">
                <p className="text-xs font-mono text-slate-500">
                  {certificate.certificate_code}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Certificate info */}
        <div className="space-y-4 px-6 pb-6 pt-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl bg-sky-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-700">
                Học viên
              </p>
              <p className="mt-1.5 text-base font-semibold text-slate-900">
                {certificate.student_name ?? "Học viên"}
              </p>
            </div>
            <div className="rounded-2xl bg-emerald-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">
                Ngày cấp
              </p>
              <p className="mt-1.5 text-base font-semibold text-slate-900">
                {formatIssuedDate(certificate.issued_at)}
              </p>
            </div>
          </div>

          <div className="rounded-2xl bg-amber-50 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-700">
              Mã chứng chỉ
            </p>
            <p className="mt-1.5 font-mono text-base font-semibold text-slate-900">
              {certificate.certificate_code}
            </p>
          </div>

          <div className="flex items-center gap-2 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            <span>
              Chứng chỉ này có thể được xác minh bằng mã{" "}
              <span className="font-mono font-semibold text-slate-900">
                {certificate.certificate_code}
              </span>{" "}
              tại trang xác minh chứng chỉ.
            </span>
          </div>

          <div className="flex gap-3 pt-1">
            {imageUrl ? (
              <a
                href={imageUrl}
                download
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-slate-800"
              >
                <Download className="h-4 w-4" />
                Tải chứng chỉ
              </a>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
            >
              Đóng
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function StudentCertificatesPage() {
  const router = useRouter();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [viewingCertificate, setViewingCertificate] =
    useState<Certificate | null>(null);
  const [searchKeyword, setSearchKeyword] = useState("");
  const { currentUser, isCheckingAuth } = useStudentSession();

  useEffect(() => {
    let isMounted = true;

    async function loadCertificates() {
      if (!currentUser) {
        return;
      }

      try {
        const certs = await getCertificatesByUser(currentUser.id);

        if (!isMounted) {
          return;
        }

        setCertificates(certs);
        setErrorMessage("");
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Không thể tải danh sách chứng chỉ.",
        );
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadCertificates();

    return () => {
      isMounted = false;
    };
  }, [currentUser]);

  const user = currentUser ?? initialUser;

  const filteredCertificates = searchKeyword.trim()
    ? certificates.filter((cert) => {
        const keyword = searchKeyword.toLowerCase().trim();
        return (
          (cert.course_title?.toLowerCase().includes(keyword) ?? false) ||
          cert.certificate_code.toLowerCase().includes(keyword) ||
          (cert.student_name?.toLowerCase().includes(keyword) ?? false)
        );
      })
    : certificates;

  const isAuthPending = isCheckingAuth || !currentUser;

  if (isAuthPending) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4 text-slate-700">
        <div className="flex items-center gap-3 rounded-3xl bg-white px-5 py-4 shadow-sm">
          <LoaderCircle className="h-5 w-5 animate-spin" />
          <span>Đang kiểm tra phiên đăng nhập...</span>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(251,191,36,0.06),transparent_40%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.04),transparent_40%),linear-gradient(180deg,#f8fafc_0%,#f1f5f9_100%)] text-slate-900">
      <ShowNavigation
        user={user}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      {isSidebarOpen ? (
        <button
          type="button"
          aria-label="Đóng lớp nền điều hướng"
          className="fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-[2px]"
          onClick={() => setIsSidebarOpen(false)}
        />
      ) : null}

      <header className="fixed top-0 left-0 z-30 flex w-full items-center justify-between border-b border-slate-200/80 bg-white/90 px-4 py-3 shadow-sm shadow-slate-200/60 backdrop-blur md:px-6">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setIsSidebarOpen(true)}
            className="rounded-xl p-2 text-slate-700 transition-colors hover:bg-slate-100"
            aria-label="Mở thanh điều hướng"
          >
            <Menu className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => router.push(`/${user.role}`)}
            className="rounded-2xl transition-transform hover:scale-[1.02]"
            aria-label="Về trang chủ học sinh"
          >
            <Image src="/logo.png" alt="Logo" width={42} height={42} />
          </button>
          <div>
            <h1 className="text-lg font-semibold">Chứng chỉ của tôi</h1>
            <p className="text-sm text-slate-500">
              Danh sách chứng chỉ hoàn thành khóa học
            </p>
          </div>
        </div>

        <div className="hidden items-center gap-2 md:flex">
          <NotificationBell userId={user.id} />
          <UserAccountMenu user={user} variant="dashboard" />
        </div>

        <div className="hidden items-center gap-3">
          <div className="rounded-full bg-sky-100 px-3 py-1 text-sm font-medium text-sky-700">
            Học sinh
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold">{user.username}</p>
            <p className="text-xs text-slate-500">{user.email}</p>
          </div>
        </div>
      </header>

      <section className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-4 pb-10 pt-24 sm:px-6 lg:px-8">
        {isLoading ? (
          <div className="flex min-h-[55vh] items-center justify-center rounded-4xl border border-white/60 bg-white/80 shadow-xl shadow-slate-200/60 backdrop-blur">
            <div className="flex items-center gap-3 text-slate-600">
              <LoaderCircle className="h-5 w-5 animate-spin" />
              <span>Đang tải danh sách chứng chỉ...</span>
            </div>
          </div>
        ) : null}

        {!isLoading && errorMessage ? (
          <div className="rounded-[28px] border border-rose-200 bg-rose-50 px-5 py-4 text-rose-700 shadow-sm">
            {errorMessage}
          </div>
        ) : null}

        {!isLoading && !errorMessage ? (
          <>
            {/* Hero section */}
            <section className="overflow-hidden rounded-[34px] border border-slate-200/70 bg-linear-to-br from-amber-600 via-orange-600 to-rose-600 text-white shadow-2xl shadow-amber-200/50">
              <div className="relative px-6 py-8 md:px-8">
                {/* Decorative elements */}
                <div className="pointer-events-none absolute -top-20 -right-20 h-60 w-60 rounded-full bg-white/5" />
                <div className="pointer-events-none absolute -bottom-10 -left-10 h-40 w-40 rounded-full bg-white/5" />

                <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                  <div className="max-w-3xl">
                    <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/12 px-3 py-1 text-sm text-amber-50">
                      <Award className="h-4 w-4" />
                      <span>Thành tích học tập</span>
                    </div>
                    <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
                      {user.username} đã đạt được{" "}
                      <span className="text-amber-200">
                        {certificates.length}
                      </span>{" "}
                      chứng chỉ
                    </h2>
                    <p className="mt-3 max-w-2xl text-sm leading-7 text-amber-50 sm:text-base">
                      Trang này tổng hợp các chứng chỉ bạn đã đạt được sau khi
                      hoàn thành khóa học. Mỗi chứng chỉ đi kèm mã xác minh duy
                      nhất để đảm bảo tính hợp lệ.
                    </p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-3xl border border-white/15 bg-white/10 px-5 py-4 backdrop-blur">
                      <p className="text-sm text-amber-100">Tổng số</p>
                      <p className="mt-2 text-3xl font-semibold">
                        {certificates.length}
                      </p>
                    </div>
                    <div className="rounded-3xl border border-white/15 bg-white/10 px-5 py-4 backdrop-blur">
                      <p className="text-sm text-amber-100">Gần nhất</p>
                      <p className="mt-2 text-3xl font-semibold">
                        {certificates.length > 0
                          ? formatIssuedDateShort(
                              certificates.reduce((latest, cert) =>
                                new Date(cert.issued_at) >
                                new Date(latest.issued_at)
                                  ? cert
                                  : latest,
                              ).issued_at,
                            )
                          : "—"}
                      </p>
                    </div>
                    <div className="rounded-3xl border border-white/15 bg-white/10 px-5 py-4 backdrop-blur">
                      <p className="text-sm text-amber-100">Đã hoàn thành</p>
                      <p className="mt-2 text-3xl font-semibold">
                        {certificates.length}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Search & info bar */}
            <section className="flex flex-col gap-4 rounded-[28px] border border-slate-200 bg-white/95 p-5 shadow-sm shadow-slate-200/60 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <ScrollText className="h-4 w-4 text-sky-600" />
                <span>
                  Danh sách gồm{" "}
                  <span className="font-semibold text-slate-900">
                    {filteredCertificates.length}
                  </span>{" "}
                  chứng chỉ
                  {searchKeyword.trim()
                    ? ` phù hợp với từ khóa "${searchKeyword}"`
                    : ""}
                </span>
              </div>

              <div className="relative w-full sm:max-w-xs">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchKeyword}
                  onChange={(e) => setSearchKeyword(e.target.value)}
                  placeholder="Tìm theo tên khóa học, mã chứng chỉ..."
                  className="w-full rounded-xl border border-slate-300 py-2.5 pl-10 pr-4 text-sm outline-none transition-colors focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                />
              </div>
            </section>

            {/* Certificate grid */}
            <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {filteredCertificates.length > 0 ? (
                filteredCertificates.map((certificate) => (
                  <CertificateCard
                    key={certificate.id}
                    certificate={certificate}
                    onView={(cert) => setViewingCertificate(cert)}
                  />
                ))
              ) : (
                <div className="col-span-full rounded-[28px] border border-dashed border-slate-300 bg-white/80 px-6 py-14 text-center shadow-sm">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-50">
                    <Award className="h-8 w-8 text-amber-400" />
                  </div>
                  <h3 className="mt-5 text-xl font-semibold text-slate-900">
                    {searchKeyword.trim()
                      ? "Không tìm thấy chứng chỉ phù hợp"
                      : "Chưa có chứng chỉ nào"}
                  </h3>
                  <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-slate-600">
                    {searchKeyword.trim()
                      ? "Thử thay đổi từ khóa tìm kiếm hoặc xóa bộ lọc để xem tất cả chứng chỉ."
                      : "Bạn cần hoàn thành khóa học để nhận chứng chỉ. Hãy tiếp tục học tập và quay lại sau."}
                  </p>
                  {!searchKeyword.trim() ? (
                    <Link
                      href="/student/courses"
                      className="mt-6 inline-flex items-center gap-2 rounded-full bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-800"
                    >
                      <GraduationCap className="h-4 w-4" />
                      Đi đến khóa học của tôi
                    </Link>
                  ) : null}
                </div>
              )}
            </section>

            {/* Tips section */}
            {certificates.length > 0 ? (
              <section className="grid gap-5 md:grid-cols-2">
                <article className="rounded-[28px] border border-slate-200 bg-white/95 p-6 shadow-sm shadow-slate-200/60">
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-100">
                      <ShieldCheck className="h-6 w-6 text-amber-700" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-slate-950">
                        Xác minh chứng chỉ
                      </h3>
                      <p className="mt-2 text-sm leading-6 text-slate-600">
                        Mỗi chứng chỉ đều có mã duy nhất để xác minh tính hợp
                        lệ. Bạn có thể chia sẻ mã này cho người khác để họ kiểm
                        tra chứng chỉ của bạn trên hệ thống.
                      </p>
                    </div>
                  </div>
                </article>

                <article className="rounded-[28px] border border-slate-200 bg-white/95 p-6 shadow-sm shadow-slate-200/60">
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-100">
                      <Trophy className="h-6 w-6 text-emerald-700" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-slate-950">
                        Tiếp tục chinh phục
                      </h3>
                      <p className="mt-2 text-sm leading-6 text-slate-600">
                        Hãy hoàn thành thêm các khóa học khác để tích lũy thêm
                        chứng chỉ. Mỗi chứng chỉ là một minh chứng cho sự cố
                        gắng và kiến thức của bạn.
                      </p>
                    </div>
                  </div>
                </article>
              </section>
            ) : null}
          </>
        ) : null}
      </section>

      {/* Detail modal */}
      {viewingCertificate ? (
        <CertificateDetailModal
          certificate={viewingCertificate}
          onClose={() => setViewingCertificate(null)}
        />
      ) : null}
    </main>
  );
}

"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  KeyRound,
  LoaderCircle,
  LockKeyhole,
  Menu,
  ShieldCheck,
} from "lucide-react";

import { AuthPasswordField } from "@/app/components/auth-password-field";
import { UserAccountMenu } from "@/app/components/user-account-menu";
import { ShowNavigation } from "@/app/lib/app_nav";
import {
  PasswordResetSessionError,
  getMockCurrentPasswordHint,
  resetPasswordWithSessionCheck,
} from "@/app/lib/api_password_reset";
import { getDashboardPathByRole, getRoleLabel } from "@/app/lib/public_site";

import { useSession } from "./use-session";

export default function PasswordResetPage() {
  const router = useRouter();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { currentUser, isCheckingAuth } = useSession();

  const mockPasswordHint = useMemo(
    () => getMockCurrentPasswordHint(currentUser),
    [currentUser],
  );

  if (isCheckingAuth || !currentUser) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4 text-slate-700">
        <div className="flex items-center gap-3 rounded-3xl bg-white px-5 py-4 shadow-sm">
          <LoaderCircle className="h-5 w-5 animate-spin" />
          <span>Đang kiểm tra phiên đăng nhập...</span>
        </div>
      </main>
    );
  }

  const roleLabel = getRoleLabel(currentUser.role);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");

    if (!currentPassword || !newPassword || !confirmNewPassword) {
      setErrorMessage("Vui lòng nhập đầy đủ ba trường mật khẩu.");
      return;
    }

    if (newPassword.length < 8) {
      setErrorMessage("Mật khẩu mới cần có ít nhất 8 ký tự.");
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setErrorMessage("Mật khẩu nhập lại chưa khớp với mật khẩu mới.");
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await resetPasswordWithSessionCheck({
        currentPassword,
        newPassword,
      });

      setSuccessMessage(result.message);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
    } catch (error) {
      if (error instanceof PasswordResetSessionError) {
        router.replace("/login");
        router.refresh();
        return;
      }

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Không thể cập nhật mật khẩu mới vào lúc này.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <ShowNavigation
        user={currentUser}
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

      <header className="fixed top-0 left-0 z-30 flex w-full items-center justify-between border-b border-slate-200 bg-white/95 px-4 py-3 shadow-sm backdrop-blur">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setIsSidebarOpen(true)}
            className="rounded-xl p-2 text-slate-700 hover:bg-slate-100"
            aria-label="Mở thanh điều hướng"
          >
            <Menu className="h-5 w-5" />
          </button>
          <Image
            src="/logo.png"
            alt="Logo"
            width={40}
            height={40}
            className="cursor-pointer"
            onClick={() => router.push(`/${currentUser.role}`)}
          />
          <div>
            <h1 className="text-lg font-semibold">Đổi mật khẩu</h1>
            <p className="text-sm text-slate-500">
              Cập nhật mật khẩu bảo mật cho tài khoản {roleLabel.toLowerCase()}
            </p>
          </div>
        </div>

        <div className="hidden md:block">
          <UserAccountMenu user={currentUser} variant="dashboard" />
        </div>
      </header>

      <section className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 px-4 pb-8 pt-24 sm:px-6 lg:px-8">
        <section className="rounded-[28px] bg-linear-to-r from-sky-700 via-cyan-700 to-emerald-600 px-6 py-7 text-white shadow-xl">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-sm font-medium text-sky-100">
                Khu vực bảo mật tài khoản
              </p>
              <h2 className="mt-2 text-3xl font-semibold">
                Cập nhật mật khẩu để bảo vệ phiên đăng nhập của bạn
              </h2>
              <p className="mt-3 text-sm leading-6 text-sky-50">
                Trang này sẽ kiểm tra phiên đăng nhập trước khi hiển thị và xác
                minh lại phiên một lần nữa ngay khi bạn gửi mật khẩu mới để bảo
                đảm luồng đổi mật khẩu luôn nhất quán với hệ thống hiện có.
              </p>
            </div>

            <div className="rounded-3xl bg-white/14 p-5 backdrop-blur">
              <p className="text-sm text-sky-100">Vai trò hiện tại</p>
              <p className="mt-2 text-xl font-semibold">{roleLabel}</p>
              <button
                type="button"
                onClick={() => router.push(getDashboardPathByRole(currentUser.role))}
                className="mt-4 rounded-full bg-white px-4 py-2 text-sm font-semibold text-sky-800 transition hover:bg-sky-50"
              >
                Quay về bảng điều khiển
              </button>
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <article className="rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-slate-200">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-sky-100 text-sky-700">
                <KeyRound className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-2xl font-semibold text-slate-900">
                  Nhập mật khẩu mới
                </h3>
                <p className="mt-2 text-sm leading-7 text-slate-600">
                  Bạn cần nhập đúng mật khẩu hiện tại, sau đó đặt mật khẩu mới và
                  nhập lại để xác nhận. Các ô mật khẩu mặc định được ẩn và có thể
                  bật hiển thị khi cần kiểm tra.
                </p>
              </div>
            </div>

            {currentUser.is_password_reset ? (
              <div className="mt-5 rounded-3xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm leading-7 text-amber-900">
                Tài khoản của bạn đang được đánh dấu cần đổi mật khẩu. Vui lòng
                hoàn tất bước này trước khi tiếp tục sử dụng hệ thống.
              </div>
            ) : null}

            {errorMessage ? (
              <div className="mt-5 rounded-3xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm leading-7 text-rose-700">
                {errorMessage}
              </div>
            ) : null}

            {successMessage ? (
              <div className="mt-5 rounded-3xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm leading-7 text-emerald-700">
                {successMessage}
              </div>
            ) : null}

            <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
              <AuthPasswordField
                id="current-password"
                label="Mật khẩu hiện tại"
                value={currentPassword}
                onChange={setCurrentPassword}
                autoComplete="current-password"
                placeholder="Nhập mật khẩu hiện tại"
              />

              <AuthPasswordField
                id="new-password"
                label="Mật khẩu mới"
                value={newPassword}
                onChange={setNewPassword}
                autoComplete="new-password"
                minLength={8}
                placeholder="Nhập mật khẩu mới"
              />

              <AuthPasswordField
                id="confirm-new-password"
                label="Nhập lại mật khẩu mới"
                value={confirmNewPassword}
                onChange={setConfirmNewPassword}
                autoComplete="new-password"
                minLength={8}
                placeholder="Nhập lại mật khẩu mới"
              />

              <div className="flex flex-col gap-3 pt-2 sm:flex-row">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center justify-center rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isSubmitting ? (
                    <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  Lưu mật khẩu mới
                </button>

                <button
                  type="button"
                  onClick={() => router.push(getDashboardPathByRole(currentUser.role))}
                  className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Hủy và quay lại
                </button>
              </div>
            </form>
          </article>

          <div className="space-y-6">
            <article className="rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-slate-200">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <h3 className="text-xl font-semibold text-slate-900">
                  Gợi ý bảo mật
                </h3>
              </div>

              <ul className="mt-5 space-y-3 text-sm leading-7 text-slate-600">
                <li>Mật khẩu mới nên có ít nhất 8 ký tự.</li>
                <li>Nên kết hợp chữ hoa, chữ thường và số để tăng độ an toàn.</li>
                <li>Không nên dùng lại mật khẩu cũ hoặc mật khẩu từ dịch vụ khác.</li>
              </ul>
            </article>

            <article className="rounded-[28px] bg-white p-6 shadow-sm ring-1 ring-slate-200">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-100 text-sky-700">
                  <LockKeyhole className="h-5 w-5" />
                </div>
                <h3 className="text-xl font-semibold text-slate-900">
                  Trạng thái tích hợp
                </h3>
              </div>

              <p className="mt-4 text-sm leading-7 text-slate-600">
                Khi tắt dữ liệu mô phỏng, biểu mẫu này sẽ xác minh phiên qua
                <span className="font-semibold text-slate-800"> /api/auth/me </span>
                rồi gửi dữ liệu đổi mật khẩu tới route FastAPI
                <span className="font-semibold text-slate-800">
                  {" "}
                  /user/reset_password/{currentUser.id}
                </span>
                .
              </p>

              {mockPasswordHint ? (
                <div className="mt-5 rounded-3xl border border-sky-200 bg-sky-50 px-5 py-4 text-sm leading-7 text-sky-900">
                  Hệ thống hiện đang dùng dữ liệu cho sẵn. Mật khẩu hiện tại mẫu
                  cho phiên này là
                  <span className="font-semibold"> {mockPasswordHint}</span>.
                </div>
              ) : null}
            </article>
          </div>
        </section>
      </section>
    </main>
  );
}

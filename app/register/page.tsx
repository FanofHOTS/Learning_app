import Link from "next/link";
import { redirect } from "next/navigation";

import { AuthShell } from "@/app/components/auth-shell";
import { getRedirectPathByRole } from "@/app/lib/auth_paths";
import {
  getAuthenticatedUser,
  isRegistrationAllowed,
} from "@/app/lib/auth_server";

import { RegisterForm } from "./register-form";

function RegistrationDisabledNotice() {
  return (
    <>
      <div className="mb-8">
        <p className="text-sm font-semibold uppercase tracking-[0.22em] text-sky-700">
          Đăng ký
        </p>
        <h2 className="mt-3 text-3xl font-semibold text-slate-900">
          Chức năng đăng ký hiện đang tạm khóa
        </h2>
        <p className="mt-3 text-sm leading-6 text-slate-500">
          Quản trị viên chưa bật biến môi trường
          {" "}
          <span className="font-semibold text-slate-700">REGISTER_ALLOWED</span>
          {" "}
          nên hệ thống chưa cho phép tạo tài khoản mới vào lúc này.
        </p>
      </div>

      <div className="rounded-[28px] border border-amber-200 bg-amber-50 px-5 py-5 text-sm leading-7 text-amber-900">
        Vui lòng liên hệ quản trị viên nếu bạn cần được cấp tài khoản hoặc quay
        lại trang đăng nhập để sử dụng tài khoản đã có.
      </div>

      <div className="mt-6">
        <Link
          href="/login"
          className="inline-flex items-center justify-center rounded-2xl bg-sky-700 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-sky-200 transition hover:bg-sky-800"
        >
          Quay về trang đăng nhập
        </Link>
      </div>
    </>
  );
}

export default async function RegisterPage() {
  const currentUser = await getAuthenticatedUser();

  if (currentUser) {
    redirect(getRedirectPathByRole(currentUser));
  }

  const registrationAllowed = isRegistrationAllowed();

  return (
    <AuthShell
      alternateHref="/login"
      alternateLabel="Mở trang đăng nhập"
      alternateText="Đã có tài khoản học tập?"
      description="Đăng ký tài khoản mới theo đúng cấu hình hệ thống, sau đó được đưa thẳng vào bảng điều khiển phù hợp với vai trò của bạn."
      eyebrow="Đăng ký chỉ được mở khi REGISTER_ALLOWED=true"
      modeLabel="Đăng ký"
      title="Khởi tạo tài khoản học tập với trải nghiệm nhất quán và an toàn"
    >
      {registrationAllowed ? <RegisterForm /> : <RegistrationDisabledNotice />}
    </AuthShell>
  );
}

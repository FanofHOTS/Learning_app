import { redirect } from "next/navigation";

import { AuthShell } from "@/app/components/auth-shell";
import { getRedirectPathByRole } from "@/app/lib/auth_paths";
import { getAuthenticatedUser } from "@/app/lib/auth_server";

import { LoginForm } from "./login-form";

export default async function LoginPage() {
  const currentUser = await getAuthenticatedUser();

  if (currentUser) {
    redirect(getRedirectPathByRole(currentUser));
  }

  return (
    <AuthShell
      alternateHref="/register"
      alternateLabel="Mở trang đăng ký"
      alternateText="Bạn chưa có tài khoản học tập?"
      description="Đăng nhập để tiếp tục học tập, theo dõi tiến độ và truy cập đúng bảng điều khiển theo vai trò của bạn."
      eyebrow="Phiên đăng nhập được bảo vệ bằng cookie HttpOnly"
      modeLabel="Đăng nhập"
      title="Cổng truy cập học tập dành cho sinh viên, giảng viên và quản trị viên"
    >
      <LoginForm />
    </AuthShell>
  );
}

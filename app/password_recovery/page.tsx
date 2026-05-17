import { redirect } from "next/navigation";

import { AuthShell } from "@/app/components/auth-shell";
import { getRedirectPathByRole } from "@/app/lib/auth_paths";
import { getAuthenticatedUser } from "@/app/lib/auth_server";

import { PasswordRecoveryForm } from "./password-recovery-form";

export default async function PasswordRecoveryPage() {
  const currentUser = await getAuthenticatedUser();

  if (currentUser) {
    redirect(getRedirectPathByRole(currentUser));
  }

  return (
    <AuthShell
      alternateHref="/login"
      alternateLabel="Quay về trang đăng nhập"
      alternateText="Đã nhớ lại mật khẩu hoặc vừa nhận được mật khẩu tạm thời?"
      description="Khôi phục lại quyền truy cập bằng cách xác minh tên đăng nhập hoặc email, sau đó gửi mật khẩu tạm thời tới hộp thư gắn với tài khoản."
      eyebrow="Ưu tiên bảo mật với mật khẩu tạm thời và yêu cầu đổi lại sau đăng nhập"
      modeLabel="Phục hồi mật khẩu"
      title="Lấy lại quyền truy cập tài khoản học tập theo giao diện đồng bộ với trang đăng nhập"
    >
      <PasswordRecoveryForm />
    </AuthShell>
  );
}

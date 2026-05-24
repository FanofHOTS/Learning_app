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
      alternateText="Đã nhớ lại mật khẩu hoặc đã nhận được mật khẩu tạm thời?"
      description="Khôi phục lại quyền truy cập bằng quy trình hai bước: nhận mã xác nhận qua email, nhập đúng mã rồi mới gửi mật khẩu tạm thời tới hộp thư của bạn."
      eyebrow="Ưu tiên bảo mật với mã xác nhận, thời hạn ngắn và mật khẩu tạm thời sau bước xác minh"
      modeLabel="Phục hồi mật khẩu"
      title="Lấy lại quyền truy cập tài khoản học tập theo quy trình xác nhận hai bước an toàn hơn"
    >
      <PasswordRecoveryForm />
    </AuthShell>
  );
}

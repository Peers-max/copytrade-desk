import { AuthCard } from "@/components/auth/auth-card";
import { PasswordReset } from "../forgot-password/password-reset";

export const metadata = { title: "重置密码" };

export default function ResetPasswordPage() {
  return (
    <AuthCard title="设置新密码" desc="请输入验证码与新密码，完成后即可重新登录。">
      <PasswordReset mode="reset" />
    </AuthCard>
  );
}

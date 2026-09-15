import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-card";
import { PasswordReset } from "./password-reset";

export const metadata = { title: "找回密码" };

export default function ForgotPasswordPage() {
  return (
    <AuthCard title="找回密码" desc="输入注册邮箱，我们会发送验证码帮助你重置密码。">
      <PasswordReset mode="request" />
      <p className="mt-5 text-center text-[12px] text-muted-foreground">
        想起密码了？
        <Link href="/login" className="ml-1 underline">
          返回登录
        </Link>
      </p>
    </AuthCard>
  );
}

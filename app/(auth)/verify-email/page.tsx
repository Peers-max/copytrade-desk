import Link from "next/link";
import { Suspense } from "react";
import { AuthCard } from "@/components/auth/auth-card";
import { VerifyForm } from "./verify-form";

export const metadata = { title: "邮箱验证" };

export default function VerifyEmailPage() {
  return (
    <AuthCard title="验证你的邮箱" desc="我们已向你的邮箱发送了一封验证邮件，请输入邮件中的 6 位验证码。">
      <Suspense fallback={<div className="h-32 animate-pulse rounded-2xl bg-surface" />}>
        <VerifyForm />
      </Suspense>
      <p className="mt-5 text-center text-[12px] text-muted-foreground">
        没收到？检查垃圾邮件，或
        <Link href="/login" className="ml-1 underline">
          重新登录
        </Link>
      </p>
    </AuthCard>
  );
}

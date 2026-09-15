import Link from "next/link";
import { Suspense } from "react";
import { LoginForm } from "./login-form";

export const metadata = { title: "登录" };

export default function LoginPage() {
  return (
    <div className="w-full max-w-[420px]">
      <Link href="/" className="mb-8 flex items-center justify-center gap-2">
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-[9px] bg-wise-green text-[15px] font-black text-wise-darkgreen">
          C
        </span>
        <span className="text-[18px] font-bold">币策</span>
      </Link>
      <div className="rounded-card-lg border border-border bg-card p-7 shadow-card">
        <h1 className="text-[22px] font-bold tracking-tight">登录 / 注册</h1>
        <p className="mt-1.5 text-[13px] text-muted-foreground">
          使用邮箱验证码登录，无需密码。邮箱验证 30 秒搞定。
        </p>
        <Suspense fallback={<div className="mt-6 h-40 animate-pulse rounded-2xl bg-surface" />}>
          <LoginForm />
        </Suspense>
      </div>
      <p className="mt-5 text-center text-[11.5px] leading-relaxed text-muted-foreground">
        继续即表示你同意
        <Link href="/terms" className="mx-1 underline">
          服务条款
        </Link>
        与
        <Link href="/privacy" className="mx-1 underline">
          隐私政策
        </Link>
      </p>
    </div>
  );
}

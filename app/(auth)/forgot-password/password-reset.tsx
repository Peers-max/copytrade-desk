"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { LoaderCircle } from "lucide-react";

export function PasswordReset({ mode }: { mode: "request" | "reset" }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  async function request() {
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return setError("请输入有效的邮箱地址");
    setError("");
    setLoading(true);
    const r = await fetch("/api/auth/send-code", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const j = await r.json();
    setLoading(false);
    if (!j.ok) return setError(j.error ?? "发送失败");
    setMsg(`验证码已发送（演示环境：${j.code}）`);
    setTimeout(() => router.push(`/reset-password?email=${encodeURIComponent(email)}`), 800);
  }

  async function reset() {
    if (code.length < 4) return setError("请输入验证码");
    if (pw.length < 8) return setError("密码至少 8 位");
    if (pw !== pw2) return setError("两次输入的密码不一致");
    setError("");
    setLoading(true);
    await new Promise((r) => setTimeout(r, 700));
    setLoading(false);
    setMsg("密码已重置，正在跳转登录…");
    setTimeout(() => router.push("/login"), 800);
  }

  if (mode === "request") {
    return (
      <div className="space-y-3">
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="w-full rounded-2xl border border-border bg-background px-3.5 py-2.5 text-[14px] outline-none focus:border-wise-green"
        />
        {error ? <p className="text-[12.5px] text-[#f6465d]">{error}</p> : null}
        {msg ? <p className="text-[12.5px] text-wise-darkgreen dark:text-wise-green">{msg}</p> : null}
        <button onClick={request} disabled={loading} className="btn-primary w-full py-3">
          {loading ? <LoaderCircle size={16} className="animate-spin" /> : null} 发送验证码
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <input
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
        placeholder="6 位验证码（演示用 888888）"
        className="w-full rounded-2xl border border-border bg-background px-3.5 py-2.5 text-[14px] tracking-[0.25em] outline-none placeholder:tracking-normal focus:border-wise-green"
      />
      <input
        type="password"
        value={pw}
        onChange={(e) => setPw(e.target.value)}
        placeholder="新密码（至少 8 位）"
        className="w-full rounded-2xl border border-border bg-background px-3.5 py-2.5 text-[14px] outline-none focus:border-wise-green"
      />
      <input
        type="password"
        value={pw2}
        onChange={(e) => setPw2(e.target.value)}
        placeholder="确认新密码"
        className="w-full rounded-2xl border border-border bg-background px-3.5 py-2.5 text-[14px] outline-none focus:border-wise-green"
      />
      {error ? <p className="text-[12.5px] text-[#f6465d]">{error}</p> : null}
      {msg ? <p className="text-[12.5px] text-wise-darkgreen dark:text-wise-green">{msg}</p> : null}
      <button onClick={reset} disabled={loading} className="btn-primary w-full py-3">
        {loading ? <LoaderCircle size={16} className="animate-spin" /> : null} 重置密码
      </button>
      <Link href="/login" className="block text-center text-[12.5px] text-muted-foreground underline">
        返回登录
      </Link>
    </div>
  );
}

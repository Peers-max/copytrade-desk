"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { ArrowRight, KeyRound, LoaderCircle, Mail, ShieldCheck, User } from "lucide-react";

type Tab = "password" | "email";
type Step = "email" | "code";

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/dashboard";

  const [tab, setTab] = useState<Tab>("password");

  // 账号密码
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  // 邮箱验证码
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [hint, setHint] = useState("");
  const [countdown, setCountdown] = useState(0);

  function done() {
    router.push(next);
    router.refresh();
  }

  async function loginWithPassword() {
    if (!username.trim() || !password) {
      setError("请输入用户名与密码");
      return;
    }
    setError("");
    setLoading(true);
    const r = await fetch("/api/auth/admin-login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: username.trim(), password }),
    });
    const j = await r.json().catch(() => ({}));
    setLoading(false);
    if (!j.ok) {
      setError(j.error ?? "登录失败");
      return;
    }
    done();
  }

  async function sendCode(e?: string) {
    const target = e ?? email;
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(target)) {
      setError("请输入有效的邮箱地址");
      return;
    }
    setError("");
    setLoading(true);
    const r = await fetch("/api/auth/send-code", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: target }),
    });
    const j = await r.json();
    setLoading(false);
    if (!j.ok) {
      setError(j.error ?? "发送失败");
      return;
    }
    setHint(`验证码已发送（演示环境验证码：${j.code}，也可输入 888888）`);
    setStep("code");
    setCountdown(60);
    const t = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(t);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
  }

  async function verify() {
    if (code.length < 4) {
      setError("请输入验证码");
      return;
    }
    setError("");
    setLoading(true);
    const r = await fetch("/api/auth/verify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, code }),
    });
    const j = await r.json();
    setLoading(false);
    if (!j.ok) {
      setError(j.error ?? "登录失败");
      return;
    }
    done();
  }

  async function useDemo() {
    setEmail("demo@coince.io");
    setCode("888888");
    setError("");
    setLoading(true);
    await fetch("/api/auth/send-code", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "demo@coince.io" }),
    });
    const r = await fetch("/api/auth/verify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "demo@coince.io", code: "888888" }),
    });
    const j = await r.json();
    setLoading(false);
    if (j.ok) done();
    else setError("演示登录失败，请重试");
  }

  const tabBtn = (active: boolean) =>
    `flex-1 rounded-xl py-2 text-[13px] font-medium transition ${
      active ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
    }`;

  return (
    <div className="mt-6">
      <div className="mb-4 flex gap-1 rounded-2xl border border-border bg-surface p-1">
        <button type="button" onClick={() => { setTab("password"); setError(""); }} className={tabBtn(tab === "password")}>
          账号密码
        </button>
        <button type="button" onClick={() => { setTab("email"); setError(""); }} className={tabBtn(tab === "email")}>
          邮箱验证码
        </button>
      </div>

      {tab === "password" ? (
        <div className="space-y-3">
          <label className="block">
            <span className="text-[12.5px] font-medium">用户名</span>
            <div className="mt-1.5 flex items-center gap-2 rounded-2xl border border-border bg-background px-3.5 py-2.5 focus-within:border-wise-green">
              <User size={16} className="text-muted-foreground" />
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="用户名"
                autoComplete="username"
                className="w-full bg-transparent text-[14px] outline-none placeholder:text-muted-foreground/60"
              />
            </div>
          </label>
          <label className="block">
            <span className="text-[12.5px] font-medium">密码</span>
            <div className="mt-1.5 flex items-center gap-2 rounded-2xl border border-border bg-background px-3.5 py-2.5 focus-within:border-wise-green">
              <KeyRound size={16} className="text-muted-foreground" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && loginWithPassword()}
                placeholder="密码"
                autoComplete="current-password"
                className="w-full bg-transparent text-[14px] outline-none placeholder:text-muted-foreground/60"
              />
            </div>
          </label>
          {error ? <p className="text-[12.5px] text-[#f6465d]">{error}</p> : null}
          <button onClick={loginWithPassword} disabled={loading} className="btn-primary w-full py-3">
            {loading ? <LoaderCircle size={16} className="animate-spin" /> : null} 登录
            {!loading ? <ArrowRight size={16} /> : null}
          </button>
        </div>
      ) : step === "email" ? (
        <div className="space-y-3">
          <label className="block">
            <span className="text-[12.5px] font-medium">邮箱</span>
            <div className="mt-1.5 flex items-center gap-2 rounded-2xl border border-border bg-background px-3.5 py-2.5 focus-within:border-wise-green">
              <Mail size={16} className="text-muted-foreground" />
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendCode()}
                placeholder="you@example.com"
                className="w-full bg-transparent text-[14px] outline-none placeholder:text-muted-foreground/60"
              />
            </div>
          </label>
          {error ? <p className="text-[12.5px] text-[#f6465d]">{error}</p> : null}
          <button onClick={() => sendCode()} disabled={loading} className="btn-primary w-full py-3">
            {loading ? <LoaderCircle size={16} className="animate-spin" /> : null} 获取验证码
            {!loading ? <ArrowRight size={16} /> : null}
          </button>
          <div className="flex items-center gap-3 py-1">
            <span className="h-px flex-1 bg-border" />
            <span className="text-[11.5px] text-muted-foreground">或</span>
            <span className="h-px flex-1 bg-border" />
          </div>
          <button onClick={useDemo} disabled={loading} className="btn-ghost w-full py-3">
            一键体验演示账号
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="rounded-2xl border border-border bg-surface px-3.5 py-2.5 text-[12.5px] text-muted-foreground">
            已发送至 <span className="font-medium text-foreground">{email}</span>
          </div>
          <label className="block">
            <span className="text-[12.5px] font-medium">验证码</span>
            <div className="mt-1.5 flex items-center gap-2 rounded-2xl border border-border bg-background px-3.5 py-2.5 focus-within:border-wise-green">
              <ShieldCheck size={16} className="text-muted-foreground" />
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                onKeyDown={(e) => e.key === "Enter" && verify()}
                placeholder="6 位验证码"
                className="w-full bg-transparent text-[14px] tracking-[0.3em] outline-none placeholder:tracking-normal placeholder:text-muted-foreground/60"
              />
            </div>
          </label>
          {hint ? <p className="text-[12px] text-wise-darkgreen dark:text-wise-green">{hint}</p> : null}
          {error ? <p className="text-[12.5px] text-[#f6465d]">{error}</p> : null}
          <button onClick={verify} disabled={loading} className="btn-primary w-full py-3">
            {loading ? <LoaderCircle size={16} className="animate-spin" /> : null} 登录
          </button>
          <button
            onClick={() => (countdown ? null : sendCode())}
            disabled={countdown > 0}
            className="w-full text-[12.5px] text-muted-foreground underline disabled:no-underline disabled:opacity-60"
          >
            {countdown ? `${countdown}s 后重新发送` : "重新发送验证码"}
          </button>
          <button onClick={() => setStep("email")} className="w-full text-[12.5px] text-muted-foreground">
            使用其他邮箱
          </button>
        </div>
      )}
    </div>
  );
}

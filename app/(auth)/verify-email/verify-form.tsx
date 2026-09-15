"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { LoaderCircle } from "lucide-react";

export function VerifyForm() {
  const router = useRouter();
  const params = useSearchParams();
  const email = params.get("email") ?? "";
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  async function submit() {
    if (code.length < 4) return setError("请输入 6 位验证码");
    setError("");
    setLoading(true);
    const r = await fetch("/api/auth/verify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, code }),
    });
    const j = await r.json();
    setLoading(false);
    if (!j.ok) return setError(j.error ?? "验证失败");
    setMsg("验证成功，正在进入控制台…");
    setTimeout(() => {
      router.push("/dashboard");
      router.refresh();
    }, 600);
  }

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-border bg-surface px-3.5 py-2.5 text-[12.5px] text-muted-foreground">
        {email || "未检测到邮箱，请返回登录页重试"}
      </div>
      <input
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
        placeholder="6 位验证码（演示用 888888）"
        className="w-full rounded-2xl border border-border bg-background px-3.5 py-2.5 text-[14px] tracking-[0.25em] outline-none placeholder:tracking-normal focus:border-wise-green"
      />
      {error ? <p className="text-[12.5px] text-[#f6465d]">{error}</p> : null}
      {msg ? <p className="text-[12.5px] text-wise-darkgreen dark:text-wise-green">{msg}</p> : null}
      <button onClick={submit} disabled={loading} className="btn-primary w-full py-3">
        {loading ? <LoaderCircle size={16} className="animate-spin" /> : null} 完成验证
      </button>
    </div>
  );
}

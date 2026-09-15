"use client";

import { useState } from "react";
import { Check, Copy, Share2 } from "lucide-react";

export function PromotionClient({ code }: { code: string }) {
  const [copied, setCopied] = useState<"code" | "link" | null>(null);
  const link = typeof window !== "undefined" ? `${window.location.origin}/login?ref=${code}` : `/login?ref=${code}`;

  function copy(kind: "code" | "link", text: string) {
    navigator.clipboard?.writeText(text);
    setCopied(kind);
    setTimeout(() => setCopied(null), 1800);
  }

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-border bg-surface p-4">
        <div className="text-[11.5px] text-muted-foreground">我的邀请码</div>
        <div className="mt-1 flex items-center justify-between gap-3">
          <span className="num text-[18px] font-bold tracking-wide">{code}</span>
          <button
            onClick={() => copy("code", code)}
            className="inline-flex items-center gap-1.5 rounded-pill border border-border bg-card px-3 py-1.5 text-[12.5px] font-medium transition hover:bg-surface"
          >
            {copied === "code" ? <Check size={13} /> : <Copy size={13} />}
            {copied === "code" ? "已复制" : "复制"}
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-surface p-4">
        <div className="text-[11.5px] text-muted-foreground">专属邀请链接</div>
        <div className="mt-1 flex items-center justify-between gap-3">
          <span className="truncate text-[13px]">{link}</span>
          <button
            onClick={() => copy("link", link)}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-pill border border-border bg-card px-3 py-1.5 text-[12.5px] font-medium transition hover:bg-surface"
          >
            {copied === "link" ? <Check size={13} /> : <Share2 size={13} />}
            {copied === "link" ? "已复制" : "复制链接"}
          </button>
        </div>
      </div>
    </div>
  );
}

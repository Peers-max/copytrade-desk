"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { cn } from "@/components/ui";
import type { Plan } from "@/lib/types";

export function PricingToggle({ plans }: { plans: Plan[] }) {
  const [yearly, setYearly] = useState(true);

  return (
    <div className="mt-10">
      <div className="flex items-center justify-center gap-3">
        <span className={cn("text-[13.5px] font-medium", !yearly ? "text-foreground" : "text-muted-foreground")}>
          月付
        </span>
        <button
          onClick={() => setYearly((v) => !v)}
          className={cn(
            "relative h-6 w-11 rounded-pill transition",
            yearly ? "bg-wise-green" : "bg-border"
          )}
          aria-label="切换计费周期"
        >
          <span
            className={cn(
              "absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all",
              yearly ? "left-[22px]" : "left-0.5"
            )}
          />
        </button>
        <span className={cn("text-[13.5px] font-medium", yearly ? "text-foreground" : "text-muted-foreground")}>
          年付
        </span>
        <span className="rounded-pill bg-wise-mint px-2.5 py-1 text-[11.5px] font-bold text-wise-darkgreen">
          省 2 个月
        </span>
      </div>

      <div className="mt-8 grid gap-5 lg:grid-cols-3">
        {plans.map((p) => {
          const price = yearly ? p.priceYearly : p.priceMonthly;
          return (
            <div
              key={p.id}
              className={cn(
                "relative flex flex-col rounded-card-lg border bg-card p-7",
                p.popular ? "border-wise-green shadow-glow" : "border-border"
              )}
            >
              {p.popular ? (
                <span className="absolute -top-3 left-7 rounded-pill bg-wise-green px-3 py-1 text-[11.5px] font-bold text-wise-darkgreen">
                  最受欢迎
                </span>
              ) : null}
              <div className="text-[15px] font-bold">{p.name}</div>
              <p className="mt-1 text-[12.5px] text-muted-foreground">{p.tagline}</p>
              <div className="mt-5 flex items-baseline gap-1.5">
                <span className="num text-[38px] font-bold leading-none">${price}</span>
                <span className="text-[13px] text-muted-foreground">/ {yearly ? "年" : "月"}</span>
              </div>
              <div className="mt-1 text-[12px] text-muted-foreground">
                {yearly
                  ? `约 $${(p.priceYearly / 12).toFixed(1)}/月 · 支持 USDT 支付`
                  : "支持 USDT 支付，随时取消"}
              </div>
              <ul className="mt-6 flex-1 space-y-3">
                {p.features.map((f) => (
                  <li key={f} className="flex gap-2.5 text-[13px]">
                    <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-wise-mint text-wise-darkgreen">
                      <Check size={11} strokeWidth={3.5} />
                    </span>
                    <span className="text-muted-foreground">{f}</span>
                  </li>
                ))}
              </ul>
              <a
                href="/wallet"
                className={cn(
                  "mt-7 inline-flex items-center justify-center rounded-pill px-5 py-3 text-[14px] font-semibold transition",
                  p.popular
                    ? "bg-wise-green text-wise-darkgreen hover:opacity-90"
                    : "border border-border hover:bg-surface"
                )}
              >
                {p.id === "basic" ? "从基础版开始" : p.id === "pro" ? "选择专业版" : "联系顾问"}
              </a>
            </div>
          );
        })}
      </div>
    </div>
  );
}

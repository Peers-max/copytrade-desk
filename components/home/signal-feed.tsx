"use client";

import { useEffect, useState } from "react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import type { Signal } from "@/lib/types";
import { timeAgo } from "@/lib/format";

const ACTION_LABEL: Record<Signal["action"], string> = {
  OPEN: "开仓",
  CLOSE: "平仓",
  ADD: "加仓",
  REDUCE: "减仓",
};

export function SignalFeed({ initial }: { initial: Signal[] }) {
  const [items, setItems] = useState<Signal[]>(initial);

  useEffect(() => {
    let alive = true;
    async function tick() {
      try {
        const r = await fetch("/api/signals?limit=6", { cache: "no-store" });
        const j = await r.json();
        if (alive && Array.isArray(j.signals)) setItems(j.signals);
      } catch {}
    }
    const t = setInterval(tick, 4000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  return (
    <div className="rounded-3xl border border-border bg-card p-4 shadow-card">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-[13px] font-semibold">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-wise-green opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-wise-green" />
          </span>
          实时信号流
        </div>
        <span className="text-[11px] text-muted-foreground">秒级同步</span>
      </div>
      <div className="space-y-2">
        {items.slice(0, 6).map((s) => {
          const long = s.side === "LONG";
          return (
            <div
              key={s.id}
              className="flex items-center justify-between gap-3 rounded-2xl border border-border/70 bg-surface/60 px-3 py-2.5"
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                    long ? "bg-[#0ecb81]/12 text-[#0ecb81]" : "bg-[#f6465d]/12 text-[#f6465d]"
                  }`}
                >
                  {long ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                </span>
                <div className="min-w-0">
                  <div className="truncate text-[12.5px] font-semibold">
                    {s.traderName} · {s.symbol.replace("/USDT", "")}
                    <span className={long ? "text-[#0ecb81]" : "text-[#f6465d]"}>
                      {" "}
                      {long ? "开多" : "开空"}
                    </span>
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {ACTION_LABEL[s.action]} · {s.leverage}x · {timeAgo(s.ts)}
                  </div>
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div className="num text-[12.5px] font-semibold">
                  {s.price.toLocaleString("en-US", { maximumFractionDigits: 4 })}
                </div>
                <div
                  className={`text-[10.5px] ${
                    s.status === "filled"
                      ? "text-[#0ecb81]"
                      : s.status === "pending"
                      ? "text-warning"
                      : "text-muted-foreground"
                  }`}
                >
                  {s.status === "filled" ? "已成交" : s.status === "pending" ? "执行中" : "已平仓"}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

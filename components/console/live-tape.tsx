"use client";

import { useEffect, useState } from "react";
import type { MarketSnapshot } from "@/lib/market";
import { fmtPct, fmtUsd } from "@/lib/format";

export function LiveTape({ initial }: { initial: MarketSnapshot }) {
  const [m, setM] = useState(initial);
  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const r = await fetch("/api/market", { cache: "no-store" });
        const j = await r.json();
        if (alive && j?.snapshot) setM(j.snapshot);
      } catch {}
    };
    const t = setInterval(tick, 6000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  return (
    <div className="mb-5 flex items-center gap-4 overflow-x-auto no-scrollbar rounded-2xl border border-border bg-card px-4 py-3">
      <span className="flex shrink-0 items-center gap-1.5 text-[11.5px] font-semibold text-muted-foreground">
        <span className="h-1.5 w-1.5 animate-ticker rounded-full bg-wise-green" />
        实时
      </span>
      {m.tickers.map((t) => (
        <div key={t.symbol} className="flex shrink-0 items-baseline gap-1.5">
          <span className="text-[12px] font-semibold">{t.base}</span>
          <span className="num text-[12px]">{fmtUsd(t.price, t.price > 1000 ? 1 : 3)}</span>
          <span className={`num text-[11px] ${t.changePct >= 0 ? "text-[#0ecb81]" : "text-[#f6465d]"}`}>
            {fmtPct(t.changePct, 2)}
          </span>
        </div>
      ))}
    </div>
  );
}

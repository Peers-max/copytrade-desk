"use client";

import { useEffect, useState } from "react";
import type { MarketSnapshot } from "@/lib/market";
import { fmtCompactUsd, fmtPct, fmtUsd } from "@/lib/format";
import { Donut, Sparkline } from "@/components/ui";

export function DashboardPreview({ initial }: { initial: MarketSnapshot }) {
  const [m, setM] = useState<MarketSnapshot>(initial);

  useEffect(() => {
    let alive = true;
    async function tick() {
      try {
        const r = await fetch("/api/market", { cache: "no-store" });
        const j = await r.json();
        if (alive && j?.snapshot) setM(j.snapshot);
      } catch {}
    }
    const t = setInterval(tick, 5000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  const btc = m.tickers[0];

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {/* 账户总资产 */}
      <div className="rounded-3xl border border-border bg-card p-4">
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground">账户总资产</span>
          <span className="rounded-md bg-wise-mint px-1.5 py-0.5 text-[10px] font-semibold text-wise-darkgreen">
            LIVE
          </span>
        </div>
        <div className="mt-1.5 num text-[24px] font-bold leading-none">12,380.12</div>
        <div className="mt-1 flex items-center gap-2">
          <span className="text-[10.5px] text-muted-foreground">USDT</span>
          <span className="num text-[11px] font-semibold text-[#0ecb81]">+148.23 (+1.20%)</span>
        </div>
        <div className="mt-2">
          <Sparkline data={[1, 2, 1.4, 3, 2.4, 4, 3.6, 5].map((v) => v + Math.sin(v) * 0.3)} width={180} height={34} />
        </div>
      </div>

      {/* 行情 */}
      <div className="rounded-3xl border border-border bg-card p-4">
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground">BTC/USDT · 1H</span>
          <span className="text-[10px] text-muted-foreground">1H</span>
        </div>
        <div className="mt-1.5 flex items-baseline gap-2">
          <span className="num text-[22px] font-bold leading-none">{fmtUsd(btc.price, 1)}</span>
          <span className={`num text-[11px] font-semibold ${btc.changePct >= 0 ? "text-[#0ecb81]" : "text-[#f6465d]"}`}>
            {fmtPct(btc.changePct)}
          </span>
        </div>
        <div className="mt-2 grid grid-cols-4 gap-1.5">
          {m.tickers.slice(1, 5).map((t) => (
            <div key={t.symbol} className="rounded-xl bg-surface px-2 py-1.5">
              <div className="text-[9.5px] text-muted-foreground">{t.base}</div>
              <div className="num text-[11.5px] font-bold">{t.price > 100 ? t.price.toFixed(1) : t.price.toFixed(3)}</div>
              <div className={`num text-[9.5px] ${t.changePct >= 0 ? "text-[#0ecb81]" : "text-[#f6465d]"}`}>
                {fmtPct(t.changePct, 1)}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 市场结构 */}
      <div className="rounded-3xl border border-border bg-card p-4">
        <div className="text-[11px] text-muted-foreground">多空比</div>
        <div className="mt-2 flex items-center gap-3">
          <div className="relative h-[74px] w-[74px]">
            <Donut
              size={74}
              data={[
                { name: "多", value: m.longShort.long, pct: m.longShort.long },
                { name: "空", value: m.longShort.short, pct: m.longShort.short },
              ]}
            />
            <div className="absolute inset-0 flex items-center justify-center text-[12px] font-bold">
              {m.longShort.long}%
            </div>
          </div>
          <div className="flex-1 space-y-1.5 text-[11px]">
            <Row label="大额挂单" value={`${m.largeOrders.length} 笔`} />
            <Row label="鲸鱼转账" value={`${fmtUsd(m.whaleTransfers[0]?.amount ?? 0, 1)}k BTC`} />
            <Row label="清算热图" value={fmtCompactUsd(m.totalLiquidationUsd)} />
            <Row label="跟单盈亏" value="+2,847" accent />
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className={`num font-semibold ${accent ? "text-[#0ecb81]" : ""}`}>{value}</span>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { Activity, Droplets, TrendingUp, Fish } from "lucide-react";
import { Sparkline, cn } from "@/components/ui";
import { PageHeader, Panel } from "@/components/console/ui";
import { fmtCompactUsd, fmtPct, fmtUsd } from "@/lib/format";
import type { MarketSnapshot } from "@/lib/market";

export function MarketClient({ initial }: { initial: MarketSnapshot }) {
  const [m, setM] = useState<MarketSnapshot>(initial);

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const r = await fetch("/api/market", { cache: "no-store" });
        const j = await r.json();
        if (alive && j?.snapshot) setM(j.snapshot);
      } catch {}
    };
    const t = setInterval(tick, 4000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  return (
    <>
      <PageHeader
        title="实时行情"
        desc="聚合 8 家主流交易所行情，4 秒刷新一次"
        actions={
          <span className="flex items-center gap-1.5 rounded-pill border border-border bg-card px-3 py-1.5 text-[12px] text-muted-foreground">
            <span className="h-1.5 w-1.5 animate-ticker rounded-full bg-wise-green" />
            已连接 · {new Date(m.ts).toLocaleTimeString("zh-CN", { hour12: false })}
          </span>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <Panel title="行情列表" bodyClassName="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-border">
                <tr>
                  <th className="px-4 py-2.5 text-left text-[12px] font-medium text-muted-foreground">交易对</th>
                  <th className="px-4 py-2.5 text-right text-[12px] font-medium text-muted-foreground">最新价</th>
                  <th className="px-4 py-2.5 text-right text-[12px] font-medium text-muted-foreground">24h 涨跌</th>
                  <th className="px-4 py-2.5 text-right text-[12px] font-medium text-muted-foreground">24h 最高</th>
                  <th className="px-4 py-2.5 text-right text-[12px] font-medium text-muted-foreground">24h 最低</th>
                  <th className="px-4 py-2.5 text-right text-[12px] font-medium text-muted-foreground">成交额</th>
                  <th className="px-4 py-2.5 text-right text-[12px] font-medium text-muted-foreground">走势</th>
                </tr>
              </thead>
              <tbody>
                {m.tickers.map((t) => (
                  <tr key={t.symbol} className="border-b border-border/60 last:border-0">
                    <td className="whitespace-nowrap px-4 py-3 text-[13px] font-semibold">{t.symbol}</td>
                    <td className="num whitespace-nowrap px-4 py-3 text-right text-[13px] font-semibold">
                      {fmtUsd(t.price, t.price > 1000 ? 1 : t.price > 1 ? 3 : 5)}
                    </td>
                    <td
                      className={cn(
                        "num whitespace-nowrap px-4 py-3 text-right text-[13px] font-semibold",
                        t.changePct >= 0 ? "text-[#0ecb81]" : "text-[#f6465d]"
                      )}
                    >
                      {fmtPct(t.changePct)}
                    </td>
                    <td className="num whitespace-nowrap px-4 py-3 text-right text-[13px] text-muted-foreground">
                      {fmtUsd(t.high24h, t.price > 1000 ? 1 : 3)}
                    </td>
                    <td className="num whitespace-nowrap px-4 py-3 text-right text-[13px] text-muted-foreground">
                      {fmtUsd(t.low24h, t.price > 1000 ? 1 : 3)}
                    </td>
                    <td className="num whitespace-nowrap px-4 py-3 text-right text-[13px]">{fmtCompactUsd(t.volume24h)}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end">
                        <Sparkline data={t.spark} width={80} height={26} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <div className="space-y-4">
          <Panel title="多空比">
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <div className="flex h-3 overflow-hidden rounded-pill">
                  <div className="bg-[#0ecb81]" style={{ width: `${m.longShort.long}%` }} />
                  <div className="bg-[#f6465d]" style={{ width: `${m.longShort.short}%` }} />
                </div>
                <div className="mt-2 flex justify-between text-[12.5px]">
                  <span className="text-[#0ecb81]">多头 {m.longShort.long}%</span>
                  <span className="text-[#f6465d]">空头 {m.longShort.short}%</span>
                </div>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 border-t border-border pt-4">
              <Mini icon={Droplets} label="资金费率" value={`${(m.fundingRate * 100).toFixed(3)}%`} />
              <Mini icon={Activity} label="24h 清算" value={fmtCompactUsd(m.totalLiquidationUsd)} />
            </div>
          </Panel>

          <Panel title="清算热图" desc="BTC 多空清算分布">
            <div className="flex h-[120px] items-end gap-[3px]">
              {m.liquidations.map((l, i) => {
                const h = ((l.long + l.short) / 3_400_000) * 100;
                return (
                  <div
                    key={i}
                    className="flex-1 rounded-t-sm"
                    style={{
                      height: `${Math.max(4, Math.min(100, h))}%`,
                      background: l.long ? "#0ecb81" : "#f6465d",
                      opacity: 0.85,
                    }}
                    title={`${l.price} · 多 ${fmtCompactUsd(l.long)} / 空 ${fmtCompactUsd(l.short)}`}
                  />
                );
              })}
            </div>
            <div className="mt-2 flex justify-between text-[11px] text-muted-foreground">
              <span>{m.liquidations[0]?.price}</span>
              <span>{m.liquidations[m.liquidations.length - 1]?.price}</span>
            </div>
          </Panel>

          <Panel title="大额挂单">
            <div className="space-y-2">
              {m.largeOrders.map((o, i) => (
                <div key={i} className="flex items-center justify-between text-[12.5px]">
                  <span className="font-medium">{o.symbol}</span>
                  <span className={o.side === "buy" ? "text-[#0ecb81]" : "text-[#f6465d]"}>
                    {o.side === "buy" ? "买单" : "卖单"}
                  </span>
                  <span className="num text-muted-foreground">{fmtUsd(o.price, o.price > 1000 ? 1 : 3)}</span>
                  <span className="num font-semibold">{fmtCompactUsd(o.amountUsd)}</span>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="鲸鱼转账">
            <div className="space-y-3">
              {m.whaleTransfers.map((w, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Fish size={16} className="shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[12.5px]">
                      {fmtUsd(w.amount, 1)} {w.symbol.split("/")[0]}
                    </div>
                    <div className="truncate text-[11px] text-muted-foreground">
                      {w.from} → {w.to} · {new Date(w.ts).toLocaleTimeString("zh-CN", { hour12: false })}
                    </div>
                  </div>
                  <span className="num shrink-0 text-[12.5px] font-semibold">{fmtCompactUsd(w.usd)}</span>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </div>
    </>
  );
}

function Mini({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <Icon size={15} className="text-muted-foreground" />
      <div>
        <div className="text-[11px] text-muted-foreground">{label}</div>
        <div className="num text-[13px] font-semibold">{value}</div>
      </div>
    </div>
  );
}

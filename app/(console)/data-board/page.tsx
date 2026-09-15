import { ChartBar, Flame, ChartPie, Users } from "lucide-react";
import { AreaChart, Badge, Donut, Sparkline, cn } from "@/components/ui";
import { PageHeader, Panel, StatCard, Td, Th } from "@/components/console/ui";
import { getSessionUser } from "@/lib/auth";
import { buildMarket } from "@/lib/market";
import { getTraders, bootstrapIfNeeded } from "@/lib/seed";
import { all, filter } from "@/lib/db";
import { exchangeBreakdown, pnlByDay } from "@/lib/stats";
import { fmtCompactUsd, fmtPct, fmtUsd, EXCHANGE_LABEL } from "@/lib/format";
import type { Trade } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "数据看板" };

export default async function DataBoardPage() {
  await bootstrapIfNeeded();
  const market = await buildMarket();
  const traders = await getTraders();
  const user = (await getSessionUser())!;
  const trades = await filter<Trade>("trades", (t) => t.userId === user.id);
  const byDay = await pnlByDay(user.id);
  const exBreak = await exchangeBreakdown(user.id);

  const totalSignals = (await all("signals")).length;
  const closed = trades.filter((t) => t.status === "closed");
  const winRate = closed.length ? (closed.filter((t) => t.pnl > 0).length / closed.length) * 100 : 0;
  const totalVolume = trades.reduce((a, t) => a + t.entry * t.qty, 0);
  const totalPnl = closed.reduce((a, t) => a + t.pnl, 0);

  const series = byDay.map((d, i) => 100 + d.pnl / 40 + i * 0.6);

  return (
    <>
      <PageHeader title="数据看板" desc="你的跟单表现、交易分布与全平台热度一览" />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="累计成交笔数" value={trades.length} sub={`其中已平仓 ${closed.length} 笔`} icon={ChartBar} />
        <StatCard label="胜率" value={`${winRate.toFixed(1)}%`} sub={`平均盈亏 ${fmtUsd(totalPnl / (closed.length || 1))} USDT`} icon={Flame} />
        <StatCard label="累计成交额" value={fmtCompactUsd(totalVolume)} sub="按开仓价估算" icon={ChartPie} />
        <StatCard label="全平台信号" value={totalSignals.toLocaleString()} sub="由量化引擎 / Webhook / 手动发布产生" icon={Users} />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1.5fr_1fr]">
        <Panel title="每日盈亏" desc="近 14 日">
          <div className="flex h-[180px] items-end gap-2">
            {byDay.map((d) => {
              const max = Math.max(...byDay.map((x) => Math.abs(x.pnl)), 1);
              const h = (Math.abs(d.pnl) / max) * 78;
              return (
                <div key={d.day} className="flex flex-1 flex-col items-center gap-1.5">
                  <div className="flex h-[92px] w-full flex-col justify-end">
                    <div
                      className={cn("w-full rounded-md", d.pnl >= 0 ? "bg-[#0ecb81]" : "bg-[#f6465d]")}
                      style={{ height: `${Math.max(3, h)}%` }}
                      title={`${d.day} · ${d.pnl}`}
                    />
                  </div>
                  <span className="text-[10px] text-muted-foreground">{d.day}</span>
                </div>
              );
            })}
          </div>
          <div className="mt-5">
            <AreaChart data={series} height={140} id="db" color="#4cc9f0" />
          </div>
        </Panel>

        <Panel title="交易所分布" desc="按成交笔数">
          <div className="flex items-center gap-5">
            <Donut
              size={140}
              data={exBreak.map((e) => ({ name: e.exchange, value: e.trades, pct: 0 }))}
            />
            <div className="flex-1 space-y-2">
              {exBreak.map((e, i) => (
                <div key={e.exchange} className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 rounded-sm"
                    style={{ background: ["#9fe870", "#4cc9f0", "#ffd11a", "#f6465d"][i % 4] }}
                  />
                  <span className="flex-1 text-[13px]">{EXCHANGE_LABEL[e.exchange] ?? e.exchange}</span>
                  <span className="num text-[12.5px] font-semibold">{e.trades} 笔</span>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-5 space-y-2 border-t border-border pt-4">
            {exBreak.map((e) => (
              <div key={e.exchange} className="flex items-center justify-between text-[13px]">
                <span className="text-muted-foreground">{EXCHANGE_LABEL[e.exchange] ?? e.exchange} 盈亏</span>
                <span className={cn("num font-semibold", e.pnl >= 0 ? "text-[#0ecb81]" : "text-[#f6465d]")}>
                  {e.pnl >= 0 ? "+" : ""}
                  {fmtUsd(e.pnl)}
                </span>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Panel title="交易员热度榜" desc="按跟单人数" bodyClassName="p-0">
          <table className="w-full">
            <thead className="border-b border-border">
              <tr>
                <Th>#</Th>
                <Th>交易员</Th>
                <Th>近 30 日</Th>
                <Th>跟单人数</Th>
                <Th>AUM</Th>
              </tr>
            </thead>
            <tbody>
              {[...traders]
                .sort((a, b) => b.followers - a.followers)
                .slice(0, 6)
                .map((t, i) => (
                  <tr key={t.id} className="border-b border-border/60 last:border-0">
                    <Td className="text-muted-foreground">{i + 1}</Td>
                    <Td>
                      <div className="flex items-center gap-2">
                        <div
                          className="flex h-6 w-6 items-center justify-center rounded-full text-[9px] font-bold text-wise-darkgreen"
                          style={{ background: `hsl(${t.avatarHue} 72% 78%)` }}
                        >
                          {t.name.slice(0, 2).toUpperCase()}
                        </div>
                        <span className="font-medium">{t.name}</span>
                      </div>
                    </Td>
                    <Td className="num text-[#0ecb81]">{fmtPct(t.roi30d)}</Td>
                    <Td className="num">{t.followers.toLocaleString()}</Td>
                    <Td className="num">{fmtCompactUsd(t.aum)}</Td>
                  </tr>
                ))}
            </tbody>
          </table>
        </Panel>

        <Panel title="市场情绪" desc="实时聚合指标">
          <div className="grid grid-cols-2 gap-3">
            {[
              { k: "多空比", v: `${market.longShort.long}% / ${market.longShort.short}%` },
              { k: "BTC 24h 成交额", v: fmtCompactUsd(market.tickers[0]?.volume24h ?? 0) },
              { k: "资金费率", v: `${(market.fundingRate * 100).toFixed(4)}%` },
              { k: "盘口大额挂单", v: `${market.largeOrders.length} 档` },
            ].map((x) => (
              <div key={x.k} className="rounded-2xl border border-border bg-surface/60 p-4">
                <div className="text-[11.5px] text-muted-foreground">{x.k}</div>
                <div className="num mt-1 text-[16px] font-bold">{x.v}</div>
              </div>
            ))}
          </div>
          <div className="mt-4 space-y-3 border-t border-border pt-4">
            {market.tickers.slice(0, 4).map((t) => (
              <div key={t.symbol} className="flex items-center justify-between gap-3">
                <span className="text-[13px] font-medium">{t.symbol}</span>
                <Sparkline data={t.spark} width={90} height={26} />
                <span className={cn("num text-[13px] font-semibold", t.changePct >= 0 ? "text-[#0ecb81]" : "text-[#f6465d]")}>
                  {fmtPct(t.changePct)}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-4">
            <Badge tone={market.source === "unavailable" ? "warn" : "green"}>
              {market.source === "unavailable"
                ? "行情源不可用 —— 访问 /api/diag 查看出网探测"
                : `数据源：${market.source === "okx" ? "OKX" : "Gate.io"} 公开行情 · 更新于 ${new Date(
                    market.ts
                  ).toLocaleTimeString("zh-CN", { hour12: false })}`}
            </Badge>
          </div>
        </Panel>
      </div>
    </>
  );
}

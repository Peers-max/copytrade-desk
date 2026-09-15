import Link from "next/link";
import {
  ArrowUpRight,
  Copy,
  Layers,
  Percent,
  Plus,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { AreaChart, Badge, Donut, RiskPill, Sparkline, cn } from "@/components/ui";
import { PageHeader, Panel, StatCard, Td, Th } from "@/components/console/ui";
import { LiveTape } from "@/components/console/live-tape";
import { getSessionUser } from "@/lib/auth";
import { filter } from "@/lib/db";
import { getTraders, PLANS, seedIfNeeded } from "@/lib/seed";
import { portfolioOf, recentTrades } from "@/lib/stats";
import { buildMarket } from "@/lib/market";
import { fmtPct, fmtUsd, signClass, timeAgo, EXCHANGE_LABEL } from "@/lib/format";
import type { CopyRelation } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  seedIfNeeded();
  const user = (await getSessionUser())!;
  const p = await portfolioOf(user.id);
  const relations = await filter<CopyRelation>("copyRelations", (r) => r.userId === user.id);
  const traders = await getTraders();
  const trades = await recentTrades(user.id, 7);
  const market = buildMarket();
  const plan = PLANS.find((x) => x.id === user.planId) ?? PLANS[0];

  return (
    <>
      <PageHeader
        title="仪表盘"
        desc={`欢迎回来，${user.nickname} · 当前套餐 ${plan.name}，到期 ${new Date(
          user.planExpiresAt
        ).toLocaleDateString("zh-CN")}`}
        actions={
          <>
            <Link href="/copy-trading" className="btn-ghost">
              <Copy size={15} /> 管理跟单
            </Link>
            <Link href="/strategies" className="btn-primary">
              <Plus size={15} /> 新增跟单
            </Link>
          </>
        }
      />

      <LiveTape initial={market} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="账户总资产"
          value={`${fmtUsd(p.equity)} USDT`}
          sub={
            <span className={signClass(p.todayPnl)}>
              {fmtPct(p.todayPnlPct)} 今日 · {fmtUsd(p.todayPnl)}
            </span>
          }
          icon={Wallet}
        />
        <StatCard
          label="累计跟单盈亏"
          value={`${p.totalPnl >= 0 ? "+" : ""}${fmtUsd(p.totalPnl)}`}
          sub={<span className={signClass(p.totalPnl)}>{fmtPct(p.pnlPct)} 收益率</span>}
          tone={p.totalPnl >= 0 ? "up" : "down"}
          icon={TrendingUp}
        />
        <StatCard label="胜率" value={`${p.winRate}%`} sub={`最大回撤 ${p.maxDrawdown}% · Sharpe ${p.sharpe}`} icon={Percent} />
        <StatCard
          label="运行中跟单 / 持仓"
          value={`${p.runningCopies} / ${p.openPositions}`}
          sub={`最佳交易员 ${p.bestTrader}`}
          icon={Layers}
        />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1.55fr_1fr]">
        <Panel
          title="账户净值曲线"
          desc="近 30 日（含所有跟单与策略）"
          actions={
            <div className="flex gap-1">
              {["7D", "30D", "90D", "ALL"].map((t, i) => (
                <span
                  key={t}
                  className={cn(
                    "rounded-pill px-2.5 py-1 text-[11.5px] font-medium",
                    i === 1 ? "bg-wise-green text-wise-darkgreen" : "text-muted-foreground"
                  )}
                >
                  {t}
                </span>
              ))}
            </div>
          }
        >
          <AreaChart data={p.series} height={230} id="dash" />
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              { k: "期初", v: fmtUsd(p.series[0]) },
              { k: "期末", v: fmtUsd(p.equity) },
              { k: "最高", v: fmtUsd(Math.max(...p.series)) },
              { k: "最低", v: fmtUsd(Math.min(...p.series)) },
            ].map((x) => (
              <div key={x.k}>
                <div className="text-[11.5px] text-muted-foreground">{x.k}</div>
                <div className="num text-[14px] font-semibold">{x.v}</div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="资金分配" desc="按交易员">
          <div className="flex items-center gap-5">
            <div className="relative">
              <Donut data={p.allocation} size={148} />
            </div>
            <div className="flex-1 space-y-2.5">
              {p.allocation.map((a, i) => (
                <div key={a.name} className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-sm"
                    style={{ background: ["#9fe870", "#4cc9f0", "#ffd11a", "#f6465d", "#b388ff"][i % 5] }}
                  />
                  <span className="flex-1 truncate text-[13px]">{a.name}</span>
                  <span className="num text-[12.5px] font-semibold">{a.pct}%</span>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-5 space-y-2 border-t border-border pt-4">
            {[
              { k: "可用余额", v: fmtUsd(user.balance) },
              { k: "跟单占用", v: fmtUsd(relations.reduce((a, r) => a + r.capital, 0)) },
              { k: "风险敞口", v: fmtUsd(relations.reduce((a, r) => a + r.capital * r.leverage, 0)) },
            ].map((x) => (
              <div key={x.k} className="flex items-center justify-between text-[13px]">
                <span className="text-muted-foreground">{x.k}</span>
                <span className="num font-semibold">{x.v} USDT</span>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1.25fr_1fr]">
        <Panel
          title="我的跟单"
          desc="实时展示每条跟单的表现"
          actions={
            <Link href="/copy-trading" className="text-[13px] font-semibold text-wise-darkgreen dark:text-wise-green">
              全部管理
            </Link>
          }
          bodyClassName="p-0"
        >
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-border">
                <tr>
                  <Th>交易员</Th>
                  <Th>资金</Th>
                  <Th>杠杆</Th>
                  <Th>盈亏</Th>
                  <Th>状态</Th>
                </tr>
              </thead>
              <tbody>
                {relations.map((r) => {
                  const t = traders.find((x) => x.id === r.traderId);
                  return (
                    <tr key={r.id} className="border-b border-border/60 last:border-0">
                      <Td>
                        <div className="flex items-center gap-2">
                          <div
                            className="flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold text-wise-darkgreen"
                            style={{ background: `hsl(${t?.avatarHue ?? 90} 72% 78%)` }}
                          >
                            {(t?.name ?? "??").slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-medium">{t?.name}</div>
                            <div className="text-[11px] text-muted-foreground">{t?.style}</div>
                          </div>
                        </div>
                      </Td>
                      <Td className="num">{fmtUsd(r.capital)}</Td>
                      <Td className="num">{r.leverage}x</Td>
                      <Td className={cn("num font-semibold", signClass(r.pnl))}>
                        {r.pnl >= 0 ? "+" : ""}
                        {fmtUsd(r.pnl)} ({fmtPct(r.pnlPct, 1)})
                      </Td>
                      <Td>
                        <Badge tone={r.status === "running" ? "green" : "default"}>
                          {r.status === "running" ? "运行中" : "已暂停"}
                        </Badge>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel
          title="最近成交"
          actions={
            <Link href="/copy-trading" className="inline-flex items-center gap-1 text-[13px] font-semibold">
              明细 <ArrowUpRight size={13} />
            </Link>
          }
          bodyClassName="p-0"
        >
          <div className="divide-y divide-border">
            {trades.map((t) => (
              <div key={t.id} className="flex items-center justify-between gap-3 px-5 py-3">
                <div>
                  <div className="flex items-center gap-1.5 text-[13px] font-semibold">
                    <span className={t.side === "LONG" ? "text-[#0ecb81]" : "text-[#f6465d]"}>
                      {t.side === "LONG" ? "开多" : "开空"}
                    </span>
                    {t.symbol}
                    <span className="text-[11px] font-normal text-muted-foreground">
                      {t.leverage}x · {EXCHANGE_LABEL[t.exchange] ?? t.exchange}
                    </span>
                  </div>
                  <div className="text-[11.5px] text-muted-foreground">
                    {t.traderName} · {timeAgo(t.ts)}
                  </div>
                </div>
                <div className="text-right">
                  <div className={cn("num text-[13.5px] font-semibold", signClass(t.pnl))}>
                    {t.status === "open" ? "持仓中" : `${t.pnl >= 0 ? "+" : ""}${fmtUsd(t.pnl)}`}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {fmtUsd(t.entry, t.entry > 1000 ? 1 : 4)} → {t.exit ? fmtUsd(t.exit, t.exit > 1000 ? 1 : 4) : "—"}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <div className="mt-5">
        <Panel title="推荐交易员" desc="按近 30 日收益排序" bodyClassName="p-0">
          <div className="grid gap-px bg-border sm:grid-cols-2 lg:grid-cols-4">
            {traders.slice(0, 4).map((t) => (
              <Link key={t.id} href="/copy-trading" className="bg-card p-5 transition hover:bg-surface">
                <div className="flex items-center gap-2.5">
                  <div
                    className="flex h-9 w-9 items-center justify-center rounded-full text-[11px] font-bold text-wise-darkgreen"
                    style={{ background: `hsl(${t.avatarHue} 72% 78%)` }}
                  >
                    {t.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-[13.5px] font-semibold">{t.name}</div>
                    <div className="truncate text-[11px] text-muted-foreground">{t.tagline}</div>
                  </div>
                </div>
                <div className="mt-3 flex items-end justify-between">
                  <div>
                    <div className="num text-[18px] font-bold text-[#0ecb81]">{fmtPct(t.roi30d)}</div>
                    <div className="text-[11px] text-muted-foreground">近 30 日</div>
                  </div>
                  <Sparkline data={t.curve.slice(-24)} width={80} height={30} />
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <RiskPill risk={t.risk} />
                  <span className="text-[11px] text-muted-foreground">{t.followers.toLocaleString()} 人跟单</span>
                </div>
              </Link>
            ))}
          </div>
        </Panel>
      </div>
    </>
  );
}

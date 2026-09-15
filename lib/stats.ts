import { all, filter, update } from "./db";
import { getTraders } from "./seed";
import type { CopyRelation, Signal, Trade, Trader } from "./types";

/**
 * 统计层。
 *
 * ⚠️ 全部由真实记录算出。
 * 早期版本这里写死了 maxDrawdown=9.42、sharpe=1.94，还用 totalPnl*0.0832 伪造
 * 「今日盈亏」，曲线是正弦波拟合出来的 —— 在实盘语境下这些都是误导，
 * 已全部删除。没有数据时就是 0 / 空数组。
 */

export type Portfolio = {
  equity: number;
  totalPnl: number;
  pnlPct: number;
  todayPnl: number;
  todayPnlPct: number;
  openPositions: number;
  runningCopies: number;
  winRate: number;
  maxDrawdown: number;
  sharpe: number;
  series: number[];
  allocation: { name: string; value: number; pct: number }[];
  bestTrader: string;
  allocated: number;
};

const DAY = 86_400_000;

export async function portfolioOf(userId: string): Promise<Portfolio> {
  const relations = await filter<CopyRelation>("copyRelations", (r) => r.userId === userId);
  const trades = await filter<Trade>("trades", (t) => t.userId === userId);
  const traders = await getTraders();

  const allocated = relations.reduce((a, r) => a + r.capital, 0);
  const totalPnl = relations.reduce((a, r) => a + r.pnl, 0);
  const equity = allocated + totalPnl;

  const closed = trades.filter((t) => t.status === "closed");
  const wins = closed.filter((t) => t.pnl > 0).length;
  const winRate = closed.length ? (wins / closed.length) * 100 : 0;

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const todayPnl = closed.filter((t) => t.ts >= startOfDay.getTime()).reduce((a, t) => a + t.pnl, 0);

  // 真实权益曲线：按日聚合已实现盈亏，回推 30 天
  const series: number[] = [];
  const baseline = allocated || 0;
  let running = 0;
  const dailyPnl = new Map<string, number>();
  for (const t of closed) {
    const d = new Date(t.ts);
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    dailyPnl.set(key, (dailyPnl.get(key) ?? 0) + t.pnl);
  }
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.now() - i * DAY);
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    // 只累计「当天及之前」的已实现盈亏
    let acc = 0;
    for (const [k, v] of dailyPnl) {
      const [y, m, dd] = k.split("-").map(Number);
      const kt = new Date(y, m, dd).getTime();
      if (kt <= d.getTime()) acc += v;
    }
    running = acc;
    series.push(0);
    series[series.length - 1] = Number((baseline + running).toFixed(2));
  }
  // 最后一点用当前总权益对齐
  if (series.length) series[series.length - 1] = Number(equity.toFixed(2));

  const allocation = relations.map((r) => {
    const t = traders.find((x) => x.id === r.traderId);
    return {
      name: t?.name ?? "未知信号源",
      value: Number((r.capital + r.pnl).toFixed(2)),
      pct: equity ? Number((((r.capital + r.pnl) / equity) * 100).toFixed(1)) : 0,
    };
  });

  const best = [...relations].sort((a, b) => b.pnlPct - a.pnlPct)[0];
  const bestTrader = best ? traders.find((t) => t.id === best.traderId)?.name ?? "—" : "—";

  const dd = maxDrawdownOf(series);
  const rets = dailyReturns(series);

  return {
    equity: Number(equity.toFixed(2)),
    totalPnl: Number(totalPnl.toFixed(2)),
    pnlPct: allocated ? Number(((totalPnl / allocated) * 100).toFixed(2)) : 0,
    todayPnl: Number(todayPnl.toFixed(2)),
    todayPnlPct: equity ? Number(((todayPnl / equity) * 100).toFixed(2)) : 0,
    openPositions: trades.filter((t) => t.status === "open").length,
    runningCopies: relations.filter((r) => r.status === "running").length,
    winRate: Number(winRate.toFixed(1)),
    maxDrawdown: dd,
    sharpe: sharpeOf(rets),
    series,
    allocation,
    bestTrader,
    allocated: Number(allocated.toFixed(2)),
  };
}

function maxDrawdownOf(series: number[]): number {
  let peak = -Infinity;
  let maxDd = 0;
  for (const v of series) {
    if (v > peak) peak = v;
    if (peak > 0) maxDd = Math.max(maxDd, ((peak - v) / peak) * 100);
  }
  return Number(maxDd.toFixed(2));
}

function dailyReturns(series: number[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < series.length; i++) {
    if (series[i - 1] > 0) out.push(series[i] / series[i - 1] - 1);
  }
  return out;
}

function sharpeOf(rets: number[]): number {
  if (rets.length < 2) return 0;
  const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
  const variance = rets.reduce((a, b) => a + (b - mean) ** 2, 0) / (rets.length - 1);
  const sd = Math.sqrt(variance);
  if (!sd) return 0;
  // 日频 → 年化
  return Number(((mean / sd) * Math.sqrt(365)).toFixed(2));
}

export async function pnlByDay(userId: string) {
  const trades = await filter<Trade>("trades", (t) => t.userId === userId);
  const buckets = new Map<string, number>();
  for (let i = 13; i >= 0; i--) {
    const d = new Date(Date.now() - i * DAY);
    buckets.set(`${d.getMonth() + 1}/${d.getDate()}`, 0);
  }
  trades.forEach((t) => {
    const d = new Date(t.ts);
    const key = `${d.getMonth() + 1}/${d.getDate()}`;
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + t.pnl);
  });
  return Array.from(buckets, ([day, pnl]) => ({ day, pnl: Number(pnl.toFixed(2)) }));
}

export async function exchangeBreakdown(userId: string) {
  const trades = await filter<Trade>("trades", (t) => t.userId === userId);
  const map = new Map<string, { exchange: string; trades: number; pnl: number }>();
  trades.forEach((t) => {
    const cur = map.get(t.exchange) ?? { exchange: t.exchange, trades: 0, pnl: 0 };
    cur.trades += 1;
    cur.pnl += t.pnl;
    map.set(t.exchange, cur);
  });
  return Array.from(map.values());
}

export async function recentTrades(userId: string, limit = 8) {
  const rows = await all<Trade>("trades");
  return rows
    .filter((t) => t.userId === userId)
    .sort((a, b) => b.ts - a.ts)
    .slice(0, limit);
}

/* ------------------------------------------------------------------ */
/* 信号源业绩回算                                                       */
/* ------------------------------------------------------------------ */

/**
 * 用真实成交回填信号源的业绩。跟单人数 / AUM / 胜率 / 收益 全部有据可查，
 * 不再有任何硬编码数字。
 */
export async function recalcTraderStats(traderId: string): Promise<void> {
  const relations = await filter<CopyRelation>("copyRelations", (r) => r.traderId === traderId);
  const signals = await filter<Signal>("signals", (s) => s.traderId === traderId);
  const relIds = new Set(relations.map((r) => r.id));
  const trades = (await all<Trade>("trades")).filter((t) => t.relationId && relIds.has(t.relationId));

  const followers = new Set(relations.map((r) => r.userId)).size;
  const aum = relations.reduce((a, r) => a + r.capital, 0);

  const closed = trades.filter((t) => t.status === "closed");
  const wins = closed.filter((t) => t.pnl > 0).length;
  const winRate = closed.length ? (wins / closed.length) * 100 : 0;

  const pnl30 = closed.filter((t) => t.ts >= Date.now() - 30 * DAY).reduce((a, t) => a + t.pnl, 0);
  const pnl90 = closed.filter((t) => t.ts >= Date.now() - 90 * DAY).reduce((a, t) => a + t.pnl, 0);
  const pnlAll = closed.reduce((a, t) => a + t.pnl, 0);
  const base = aum || 1;

  // 曲线：按日累计已实现盈亏对应的收益率
  const points: number[] = [];
  for (let i = 29; i >= 0; i--) {
    const cutoff = Date.now() - i * DAY;
    const acc = closed.filter((t) => t.ts <= cutoff).reduce((a, t) => a + t.pnl, 0);
    points.push(Number((100 + (acc / base) * 100).toFixed(2)));
  }
  if (points.length) points[points.length - 1] = Number((100 + (pnlAll / base) * 100).toFixed(2));

  const returns = dailyReturns(points);
  const avgHoldTrades = closed.length
    ? Math.round(
        (closed.reduce((a, t) => a + t.leverage, 0) / closed.length) * 10
      ) / 10
    : 0;

  await update<Trader>("traders", (t) => t.id === traderId, {
    followers,
    aum: Number(aum.toFixed(2)),
    winRate: Number(winRate.toFixed(1)),
    roi30d: Number(((pnl30 / base) * 100).toFixed(2)),
    roi90d: Number(((pnl90 / base) * 100).toFixed(2)),
    roiTotal: Number(((pnlAll / base) * 100).toFixed(2)),
    maxDrawdown: maxDrawdownOf(points),
    sharpe: sharpeOf(returns),
    trades: signals.length,
    avgHold: closed.length ? `${avgHoldTrades}x 杠杆 · 已平 ${closed.length} 笔` : "—",
    curve: points,
    verified: followers > 0,
  });
}

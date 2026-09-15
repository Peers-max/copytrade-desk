import "server-only";

import { candles } from "./market";
import { update } from "./db";
import { getLiveTraders } from "./seed";
import { emitSignal } from "./executor";
import type { QuantKind, Trader } from "./types";

/**
 * 内置量化引擎。
 *
 * 定位：给「信号源」提供一个自包含的产生方式 —— 不需要外部推送，服务端定时
 * 拉真实 K 线算指标，触发条件就发信号。这是源站文案里「量化策略实时适应市场
 * 波动」对应的那一半。
 *
 * ⚠️ 这些策略本身是**规则示例**，不是经过验证的盈利系统。参数需要你自己调、
 * 自己回测。系统只负责把「策略判定」忠实地变成「交易所里的真实订单」，
 * 不为收益背书。
 *
 * 触发方式：
 *   - 站主在「信号源管理」页点「立即运行一轮」
 *   - 或由 GitHub Actions 定时调用 /api/quant/run（见 .github/workflows/tick.yml）
 */

type Decision = {
  side: "LONG" | "SHORT";
  action: "OPEN" | "CLOSE";
  reason: string;
};

type SymbolState = {
  side: "LONG" | "SHORT" | null;
  entry?: number;
  fast?: number;
  slow?: number;
  rsi?: number;
  gridRef?: number;
  lastBarTs?: number;
};

/* ---------------- 指标 ---------------- */

function ema(values: number[], period: number): number[] {
  if (!values.length) return [];
  const k = 2 / (period + 1);
  const out: number[] = [values[0]];
  for (let i = 1; i < values.length; i++) out.push(values[i] * k + out[i - 1] * (1 - k));
  return out;
}

function rsi(values: number[], period = 14): number[] {
  const out = new Array(values.length).fill(50);
  if (values.length <= period) return out;
  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= period; i++) {
    const d = values[i] - values[i - 1];
    if (d >= 0) gain += d;
    else loss -= d;
  }
  let ag = gain / period;
  let al = loss / period;
  out[period] = al === 0 ? 100 : 100 - 100 / (1 + ag / al);
  for (let i = period + 1; i < values.length; i++) {
    const d = values[i] - values[i - 1];
    ag = (ag * (period - 1) + Math.max(d, 0)) / period;
    al = (al * (period - 1) + Math.max(-d, 0)) / period;
    out[i] = al === 0 ? 100 : 100 - 100 / (1 + ag / al);
  }
  return out;
}

/* ---------------- 单策略判定 ---------------- */

async function decide(trader: Trader, symbol: string): Promise<Decision[]> {
  const cfg = trader.quant;
  if (!cfg) return [];

  const interval = cfg.interval || "15m";
  const p = cfg.params ?? {};
  const bars = await candles(symbol, interval, 200);
  if (bars.length < 30) return [];

  const closes = bars.map((b) => b.c);
  const n = closes.length - 1;
  const price = closes[n];
  const state: SymbolState = (trader.engineState ?? {})[symbol] ?? { side: null };

  // 同一根 K 线只判定一次，避免定时任务抖动造成重复下单
  const barTs = bars[n].t;
  if (state.lastBarTs === barTs) return [];
  state.lastBarTs = barTs;

  const out: Decision[] = [];
  const push = (d: Decision) => out.push(d);

  switch (cfg.kind as QuantKind) {
    case "ema_cross": {
      const fastP = p.fast ?? 12;
      const slowP = p.slow ?? 26;
      const f = ema(closes, fastP);
      const s = ema(closes, slowP);
      const prevDiff = f[n - 1] - s[n - 1];
      const curDiff = f[n] - s[n];
      state.fast = f[n];
      state.slow = s[n];
      if (prevDiff <= 0 && curDiff > 0) {
        if (state.side === "SHORT") push({ side: "SHORT", action: "CLOSE", reason: `EMA${fastP}/${slowP} 金叉翻多` });
        push({ side: "LONG", action: "OPEN", reason: `EMA${fastP} 上穿 EMA${slowP}（金叉）` });
      } else if (prevDiff >= 0 && curDiff < 0) {
        if (state.side === "LONG") push({ side: "LONG", action: "CLOSE", reason: `EMA${fastP}/${slowP} 死叉翻空` });
        push({ side: "SHORT", action: "OPEN", reason: `EMA${fastP} 下穿 EMA${slowP}（死叉）` });
      }
      break;
    }

    case "rsi_revert": {
      const period = p.period ?? 14;
      const low = p.low ?? 30;
      const high = p.high ?? 70;
      const exit = p.exit ?? 50;
      const r = rsi(closes, period);
      const cur = r[n];
      const prev = r[n - 1];
      state.rsi = cur;
      if (prev >= low && cur < low) {
        if (state.side === "SHORT") push({ side: "SHORT", action: "CLOSE", reason: `RSI 跌破 ${low} 超卖` });
        push({ side: "LONG", action: "OPEN", reason: `RSI ${cur.toFixed(1)} < ${low}（超卖）` });
      } else if (prev <= high && cur > high) {
        if (state.side === "LONG") push({ side: "LONG", action: "CLOSE", reason: `RSI 突破 ${high} 超买` });
        push({ side: "SHORT", action: "OPEN", reason: `RSI ${cur.toFixed(1)} > ${high}（超买）` });
      } else if (state.side === "LONG" && cur >= exit) {
        push({ side: "LONG", action: "CLOSE", reason: `RSI 回到 ${cur.toFixed(1)}，均值回归离场` });
      } else if (state.side === "SHORT" && cur <= exit) {
        push({ side: "SHORT", action: "CLOSE", reason: `RSI 回到 ${cur.toFixed(1)}，均值回归离场` });
      }
      break;
    }

    case "breakout": {
      const lookback = p.lookback ?? 20;
      if (n < lookback + 1) break;
      const win = bars.slice(n - lookback, n);
      const hh = Math.max(...win.map((b) => b.h));
      const ll = Math.min(...win.map((b) => b.l));
      if (price > hh) {
        if (state.side === "SHORT") push({ side: "SHORT", action: "CLOSE", reason: `向上突破 ${hh}` });
        push({ side: "LONG", action: "OPEN", reason: `收盘 ${price} 突破 ${lookback} 根高点 ${hh}` });
      } else if (price < ll) {
        if (state.side === "LONG") push({ side: "LONG", action: "CLOSE", reason: `向下跌破 ${ll}` });
        push({ side: "SHORT", action: "OPEN", reason: `收盘 ${price} 跌破 ${lookback} 根低点 ${ll}` });
      }
      break;
    }

    case "grid": {
      const gridPct = p.gridPct ?? 1.5;
      if (!state.gridRef) state.gridRef = price;
      const delta = ((price - state.gridRef) / state.gridRef) * 100;
      if (delta <= -gridPct && state.side !== "LONG") {
        if (state.side === "SHORT") push({ side: "SHORT", action: "CLOSE", reason: `网格上移复位` });
        push({ side: "LONG", action: "OPEN", reason: `较基准下移 ${delta.toFixed(2)}%，网格买入` });
      } else if (delta >= gridPct) {
        if (state.side === "LONG") push({ side: "LONG", action: "CLOSE", reason: `较基准上移 ${delta.toFixed(2)}%，网格卖出` });
        state.gridRef = price;
      }
      break;
    }
  }

  // 把最新状态写回 trader，供下一轮判定使用
  trader.engineState = { ...(trader.engineState ?? {}), [symbol]: state };
  return out;
}

/* ------------------------------------------------------------------ */
/* 引擎主循环                                                          */
/* ------------------------------------------------------------------ */

export type QuantRunItem = {
  traderId: string;
  traderName: string;
  symbol: string;
  action: string;
  side: string;
  reason: string;
  dispatched: number;
  succeeded: number;
  failed: number;
  error?: string;
};

export type QuantRunReport = {
  ran: number;
  emitted: number;
  items: QuantRunItem[];
};

export async function runQuantEngine(opts: { traderId?: string } = {}): Promise<QuantRunReport> {
  const all = (await getLiveTraders()).filter((t) => t.source === "quant" && t.quant);
  const traders = opts.traderId ? all.filter((t) => t.id === opts.traderId) : all;

  const items: QuantRunItem[] = [];

  for (const trader of traders) {
    for (const symbol of trader.symbols ?? []) {
      let decisions: Decision[] = [];
      try {
        decisions = await decide(trader, symbol);
      } catch (e: any) {
        items.push({
          traderId: trader.id,
          traderName: trader.name,
          symbol,
          action: "—",
          side: "—",
          reason: "指标计算失败",
          dispatched: 0,
          succeeded: 0,
          failed: 0,
          error: String(e?.message ?? e),
        });
        continue;
      }

      for (const d of decisions) {
        try {
          const rep = await emitSignal({
            trader,
            symbol,
            side: d.side,
            action: d.action,
            source: "quant",
            note: d.reason,
          });
          items.push({
            traderId: trader.id,
            traderName: trader.name,
            symbol,
            action: d.action,
            side: d.side,
            reason: d.reason,
            dispatched: rep.dispatched,
            succeeded: rep.succeeded,
            failed: rep.failed,
          });
        } catch (e: any) {
          items.push({
            traderId: trader.id,
            traderName: trader.name,
            symbol,
            action: d.action,
            side: d.side,
            reason: d.reason,
            dispatched: 0,
            succeeded: 0,
            failed: 0,
            error: String(e?.message ?? e),
          });
        }
      }
    }

    // 落盘引擎状态
    await update<Trader>("traders", (t) => t.id === trader.id, { engineState: trader.engineState });
  }

  return { ran: traders.length, emitted: items.filter((i) => !i.error && i.succeeded > 0).length, items };
}

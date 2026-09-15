import "server-only";

import { filter, find, insert, uid, update } from "./db";
import { getAdapter } from "./exchanges";
import { pickApiKey, tradingCredentials } from "./keys";
import { lastPrice } from "./market";
import { updateSource } from "./sources";
import type { CopyRelation, Notification, Signal, SignalSource, Trade, Trader } from "./types";

/**
 * 跟单执行引擎 —— 这是整个系统里唯一真正「动钱」的地方。
 *
 * 链路：信号源产出信号 → 找出该信号源下所有 running 的跟单关系 →
 *       逐条解析出该用户可用的交易所凭据 → 按分配保证金 × 杠杆算出名义额 →
 *       调交易所 REST 真实下单 → 回写成交记录 / 跟单盈亏 / 通知。
 *
 * 几条硬规则：
 * 1. **串行下发**，不并行。一家交易所的限频打爆了会导致整批失败，
 *    慢一点但每一笔都拿到明确的成功/失败回执更重要。
 * 2. **单笔名义额硬上限**，防止「跟单资金 100 万 + 20 倍杠杆」这类参数
 *    笔误直接把账户打穿。
 * 3. **单个用户失败不影响其他人**。某一家的 Key 失效了，只标记这一条关系，
 *    其余照常下单。
 * 4. **止损止盈直接挂到交易所侧**（closePosition / reduceOnly 条件单），
 *    这样即使本服务挂掉，风控依然生效。
 */

/** 单笔名义额硬上限（USDT）。超出的部分会被截断并记录提醒。 */
export const MAX_NOTIONAL_PER_ORDER = 100_000;

export type EmitInput = {
  trader: Trader;
  symbol: string;
  side: "LONG" | "SHORT";
  action: "OPEN" | "CLOSE" | "ADD" | "REDUCE";
  /** 留空则自动取最新价 */
  price?: number;
  leverage?: number;
  source?: SignalSource;
  note?: string;
  /** 由调用方明确指定用户，只给这一个用户下单（手动单发场景） */
  onlyUserId?: string;
};

export type EmitReport = {
  signal: Signal;
  dispatched: number;
  succeeded: number;
  failed: number;
};

export async function emitSignal(input: EmitInput): Promise<EmitReport> {
  const price = input.price && input.price > 0 ? input.price : await lastPrice(input.symbol);
  if (!price) throw new Error(`无法获取 ${input.symbol} 的最新价，信号未发出`);

  const signal: Signal = {
    id: uid("sg"),
    ts: Date.now(),
    traderId: input.trader.id,
    traderName: input.trader.name,
    symbol: input.symbol,
    side: input.side,
    action: input.action,
    price,
    leverage: input.leverage ?? 1,
    status: "pending",
    source: input.source ?? input.trader.source,
    note: input.note,
    dispatched: 0,
    succeeded: 0,
    failed: 0,
    results: [],
  };

  let relations = await filter<CopyRelation>(
    "copyRelations",
    (r) => r.traderId === input.trader.id && r.status === "running"
  );
  if (input.onlyUserId) relations = relations.filter((r) => r.userId === input.onlyUserId);

  signal.dispatched = relations.length;

  // 串行下发：一笔一笔来，每笔都有明确回执
  for (const rel of relations) {
    const res = await executeFor(rel, signal);
    signal.results!.push(res);
    if (res.ok) signal.succeeded = (signal.succeeded ?? 0) + 1;
    else signal.failed = (signal.failed ?? 0) + 1;
  }

  signal.status =
    signal.dispatched === 0
      ? "filled"
      : (signal.succeeded ?? 0) > 0
        ? input.action === "CLOSE"
          ? "closed"
          : "filled"
        : "failed";

  await insert<Signal>("signals", signal);

  await updateSource(input.trader.id, {
    lastSignalAt: signal.ts,
    signalCount: ((input.trader as any).signalCount ?? 0) + 1,
  });

  // 用真实成交回填该信号源的业绩（跟单人数 / AUM / 胜率 / 收益）
  const { recalcTraderStats } = await import("./stats");
  await recalcTraderStats(input.trader.id).catch(() => undefined);

  return {
    signal,
    dispatched: signal.dispatched ?? 0,
    succeeded: signal.succeeded ?? 0,
    failed: signal.failed ?? 0,
  };
}

/* ------------------------------------------------------------------ */
/* 单条跟单关系                                                        */
/* ------------------------------------------------------------------ */

type Outcome = NonNullable<Signal["results"]>[number];

async function executeFor(rel: CopyRelation, signal: Signal): Promise<Outcome> {
  const base: Outcome = { relationId: rel.id, userId: rel.userId, exchange: "", ok: false };

  const apiKey = await pickApiKey(rel.userId, rel.apiKeyId);
  if (!apiKey) {
    await noteFailure(rel, "未绑定可用的交易所 API Key，本笔未执行");
    return { ...base, error: "未绑定可用的交易所 API Key" };
  }

  const adapter = getAdapter(apiKey.exchange);
  if (!adapter || !adapter.tradable) {
    const msg = `${apiKey.exchange} 暂不支持实盘下单`;
    await noteFailure(rel, msg);
    return { ...base, exchange: apiKey.exchange, error: msg };
  }

  const cred = await tradingCredentials(apiKey);
  if (!cred) {
    const msg = "凭据解密失败，请重新绑定 API Key";
    await noteFailure(rel, msg);
    return { ...base, exchange: apiKey.exchange, error: msg };
  }

  const isOpen = signal.action === "OPEN" || signal.action === "ADD";

  // ---- 计算下单量 ----
  let notional: number;
  let qtyBase: number | undefined;
  let openTrades: Trade[] = [];

  if (isOpen) {
    const margin = rel.mode === "ratio" ? rel.capital * ((rel.ratio || 0) / 100) : rel.capital;
    if (!margin || margin <= 0) {
      const msg = "跟单资金为 0，未下单";
      await noteFailure(rel, msg);
      return { ...base, exchange: apiKey.exchange, error: msg };
    }
    const leverage = signal.leverage || rel.leverage || 1;
    notional = margin * leverage;
    if (notional > MAX_NOTIONAL_PER_ORDER) {
      await pushNotification(rel.userId, "risk", "单笔上限已生效", {
        body: `本笔名义额 ${notional.toFixed(0)} USDT 超过上限 ${MAX_NOTIONAL_PER_ORDER} USDT，已按上限截断执行。`,
      });
      notional = MAX_NOTIONAL_PER_ORDER;
    }
  } else {
    openTrades = await filter<Trade>(
      "trades",
      (t) => t.relationId === rel.id && t.symbol === signal.symbol && t.status === "open"
    );
    if (!openTrades.length) {
      const msg = `${signal.symbol} 没有可平仓位`;
      await noteFailure(rel, msg);
      return { ...base, exchange: apiKey.exchange, error: msg };
    }
    qtyBase = openTrades.reduce((a, t) => a + t.qty, 0);
    notional = qtyBase * signal.price;
  }

  // ---- 止损止盈价 ----
  const isLong = signal.side === "LONG";
  const stopLossPrice =
    isOpen && rel.stopLossPct > 0
      ? isLong
        ? signal.price * (1 - rel.stopLossPct / 100)
        : signal.price * (1 + rel.stopLossPct / 100)
      : undefined;
  const takeProfitPrice =
    isOpen && rel.takeProfitPct > 0
      ? isLong
        ? signal.price * (1 + rel.takeProfitPct / 100)
        : signal.price * (1 - rel.takeProfitPct / 100)
      : undefined;

  // ---- 真实下单 ----
  const result = await adapter.placeOrder(cred, {
    symbol: signal.symbol,
    side: signal.side,
    action: signal.action,
    notionalUsdt: notional,
    qtyBase,
    price: signal.price,
    leverage: isOpen ? signal.leverage || rel.leverage : undefined,
    stopLossPrice,
    takeProfitPrice,
    clientId: `${signal.id}${rel.id}`,
  });

  if (!result.ok) {
    await noteFailure(rel, result.error ?? "下单失败");
    await insert<Trade>("trades", {
      id: uid("td"),
      userId: rel.userId,
      ts: Date.now(),
      symbol: signal.symbol,
      side: signal.side,
      entry: signal.price,
      exit: null,
      qty: result.qty || 0,
      leverage: signal.leverage || rel.leverage,
      pnl: 0,
      status: "failed",
      traderName: signal.traderName,
      exchange: apiKey.exchange,
      traderId: signal.traderId,
      relationId: rel.id,
      signalId: signal.id,
      lastError: result.error,
    });
    return { ...base, exchange: apiKey.exchange, error: result.error };
  }

  const fillPrice = result.avgPrice || signal.price;

  // ---- 回写成交记录 ----
  if (isOpen) {
    await insert<Trade>("trades", {
      id: uid("td"),
      userId: rel.userId,
      ts: Date.now(),
      symbol: signal.symbol,
      side: signal.side,
      entry: fillPrice,
      exit: null,
      qty: result.qty,
      leverage: signal.leverage || rel.leverage,
      pnl: 0,
      status: "open",
      traderName: signal.traderName,
      exchange: apiKey.exchange,
      orderId: result.orderId,
      traderId: signal.traderId,
      relationId: rel.id,
      signalId: signal.id,
      notional: result.notionalUsdt,
      slOrderId: result.slOrderId,
      tpOrderId: result.tpOrderId,
    });
  } else {
    // 平仓：逐条结算
    let totalPnl = 0;
    for (const t of openTrades) {
      const pnl = (isLong ? fillPrice - t.entry : t.entry - fillPrice) * t.qty;
      totalPnl += pnl;
      await update<Trade>("trades", (x) => x.id === t.id, {
        exit: fillPrice,
        status: "closed",
        pnl: Number(pnl.toFixed(4)),
      });
    }
    const newPnl = rel.pnl + totalPnl;
    await update<CopyRelation>("copyRelations", (r) => r.id === rel.id, {
      pnl: Number(newPnl.toFixed(4)),
      pnlPct: Number(((newPnl / (rel.capital || 1)) * 100).toFixed(2)),
      copiedTrades: rel.copiedTrades + 1,
      lastSyncAt: Date.now(),
    });
  }

  if (isOpen) {
    await update<CopyRelation>("copyRelations", (r) => r.id === rel.id, {
      copiedTrades: rel.copiedTrades + 1,
      lastSyncAt: Date.now(),
      notionalTotal: (rel.notionalTotal ?? 0) + result.notionalUsdt,
      lastError: undefined,
    });
  }

  await pushNotification(
    rel.userId,
    "trade",
    isOpen ? `跟单已成交 · ${signal.symbol}` : `跟单已平仓 · ${signal.symbol}`,
    {
      body: isOpen
        ? `${signal.traderName} 在 ${signal.symbol} ${isLong ? "开多" : "开空"}，已按 ${fillPrice} 在 ${apiKey.exchange} 成交 ${result.qty}。`
        : `${signal.traderName} 平掉 ${signal.symbol}，平仓价 ${fillPrice}。`,
    }
  );

  return {
    relationId: rel.id,
    userId: rel.userId,
    exchange: apiKey.exchange,
    ok: true,
    orderId: result.orderId,
    qty: result.qty,
  };
}

async function noteFailure(rel: CopyRelation, error: string): Promise<void> {
  await update<CopyRelation>("copyRelations", (r) => r.id === rel.id, {
    failedTrades: (rel.failedTrades ?? 0) + 1,
    lastError: error,
    lastSyncAt: Date.now(),
  });
  await pushNotification(rel.userId, "risk", "跟单执行失败", {
    body: `${error}。请到「API 管理」检查绑定状态。`,
  });
}

async function pushNotification(
  userId: string,
  type: Notification["type"],
  title: string,
  extra: { body: string }
): Promise<void> {
  await insert<Notification>("notifications", {
    id: uid("nt"),
    userId,
    type,
    title,
    body: extra.body,
    read: false,
    ts: Date.now(),
  });
}

import { hmacSha256Hex } from "@/lib/crypto";
import {
  type AccountSnapshot,
  type Credentials,
  type ExchangeAdapter,
  type OrderRequest,
  type OrderResult,
  emptyResult,
  floorToStep,
  fromBinanceSymbol,
  timedFetch,
  toBinanceSymbol,
} from "./base";

/**
 * 币安 USDT-M 永续合约适配器。
 *
 * - 签名：HMAC-SHA256(query string + secret)，签名放 query 末尾，Key 走 X-MBX-APIKEY 头
 * - 时间戳：币安要求与服务器时间差 < 1000ms，这里先用 /fapi/v1/time 校正偏移
 * - 数量：按 exchangeInfo 的 LOT_SIZE.stepSize 向下取整，并校验 MIN_NOTIONAL
 * - 条件单：开仓后立刻用 closePosition=true 的 STOP_MARKET / TAKE_PROFIT_MARKET
 *   把止损止盈挂到交易所侧。这样即使我们的 Worker 挂了，风控仍然生效。
 */

const BASE = "https://fapi.binance.com";
const RECV_WINDOW = 5000;

let timeOffset = 0;
let offsetAt = 0;

async function syncTime(force = false): Promise<number> {
  const now = Date.now();
  if (!force && now - offsetAt < 60_000) return timeOffset;
  try {
    const r = await timedFetch(`${BASE}/fapi/v1/time`);
    const j: any = await r.json();
    if (j?.serverTime) {
      timeOffset = Number(j.serverTime) - Date.now();
      offsetAt = now;
    }
  } catch {
    /* 拿不到就用本地时间，签名失败时交易所会明确报 -1021 */
  }
  return timeOffset;
}

async function signed(
  path: string,
  params: Record<string, string | number | boolean | undefined>,
  c: Credentials,
  method: "GET" | "POST" | "DELETE" = "GET"
): Promise<any> {
  const offset = await syncTime();
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    qs.set(k, String(v));
  }
  qs.set("timestamp", String(Date.now() + offset));
  qs.set("recvWindow", String(RECV_WINDOW));
  const signature = await hmacSha256Hex(c.secret, qs.toString());
  const url = `${BASE}${path}?${qs.toString()}&signature=${signature}`;
  const res = await timedFetch(url, {
    method,
    headers: { "X-MBX-APIKEY": c.apiKey, "Content-Type": "application/json" },
  });
  const json: any = await res.json().catch(() => ({}));
  if (!res.ok) {
    // -1021 = 时间戳超窗，重校一次时间后让调用方重试
    if (json?.code === -1021) await syncTime(true);
    const msg = json?.msg || `HTTP ${res.status}`;
    throw new Error(`币安 ${json?.code ?? res.status}: ${msg}`);
  }
  return json;
}

/* ---------------- exchangeInfo 缓存 ---------------- */

type Filters = { stepSize: number; minQty: number; minNotional: number };
let filtersCache: { at: number; map: Map<string, Filters> } | null = null;

async function loadFilters(): Promise<Map<string, Filters>> {
  if (filtersCache && Date.now() - filtersCache.at < 10 * 60_000) return filtersCache.map;
  const map = new Map<string, Filters>();
  try {
    const r = await timedFetch(`${BASE}/fapi/v1/exchangeInfo`);
    const j: any = await r.json();
    for (const s of j?.symbols ?? []) {
      const lot = (s.filters ?? []).find((f: any) => f.filterType === "LOT_SIZE");
      const notional = (s.filters ?? []).find((f: any) => f.filterType === "MIN_NOTIONAL");
      if (!lot) continue;
      map.set(s.symbol, {
        stepSize: Number(lot.stepSize) || 0.001,
        minQty: Number(lot.minQty) || 0,
        minNotional: Number(notional?.notional) || 5,
      });
    }
  } catch {
    /* 退化为默认精度 */
  }
  if (!map.size) map.set("__default__", { stepSize: 0.001, minQty: 0, minNotional: 5 });
  filtersCache = { at: Date.now(), map };
  return map;
}

async function markPrice(symbol: string): Promise<number> {
  try {
    const r = await timedFetch(`${BASE}/fapi/v1/ticker/price?symbol=${toBinanceSymbol(symbol)}`);
    const j: any = await r.json();
    return Number(j?.price) || 0;
  } catch {
    return 0;
  }
}

async function isHedgeMode(c: Credentials): Promise<boolean> {
  try {
    const j = await signed("/fapi/v1/positionSide/dual", {}, c);
    return Boolean(j?.dualSidePosition);
  } catch {
    return false;
  }
}

/* ---------------- 适配器 ---------------- */

export const binanceAdapter: ExchangeAdapter = {
  id: "binance",
  label: "币安 Binance",
  needsPassphrase: false,
  tradable: true,

  async verify(c: Credentials): Promise<AccountSnapshot> {
    const acct = await signed("/fapi/v2/account", {}, c);

    // 权限位：/fapi/v2/account 会带回 canTrade / canDeposit / canWithdraw
    const permissions: string[] = ["读取"];
    if (acct?.canTrade !== false) permissions.push("交易");
    if (acct?.canDeposit) permissions.push("充值");
    const hasWithdraw = acct?.canWithdraw === true;
    if (hasWithdraw) permissions.push("提现");

    const positions = (acct?.positions ?? [])
      .filter((p: any) => Number(p.positionAmt) !== 0)
      .map((p: any) => ({
        symbol: fromBinanceSymbol(String(p.symbol)),
        side: Number(p.positionAmt) > 0 ? ("LONG" as const) : ("SHORT" as const),
        qty: Math.abs(Number(p.positionAmt)),
        entryPrice: Number(p.entryPrice) || 0,
        markPrice: Number(p.markPrice) || 0,
        unrealizedPnl: Number(p.unrealizedProfit) || 0,
        leverage: Number(p.leverage) || 0,
      }));

    const hedge = await isHedgeMode(c).catch(() => false);

    return {
      accountMode: `${hedge ? "双向持仓" : "单向持仓"} · 全仓（USDT-M）`,
      permissions,
      hasWithdraw,
      equityUsdt: Number(acct?.totalMarginBalance ?? acct?.totalWalletBalance) || 0,
      availableUsdt: Number(acct?.availableBalance) || 0,
      positions,
    };
  },

  async placeOrder(c: Credentials, o: OrderRequest): Promise<OrderResult> {
    const symbol = toBinanceSymbol(o.symbol);
    const isOpen = o.action === "OPEN" || o.action === "ADD";
    const isLong = o.side === "LONG";

    const filters = (await loadFilters()).get(symbol);
    if (!filters) return emptyResult(`币安无此合约交易对：${symbol}`);

    let price = o.price && o.price > 0 ? o.price : await markPrice(o.symbol);
    if (!price) return emptyResult(`无法获取 ${o.symbol} 最新价，已跳过`);

    let qty = floorToStep(o.notionalUsdt / price, filters.stepSize);
    if (qty <= 0) {
      return emptyResult(
        `下单量过小：${o.notionalUsdt.toFixed(2)} USDT ÷ ${price} = ${(o.notionalUsdt / price).toFixed(8)}，` +
          `低于最小步长 ${filters.stepSize}`
      );
    }
    const notional = qty * price;
    if (notional < filters.minNotional) {
      return emptyResult(
        `名义价值 ${notional.toFixed(2)} USDT 低于币安最小要求 ${filters.minNotional} USDT，请提高跟单资金或杠杆`
      );
    }

    // 杠杆：开仓前先设置，币安会按该杠杆占用保证金
    if (isOpen && o.leverage && o.leverage > 0) {
      const lev = Math.min(Math.max(Math.round(o.leverage), 1), 125);
      await signed("/fapi/v1/leverage", { symbol, leverage: lev }, c, "POST").catch(() => undefined);
    }

    const hedge = await isHedgeMode(c);
    const orderSide = isOpen === isLong ? "BUY" : "SELL";
    const params: Record<string, string | number | boolean> = {
      symbol,
      side: orderSide,
      type: "MARKET",
      quantity: qty,
      newClientOrderId: o.clientId.slice(0, 36),
    };
    if (hedge) {
      params.positionSide = isLong ? "LONG" : "SHORT";
    } else if (!isOpen) {
      params.reduceOnly = true;
    }

    let order: any;
    try {
      order = await signed("/fapi/v1/order", params, c, "POST");
    } catch (e: any) {
      return emptyResult(String(e?.message ?? e), { qty, notionalUsdt: notional });
    }

    const avgPrice = Number(order?.avgPrice) || price;
    const filledQty = Number(order?.executedQty) || qty;

    // 开仓后把止损止盈挂到交易所侧（closePosition 单，不依赖我们进程存活）
    let slOrderId: string | undefined;
    let tpOrderId: string | undefined;
    if (isOpen) {
      const exitSide = orderSide === "BUY" ? "SELL" : "BUY";
      const positionSide = isLong ? "LONG" : "SHORT";
      const cond = async (type: "STOP_MARKET" | "TAKE_PROFIT_MARKET", stopPrice: number) => {
        const p: Record<string, string | number | boolean> = {
          symbol,
          side: exitSide,
          type,
          stopPrice: Number(stopPrice.toFixed(8)),
          closePosition: true,
          workingType: "MARK_PRICE",
        };
        if (hedge) p.positionSide = positionSide;
        const r = await signed("/fapi/v1/order", p, c, "POST").catch(() => null);
        return r?.orderId ? String(r.orderId) : undefined;
      };
      if (o.stopLossPrice && o.stopLossPrice > 0) slOrderId = await cond("STOP_MARKET", o.stopLossPrice);
      if (o.takeProfitPrice && o.takeProfitPrice > 0) tpOrderId = await cond("TAKE_PROFIT_MARKET", o.takeProfitPrice);
    }

    return {
      ok: true,
      orderId: String(order?.orderId ?? ""),
      qty: filledQty,
      notionalUsdt: filledQty * avgPrice,
      avgPrice,
      slOrderId,
      tpOrderId,
      raw: order,
    };
  },
};

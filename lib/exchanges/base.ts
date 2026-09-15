/**
 * 交易所适配器的公共契约。
 *
 * 设计要点：
 * 1. 统一用**名义价值（USDT）**表达下单量。币安是按币数下单、OKX 是按张数下单，
 *    换算和精度取整全部收敛在各自适配器内部，上层业务只关心「这一笔要动用多少 U」。
 * 2. 符号内部统一用 `BTC/USDT`，进出适配器时再做映射。
 * 3. 所有方法失败都返回结果对象而不是抛异常 —— 跟单链路上某一家交易所挂了，
 *    不能把整批信号一起带崩。
 */

export type Credentials = {
  exchange: string;
  apiKey: string;
  secret: string;
  passphrase?: string;
};

export type Position = {
  /** 内部格式，如 BTC/USDT */
  symbol: string;
  side: "LONG" | "SHORT";
  /** 基础币数量 */
  qty: number;
  entryPrice: number;
  markPrice?: number;
  unrealizedPnl: number;
  leverage: number;
};

export type AccountSnapshot = {
  uid?: string;
  /** 如「单向持仓 · 全仓」 */
  accountMode?: string;
  permissions: string[];
  /** 交易所明确返回可提现 —— 这类 Key 一律拒绝用于跟单 */
  hasWithdraw: boolean;
  equityUsdt: number;
  availableUsdt: number;
  positions: Position[];
};

export type OrderAction = "OPEN" | "CLOSE" | "ADD" | "REDUCE";

export type OrderRequest = {
  symbol: string;
  side: "LONG" | "SHORT";
  action: OrderAction;
  /** 名义价值（USDT） */
  notionalUsdt: number;
  /** 直接指定基础币数量（平仓时用它精确对齐持仓，避免取整留下残仓） */
  qtyBase?: number;
  /** 参考价：市价单用它做数量换算 */
  price?: number;
  leverage?: number;
  /** 绝对触发价，留空则不在交易所挂条件单 */
  stopLossPrice?: number;
  takeProfitPrice?: number;
  clientId: string;
};

export type OrderResult = {
  ok: boolean;
  error?: string;
  orderId?: string;
  /** 实际下单的基础币数量 */
  qty: number;
  /** 实际名义价值（USDT） */
  notionalUsdt: number;
  avgPrice?: number;
  slOrderId?: string;
  tpOrderId?: string;
  raw?: any;
};

export interface ExchangeAdapter {
  id: string;
  label: string;
  needsPassphrase: boolean;
  /** 是否已实现实盘下单。未实现时只允许校验，不允许下单。 */
  tradable: boolean;
  verify(c: Credentials): Promise<AccountSnapshot>;
  placeOrder(c: Credentials, o: OrderRequest): Promise<OrderResult>;
}

/* ------------------------------------------------------------------ */
/* 符号映射                                                             */
/* ------------------------------------------------------------------ */

export function splitSymbol(symbol: string): { base: string; quote: string } {
  const [base, quote = "USDT"] = symbol.toUpperCase().split("/");
  return { base, quote };
}

/** BTC/USDT -> BTCUSDT */
export function toBinanceSymbol(symbol: string): string {
  const { base, quote } = splitSymbol(symbol);
  return `${base}${quote}`;
}

/** BTCUSDT / BTC_USDT -> BTC/USDT */
export function fromBinanceSymbol(s: string): string {
  const u = s.toUpperCase();
  for (const q of ["USDT", "USDC", "BUSD"]) {
    if (u.endsWith(q) && u.length > q.length) return `${u.slice(0, -q.length)}/${q}`;
  }
  return u;
}

/** BTC/USDT -> BTC-USDT-SWAP */
export function toOkxInstId(symbol: string): string {
  const { base, quote } = splitSymbol(symbol);
  return `${base}-${quote}-SWAP`;
}

/** BTC-USDT-SWAP -> BTC/USDT */
export function fromOkxInstId(instId: string): string {
  const [base, quote] = instId.toUpperCase().split("-");
  return `${base}/${quote}`;
}

/* ------------------------------------------------------------------ */
/* 通用工具                                                             */
/* ------------------------------------------------------------------ */

export const FETCH_TIMEOUT_MS = 12_000;

export async function timedFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: ctl.signal });
  } finally {
    clearTimeout(timer);
  }
}

/** 向零取整到 step 的整数倍，避免交易所报「数量精度错误」。 */
export function floorToStep(value: number, step: number): number {
  if (!step || step <= 0) return value;
  const decimals = decimalsOf(step);
  const n = Math.floor(value / step + 1e-9) * step;
  return Number(n.toFixed(Math.min(decimals + 2, 12)));
}

export function decimalsOf(step: number): number {
  const s = String(step);
  if (s.includes("e-")) return Number(s.split("e-")[1]);
  const dot = s.indexOf(".");
  return dot === -1 ? 0 : s.length - dot - 1;
}

export function emptyResult(error: string, extra: Partial<OrderResult> = {}): OrderResult {
  return { ok: false, error, qty: 0, notionalUsdt: 0, ...extra };
}

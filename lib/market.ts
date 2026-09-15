import { SYMBOLS } from "./seed";
import { timedFetch } from "./exchanges/base";

/**
 * 行情快照 —— 全部来自币安公开行情接口（无需鉴权、无速率风险）。
 *
 * ⚠️ 早期版本这里是**合成数据**（正弦波 + 伪随机噪声）。对演示 UI 勉强够用，
 * 但对要真金白银下单的实盘系统是危险的：用户会照着假价格做判断。
 * 现在只保留有真实数据源的字段，拿不到的一律返回空数组并标注，
 * 绝不编造。
 *
 * 数据源与真实性对照：
 *   tickers        → /fapi/v1/ticker/24hr + /fapi/v1/klines     真实
 *   fundingRate    → /fapi/v1/premiumIndex                      真实
 *   longShort      → /futures/data/globalLongShortAccountRatio   真实（大户多空持仓人数比）
 *   largeOrders    → /fapi/v1/depth 盘口前若干档按名义额排序      真实
 *   liquidations   → 无免费可靠数据源 → 空数组
 *   whaleTransfers → 无免费可靠数据源 → 空数组
 */

export type MarketTicker = {
  symbol: string;
  base: string;
  price: number;
  changePct: number;
  change: number;
  high24h: number;
  low24h: number;
  volume24h: number;
  spark: number[];
};

export type MarketSnapshot = {
  ts: number;
  source: "binance" | "unavailable";
  error?: string;
  tickers: MarketTicker[];
  longShort: { long: number; short: number };
  largeOrders: { symbol: string; side: "buy" | "sell"; price: number; amountUsd: number }[];
  whaleTransfers: { symbol: string; amount: number; usd: number; from: string; to: string; ts: number }[];
  liquidations: { price: number; long: number; short: number }[];
  totalLiquidationUsd: number;
  fundingRate: number;
};

const FAPI = "https://fapi.binance.com";

/** 单条快照在同一个 Worker 实例内复用 20 秒，避免每次 SSR 都打十几发请求 */
const TTL = 20_000;
let cache: { at: number; snap: MarketSnapshot } | null = null;
let inflight: Promise<MarketSnapshot> | null = null;

const EMPTY: MarketSnapshot = {
  ts: 0,
  source: "unavailable",
  tickers: [],
  longShort: { long: 50, short: 50 },
  largeOrders: [],
  whaleTransfers: [],
  liquidations: [],
  totalLiquidationUsd: 0,
  fundingRate: 0,
};

async function json<T = any>(url: string): Promise<T | null> {
  try {
    const r = await timedFetch(url);
    if (!r.ok) return null;
    return (await r.json()) as T;
  } catch {
    return null;
  }
}

export async function buildMarket(): Promise<MarketSnapshot> {
  const now = Date.now();
  if (cache && now - cache.at < TTL) return cache.snap;
  if (inflight) return inflight;

  inflight = (async () => {
    try {
      const snap = await fetchSnapshot();
      cache = { at: Date.now(), snap };
      return snap;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

async function fetchSnapshot(): Promise<MarketSnapshot> {
  const wanted = new Set(SYMBOLS.map((s) => s.base + "USDT"));

  const [all24h, funding, lsr] = await Promise.all([
    json<any[]>(`${FAPI}/fapi/v1/ticker/24hr`),
    json<any>(`${FAPI}/fapi/v1/premiumIndex?symbol=BTCUSDT`),
    json<any[]>(`${FAPI}/futures/data/globalLongShortAccountRatio?symbol=BTCUSDT&period=5m&limit=1`),
  ]);

  if (!Array.isArray(all24h) || !all24h.length) {
    return { ...EMPTY, ts: Date.now(), error: "行情源（币安）暂时不可达，请稍后刷新。" };
  }

  const bySymbol = new Map(all24h.map((t: any) => [String(t.symbol), t]));

  // 每个币种拉一段 15m K 线做走势缩略图
  const sparks = await Promise.all(
    SYMBOLS.map(async (s) => {
      const k = await json<any[]>(`${FAPI}/fapi/v1/klines?symbol=${s.base}USDT&interval=15m&limit=32`);
      if (!Array.isArray(k)) return [] as number[];
      return k.map((row: any) => Number(row[4]));
    })
  );

  const tickers: MarketTicker[] = [];
  SYMBOLS.forEach((s, i) => {
    const t = bySymbol.get(s.base + "USDT");
    if (!t) return;
    const price = Number(t.lastPrice);
    const change = Number(t.priceChange);
    tickers.push({
      symbol: s.symbol,
      base: s.base,
      price,
      change,
      changePct: Number(t.priceChangePercent),
      high24h: Number(t.highPrice),
      low24h: Number(t.lowPrice),
      volume24h: Number(t.quoteVolume),
      spark: sparks[i] ?? [],
    });
  });

  const long = Number(lsr?.[0]?.longAccount);
  const fundingRate = Number(funding?.lastFundingRate);

  // 盘口大额挂单：取深度前 100 档里名义额最大的 6 档
  const depth = await json<any>(`${FAPI}/fapi/v1/depth?symbol=BTCUSDT&limit=100`);
  const largeOrders = depth
    ? [
        ...(depth.bids ?? []).map((b: any) => ({ side: "buy" as const, price: Number(b[0]), qty: Number(b[1]) })),
        ...(depth.asks ?? []).map((a: any) => ({ side: "sell" as const, price: Number(a[0]), qty: Number(a[1]) })),
      ]
        .map((o) => ({ symbol: "BTC/USDT", side: o.side, price: o.price, amountUsd: o.price * o.qty }))
        .sort((a, b) => b.amountUsd - a.amountUsd)
        .slice(0, 6)
    : [];

  return {
    ts: Date.now(),
    source: "binance",
    tickers,
    longShort: Number.isFinite(long) && long > 0 ? { long: Math.round(long * 100), short: 100 - Math.round(long * 100) } : { long: 50, short: 50 },
    largeOrders,
    // 链上大额转账 / 清算热力图需要付费数据源（Glassnode、Coinglass 等），
    // 这里不编造，保持为空，前端会显示「暂无数据」。
    whaleTransfers: [],
    liquidations: [],
    totalLiquidationUsd: 0,
    fundingRate: Number.isFinite(fundingRate) ? fundingRate : 0,
  };
}

export async function getTicker(symbol: string): Promise<MarketTicker | null> {
  const m = await buildMarket();
  return m.tickers.find((t) => t.symbol === symbol) ?? null;
}

/** 取某个交易对的真实最新价；quant 引擎与执行链路都用它。 */
export async function lastPrice(symbol: string): Promise<number> {
  const t = (await getTicker(symbol))?.price;
  if (t) return t;
  const base = symbol.toUpperCase().replace("/", "");
  const r = await json<any>(`${FAPI}/fapi/v1/ticker/price?symbol=${base}`);
  return Number(r?.price) || 0;
}

/** 拉真实 K 线（用于量化引擎算指标）。 */
export type Candle = { t: number; o: number; h: number; l: number; c: number; v: number };

export async function candles(symbol: string, interval = "15m", limit = 200): Promise<Candle[]> {
  const base = symbol.toUpperCase().replace("/", "");
  const rows = await json<any[]>(`${FAPI}/fapi/v1/klines?symbol=${base}&interval=${interval}&limit=${limit}`);
  if (!Array.isArray(rows)) return [];
  return rows.map((r: any) => ({
    t: Number(r[0]),
    o: Number(r[1]),
    h: Number(r[2]),
    l: Number(r[3]),
    c: Number(r[4]),
    v: Number(r[5]),
  }));
}

export async function closes(symbol: string, interval = "15m", limit = 200): Promise<number[]> {
  return (await candles(symbol, interval, limit)).map((c) => c.c);
}

import { SYMBOLS } from "./seed";
import { timedFetch } from "./exchanges/base";

/**
 * 行情快照。
 *
 * 全部来自交易所**公开**行情接口（无需鉴权）。
 *
 * ⚠️ 两条重要事实（2026-09 在 Cloudflare Workers 上实测）：
 *   1. 币安（fapi/api.binance.com，含 fapi1~3 备用域名）会拒绝 Worker 的出口，
 *      返回 403 / 451「restricted location」；Bybit 也被 CloudFront 地区封锁（403）。
 *   2. OKX 与 Gate 可正常访问。
 * 因此行情主源选 OKX，Gate 作为兜底，币安不再作为行情来源
 * （币安适配器仍保留在 lib/exchanges/binance.ts，供部署在非 Cloudflare 主机时使用）。
 *
 * 另：原先这里是**合成数据**（正弦波 + 伪随机噪声）。对演示 UI 勉强够用，
 * 但对要真金白银下单的实盘系统是危险的。现在只保留有真实数据源的字段，
 * 拿不到的一律返回空数组并标注，绝不编造。
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
  source: "okx" | "gate" | "unavailable";
  error?: string;
  tickers: MarketTicker[];
  longShort: { long: number; short: number };
  largeOrders: { symbol: string; side: "buy" | "sell"; price: number; amountUsd: number }[];
  whaleTransfers: { symbol: string; amount: number; usd: number; from: string; to: string; ts: number }[];
  liquidations: { price: number; long: number; short: number }[];
  totalLiquidationUsd: number;
  fundingRate: number;
};

const OKX = "https://www.okx.com";
const GATE = "https://api.gateio.ws";

/** 单条快照在同一个 Worker 实例内复用 20 秒 */
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

/* ------------------------------------------------------------------ */
/* 符号映射                                                             */
/* ------------------------------------------------------------------ */

/** BTC/USDT -> BTC-USDT-SWAP */
export function toOkxInst(s: string): string {
  const [base, quote = "USDT"] = s.toUpperCase().split("/");
  return `${base}-${quote}-SWAP`;
}

/** BTC/USDT -> BTC_USDT */
export function toGateContract(s: string): string {
  return s.toUpperCase().replace("/", "_");
}

/** 内部周期 -> OKX bar */
function toOkxBar(interval: string): string {
  const m: Record<string, string> = { "1m": "1m", "5m": "5m", "15m": "15m", "30m": "30m", "1h": "1H", "4h": "4H", "1d": "1D" };
  return m[interval] ?? "15m";
}

/** 内部周期 -> Gate interval */
function toGateInterval(interval: string): string {
  const m: Record<string, string> = { "1m": "1m", "5m": "5m", "15m": "15m", "30m": "30m", "1h": "1h", "4h": "4h", "1d": "1d" };
  return m[interval] ?? "15m";
}

/* ------------------------------------------------------------------ */
/* OKX                                                                 */
/* ------------------------------------------------------------------ */

type OkxTicker = {
  instId: string;
  last: string;
  open24h: string;
  high24h: string;
  low24h: string;
  volCcy24h: string;
};

async function okxSnapshot(): Promise<MarketSnapshot | null> {
  const payload = await json<{ code: string; data: OkxTicker[] }>(`${OKX}/api/v5/market/tickers?instType=SWAP`);
  if (payload?.code !== "0" || !Array.isArray(payload.data) || !payload.data.length) return null;

  const byInst = new Map(payload.data.map((t) => [t.instId, t]));

  // K 线：OKX 返回的是「最新在前」，要反过来才能当走势图用
  const sparks = await Promise.all(
    SYMBOLS.map(async (s) => {
      const k = await json<{ data: string[][] }>(
        `${OKX}/api/v5/market/candles?instId=${toOkxInst(s.symbol)}&bar=15m&limit=32`
      );
      if (!k?.data?.length) return [] as number[];
      return k.data.map((row) => Number(row[4])).reverse();
    })
  );

  const tickers: MarketTicker[] = [];
  SYMBOLS.forEach((s, i) => {
    const t = byInst.get(toOkxInst(s.symbol));
    if (!t) return;
    const price = Number(t.last);
    const open = Number(t.open24h);
    if (!price) return;
    const change = open ? price - open : 0;
    tickers.push({
      symbol: s.symbol,
      base: s.base,
      price,
      change,
      changePct: open ? (change / open) * 100 : 0,
      high24h: Number(t.high24h) || price,
      low24h: Number(t.low24h) || price,
      // volCcy24h 就是计价币（USDT）成交额
      volume24h: Number(t.volCcy24h) || 0,
      spark: sparks[i] ?? [],
    });
  });
  if (!tickers.length) return null;

  const [funding, lsr, books] = await Promise.all([
    json<{ data: Array<{ fundingRate: string }> }>(`${OKX}/api/v5/public/funding-rate?instId=${toOkxInst("BTC/USDT")}`),
    json<{ code: string; data: string[][] }>(
      `${OKX}/api/v5/rubik/stat/contracts/long-short-account-ratio?ccy=BTC&period=5m`
    ),
    json<{ data: Array<{ bids: string[][]; asks: string[][] }> }>(
      `${OKX}/api/v5/market/books?instId=${toOkxInst("BTC/USDT")}&sz=100`
    ),
  ]);

  // 多空持仓人数比：[ts, ratio]；ratio = 多/空，需要换算成百分比
  let longShort = { long: 50, short: 50 };
  const ratio = Number(lsr?.data?.[0]?.[1]);
  if (Number.isFinite(ratio) && ratio > 0) {
    const long = Math.round((ratio / (1 + ratio)) * 100);
    longShort = { long, short: 100 - long };
  }

  const book = books?.data?.[0];
  const largeOrders = book
    ? [
        ...(book.bids ?? []).map((b) => ({ side: "buy" as const, price: Number(b[0]), qty: Number(b[1]) })),
        ...(book.asks ?? []).map((a) => ({ side: "sell" as const, price: Number(a[0]), qty: Number(a[1]) })),
      ]
        .map((o) => ({ symbol: "BTC/USDT", side: o.side, price: o.price, amountUsd: o.price * o.qty }))
        .sort((a, b) => b.amountUsd - a.amountUsd)
        .slice(0, 6)
    : [];

  return {
    ts: Date.now(),
    source: "okx",
    tickers,
    longShort,
    largeOrders,
    whaleTransfers: [],
    liquidations: [],
    totalLiquidationUsd: 0,
    fundingRate: Number(funding?.data?.[0]?.fundingRate) || 0,
  };
}

/* ------------------------------------------------------------------ */
/* Gate（兜底：只保证价格可用）                                          */
/* ------------------------------------------------------------------ */

type GateTicker = {
  contract: string;
  last: string;
  change_percentage: string;
  high_24h: string;
  low_24h: string;
  volume_24h_quote: string;
};

async function gateSnapshot(): Promise<MarketSnapshot | null> {
  const list = await json<GateTicker[]>(`${GATE}/api/v4/futures/usdt/tickers`);
  if (!Array.isArray(list) || !list.length) return null;

  const byContract = new Map(list.map((t) => [t.contract, t]));
  const tickers: MarketTicker[] = [];

  for (const s of SYMBOLS) {
    const t = byContract.get(toGateContract(s.symbol));
    if (!t) continue;
    const price = Number(t.last);
    if (!price) continue;
    const pct = Number(t.change_percentage);
    const spark = await json<Array<{ c: string }>>(
      `${GATE}/api/v4/futures/usdt/candlesticks?contract=${toGateContract(s.symbol)}&interval=15m&limit=32`
    ).then((k) => (Array.isArray(k) ? k.map((r) => Number(r.c)) : []));

    tickers.push({
      symbol: s.symbol,
      base: s.base,
      price,
      change: price * (pct / 100),
      changePct: Number.isFinite(pct) ? pct : 0,
      high24h: Number(t.high_24h) || price,
      low24h: Number(t.low_24h) || price,
      volume24h: Number(t.volume_24h_quote) || 0,
      spark,
    });
  }
  if (!tickers.length) return null;

  return {
    ts: Date.now(),
    source: "gate",
    tickers,
    longShort: { long: 50, short: 50 },
    largeOrders: [],
    whaleTransfers: [],
    liquidations: [],
    totalLiquidationUsd: 0,
    fundingRate: 0,
  };
}

/* ------------------------------------------------------------------ */

export async function buildMarket(): Promise<MarketSnapshot> {
  const now = Date.now();
  if (cache && now - cache.at < TTL) return cache.snap;
  if (inflight) return inflight;

  inflight = (async () => {
    try {
      let snap: MarketSnapshot | null = null;
      let err: string | undefined;

      try {
        snap = await okxSnapshot();
      } catch (e: any) {
        err = String(e?.message ?? e);
      }
      if (!snap) {
        try {
          snap = await gateSnapshot();
        } catch {
          /* 继续走不可用分支 */
        }
      }

      if (!snap) {
        snap = { ...EMPTY, ts: Date.now(), error: err ?? "行情源（OKX / Gate）均不可达，请到 /api/diag 查看出网情况。" };
      }
      cache = { at: Date.now(), snap };
      return snap;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

export async function getTicker(symbol: string): Promise<MarketTicker | null> {
  const m = await buildMarket();
  return m.tickers.find((t) => t.symbol === symbol) ?? null;
}

/** 取某个交易对的真实最新价；quant 引擎与执行链路都用它。 */
export async function lastPrice(symbol: string): Promise<number> {
  const t = (await getTicker(symbol))?.price;
  if (t) return t;

  // 快照里没有该交易对时，单独直查一次（OKX -> Gate）
  const okx = await json<{ data: Array<{ last: string }> }>(
    `${OKX}/api/v5/market/ticker?instId=${toOkxInst(symbol)}`
  );
  const p1 = Number(okx?.data?.[0]?.last);
  if (p1) return p1;

  const gate = await json<{ last: string }>(
    `${GATE}/api/v4/futures/usdt/tickers?contract=${toGateContract(symbol)}`
  );
  const rows = Array.isArray(gate) ? gate : gate ? [gate] : [];
  const p2 = Number((rows as any[])[0]?.last);
  return p2 || 0;
}

/** 真实 K 线（量化引擎算指标用）。OKX 主源，Gate 兜底。 */
export type Candle = { t: number; o: number; h: number; l: number; c: number; v: number };

export async function candles(symbol: string, interval = "15m", limit = 200): Promise<Candle[]> {
  const okx = await json<{ code: string; data: string[][] }>(
    `${OKX}/api/v5/market/candles?instId=${toOkxInst(symbol)}&bar=${toOkxBar(interval)}&limit=${Math.min(limit, 300)}`
  );
  if (okx?.code === "0" && okx.data?.length) {
    return okx.data
      .map((r) => ({ t: Number(r[0]), o: Number(r[1]), h: Number(r[2]), l: Number(r[3]), c: Number(r[4]), v: Number(r[5]) }))
      .reverse();
  }

  const gate = await json<Array<{ t: number; o: string; h: string; l: string; c: string; v: string }>>(
    `${GATE}/api/v4/futures/usdt/candlesticks?contract=${toGateContract(symbol)}&interval=${toGateInterval(interval)}&limit=${Math.min(limit, 300)}`
  );
  if (Array.isArray(gate) && gate.length) {
    return gate.map((r) => ({
      t: Number(r.t) * 1000,
      o: Number(r.o),
      h: Number(r.h),
      l: Number(r.l),
      c: Number(r.c),
      v: Number(r.v),
    }));
  }

  return [];
}

export async function closes(symbol: string, interval = "15m", limit = 200): Promise<number[]> {
  return (await candles(symbol, interval, limit)).map((c) => c.c);
}

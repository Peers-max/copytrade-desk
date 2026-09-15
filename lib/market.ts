import { SYMBOLS } from "./seed";
import { hashString, seededRandom } from "./db";

export type MarketSnapshot = {
  ts: number;
  tickers: Array<{
    symbol: string;
    base: string;
    price: number;
    changePct: number;
    change: number;
    high24h: number;
    low24h: number;
    volume24h: number;
    spark: number[];
  }>;
  longShort: { long: number; short: number };
  largeOrders: { symbol: string; side: "buy" | "sell"; price: number; amountUsd: number }[];
  whaleTransfers: { symbol: string; amount: number; usd: number; from: string; to: string; ts: number }[];
  liquidations: { price: number; long: number; short: number }[];
  totalLiquidationUsd: number;
  fundingRate: number;
};

const BUCKET = 15000; // 15s

function bucketTs(ts: number) {
  return Math.floor(ts / BUCKET) * BUCKET;
}

export function buildMarket(now = Date.now()): MarketSnapshot {
  const t = bucketTs(now);
  const tickers = SYMBOLS.map((s, idx) => {
    const seed = hashString(s.symbol);
    const phase = (seed % 1000) / 1000 * Math.PI * 2;
    const slow = Math.sin(t / 240000 + phase) * 0.018;
    const mid = Math.sin(t / 45000 + phase * 2) * 0.006;
    const rnd = seededRandom(seed + Math.floor(t / BUCKET));
    const jitter = (rnd() - 0.5) * 0.004;
    const price = s.price * (1 + slow + mid + jitter);
    const changePct = (slow + mid + jitter) * 100 + (seededRandom(seed)() - 0.4) * 2.4;
    const high24h = price * (1 + Math.abs(slow) * 0.9 + 0.008);
    const low24h = price * (1 - Math.abs(slow) * 0.9 - 0.008);
    const volume24h = s.price * (900 + (seededRandom(seed + 7)() * 8000)) * (idx === 0 ? 12 : 1);
    const spark: number[] = [];
    const sr = seededRandom(seed + Math.floor(t / BUCKET));
    let v = price * (1 - 0.012);
    for (let i = 0; i < 32; i++) {
      v = v * (1 + (sr() - 0.48) * 0.006);
      spark.push(Number(v.toFixed(s.price > 1000 ? 2 : 4)));
    }
    return {
      symbol: s.symbol,
      base: s.base,
      price: Number(price.toFixed(s.price > 1000 ? 1 : s.price > 1 ? 3 : 5)),
      changePct: Number(changePct.toFixed(2)),
      change: Number((price * (changePct / 100)).toFixed(s.price > 1000 ? 1 : 4)),
      high24h: Number(high24h.toFixed(s.price > 1000 ? 1 : s.price > 1 ? 3 : 5)),
      low24h: Number(low24h.toFixed(s.price > 1000 ? 1 : s.price > 1 ? 3 : 5)),
      volume24h: Number(volume24h.toFixed(0)),
      spark,
    };
  });

  const r = seededRandom(Math.floor(t / BUCKET) + 99);
  const longPct = 46 + Math.round(r() * 18);

  const sides: Array<"buy" | "sell"> = ["buy", "sell", "buy", "buy", "sell"];
  const largeOrders = tickers.slice(0, 5).map((tk, i) => ({
    symbol: tk.symbol,
    side: sides[i],
    price: tk.price,
    amountUsd: Math.round((180000 + r() * 1400000) / 1000) * 1000,
  }));

  const venues = ["Binance", "OKX", "Bybit", "Bitget", "Gate", "未知钱包"];
  const whaleTransfers = tickers.slice(0, 4).map((tk, i) => {
    const amount = tk.base === "BTC" ? 180 + r() * 1600 : tk.base === "ETH" ? 2400 + r() * 18000 : 40000 + r() * 400000;
    return {
      symbol: tk.symbol,
      amount: Number(amount.toFixed(tk.base === "BTC" ? 1 : 0)),
      usd: Math.round(amount * tk.price),
      from: venues[i % venues.length],
      to: venues[(i + 2) % venues.length],
      ts: now - Math.round(r() * 900) * 1000,
    };
  });

  const btc = tickers[0];
  const liquidations = Array.from({ length: 22 }, (_, i) => {
    const p = btc.price * (1 + (i - 11) * 0.0016);
    const rr = seededRandom(Math.floor(t / BUCKET) + i * 13)();
    const isLong = i < 11;
    return {
      price: Number(p.toFixed(1)),
      long: isLong ? Math.round(rr * 3_400_000) : 0,
      short: !isLong ? Math.round(rr * 2_900_000) : 0,
    };
  });
  const totalLiquidationUsd = liquidations.reduce((a, b) => a + b.long + b.short, 0);

  return {
    ts: now,
    tickers,
    longShort: { long: longPct, short: 100 - longPct },
    largeOrders,
    whaleTransfers,
    liquidations,
    totalLiquidationUsd,
    fundingRate: Number(((r() - 0.35) * 0.06).toFixed(4)),
  };
}

export function getTicker(symbol: string) {
  const m = buildMarket();
  return m.tickers.find((t) => t.symbol === symbol) ?? m.tickers[0];
}

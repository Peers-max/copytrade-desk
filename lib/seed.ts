import { all, isSeeded, seededRandom, uid } from "./db";
import { readDB, writeDB } from "./store";
import type { ApiKey, CopyRelation, Invoice, Notification, Plan, Signal, Strategy, Trade, Trader, User } from "./types";

export const EXCHANGES = [
  { id: "binance", name: "Binance", cn: "币安" },
  { id: "okx", name: "OKX", cn: "欧易" },
  { id: "bybit", name: "Bybit", cn: "Bybit" },
  { id: "bitget", name: "Bitget", cn: "Bitget" },
  { id: "gate", name: "Gate", cn: "Gate.io" },
  { id: "htx", name: "HTX", cn: "火币 HTX" },
  { id: "bitmart", name: "BitMart", cn: "BitMart" },
  { id: "hotcoin", name: "Hotcoin", cn: "热币" },
];

export const SYMBOLS = [
  { symbol: "BTC/USDT", base: "BTC", price: 68420.5 },
  { symbol: "ETH/USDT", base: "ETH", price: 3542.18 },
  { symbol: "SOL/USDT", base: "SOL", price: 168.42 },
  { symbol: "BNB/USDT", base: "BNB", price: 592.7 },
  { symbol: "XRP/USDT", base: "XRP", price: 0.6218 },
  { symbol: "ADA/USDT", base: "ADA", price: 0.4521 },
  { symbol: "DOGE/USDT", base: "DOGE", price: 0.1385 },
  { symbol: "TON/USDT", base: "TON", price: 7.214 },
];

export const PLANS: Plan[] = [
  {
    id: "basic",
    name: "基础版",
    tagline: "刚上手，先跑通一次跟单",
    priceMonthly: 29,
    priceYearly: 290,
    popular: false,
    limits: { copySlots: 2, apiKeys: 1, strategies: 1, signals: "延迟 3–5 秒" },
    features: [
      "2 个跟单席位",
      "1 个交易所 API 绑定",
      "1 个量化策略",
      "标准信号延迟（3–5 秒）",
      "基础 PnL 分析",
      "邮件通知",
      "7×24 工单支持",
    ],
  },
  {
    id: "pro",
    name: "专业版",
    tagline: "全职交易者的主力配置",
    priceMonthly: 79,
    priceYearly: 790,
    popular: true,
    limits: { copySlots: 8, apiKeys: 4, strategies: 5, signals: "秒级同步" },
    features: [
      "8 个跟单席位",
      "4 个交易所 API 绑定",
      "5 个量化策略",
      "秒级信号同步",
      "高级 PnL 与归因分析",
      "自定义止盈止损 / 风控引擎",
      "信号推送 + 微信提醒",
      "优先客服通道",
    ],
  },
  {
    id: "elite",
    name: "旗舰版",
    tagline: "多账户、多策略的资金管理者",
    priceMonthly: 199,
    priceYearly: 1990,
    popular: false,
    limits: { copySlots: -1, apiKeys: -1, strategies: -1, signals: "专线直连" },
    features: [
      "不限跟单席位",
      "不限交易所 API 绑定",
      "不限量化策略",
      "专线直连，最低延迟",
      "跨交易所统一资产视图",
      "子账户与团队权限",
      "开放 API 与 Webhook",
      "1v1 专属顾问",
    ],
  },
];

const TRADER_SEEDS: Array<Partial<Trader> & { name: string; tagline: string }> = [
  { name: "TrendMaster", tagline: "趋势跟踪 · 中长线波段", risk: "medium", style: "趋势", roi30d: 18.42, roi90d: 52.18, roiTotal: 386.5, winRate: 63.2, maxDrawdown: 12.4, followers: 4821, aum: 12400000, sharpe: 2.31, trades: 1284, avgHold: "2天 4小时", tags: ["趋势", "BTC", "ETH"] },
  { name: "GridKing", tagline: "网格套利 · 低回撤稳健", risk: "low", style: "网格", roi30d: 9.16, roi90d: 27.43, roiTotal: 163.2, winRate: 78.5, maxDrawdown: 5.1, followers: 9306, aum: 28600000, sharpe: 3.12, trades: 15230, avgHold: "4小时", tags: ["网格", "低回撤"] },
  { name: "AlphaQuant", tagline: "多因子量化 · 全时区对冲", risk: "medium", style: "量化", roi30d: 24.71, roi90d: 68.9, roiTotal: 512.7, winRate: 58.9, maxDrawdown: 16.8, followers: 2145, aum: 8200000, sharpe: 1.98, trades: 4201, avgHold: "11小时", tags: ["量化", "对冲"] },
  { name: "ScalpPro", tagline: "高频剥头皮 · 快进快出", risk: "high", style: "高频", roi30d: 41.28, roi90d: 96.4, roiTotal: 728.3, winRate: 71.4, maxDrawdown: 22.7, followers: 1562, aum: 3900000, sharpe: 1.64, trades: 28940, avgHold: "18分钟", tags: ["高频", "短线"] },
  { name: "SafeHarbor", tagline: "稳健套利 · 机构级风控", risk: "low", style: "套利", roi30d: 6.83, roi90d: 19.22, roiTotal: 98.6, winRate: 82.1, maxDrawdown: 3.2, followers: 12408, aum: 41300000, sharpe: 3.86, trades: 8930, avgHold: "6小时", tags: ["套利", "稳健"] },
  { name: "MomentumX", tagline: "动量突破 · 强势币捕捉", risk: "high", style: "动量", roi30d: 33.55, roi90d: 74.16, roiTotal: 421.9, winRate: 54.6, maxDrawdown: 28.3, followers: 3387, aum: 6700000, sharpe: 1.42, trades: 2145, avgHold: "1天 2小时", tags: ["动量", "突破"] },
  { name: "MeanRevert", tagline: "均值回归 · 震荡市专家", risk: "medium", style: "回归", roi30d: 12.94, roi90d: 35.71, roiTotal: 214.8, winRate: 69.3, maxDrawdown: 9.6, followers: 5721, aum: 9800000, sharpe: 2.05, trades: 6712, avgHold: "9小时", tags: ["均值回归", "震荡"] },
  { name: "WhaleFollow", tagline: "鲸鱼跟随 · 大额资金追踪", risk: "medium", style: "跟鲸", roi30d: 21.06, roi90d: 58.34, roiTotal: 302.4, winRate: 61.8, maxDrawdown: 14.9, followers: 7245, aum: 19300000, sharpe: 1.87, trades: 1836, avgHold: "1天 16小时", tags: ["鲸鱼", "链上"] },
];

const STRATEGY_SEEDS: Array<Partial<Strategy> & { name: string; desc: string }> = [
  { name: "双均线趋势跟踪", type: "趋势", desc: "EMA12/EMA26 金叉死叉驱动，ATR 动态仓位，趋势行情捕捉主升浪。", roi30d: 16.8, winRate: 58.4, maxDrawdown: 11.2, minCapital: 500, risk: "medium", followers: 3120, sharpe: 1.92, running: true },
  { name: "BTC 网格套利", type: "网格", desc: "等比网格 40 层，区间自动迁移，震荡行情持续吃价差。", roi30d: 8.4, winRate: 76.2, maxDrawdown: 4.8, minCapital: 1000, risk: "low", followers: 8214, sharpe: 3.05, running: true },
  { name: "资金费率对冲", type: "套利", desc: "现货多头 + 永续空头，吃资金费率，市场中性低波动。", roi30d: 5.9, winRate: 88.1, maxDrawdown: 2.1, minCapital: 2000, risk: "low", followers: 5412, sharpe: 4.12, running: false },
  { name: "动量突破狙击", type: "动量", desc: "布林带突破 + 成交量放大双重确认，追强势币种主升段。", roi30d: 29.3, winRate: 49.7, maxDrawdown: 24.6, minCapital: 300, risk: "high", followers: 2287, sharpe: 1.31, running: true },
  { name: "RSI 均值回归", type: "回归", desc: "RSI 超买超卖 + 布林中轨回归，震荡区间高胜率。", roi30d: 11.7, winRate: 71.5, maxDrawdown: 8.9, minCapital: 500, risk: "medium", followers: 4306, sharpe: 2.18, running: false },
  { name: "跨期基差套利", type: "套利", desc: "当季/次季合约基差偏离时双边建仓，到期收敛平仓。", roi30d: 7.2, winRate: 84.6, maxDrawdown: 3.4, minCapital: 5000, risk: "low", followers: 1893, sharpe: 3.44, running: false },
  { name: "波动率突破", type: "波动", desc: "ATR 通道突破 + 波动率过滤，避免低波动假信号。", roi30d: 19.5, winRate: 55.2, maxDrawdown: 15.7, minCapital: 800, risk: "medium", followers: 2741, sharpe: 1.66, running: true },
  { name: "多因子选币轮动", type: "量化", desc: "动量/波动/流动性三因子打分，每周轮动持仓 Top5。", roi30d: 22.8, winRate: 60.9, maxDrawdown: 17.4, minCapital: 1500, risk: "medium", followers: 3612, sharpe: 1.79, running: true },
];

const NOTIF_SEEDS: Array<Pick<Notification, "type" | "title" | "body"> & { minsAgo: number }> = [
  { type: "signal", title: "新信号已执行", body: "TrendMaster 在 ETHUSDT 开多，杠杆 5x，已同步到你的 Binance 账户。", minsAgo: 2 },
  { type: "risk", title: "风险提醒", body: "MomentumX 当前回撤达 18.2%，接近你设置的 20% 预警线。", minsAgo: 26 },
  { type: "system", title: "API 连接正常", body: "OKX API Key 已完成心跳检测，延迟 42ms。", minsAgo: 90 },
  { type: "billing", title: "订阅续费成功", body: "专业版（年付）已续费至 2027-09-15，支付 790 USDT。", minsAgo: 60 * 20 },
  { type: "signal", title: "仓位已减半", body: "ScalpPro 在 SOLUSDT 减仓 50%，已跟随执行。", minsAgo: 60 * 26 },
  { type: "system", title: "新版本上线", body: "v2.8.0：新增跨交易所统一资产视图与归因分析。", minsAgo: 60 * 50 },
];

function makeCurve(seed: number, len: number, drift: number, vol: number): number[] {
  const rnd = seededRandom(seed);
  let v = 100;
  const out: number[] = [];
  for (let i = 0; i < len; i++) {
    v = v * (1 + drift + (rnd() - 0.5) * vol);
    out.push(Number(v.toFixed(2)));
  }
  return out;
}

export async function seedIfNeeded(): Promise<void> {
  const { isSeeded } = await import("./db");
  if (await isSeeded()) return;

  // 边缘 KV 每一次写入都是一次网络往返，因此先在本地收集，最后一次落盘
  const buffer: Record<string, any[]> = {};
  const push = (name: string, rec: any) => {
    (buffer[name] = buffer[name] || []).push(rec);
  };

  // ---- traders ----
  TRADER_SEEDS.forEach((t, i) => {
    const curve = makeCurve(1000 + i * 37, 60, t.roi30d! / 100 / 60, 0.035);
    push("traders", {
      id: `tr_${i + 1}`,
      name: t.name,
      tagline: t.tagline,
      avatarHue: (i * 47) % 360,
      roi30d: t.roi30d!,
      roi90d: t.roi90d!,
      roiTotal: t.roiTotal!,
      winRate: t.winRate!,
      maxDrawdown: t.maxDrawdown!,
      followers: t.followers!,
      aum: t.aum!,
      risk: t.risk as Trader["risk"],
      style: t.style!,
      sharpe: t.sharpe!,
      trades: t.trades!,
      avgHold: t.avgHold!,
      verified: t.followers! > 3000,
      curve,
      tags: t.tags!,
    });
  });

  // ---- strategies ----
  STRATEGY_SEEDS.forEach((s, i) => {
    push("strategies", {
      id: `st_${i + 1}`,
      name: s.name,
      type: s.type!,
      desc: s.desc,
      roi30d: s.roi30d!,
      winRate: s.winRate!,
      maxDrawdown: s.maxDrawdown!,
      minCapital: s.minCapital!,
      risk: s.risk as Strategy["risk"],
      followers: s.followers!,
      sharpe: s.sharpe!,
      running: s.running!,
      curve: makeCurve(5000 + i * 91, 48, s.roi30d! / 100 / 48, 0.028),
    });
  });

  // ---- demo user ----
  const now = Date.now();
  const demo: User = {
    id: "u_demo",
    email: "demo@coince.io",
    nickname: "Demo Trader",
    verified: true,
    planId: "pro",
    planExpiresAt: now + 1000 * 60 * 60 * 24 * 292,
    balance: 12380.12,
    referralCode: "COINCE-8F2K",
    createdAt: now - 1000 * 60 * 60 * 24 * 128,
    avatarHue: 96,
    riskProfile: "均衡",
  };
  push("users", demo);

  // ---- strategy subscriptions ----
  [
    { strategyId: "st_1", capital: 2000, running: true },
    { strategyId: "st_2", capital: 3000, running: true },
    { strategyId: "st_4", capital: 1000, running: false },
  ].forEach((s, i) => {
    push("strategySubs", {
      id: uid("ss"),
      userId: demo.id,
      strategyId: s.strategyId,
      capital: s.capital,
      running: s.running,
      pnl: [182.4, 96.2, -41.8][i],
      createdAt: now - 1000 * 60 * 60 * 24 * (38 - i * 6),
    });
  });

  // ---- api keys ----
  const apiSeeds: Array<[string, string, string, ApiKey["status"]]> = [
    ["binance", "主账户 · 合约", "ABC***8fK2", "active"],
    ["okx", "跟单专用", "OKX***41dQ", "active"],
    ["bybit", "备用账户", "BYB***x91P", "paused"],
  ];
  apiSeeds.forEach(([ex, label, masked, status], i) => {
    push("apiKeys", {
      id: uid("ak"),
      userId: demo.id,
      exchange: ex,
      label,
      masked,
      permissions: ["读取", "交易"],
      status,
      createdAt: now - 1000 * 60 * 60 * 24 * (30 - i * 7),
      lastSyncAt: now - 1000 * 60 * (i + 1) * 3,
      ipWhitelist: "43.135.18.22 / 129.204.66.19",
    });
  });

  // ---- copy relations ----
  const copySeeds: Array<[string, number, "fixed" | "ratio", number, number, CopyRelation["status"], number]> = [
    ["tr_1", 4000, "fixed", 3, 15, "running", 842.31],
    ["tr_2", 3000, "ratio", 1, 10, "running", 318.62],
    ["tr_4", 1500, "fixed", 5, 20, "paused", -126.4],
    ["tr_6", 2000, "fixed", 2, 25, "running", 512.08],
  ];
  copySeeds.forEach(([traderId, capital, mode, leverage, sl, status, pnl], i) => {
    push("copyRelations", {
      id: uid("cr"),
      userId: demo.id,
      traderId,
      capital,
      mode,
      ratio: mode === "ratio" ? 20 : 0,
      leverage,
      stopLossPct: sl,
      takeProfitPct: sl * 2.5,
      status,
      pnl,
      pnlPct: Number(((pnl / capital) * 100).toFixed(2)),
      createdAt: now - 1000 * 60 * 60 * 24 * (46 - i * 9),
      copiedTrades: 120 + i * 37,
    });
  });

  // ---- trades ----
  const tradeSeedData: Array<[string, "LONG" | "SHORT", number, number, number, number, "open" | "closed", string, string, number]> = [
    ["BTC/USDT", "LONG", 67210.4, 68420.5, 0.12, 5, "open", "TrendMaster", "binance", 0],
    ["ETH/USDT", "LONG", 3412.8, 3542.18, 1.8, 3, "open", "TrendMaster", "binance", 0],
    ["SOL/USDT", "SHORT", 172.4, 168.42, 24, 5, "open", "ScalpPro", "okx", 0],
    ["BTC/USDT", "LONG", 64980.2, 67120.8, 0.25, 5, "closed", "SafeHarbor", "binance", 535.15],
    ["TON/USDT", "LONG", 6.842, 7.214, 320, 2, "closed", "MomentumX", "okx", 119.04],
    ["DOGE/USDT", "SHORT", 0.1462, 0.1385, 12000, 3, "closed", "MeanRevert", "binance", 277.2],
    ["XRP/USDT", "LONG", 0.6012, 0.6218, 8000, 4, "closed", "AlphaQuant", "bybit", 65.92],
    ["ADA/USDT", "LONG", 0.4382, 0.4301, 9000, 3, "closed", "WhaleFollow", "binance", -21.87],
    ["ETH/USDT", "SHORT", 3602.1, 3542.18, 2.2, 5, "open", "ScalpPro", "okx", 0],
    ["BNB/USDT", "LONG", 578.4, 592.7, 6, 2, "closed", "GridKing", "binance", 85.8],
  ];
  tradeSeedData.forEach(([symbol, side, entry, exitp, qty, lev, status, traderName, exchange, pnl], i) => {
    push("trades", {
      id: uid("td"),
      userId: demo.id,
      ts: now - 1000 * 60 * (12 + i * 47),
      symbol,
      side,
      entry,
      exit: status === "closed" ? exitp : null,
      qty,
      leverage: lev,
      pnl,
      status,
      traderName,
      exchange,
    });
  });

  // ---- signals ----
  const signalSeed: Array<[string, string, "LONG" | "SHORT", "OPEN" | "CLOSE" | "ADD" | "REDUCE", number, number, Signal["status"], number]> = [
    ["tr_1", "ETH/USDT", "LONG", "OPEN", 3542.18, 5, "filled", 1],
    ["tr_4", "SOL/USDT", "SHORT", "REDUCE", 168.42, 5, "filled", 4],
    ["tr_2", "BTC/USDT", "LONG", "ADD", 68401.2, 1, "filled", 9],
    ["tr_6", "TON/USDT", "LONG", "OPEN", 7.214, 2, "pending", 12],
    ["tr_8", "BTC/USDT", "LONG", "OPEN", 68310.5, 3, "filled", 18],
    ["tr_5", "XRP/USDT", "LONG", "CLOSE", 0.6218, 4, "closed", 31],
    ["tr_3", "DOGE/USDT", "SHORT", "OPEN", 0.1385, 3, "filled", 44],
    ["tr_7", "BNB/USDT", "LONG", "CLOSE", 592.7, 2, "closed", 58],
  ];
  signalSeed.forEach(([traderId, symbol, side, action, price, lev, status, mins], i) => {
    push("signals", {
      id: uid("sg"),
      ts: now - 1000 * 60 * mins,
      traderId,
      traderName: TRADER_SEEDS[Number(traderId.split("_")[1]) - 1]?.name ?? "System",
      symbol,
      side,
      action,
      price,
      leverage: lev,
      status,
    });
  });

  // ---- invoices ----
  push("invoices", {
    id: uid("in"),
    userId: demo.id,
    planId: "pro",
    amount: 790,
    cycle: "yearly",
    status: "paid",
    createdAt: now - 1000 * 60 * 60 * 24 * 73,
    method: "USDT (TRC20)",
  });
  push("invoices", {
    id: uid("in"),
    userId: demo.id,
    planId: "pro",
    amount: 79,
    cycle: "monthly",
    status: "paid",
    createdAt: now - 1000 * 60 * 60 * 24 * 165,
    method: "USDT (TRC20)",
  });

  // ---- notifications ----
  NOTIF_SEEDS.forEach((n) => {
    push("notifications", {
      id: uid("nt"),
      userId: demo.id,
      type: n.type,
      title: n.title,
      body: n.body,
      read: n.minsAgo > 600,
      ts: now - 1000 * 60 * n.minsAgo,
    });
  });

  // 一次性写入后端（本地为 .data/db.json，Cloudflare 为 Workers KV）
  const db = await readDB();
  for (const [k, v] of Object.entries(buffer)) db[k] = v;
  db.meta = [...(db.meta || []), { key: "seeded", version: 2, at: Date.now() }];
  await writeDB(db);
}

export function getPlans(): Plan[] {
  return PLANS;
}

export async function getTraders(): Promise<Trader[]> {
  return all<Trader>("traders");
}

export async function getStrategies(): Promise<Strategy[]> {
  return all<Strategy>("strategies");
}

export async function getDemoUser(): Promise<User> {
  const rows = await all<User>("users");
  const u = rows.find((x) => x.id === "u_demo");
  if (u) return u;
  await seedIfNeeded();
  return (await all<User>("users")).find((x) => x.id === "u_demo")!;
}

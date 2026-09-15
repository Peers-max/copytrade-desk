import { all } from "./db";
import type { Plan, Strategy, Trader } from "./types";

/**
 * 静态配置 + 数据引导。
 *
 * ⚠️ 这个文件**不再播种任何模拟数据**。
 * 早期版本会在首次请求时灌入 8 个假交易员、20 笔假跟单、50+ 条假信号，
 * 那是为了演示 UI；上线实盘后这些全部清除，跟单列表里只会出现
 * 真实存在的信号源，收益/胜率/跟单人数一律由真实成交记录统计得出。
 */

export const EXCHANGES = [
  { id: "binance", name: "Binance", cn: "币安", tradable: true },
  { id: "okx", name: "OKX", cn: "欧易", tradable: true },
  { id: "bybit", name: "Bybit", cn: "Bybit", tradable: false },
  { id: "bitget", name: "Bitget", cn: "Bitget", tradable: false },
  { id: "gate", name: "Gate", cn: "Gate.io", tradable: false },
  { id: "htx", name: "HTX", cn: "火币 HTX", tradable: false },
  { id: "bitmart", name: "BitMart", cn: "BitMart", tradable: false },
  { id: "hotcoin", name: "Hotcoin", cn: "热币", tradable: false },
];

export const SYMBOLS = [
  { symbol: "BTC/USDT", base: "BTC" },
  { symbol: "ETH/USDT", base: "ETH" },
  { symbol: "SOL/USDT", base: "SOL" },
  { symbol: "BNB/USDT", base: "BNB" },
  { symbol: "XRP/USDT", base: "XRP" },
  { symbol: "DOGE/USDT", base: "DOGE" },
  { symbol: "ADA/USDT", base: "ADA" },
  { symbol: "TON/USDT", base: "TON" },
  { symbol: "AVAX/USDT", base: "AVAX" },
  { symbol: "LINK/USDT", base: "LINK" },
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

/* ------------------------------------------------------------------ */
/* 数据引导：只保证集合存在，不产生任何业务数据                          */
/* ------------------------------------------------------------------ */

const COLLECTIONS = [
  "users",
  "sessions",
  "apiKeys",
  "traders",
  "strategies",
  "strategySubs",
  "copyRelations",
  "trades",
  "signals",
  "invoices",
  "notifications",
  "emailCodes",
  "meta",
  "settings",
];

/** 幂等：确保所有集合存在，并清掉历史遗留的「已播种」标记。 */
export async function bootstrapIfNeeded(): Promise<void> {
  const { readDB, writeDB } = await import("./store");
  const d = await readDB();
  let dirty = false;

  for (const c of COLLECTIONS) {
    if (!Array.isArray(d[c])) {
      d[c] = [];
      dirty = true;
    }
  }

  // 老版本用 meta.seeded 做标记；实盘模式不再需要，顺手清掉
  if (Array.isArray(d.meta) && d.meta.some((m: any) => m?.key === "seeded")) {
    d.meta = d.meta.filter((m: any) => m?.key !== "seeded");
    dirty = true;
  }

  if (dirty) await writeDB(d);
}

/** @deprecated 旧调用点保留的别名，语义已变为「引导」而非「播种」。 */
export const seedIfNeeded = bootstrapIfNeeded;

export function getPlans(): Plan[] {
  return PLANS;
}

export async function getTraders(): Promise<Trader[]> {
  const rows = await all<Trader>("traders");
  return rows.sort((a, b) => (b.lastSignalAt ?? b.createdAt ?? 0) - (a.lastSignalAt ?? a.createdAt ?? 0));
}

/** 只返回正在运行的信号源 —— 跟单列表只该看到这些。 */
export async function getLiveTraders(): Promise<Trader[]> {
  return (await getTraders()).filter((t) => t.status === "live");
}

export async function getStrategies(): Promise<Strategy[]> {
  return all<Strategy>("strategies");
}

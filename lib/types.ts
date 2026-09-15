/* ==================================================================
 * 领域模型
 *
 * 分为两类：
 *   - 平台侧（配置）：Plan / Trader（信号源）
 *   - 用户侧（真实数据）：User / ApiKey / CopyRelation / Trade / Signal / Invoice / Notification
 *
 * 上线为实盘后，所有「收益 / 胜率 / 跟单人数 / AUM」都由真实记录统计得出，
 * 不再有硬编码的演示数值。
 * ================================================================== */

export type User = {
  id: string;
  email: string;
  nickname: string;
  verified: boolean;
  planId: string;
  planExpiresAt: number;
  balance: number;
  referralCode: string;
  referredBy?: string;
  createdAt: number;
  avatarHue: number;
  riskProfile: string;
  /** 站主账号：可管理信号源、运行量化引擎、清理数据 */
  role?: "admin" | "user";
};

export type ExchangeId = "binance" | "okx" | "bybit" | "bitget" | "gate" | "htx";

export type ApiKey = {
  id: string;
  userId: string;
  exchange: ExchangeId | string;
  label: string;
  /** 仅用于展示，如 ABC***8fK2 */
  masked: string;
  permissions: string[];
  status: "active" | "paused" | "invalid";
  createdAt: number;
  lastSyncAt: number;
  ipWhitelist: string;

  /* ---- 实盘字段 ---- */
  /** AES-256-GCM 密文，密钥来自 Worker secret COINCE_SECRET_KEY */
  apiKeyCipher?: string;
  secretCipher?: string;
  passphraseCipher?: string;
  /** 交易所账户 UID（校验时由交易所返回） */
  uid?: string;
  /** 账户模式，如「单向持仓 · 全仓」 */
  accountMode?: string;
  /** 最近一次校验得到的账户权益（USDT） */
  equityUsdt?: number;
  availableUsdt?: number;
  positionCount?: number;
  /** 最近一次下单/校验失败原因 */
  lastError?: string;
  verifiedAt?: number;
  /** 交易所明确返回含提现权限时为 true —— 这类 Key 拒绝用于跟单 */
  hasWithdraw?: boolean;
};

/* ------------------------------------------------------------------ */
/* 信号源（跟单列表里的「交易员」）                                     */
/* ------------------------------------------------------------------ */

/** 信号来源：内置量化引擎 / 外部 Webhook / 后台手动发布 */
export type SignalSource = "quant" | "webhook" | "manual";

/** 内置量化策略类型 */
export type QuantKind = "ema_cross" | "rsi_revert" | "breakout" | "grid";

export type QuantConfig = {
  kind: QuantKind;
  /** K 线周期：1m / 5m / 15m / 1h / 4h / 1d */
  interval: string;
  params: Record<string, number>;
};

export type Trader = {
  id: string;
  name: string;
  tagline: string;
  avatarHue: number;

  /* ---- 统计（由真实记录统计得出，未产生信号时为 0） ---- */
  roi30d: number;
  roi90d: number;
  roiTotal: number;
  winRate: number;
  maxDrawdown: number;
  followers: number;
  aum: number;
  sharpe: number;
  /** 已产生信号数 */
  trades: number;
  avgHold: string;
  verified: boolean;
  curve: number[];
  tags: string[];

  /* ---- 实盘字段 ---- */
  source: SignalSource;
  status: "live" | "paused";
  risk: "low" | "medium" | "high";
  style: string;
  /** 该信号源覆盖的交易对，如 ["BTC/USDT","ETH/USDT"] */
  symbols: string[];
  /** webhook 类信号源的接入令牌 */
  webhookToken?: string;
  quant?: QuantConfig;
  /** 一句话说明这个信号源的真实出处，例如「镜像自 X 带单员，人工录入」 */
  note?: string;
  createdBy?: string;
  createdAt?: number;
  lastSignalAt?: number;
  /** 已产生信号条数 */
  signalCount?: number;
  /** 量化引擎的上一轮判定状态，用于避免重复触发（如上次 EMA 快慢线关系） */
  engineState?: Record<string, any>;
};

export type Strategy = {
  id: string;
  name: string;
  type: string;
  desc: string;
  roi30d: number;
  winRate: number;
  maxDrawdown: number;
  minCapital: number;
  risk: "low" | "medium" | "high";
  followers: number;
  sharpe: number;
  running: boolean;
  curve: number[];
};

export type CopyRelation = {
  id: string;
  userId: string;
  traderId: string;
  /** 分配的保证金（USDT） */
  capital: number;
  mode: "fixed" | "ratio";
  /** 按比例跟单时的比例（%） */
  ratio: number;
  leverage: number;
  stopLossPct: number;
  takeProfitPct: number;
  status: "running" | "paused" | "stopped";
  pnl: number;
  pnlPct: number;
  createdAt: number;
  copiedTrades: number;

  /* ---- 实盘字段 ---- */
  /** 指定用哪个 API Key 执行；为空则自动挑选该用户第一个 active 的 Key */
  apiKeyId?: string;
  /** 已同步的名义成交额累计 */
  notionalTotal?: number;
  failedTrades?: number;
  lastError?: string;
  lastSyncAt?: number;
};

export type Signal = {
  id: string;
  ts: number;
  traderId: string;
  traderName: string;
  symbol: string;
  side: "LONG" | "SHORT";
  action: "OPEN" | "CLOSE" | "ADD" | "REDUCE";
  price: number;
  leverage: number;
  status: "pending" | "filled" | "closed" | "failed";

  /* ---- 实盘字段 ---- */
  source?: SignalSource;
  note?: string;
  /** 广播结果 */
  dispatched?: number;
  succeeded?: number;
  failed?: number;
  results?: Array<{
    relationId: string;
    userId: string;
    exchange: string;
    ok: boolean;
    orderId?: string;
    qty?: number;
    error?: string;
  }>;
};

export type Trade = {
  id: string;
  userId: string;
  ts: number;
  symbol: string;
  side: "LONG" | "SHORT";
  entry: number;
  exit: number | null;
  qty: number;
  leverage: number;
  pnl: number;
  status: "open" | "closed" | "failed";
  traderName: string;
  exchange: string;

  /* ---- 实盘字段 ---- */
  orderId?: string;
  traderId?: string;
  relationId?: string;
  signalId?: string;
  /** 名义价值（USDT） */
  notional?: number;
  fees?: number;
  /** 交易所原生条件单 ID（止损 / 止盈） */
  slOrderId?: string;
  tpOrderId?: string;
  lastError?: string;
};

export type Plan = {
  id: string;
  name: string;
  tagline: string;
  priceMonthly: number;
  priceYearly: number;
  popular: boolean;
  limits: { copySlots: number; apiKeys: number; strategies: number; signals: string };
  features: string[];
};

export type Invoice = {
  id: string;
  userId: string;
  planId: string;
  amount: number;
  cycle: "monthly" | "yearly";
  status: "paid" | "pending" | "refunded";
  createdAt: number;
  method: string;
};

export type Notification = {
  id: string;
  userId: string;
  type: "signal" | "risk" | "system" | "billing" | "trade";
  title: string;
  body: string;
  read: boolean;
  ts: number;
};

export type Ticker = {
  symbol: string;
  base: string;
  price: number;
  change: number;
  changePct: number;
  high24h: number;
  low24h: number;
  volume24h: number;
  spark: number[];
};

/** 全局运行模式 */
export type Mode = "live" | "demo";

export type CacheEntry<T = any> = { at: number; data: T };

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

/** 信号来源：内置量化引擎 / 外部 Webhook / 后台手动发布 / OKX 官方带单员 */
export type SignalSource = "quant" | "webhook" | "manual" | "okx";

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
  /** 真实头像 URL（OKX 带单员会有 portLink） */
  avatarUrl?: string;

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
  /** OKX 带单员快照（source === "okx" 时存在） */
  okx?: OkxLeadMeta;
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

/* ------------------------------------------------------------------ */
/* OKX 官方跟单                                                        */
/* ------------------------------------------------------------------ */

/**
 * OKX 跟单品类。
 *
 * ⚠️ 实测（2026-09）发现的关键事实：**同一 uniqueCode 在两个品类下是两个不同的带单产品**。
 * 全量抓取 253 个 SWAP 带单员与 159 个 SPOT 带单员，其中 **99 个 uniqueCode 重叠**，
 * 但重叠者的 AUM、收益、品种、跟单人数**全部不同**
 * （例：Kunpeng Plan 在 SWAP 侧 aum=40,798 / pnl=+852,646，在 SPOT 侧 aum=2,734,380 / pnl=0）。
 *
 * 所以本地唯一键必须是 `instType + ":" + uniqueCode`，
 * 只按 uniqueCode 去重会让两个产品互相覆盖。
 *
 * 另：`MARGIN` / `FUTURES` / `OPTION` 传给 OKX 一律 400，只有这两个品类有效。
 */
export type OkxInstType = "SWAP" | "SPOT";

/**
 * OKX 带单员快照。
 *
 * 全部来自 OKX 公开接口 /api/v5/copytrading/public-lead-traders，无需鉴权。
 *
 * ⚠️ 单位口径（实测确认，不是猜测）：
 *   - `pnlRatio` 是**累计收益率的小数表示**：0.4994 → +49.94%，8.9711 → +897.11%。
 *     历史曲线 `pnlRatios[].pnlRatio` 同一单位，起点接近 0 且可为负。
 *   - `winRatio` 同样是小数：0.6429 → 64.29%。
 *   - `leadDays` 是整数天数。
 *   - 注意 OKX 的 pnlRatio **不等于** pnl / aum（实测 RuiJie: pnl/aum=46.4 而 pnlRatio=0.29），
 *     不要试图自己换算，直接用接口给的值。
 */
export type OkxLeadMeta = {
  uniqueCode: string;
  /** 该带单产品所属品类。与 uniqueCode 共同构成唯一键，见 OkxInstType 的说明。 */
  instType: OkxInstType;
  nickName: string;
  /** 累计收益率（小数），转百分比请 ×100 */
  pnlRatio?: string;
  /** 累计盈亏（USDT） */
  pnl?: string;
  /** 当前管理资金（USDT） */
  aum?: string;
  /** 胜率（小数），转百分比请 ×100 */
  winRatio?: string;
  /** 带单天数 */
  leadDays?: string;
  /** 当前跟单人数 */
  copyTraderNum?: string;
  /** 累计跟单人数 */
  accCopyTraderNum?: string;
  /** 可跟单人数上限 */
  maxCopyTraderNum?: string;
  /** 头像 URL */
  portLink?: string;
  /** 带单员的交易品种（instId 形式，如 BTC-USDT-SWAP） */
  traderInsts?: string[];
  /** 收益率历史曲线（小数数组），已按时间正序整理 */
  curve?: number[];
  /**
   * 该带单员是否隐藏了当前持仓。
   * 隐藏时 public-current-subpositions 返回的 instId 为空字符串 ——
   * 此时**无法自建镜像**，只能走 OKX 原生跟单。
   */
  hidesPositions?: boolean;
  /** 本地最近一次同步时间 */
  syncedAt: number;
};

/**
 * OKX 原生跟单参数。
 *
 * 字段名严格对齐 OKX `CopySettingsRequest`（first-copy-settings / amend-copy-settings 共用）：
 *
 *   uniqueCode          带单员唯一码
 *   instType            'SWAP' 合约跟单 | 'SPOT' 现货跟单
 *                          必须与带单员所属品类一致，否则 OKX 会拒绝
 *   copyMgnMode         'cross' 全仓 | 'isolated' 逐仓 | 'copy' 跟随带单员
 *   copyInstIdType      'copy' 跟随带单员品种 | 'custom' 指定品种
 *   copyMode            'fixed_amount' 固定金额 | 'ratio_copy' 按比例
 *                          ⚠️ 是 ratio_copy，不是 ratio
 *   copyTotalAmt        跟单总额（必填）
 *   copyAmt             copyMode=fixed_amount 时的单笔金额
 *   copyRatio           copyMode=ratio_copy 时的比例
 *   tpRatio / slRatio   止盈 / 止损比例
 *   subPosCloseType     停止跟单时的平仓方式
 *                          'market_close' 市价平 | 'copy_close' 跟随带单员平 | 'manual_close' 手动平
 */
export type OkxCopyParams = {
  uniqueCode: string;
  instType: OkxInstType;
  copyMgnMode: "cross" | "isolated" | "copy";
  copyInstIdType: "custom" | "copy";
  copyMode: "fixed_amount" | "ratio_copy";
  copyTotalAmt: number;
  copyAmt?: number;
  copyRatio?: number;
  tpRatio?: number;
  slRatio?: number;
  subPosCloseType: "market_close" | "copy_close" | "manual_close";
  startedAt: number;
};

/** OKX 跟单平台限额（来自 public-config，用于前端校验） */
export type OkxCopyLimits = {
  minCopyAmt: number;
  maxCopyAmt: number;
  maxCopyRatio: number;
  maxCopyTotalAmt: number;
  maxSlRatio: number;
  maxTpRatio: number;
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

  /**
   * 执行引擎：
   *   "local"（默认）= 本站自建链路 —— 收到信号后用自己的适配器在交易所下单
   *   "okx"          = OKX 原生跟单 —— 由 OKX 引擎实时同步带单员的开平仓
   *
   * 两者互不影响：本地信号源（quant/webhook/manual）走 local，
   * OKX 带单员走 okx。okx 模式下 capital/leverage 等本地字段不参与执行。
   */
  engine?: "local" | "okx";
  /** OKX 原生跟单参数（engine === "okx" 时必填，用于 amend / stop） */
  okx?: OkxCopyParams;
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

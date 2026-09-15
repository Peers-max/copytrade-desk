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
};

export type ApiKey = {
  id: string;
  userId: string;
  exchange: string;
  label: string;
  masked: string;
  permissions: string[];
  status: "active" | "paused" | "invalid";
  createdAt: number;
  lastSyncAt: number;
  ipWhitelist: string;
};

export type Trader = {
  id: string;
  name: string;
  tagline: string;
  avatarHue: number;
  roi30d: number;
  roi90d: number;
  roiTotal: number;
  winRate: number;
  maxDrawdown: number;
  followers: number;
  aum: number;
  risk: "low" | "medium" | "high";
  style: string;
  sharpe: number;
  trades: number;
  avgHold: string;
  verified: boolean;
  curve: number[];
  tags: string[];
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
  capital: number;
  mode: "fixed" | "ratio";
  ratio: number;
  leverage: number;
  stopLossPct: number;
  takeProfitPct: number;
  status: "running" | "paused" | "stopped";
  pnl: number;
  pnlPct: number;
  createdAt: number;
  copiedTrades: number;
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
  status: "pending" | "filled" | "closed";
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
  status: "open" | "closed";
  traderName: string;
  exchange: string;
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
  type: "signal" | "risk" | "system" | "billing";
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

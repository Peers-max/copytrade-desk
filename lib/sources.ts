import "server-only";

import { all, find, insert, remove, update } from "./db";
import { randomToken } from "./crypto";
import type { QuantConfig, SignalSource, Trader } from "./types";

/**
 * 信号源（跟单列表里的「交易员」）的增删改查。
 *
 * 复刻源站的定位：交易员由平台侧提供 —— 要么是内置量化引擎，要么是外部
 * 信号接入（Webhook），要么由站主手动发布。这里不提供「用户自由入驻」，
 * 因为那需要一整套资质审核与业绩审计，不是这个自用系统该承担的东西。
 */

export type CreateSourceInput = {
  name: string;
  tagline?: string;
  source: SignalSource;
  risk?: "low" | "medium" | "high";
  symbols: string[];
  quant?: QuantConfig;
  note?: string;
  style?: string;
};

const RISK_STYLE: Record<string, string> = {
  low: "稳健",
  medium: "均衡",
  high: "激进",
};

export async function createSource(userId: string, input: CreateSourceInput): Promise<Trader> {
  const now = Date.now();
  const id = `tr_${now.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const risk = input.risk ?? "medium";
  const source = input.source;

  const trader: Trader = {
    id,
    name: input.name.trim(),
    tagline: input.tagline?.trim() || defaultTagline(source, input.symbols),
    avatarHue: Math.floor(Math.random() * 360),

    // 统计字段从零开始 —— 有真实成交后由 recalcTraderStats 回填
    roi30d: 0,
    roi90d: 0,
    roiTotal: 0,
    winRate: 0,
    maxDrawdown: 0,
    followers: 0,
    aum: 0,
    sharpe: 0,
    trades: 0,
    avgHold: "—",
    verified: false,
    curve: [],
    tags: [riskLabel(risk), ...input.symbols.slice(0, 2).map((s) => s.split("/")[0])],

    source,
    status: "live",
    risk,
    style: input.style || RISK_STYLE[risk],
    symbols: input.symbols.length ? input.symbols : ["BTC/USDT"],
    webhookToken: source === "webhook" ? randomToken(18) : undefined,
    quant: source === "quant" ? input.quant : undefined,
    note: input.note,
    createdBy: userId,
    createdAt: now,
    signalCount: 0,
  } as Trader & { signalCount: number };

  await insert<Trader>("traders", trader);
  return trader;
}

function defaultTagline(source: SignalSource, symbols: string[]): string {
  const s = symbols.slice(0, 2).join(" / ") || "BTC/USDT";
  if (source === "quant") return `内置量化引擎 · ${s}`;
  if (source === "webhook") return `外部信号接入 · ${s}`;
  return `手动发布 · ${s}`;
}

function riskLabel(r: string): string {
  return r === "low" ? "低风险" : r === "high" ? "高风险" : "中风险";
}

export async function getSource(id: string): Promise<Trader | null> {
  return (await find<Trader>("traders", (t) => t.id === id)) ?? null;
}

export async function listSources(): Promise<Trader[]> {
  const rows = await all<Trader>("traders");
  return rows.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
}

export async function updateSource(id: string, patch: Partial<Trader>): Promise<void> {
  await update<Trader>("traders", (t) => t.id === id, patch);
}

export async function deleteSource(id: string): Promise<void> {
  await remove("traders", (t: any) => t.id === id);
}

export async function rotateWebhookToken(id: string): Promise<string> {
  const token = randomToken(18);
  await update<Trader>("traders", (t) => t.id === id, { webhookToken: token });
  return token;
}

export function webhookUrl(baseUrl: string, token: string): string {
  return `${baseUrl.replace(/\/$/, "")}/api/webhook/signal?token=${token}`;
}

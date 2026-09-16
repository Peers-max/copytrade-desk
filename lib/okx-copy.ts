import "server-only";

import { hmacSha256Base64 } from "./crypto";
import { timedFetch, type Credentials } from "./exchanges/base";
import type { OkxCopyLimits, OkxCopyParams, OkxLeadMeta, Trader } from "./types";

/**
 * OKX 官方跟单（Copy Trading）客户端。
 *
 * 分成两半，思路完全不同：
 *
 *   1. **公开接口**（无需任何鉴权，从 Cloudflare Workers 出网实测 200）
 *      - /public-lead-traders            带单员排行榜 → 跟单列表的「真实交易员名册」
 *      - /public-current-subpositions    带单员当前持仓（含品种/方向/杠杆/保证金）
 *      - /public-config                  平台跟单限额（前端校验用）
 *
 *   2. **私有接口**（需 API Key + Secret + Passphrase）
 *      - /first-copy-settings            开始跟单
 *      - /amend-copy-settings            修改跟单参数
 *      - /stop-copy-trading              停止跟单
 *      - /copy-settings                  查询跟单设置
 *      - /current-subpositions           自己的跟单持仓
 *      - /current-lead-traders           自己正在跟的带单员
 *
 * ⚠️ 单位口径（实测确认，勿自行换算）：
 *   pnlRatio / winRatio 都是**小数**，×100 才是百分比。
 *   OKX 的 pnlRatio **不等于** pnl / aum（实测 RuiJie: pnl/aum=46.4 而 pnlRatio=0.29）。
 *
 * ⚠️ 字段名以 OKX `CopySettingsRequest` 为准，很容易写错的两处：
 *   copyMode 取值是 `ratio_copy`（不是 ratio）
 *   copyMgnMode 可以是 `copy`（表示跟随带单员的保证金模式）
 */

const BASE = "https://www.okx.com";
export const COPY_INST_TYPE = "SWAP" as const;

/**
 * ⚠️ 实测踩坑（2026-09）：`public-lead-traders` 的 `limit` 上限是 **20**。
 * 传 21 就直接 400 Bad Request —— 跟 OKX 其它接口惯用的 100 完全不同。
 * 曾经把这里写成 100，导致「从 OKX 导入带单员」整条链路 502（空响应、无堆栈，极难排查）。
 * 夹紧放在客户端内部做，调用方随便传都不会把无效值发给 OKX。
 */
export const RANK_MAX_LIMIT = 20;

/** `public-current-subpositions` 允许到 100，与排行榜不同，别搞混。 */
export const SUBPOS_MAX_LIMIT = 100;

type OkxResp = { code: string; msg?: string; data?: any[] };

/**
 * OKX 报错时把 HTTP 状态码与响应正文片段一起带出来。
 * 只写「HTTP 400」等于没写 —— 排查时会误以为是权限问题而不是参数问题。
 */
function okxError(what: string, status: number, body: string): Error {
  const snip = String(body ?? "").replace(/\s+/g, " ").trim().slice(0, 240);
  return new Error(`${what}失败：OKX HTTP ${status}${snip ? ` · ${snip}` : ""}`);
}

/** 统一解析 OKX 响应：非 JSON（例如 Cloudflare/网关的 HTML 错误页）也要能给出可读信息。 */
async function readOkx(res: Response, what: string): Promise<OkxResp> {
  const text = await res.text().catch(() => "");
  let json: OkxResp | null = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  if (!json || json.code !== "0") {
    throw okxError(what, res.status, text);
  }
  return json;
}

/* ================================================================== */
/* 公开接口                                                            */
/* ================================================================== */

export type LeadRank = {
  uniqueCode: string;
  nickName: string;
  portLink?: string;
  /** 当前管理资金（USDT） */
  aum: number;
  /** 当前跟单人数 */
  copyTraderNum: number;
  accCopyTraderNum: number;
  maxCopyTraderNum: number;
  leadDays: number;
  /** 累计盈亏（USDT） */
  pnl: number;
  /** 累计收益率，小数 */
  roiRatio: number;
  /** 胜率，小数 */
  winRatio: number;
  /** 收益率曲线，小数数组，已按时间正序 */
  curve: number[];
  /** 带单员交易品种（instId 形式） */
  traderInsts: string[];
  ccy: string;
};

export type LeadPosition = {
  instId: string;
  posSide: "long" | "short";
  lever: number;
  margin: number;
  upl: number;
  uplRatio: number;
  mgnMode: string;
};

export type LeadRankQuery = {
  limit?: number;
  page?: number;
  sortType?: "overview" | "pnl" | "aum" | "win_ratio" | "pnl_ratio" | "current_copy_trader_pnl";
  state?: "0" | "1";
  /** OKX 的枚举选择器，不是天数：1=7天 2=30天 3=90天 4=180天 */
  minLeadDays?: "1" | "2" | "3" | "4";
  minAum?: string;
  maxAum?: string;
  dataVer?: string;
};

const RANK_SORT = new Set([
  "overview",
  "pnl",
  "aum",
  "win_ratio",
  "pnl_ratio",
  "current_copy_trader_pnl",
]);

function n(v: any, fallback = 0): number {
  const x = Number(v);
  return Number.isFinite(x) ? x : fallback;
}

function normalizeRank(r: any): LeadRank {
  // pnlRatios 是从最新往最早排的，反转成时间正序，直接当曲线用
  const raw = Array.isArray(r.pnlRatios) ? r.pnlRatios : [];
  const curve = raw
    .slice()
    .reverse()
    .map((p: any) => n(p?.pnlRatio, 0));

  return {
    uniqueCode: String(r.uniqueCode ?? ""),
    nickName: String(r.nickName ?? "未命名带单员"),
    portLink: r.portLink ? String(r.portLink) : undefined,
    aum: n(r.aum),
    copyTraderNum: n(r.copyTraderNum),
    accCopyTraderNum: n(r.accCopyTraderNum),
    maxCopyTraderNum: n(r.maxCopyTraderNum),
    leadDays: n(r.leadDays),
    pnl: n(r.pnl),
    roiRatio: n(r.pnlRatio),
    winRatio: n(r.winRatio),
    curve,
    traderInsts: Array.isArray(r.traderInsts)
      ? r.traderInsts.map((x: any) => String(x))
      : [],
    ccy: String(r.ccy ?? "USDT"),
  };
}

/** 拉取带单员排行榜。这是「交易员从哪来」的答案 —— 全部是 OKX 上的真实带单员。 */
export async function fetchLeadRanks(
  q: LeadRankQuery = {}
): Promise<{ dataVer?: string; ranks: LeadRank[] }> {
  const p = new URLSearchParams();
  p.set("instType", COPY_INST_TYPE);
  // 上限 20，见 RANK_MAX_LIMIT 的注释
  p.set("limit", String(Math.min(Math.max(q.limit ?? RANK_MAX_LIMIT, 1), RANK_MAX_LIMIT)));
  if (q.page) p.set("page", String(q.page));
  if (q.sortType && RANK_SORT.has(q.sortType)) p.set("sortType", q.sortType);
  if (q.state) p.set("state", q.state);
  if (q.minLeadDays) p.set("minLeadDays", q.minLeadDays);
  if (q.minAum) p.set("minAum", q.minAum);
  if (q.maxAum) p.set("maxAum", q.maxAum);
  if (q.dataVer) p.set("dataVer", q.dataVer);

  const res = await timedFetch(`${BASE}/api/v5/copytrading/public-lead-traders?${p}`);
  const json = await readOkx(res, "拉取带单员排行榜");

  const block = json.data?.[0] ?? {};
  return {
    dataVer: block.dataVer ? String(block.dataVer) : undefined,
    ranks: (block.ranks ?? []).map(normalizeRank).filter((r) => r.uniqueCode),
  };
}

/**
 * 拉取某个带单员的当前持仓。
 *
 * 注意：OKX 允许带单员隐藏当前持仓，隐藏时每条记录的 `instId` 都是空字符串 ——
 * 这时返回 `hidesPositions: true`。这就是为什么「自建镜像」方案对部分带单员行不通，
 * 而 OKX 原生跟单不受影响（由 OKX 自己同步，不需要我们知道他在买什么）。
 */
export async function fetchLeadPositions(
  uniqueCode: string,
  limit = 50
): Promise<{ positions: LeadPosition[]; hidesPositions: boolean }> {
  const p = new URLSearchParams();
  p.set("uniqueCode", uniqueCode);
  p.set("instType", COPY_INST_TYPE);
  p.set("limit", String(Math.min(Math.max(limit, 1), SUBPOS_MAX_LIMIT)));

  const res = await timedFetch(
    `${BASE}/api/v5/copytrading/public-current-subpositions?${p}`
  );
  // 常见错误：60004 Trader doesn't exist —— 排行里拿到的 code 不一定能用于持仓查询，
  // 所以调用方必须容错跳过（导入时不因此失败）
  const json = await readOkx(res, "查询带单员持仓");

  const rows = json.data ?? [];
  const positions: LeadPosition[] = rows.map((r: any) => ({
    instId: String(r.instId ?? ""),
    posSide: String(r.posSide) === "short" ? "short" : "long",
    lever: n(r.lever),
    margin: n(r.margin),
    upl: n(r.upl),
    uplRatio: n(r.uplRatio),
    mgnMode: String(r.mgnMode ?? ""),
  }));

  const hidesPositions = positions.length > 0 && positions.every((x) => !x.instId);
  return { positions, hidesPositions };
}

/** 平台跟单限额。前端在提交跟单前应据此校验，避免必然失败的请求打到 OKX。 */
export async function fetchPublicConfig(): Promise<OkxCopyLimits> {
  const res = await timedFetch(
    `${BASE}/api/v5/copytrading/public-config?instType=${COPY_INST_TYPE}`
  );
  const json = await readOkx(res, "读取平台跟单限额");
  const d = json.data?.[0] ?? {};
  return {
    minCopyAmt: n(d.minCopyAmt, 10),
    maxCopyAmt: n(d.maxCopyAmt, 100_000),
    maxCopyRatio: n(d.maxCopyRatio, 100),
    maxCopyTotalAmt: n(d.maxCopyTotalAmt, 2_000_000),
    maxSlRatio: n(d.maxSlRatio, 0.75),
    maxTpRatio: n(d.maxTpRatio, 1.5),
  };
}

/* ================================================================== */
/* 私有接口（签名）                                                    */
/* ================================================================== */

async function signed(
  path: string,
  c: Credentials,
  method: "GET" | "POST" = "GET",
  body?: any
): Promise<any[]> {
  const timestamp = new Date().toISOString();
  const bodyStr = body ? JSON.stringify(body) : "";
  const sign = await hmacSha256Base64(c.secret, `${timestamp}${method}${path}${bodyStr}`);

  const res = await timedFetch(`${BASE}${path}`, {
    method,
    headers: {
      "OK-ACCESS-KEY": c.apiKey,
      "OK-ACCESS-SIGN": sign,
      "OK-ACCESS-TIMESTAMP": timestamp,
      "OK-ACCESS-PASSPHRASE": c.passphrase ?? "",
      "Content-Type": "application/json",
      "x-simulated-trading": "0",
    },
    body: method === "POST" ? bodyStr : undefined,
  });

  // 502 / 50113 Invalid Passphrase 这类错误必须把正文带出来，否则只能靠猜
  const json = await readOkx(res, `调用 OKX 跟单接口 ${path}`);
  return json.data ?? [];
}

/** 把内部参数转成 OKX 要求的字符串 body（OKX 对金额/比例一律要求字符串） */
function toSettingsBody(p: OkxCopyParams): Record<string, string> {
  const b: Record<string, string> = {
    instType: p.instType,
    uniqueCode: p.uniqueCode,
    copyMgnMode: p.copyMgnMode,
    copyInstIdType: p.copyInstIdType,
    copyTotalAmt: String(p.copyTotalAmt),
    subPosCloseType: p.subPosCloseType,
  };
  // OKX 要求 copyMode 与金额字段配套：fixed_amount 给 copyAmt，ratio_copy 给 copyRatio
  if (p.copyMode === "fixed_amount") {
    b.copyMode = "fixed_amount";
    if (p.copyAmt != null) b.copyAmt = String(p.copyAmt);
  } else {
    b.copyMode = "ratio_copy";
    if (p.copyRatio != null) b.copyRatio = String(p.copyRatio);
  }
  if (p.tpRatio != null && p.tpRatio > 0) b.tpRatio = String(p.tpRatio);
  if (p.slRatio != null && p.slRatio > 0) b.slRatio = String(p.slRatio);
  return b;
}

/** 开始跟单。成功后该带单员的开平仓由 OKX 引擎实时同步到本账户。 */
export async function firstCopy(c: Credentials, p: OkxCopyParams): Promise<void> {
  await signed("/api/v5/copytrading/first-copy-settings", c, "POST", toSettingsBody(p));
}

/** 修改已有跟单的参数（金额、比例、止盈止损等）。 */
export async function amendCopy(c: Credentials, p: OkxCopyParams): Promise<void> {
  await signed("/api/v5/copytrading/amend-copy-settings", c, "POST", toSettingsBody(p));
}

/** 停止跟单。subPosCloseType 决定已有持仓怎么处理。 */
export async function stopCopy(
  c: Credentials,
  uniqueCode: string,
  subPosCloseType: OkxCopyParams["subPosCloseType"]
): Promise<void> {
  await signed("/api/v5/copytrading/stop-copy-trading", c, "POST", {
    instType: COPY_INST_TYPE,
    uniqueCode,
    subPosCloseType,
  });
}

/** 查询对某个带单员的跟单设置。 */
export async function getCopySettings(c: Credentials, uniqueCode: string): Promise<any[]> {
  const p = new URLSearchParams({ instType: COPY_INST_TYPE, uniqueCode });
  return signed(`/api/v5/copytrading/copy-settings?${p}`, c, "GET");
}

/**
 * 自己在 OKX 上的跟单持仓。
 * 用 subPosType=copy 只看跟单产生的子仓位（lead 是自己带单产生的，与跟单无关）。
 */
export async function getMyCopyPositions(c: Credentials, limit = SUBPOS_MAX_LIMIT): Promise<any[]> {
  const p = new URLSearchParams({
    instType: COPY_INST_TYPE,
    subPosType: "copy",
    limit: String(Math.min(Math.max(limit, 1), SUBPOS_MAX_LIMIT)),
  });
  return signed(`/api/v5/copytrading/current-subpositions?${p}`, c, "GET");
}

/** 自己正在跟的带单员列表。 */
export async function getMyLeadTraders(c: Credentials): Promise<any[]> {
  const p = new URLSearchParams({ instType: COPY_INST_TYPE });
  return signed(`/api/v5/copytrading/current-lead-traders?${p}`, c, "GET");
}

/** 平掉某个跟单子仓位。 */
export async function closeSubposition(
  c: Credentials,
  subPosId: string,
  ordType: "market" | "limit" = "market",
  px?: string
): Promise<any[]> {
  const body: Record<string, string> = {
    instType: COPY_INST_TYPE,
    subPosType: "copy",
    subPosId,
    ordType,
  };
  if (ordType === "limit" && px) body.px = px;
  return signed("/api/v5/copytrading/close-subposition", c, "POST", body);
}

/** 给跟单子仓位挂止盈/止损。 */
export async function placeAlgoOrder(
  c: Credentials,
  args: {
    subPosId: string;
    tpTriggerPx?: string;
    slTriggerPx?: string;
    tpTriggerPxType?: "last" | "index" | "mark";
    slTriggerPxType?: "last" | "index" | "mark";
  }
): Promise<any[]> {
  const body: Record<string, string> = {
    instType: COPY_INST_TYPE,
    subPosType: "copy",
    subPosId: args.subPosId,
  };
  if (args.tpTriggerPx) {
    body.tpTriggerPx = args.tpTriggerPx;
    body.tpOrdPx = "-1"; // 触发后市价
    body.tpTriggerPxType = args.tpTriggerPxType ?? "last";
  }
  if (args.slTriggerPx) {
    body.slTriggerPx = args.slTriggerPx;
    body.slOrdPx = "-1";
    body.slTriggerPxType = args.slTriggerPxType ?? "last";
  }
  return signed("/api/v5/copytrading/algo-order", c, "POST", body);
}

/* ================================================================== */
/* 映射：OKX 带单员 → 本地信号源                                        */
/* ================================================================== */

/** 把 instId（BTC-USDT-SWAP）转成本项目的交易对写法（BTC/USDT） */
function instToSymbol(instId: string): string {
  const [b, q] = String(instId).split("-");
  return b && q ? `${b}/${q}` : instId;
}

/**
 * 带单员 → Trader。
 * 所有统计字段都直接用 OKX 的真实数据，不做任何本地估算。
 * 传 existing 表示这是一次「刷新」，此时保留本地字段（id / status / note / createdAt）。
 */
export function rankToTrader(rank: LeadRank, existing?: Trader | null): Trader {
  const symbols = Array.from(
    new Set(rank.traderInsts.map(instToSymbol).filter((s) => s.includes("/")))
  ).slice(0, 12);

  const meta: OkxLeadMeta = {
    uniqueCode: rank.uniqueCode,
    nickName: rank.nickName,
    pnlRatio: String(rank.roiRatio),
    pnl: String(rank.pnl),
    aum: String(rank.aum),
    winRatio: String(rank.winRatio),
    leadDays: String(rank.leadDays),
    copyTraderNum: String(rank.copyTraderNum),
    accCopyTraderNum: String(rank.accCopyTraderNum),
    portLink: rank.portLink,
    traderInsts: rank.traderInsts,
    curve: rank.curve,
    hidesPositions: existing?.okx?.hidesPositions,
    syncedAt: Date.now(),
  };

  const base: Trader = {
    id: existing?.id ?? "",
    name: rank.nickName,
    tagline: `OKX 带单员 · 带单 ${rank.leadDays} 天 · ${rank.copyTraderNum} 人跟单`,
    avatarHue: existing?.avatarHue ?? hashHue(rank.uniqueCode),
    avatarUrl: rank.portLink,

    // 统计口径：OKX 的小数 ×100 得到本项目使用的百分比
    roi30d: 0,
    roi90d: 0,
    roiTotal: rank.roiRatio * 100,
    winRate: rank.winRatio * 100,
    maxDrawdown: 0,
    followers: rank.copyTraderNum,
    aum: rank.aum,
    sharpe: 0,
    trades: 0,
    avgHold: "—",
    verified: true,
    curve: rank.curve.map((x) => x * 100),
    tags: ["OKX 官方", "带单员", rank.ccy],

    source: "okx",
    status: existing?.status ?? "live",
    risk: riskOf(rank),
    style: "OKX 带单员",
    symbols: symbols.length ? symbols : ["BTC/USDT"],
    okx: meta,
    note: existing?.note ?? `导入自 OKX 跟单平台，uniqueCode=${rank.uniqueCode}`,
    createdBy: existing?.createdBy,
    createdAt: existing?.createdAt ?? Date.now(),
    signalCount: existing?.signalCount ?? 0,
    engineState: existing?.engineState,
  };

  return base;
}

/** 用 AUM 与带单天数粗分风险档，仅用于列表标签展示，不参与任何执行逻辑。 */
function riskOf(r: LeadRank): Trader["risk"] {
  if (r.leadDays >= 500 && r.aum >= 50_000) return "low";
  if (r.leadDays < 120 || r.aum < 3_000) return "high";
  return "medium";
}

function hashHue(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
  return h;
}

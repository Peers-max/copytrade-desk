import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { all, mutate, uid } from "@/lib/db";
import {
  fetchLeadPositions,
  fetchLeadRanks,
  fetchPublicConfig,
  rankToTrader,
  type LeadRank,
} from "@/lib/okx-copy";
import type { Trader } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * OKX 带单员名册：浏览 + 导入。
 *
 * 这是「跟单列表里的交易员从哪来」的答案 —— 不再由本地编造，而是直接取自
 * OKX 官方跟单平台的公开排行榜，业绩数据（AUM / 跟单人数 / 收益率 / 胜率 /
 * 收益曲线 / 头像）全部是 OKX 的真实数据。
 *
 *   GET  /api/okx/traders?limit=20&page=1&sortType=pnl_ratio&minLeadDays=2
 *   POST /api/okx/traders   { uniqueCodes: ["XXXX", ...] }   导入或刷新
 *
 * 仅站主可用。
 */

/** 用于把 uniqueCode 反查成完整资料——OKX 没有「按 code 查单个带单员」的公开接口 */
const PAGES_TO_SCAN = 6;
const PAGE_SIZE = 100;

function clampInt(v: string | null, min: number, max: number, dflt: number): number {
  const x = Number(v);
  if (!Number.isFinite(x)) return dflt;
  return Math.min(Math.max(Math.trunc(x), min), max);
}

/**
 * 按 uniqueCode 反查带单员资料。
 * OKX 的分页靠 dataVer + page，翻页时必须带上首页返回的 dataVer，否则数据会漂。
 */
async function findRanks(
  codes: string[]
): Promise<{ found: Map<string, LeadRank>; missing: string[]; scanned: number }> {
  const want = new Set(codes);
  const found = new Map<string, LeadRank>();
  let dataVer: string | undefined;
  let scanned = 0;

  for (let page = 1; page <= PAGES_TO_SCAN && found.size < want.size; page++) {
    const res = await fetchLeadRanks({
      limit: PAGE_SIZE,
      page,
      sortType: "overview",
      dataVer,
    });
    if (!res.ranks.length) break;
    dataVer = dataVer ?? res.dataVer;
    scanned += res.ranks.length;
    for (const r of res.ranks) if (want.has(r.uniqueCode)) found.set(r.uniqueCode, r);
  }

  return { found, missing: codes.filter((c) => !found.has(c)), scanned };
}

export async function GET(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ ok: false, error: "需要站主权限" }, { status: 403 });

  const sp = req.nextUrl.searchParams;
  const limit = clampInt(sp.get("limit"), 1, 100, 20);
  const page = clampInt(sp.get("page"), 1, 2000, 1);
  const sortType = sp.get("sortType") ?? "overview";
  const minLeadDays = sp.get("minLeadDays") ?? undefined;
  const minAum = sp.get("minAum") ?? undefined;
  const maxAum = sp.get("maxAum") ?? undefined;

  try {
    const [rankRes, limits, locals] = await Promise.all([
      fetchLeadRanks({
        limit,
        page,
        sortType: sortType as any,
        minLeadDays: minLeadDays as any,
        minAum,
        maxAum,
      }),
      fetchPublicConfig().catch(() => null),
      all<Trader>("traders"),
    ]);

    const imported: Record<string, string> = {};
    for (const t of locals) {
      if (t.source === "okx" && t.okx?.uniqueCode) imported[t.okx.uniqueCode] = t.id;
    }

    return NextResponse.json({
      ok: true,
      dataVer: rankRes.dataVer,
      page,
      ranks: rankRes.ranks,
      imported,
      limits,
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: `读取 OKX 带单员失败：${String(e?.message ?? e)}` },
      { status: 502 }
    );
  }
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ ok: false, error: "需要站主权限" }, { status: 403 });

  const b = await req.json().catch(() => ({} as any));
  const raw: any[] = Array.isArray(b?.uniqueCodes)
    ? b.uniqueCodes
    : b?.uniqueCode
      ? [b.uniqueCode]
      : [];
  const codes = Array.from(new Set(raw.map((x) => String(x).trim().toUpperCase()).filter(Boolean)));

  if (!codes.length) {
    return NextResponse.json({ ok: false, error: "请提供 uniqueCodes" }, { status: 400 });
  }
  if (codes.length > 20) {
    return NextResponse.json({ ok: false, error: "一次最多导入 20 个带单员" }, { status: 400 });
  }

  let found: Map<string, LeadRank>;
  let missing: string[];
  let scanned = 0;
  try {
    const r = await findRanks(codes);
    found = r.found;
    missing = r.missing;
    scanned = r.scanned;
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: `读取 OKX 带单员失败：${String(e?.message ?? e)}` },
      { status: 502 }
    );
  }

  const locals = await all<Trader>("traders");

  type Prepared = { trader: Trader; isNew: boolean };
  const prepared: Prepared[] = [];
  const results: any[] = missing.map((c) => ({
    uniqueCode: c,
    ok: false,
    error: `在 OKX 排行榜前 ${scanned} 名中未找到（可能已停止带单或排名靠后）`,
  }));

  for (const code of codes) {
    const rank = found.get(code);
    if (!rank) continue;

    const existing = locals.find((t) => t.source === "okx" && t.okx?.uniqueCode === code) ?? null;
    const trader = rankToTrader(rank, existing);
    const isNew = !existing;
    if (isNew) trader.id = uid("tr");

    // 探测该带单员是否隐藏当前持仓 —— 决定他能否用于「自建镜像」。
    // 失败不影响导入（可能持仓接口对这个 code 不可用）。
    try {
      const { hidesPositions } = await fetchLeadPositions(code, 20);
      if (trader.okx) trader.okx.hidesPositions = hidesPositions;
    } catch {
      /* 保持 undefined = 未知 */
    }

    prepared.push({ trader, isNew });

    // 跟单人数是「有多少人在 OKX 上跟了他」，不是本平台的数据，标签要写清
    results.push({
      uniqueCode: code,
      ok: true,
      action: isNew ? "created" : "updated",
      traderId: trader.id,
      name: trader.name,
      aum: trader.aum,
      roiTotal: trader.roiTotal,
      winRate: trader.winRate,
      leadDays: rank.leadDays,
      hidesPositions: trader.okx?.hidesPositions,
    });
  }

  if (prepared.length) {
    // 一次写完，避免在 Worker 上做 N 次整库 KV 往返
    await mutate<Trader>("traders", (rows) => {
      for (const { trader, isNew } of prepared) {
        if (isNew) {
          rows.push(trader);
        } else {
          const i = rows.findIndex((t) => t.id === trader.id);
          // 保留本地的运行状态与人工备注，只覆盖来自 OKX 的业绩数据
          if (i >= 0) {
            rows[i] = {
              ...rows[i],
              ...trader,
              status: rows[i].status,
              note: rows[i].note,
              createdBy: rows[i].createdBy,
              createdAt: rows[i].createdAt,
            };
          }
        }
      }
      return rows;
    });
  }

  return NextResponse.json({
    ok: true,
    imported: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    results,
  });
}

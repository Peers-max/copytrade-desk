import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { all, mutate, uid } from "@/lib/db";
import {
  fetchLeadPositions,
  fetchLeadRanks,
  fetchPublicConfig,
  rankToTrader,
  RANK_MAX_LIMIT,
  type LeadRank,
  type LeadRankQuery,
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
 *   POST /api/okx/traders   { uniqueCodes: ["XXXX"], sortType?, minLeadDays?, minAum?, maxAum? }
 *
 * 仅站主可用。
 */

/**
 * 用于把 uniqueCode 反查成完整资料 —— OKX 没有「按 code 查单个带单员」的公开接口。
 *
 * ⚠️ OKX 排行榜分页是 **一页 20 条**（见 RANK_MAX_LIMIT），不是 100。反查只能翻页扫，
 * 扫描深度直接决定「导入」能不能找到人。10 页 = 200 名。
 * 一次最多 10 个 code，加上持仓探测，子请求数稳定在 30 以内
 * （Cloudflare Workers 单请求子请求上限 50，这里不能堆太高）。
 */
const PAGES_TO_SCAN = 10;
const PAGE_SIZE = RANK_MAX_LIMIT;
const MAX_CODES_PER_IMPORT = 10;

type BrowseQuery = Pick<LeadRankQuery, "sortType" | "minLeadDays" | "minAum" | "maxAum">;

function clampInt(v: string | null, min: number, max: number, dflt: number): number {
  const x = Number(v);
  if (!Number.isFinite(x)) return dflt;
  return Math.min(Math.max(Math.trunc(x), min), max);
}

/** 用一组筛选条件翻页扫，把目标 code 找出来。 */
async function scanFor(codes: string[], q: BrowseQuery) {
  const want = new Set(codes);
  const found = new Map<string, LeadRank>();
  let dataVer: string | undefined;
  let scanned = 0;

  for (let page = 1; page <= PAGES_TO_SCAN && found.size < want.size; page++) {
    // OKX 的分页靠 dataVer + page，翻页时必须带上首页返回的 dataVer，否则数据会漂
    const res = await fetchLeadRanks({ ...q, limit: PAGE_SIZE, page, dataVer });
    if (!res.ranks.length) break;
    dataVer = dataVer ?? res.dataVer;
    scanned += res.ranks.length;
    for (const r of res.ranks) if (want.has(r.uniqueCode)) found.set(r.uniqueCode, r);
  }

  return { found, scanned };
}

/**
 * 反查带单员资料。
 *
 * 两遍扫描：先用前端当前的筛选条件（用户就是在那个列表里点的「导入」），
 * 找不到再回落到综合排序 —— 覆盖「筛完列表又改了条件」的情况。
 * 只扫一遍 overview 的话，带筛选导入时经常白白报「未找到」。
 */
async function findRanks(
  codes: string[],
  q: BrowseQuery
): Promise<{ found: Map<string, LeadRank>; missing: string[]; scanned: number }> {
  const pass1 = await scanFor(codes, q);
  let scanned = pass1.scanned;

  let missing = codes.filter((c) => !pass1.found.has(c));
  const hasFilter =
    Boolean(q.minLeadDays || q.minAum || q.maxAum) || Boolean(q.sortType && q.sortType !== "overview");

  if (missing.length && hasFilter) {
    const pass2 = await scanFor(missing, { sortType: "overview" });
    scanned += pass2.scanned;
    for (const [k, v] of pass2.found) pass1.found.set(k, v);
    missing = codes.filter((c) => !pass1.found.has(c));
  }

  return { found: pass1.found, missing, scanned };
}

function browseQuery(sp: URLSearchParams): BrowseQuery {
  return {
    sortType: (sp.get("sortType") ?? "overview") as LeadRankQuery["sortType"],
    minLeadDays: (sp.get("minLeadDays") || undefined) as LeadRankQuery["minLeadDays"],
    minAum: sp.get("minAum") || undefined,
    maxAum: sp.get("maxAum") || undefined,
  };
}

export async function GET(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ ok: false, error: "需要站主权限" }, { status: 403 });

  const sp = req.nextUrl.searchParams;
  // 上限 20 —— 传 100 会被 OKX 直接 400，前端传什么都不能原样转发
  const limit = clampInt(sp.get("limit"), 1, RANK_MAX_LIMIT, RANK_MAX_LIMIT);
  const page = clampInt(sp.get("page"), 1, 2000, 1);

  try {
    const [rankRes, limits, locals] = await Promise.all([
      fetchLeadRanks({ ...browseQuery(sp), limit, page }),
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
      limit,
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
  if (codes.length > MAX_CODES_PER_IMPORT) {
    return NextResponse.json(
      { ok: false, error: `一次最多导入 ${MAX_CODES_PER_IMPORT} 个带单员` },
      { status: 400 }
    );
  }

  // 前端把他当前列表的筛选条件一起带过来，反查才能命中同一份名单
  const q: BrowseQuery = {
    sortType: (b?.sortType ?? "overview") as LeadRankQuery["sortType"],
    minLeadDays: (b?.minLeadDays || undefined) as LeadRankQuery["minLeadDays"],
    minAum: b?.minAum ? String(b.minAum) : undefined,
    maxAum: b?.maxAum ? String(b.maxAum) : undefined,
  };

  let found: Map<string, LeadRank>;
  let missing: string[];
  let scanned = 0;
  try {
    const r = await findRanks(codes, q);
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
    error: `在 OKX 排行榜前 ${scanned} 名中未找到（可能已停止带单、排名靠后，或不在当前筛选条件的前 ${PAGES_TO_SCAN} 页内）`,
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

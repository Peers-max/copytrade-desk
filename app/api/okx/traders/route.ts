import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { all, mutate, uid } from "@/lib/db";
import {
  fetchLeadPositions,
  fetchLeadRanks,
  fetchPublicConfig,
  okxKey,
  rankToTrader,
  traderToRank,
  RANK_MAX_LIMIT,
  type LeadRank,
  type LeadRankQuery,
} from "@/lib/okx-copy";
import type { OkxInstType, Trader } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * OKX 带单员名册：浏览 / 导入 / 全量同步 / 存量瘦身。
 *
 * 这是「跟单列表里的交易员从哪来」的答案 —— 不再由本地编造，而是直接取自
 * OKX 官方跟单平台的公开排行榜，业绩数据（AUM / 跟单人数 / 收益率 / 胜率 /
 * 收益曲线 / 头像）全部是 OKX 的真实数据。
 *
 *   GET  /api/okx/traders?instType=SWAP&limit=20&page=1&sortType=pnl_ratio
 *   POST /api/okx/traders   { uniqueCodes: [...], instType }            按 code 导入
 *   POST /api/okx/traders   { mode: "sync", instType, page, dataVer? }  全量同步的一批
 *   POST /api/okx/traders   { mode: "compact" }                        存量瘦身（见下）
 *
 * ## 全量同步为什么必须分批
 *
 * OKX 排行榜 **一页最多 20 条**（RANK_MAX_LIMIT），全集有 253 个（SWAP）/ 159 个（SPOT），
 * 拉完要 13 / 8 页。单次请求拉完会撞上 Worker 的时长与子请求上限，
 * 所以这里一次只处理一页，由前端循环推进 —— 请求短、可显示进度、可中断。
 *
 * ## 幂等键为什么必须带品类
 *
 * 实测 99 个 uniqueCode 在 SWAP / SPOT 两册里重复出现，但它们是**两个不同的带单产品**
 * （AUM、收益、品种全不同）。只按 uniqueCode 匹配会让两者互相覆盖，所以统一走 `okxKey()`。
 *
 * ## 为什么要有一个 compact 模式
 *
 * 早期版本把 OKX 原始字段「顺手全存」了（`okx.traderInsts` 平均 204 个 / 人、
 * `okx.curve`、`okx.portLink`），414 条把整库顶到 1.8 MB。
 * 每次请求 `readDB()` 都要整库 `JSON.parse`，直接超出 Worker CPU 预算
 * → Cloudflare `error code 1102`，整站间歇 503。
 *
 * 存储侧已经在 `rankToTrader` 里改好了；但**已经落盘的 414 条老记录还得重写一遍**。
 * 全量同步当然能覆盖，不过那次只处理榜单当前在册的人，掉榜的就永远带着冗余字段。
 * `mode:"compact"` 就地重写所有 okx 记录，不依赖网络、一次整库写入，专门用来修这个事故。
 *
 * 仅站主可用。
 */

/**
 * 按 code 反查时要扫多少页。
 * OKX 没有「按 code 查单个带单员」的公开接口，只能翻页扫。
 * 全集是 13 页（253 个），这里取 13 保证能找到榜上任何一个人；
 * 13 页 + 最多 10 个持仓探测 ≈ 23 个子请求，仍在 Workers 的 50 上限内。
 */
const PAGES_TO_SCAN = 13;
const PAGE_SIZE = RANK_MAX_LIMIT;
const MAX_CODES_PER_IMPORT = 10;

type BrowseQuery = Pick<LeadRankQuery, "sortType" | "minLeadDays" | "minAum" | "maxAum">;

function clampInt(v: any, min: number, max: number, dflt: number): number {
  const x = Number(v);
  if (!Number.isFinite(x)) return dflt;
  return Math.min(Math.max(Math.trunc(x), min), max);
}

/** 只认 OKX 实际支持的品类，其余一律回落 SWAP（传 MARGIN 之类会 400）。 */
function normInst(v: any): OkxInstType {
  return String(v).toUpperCase() === "SPOT" ? "SPOT" : "SWAP";
}

/** 用一组筛选条件翻页扫，把目标 code 找出来。 */
async function scanFor(instType: OkxInstType, codes: string[], q: BrowseQuery) {
  const want = new Set(codes);
  const found = new Map<string, LeadRank>();
  let dataVer: string | undefined;
  let scanned = 0;

  for (let page = 1; page <= PAGES_TO_SCAN && found.size < want.size; page++) {
    // OKX 的分页靠 dataVer + page，翻页时必须带上首页返回的 dataVer，否则数据会漂
    const res = await fetchLeadRanks({ ...q, instType, limit: PAGE_SIZE, page, dataVer });
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
 */
async function findRanks(
  instType: OkxInstType,
  codes: string[],
  q: BrowseQuery
): Promise<{ found: Map<string, LeadRank>; missing: string[]; scanned: number }> {
  const pass1 = await scanFor(instType, codes, q);
  let scanned = pass1.scanned;

  let missing = codes.filter((c) => !pass1.found.has(c));
  const hasFilter =
    Boolean(q.minLeadDays || q.minAum || q.maxAum) || Boolean(q.sortType && q.sortType !== "overview");

  if (missing.length && hasFilter) {
    const pass2 = await scanFor(instType, missing, { sortType: "overview" });
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

/** 本地已有的 OKX 带单员索引：okxKey → Trader */
async function localIndex(): Promise<Map<string, Trader>> {
  const locals = await all<Trader>("traders");
  const map = new Map<string, Trader>();
  for (const t of locals) {
    if (t.source === "okx" && t.okx?.uniqueCode) map.set(okxKey(t.okx), t);
  }
  return map;
}

/**
 * 把一批 rank 落盘（新增或更新）。只做一次整库写入。
 * 刷新时保留本地的运行状态、人工备注与创建信息，只覆盖 OKX 来的业绩数据。
 */
async function persist(ranks: LeadRank[]): Promise<{ created: number; updated: number; names: string[] }> {
  if (!ranks.length) return { created: 0, updated: 0, names: [] };

  const idx = await localIndex();
  let created = 0;
  let updated = 0;
  const names: string[] = [];

  const prepared = ranks.map((rank) => {
    const existing = idx.get(okxKey(rank)) ?? null;
    const trader = rankToTrader(rank, existing);
    if (existing) {
      updated++;
    } else {
      created++;
      trader.id = uid("tr");
      idx.set(okxKey(rank), trader);
    }
    names.push(trader.name);
    return { trader, isNew: !existing };
  });

  await mutate<Trader>("traders", (rows) => {
    for (const { trader, isNew } of prepared) {
      if (isNew) {
        rows.push(trader);
        continue;
      }
      const i = rows.findIndex((t) => t.id === trader.id);
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
    return rows;
  });

  return { created, updated, names };
}

export async function GET(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ ok: false, error: "需要站主权限" }, { status: 403 });

  const sp = req.nextUrl.searchParams;
  const instType = normInst(sp.get("instType"));
  // 上限 20 —— 传 100 会被 OKX 直接 400，前端传什么都不能原样转发
  const limit = clampInt(sp.get("limit"), 1, RANK_MAX_LIMIT, RANK_MAX_LIMIT);
  const page = clampInt(sp.get("page"), 1, 2000, 1);

  try {
    const [rankRes, limits, idx] = await Promise.all([
      fetchLeadRanks({ ...browseQuery(sp), instType, limit, page }),
      fetchPublicConfig(instType).catch(() => null),
      localIndex(),
    ]);

    const imported: Record<string, string> = {};
    for (const [k, t] of idx) imported[k] = t.id;

    return NextResponse.json({
      ok: true,
      instType,
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
  const instType = normInst(b?.instType);

  /* ============ 模式一：全量同步的一批 ============ */
  if (b?.mode === "sync") {
    const page = clampInt(b?.page, 1, 500, 1);
    const sortType = (b?.sortType ?? "overview") as LeadRankQuery["sortType"];
    // 前端把第一批的 dataVer 一路带下来，避免翻页过程中 OKX 换榜导致数据漂移
    const dataVer = typeof b?.dataVer === "string" && b.dataVer ? b.dataVer : undefined;

    let res;
    try {
      res = await fetchLeadRanks({ instType, limit: RANK_MAX_LIMIT, page, sortType, dataVer });
    } catch (e: any) {
      return NextResponse.json(
        { ok: false, error: `读取 OKX 带单员失败：${String(e?.message ?? e)}` },
        { status: 502 }
      );
    }

    // 空页 = 已经翻到底
    if (!res.ranks.length) {
      return NextResponse.json({
        ok: true,
        mode: "sync",
        instType,
        page,
        dataVer: res.dataVer,
        created: 0,
        updated: 0,
        got: 0,
        hasMore: false,
      });
    }

    // ⚠️ 这里是「名册同步」，不为每个人探测持仓：
    // 253 人 × 1 次子请求会直接撞上 Workers 的子请求上限。
    // hidesPositions 保持「未知」，等真正要建自建镜像跟单时再按需探测。
    const { created, updated, names } = await persist(res.ranks);

    return NextResponse.json({
      ok: true,
      mode: "sync",
      instType,
      page,
      dataVer: res.dataVer,
      created,
      updated,
      got: res.ranks.length,
      // 满页说明后面大概率还有；不满页 = 到底了
      hasMore: res.ranks.length >= RANK_MAX_LIMIT,
      names: names.slice(0, 6),
    });
  }

  /* ============ 模式三：存量瘦身 ============ */
  // 就地重写所有 okx 记录，把多余的 okx.traderInsts / okx.curve / okx.portLink 去掉。
  // 不请求 OKX、不依赖网络，一次整库写入，专门用来修「整库过大 → Worker 1102」。
  if (b?.mode === "compact") {
    let scanned = 0;
    let slimmed = 0;
    let beforeBytes = 0;
    let afterBytes = 0;

    await mutate<Trader>("traders", (rows) =>
      rows.map((t) => {
        if (t.source !== "okx" || !t.okx?.uniqueCode) return t;
        scanned++;

        const rank = traderToRank(t);
        if (!rank) return t;

        const slim = rankToTrader(rank, t);
        // ⚠️ traderToRank 还原不出原始 instId 列表（那正是要丢掉的字段），
        // 所以必须把已有的品种表覆盖回去，否则全被降级成兜底的 BTC/USDT。
        if (Array.isArray(t.symbols) && t.symbols.length) slim.symbols = t.symbols;

        beforeBytes += JSON.stringify(t).length;
        afterBytes += JSON.stringify(slim).length;
        slimmed++;
        return slim;
      })
    );

    return NextResponse.json({
      ok: true,
      mode: "compact",
      scanned,
      slimmed,
      beforeKB: Math.round(beforeBytes / 1024),
      afterKB: Math.round(afterBytes / 1024),
    });
  }

  /* ============ 模式二：按 uniqueCode 导入 ============ */
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
    const r = await findRanks(instType, codes, q);
    found = r.found;
    missing = r.missing;
    scanned = r.scanned;
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: `读取 OKX 带单员失败：${String(e?.message ?? e)}` },
      { status: 502 }
    );
  }

  const before = await localIndex();

  // 逐个导入才做持仓探测（数量少，子请求可控）——
  // 这决定了该带单员能否用于「自建镜像」。
  const ranks: LeadRank[] = [];
  for (const code of codes) {
    const rank = found.get(code);
    if (!rank) continue;
    try {
      const { hidesPositions } = await fetchLeadPositions(code, 20, instType);
      rank.hidesPositions = hidesPositions;
    } catch {
      /* 保持未知 */
    }
    ranks.push(rank);
  }

  const { created, updated } = await persist(ranks);
  const idx = await localIndex();

  const results: any[] = missing.map((c) => ({
    uniqueCode: c,
    ok: false,
    error: `在 OKX ${instType} 排行榜前 ${scanned} 名中未找到（可能已停止带单、排名靠后，或不在当前筛选条件内）`,
  }));

  for (const rank of ranks) {
    const key = okxKey(rank);
    const t = idx.get(key);
    results.push({
      uniqueCode: rank.uniqueCode,
      instType,
      ok: true,
      action: before.has(key) ? "updated" : "created",
      traderId: t?.id,
      name: rank.nickName,
      aum: rank.aum,
      roiTotal: rank.roiRatio * 100,
      winRate: rank.winRatio * 100,
      leadDays: rank.leadDays,
      hidesPositions: rank.hidesPositions,
    });
  }

  return NextResponse.json({
    ok: true,
    mode: "codes",
    instType,
    imported: ranks.length,
    created,
    updated,
    failed: results.filter((r) => !r.ok).length,
    results,
  });
}

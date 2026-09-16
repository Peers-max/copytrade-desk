import { NextRequest, NextResponse } from "next/server";
import { filter, insert, remove, uid, update } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { getSource } from "@/lib/sources";
import { PLANS } from "@/lib/seed";
import { friendlyError, pickApiKey, tradingCredentials } from "@/lib/keys";
import { amendCopy, fetchPublicConfig, firstCopy, getMyCopyPositions, stopCopy } from "@/lib/okx-copy";
import type { CopyRelation, OkxCopyParams, OkxInstType } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * 跟单关系。
 *
 * 这里有**两条完全不同的执行链路**，靠 agent 字段区分：
 *
 *   engine = "local"（默认）
 *     本站自建：信号进来后用交易所适配器自己下单。适用于
 *     量化引擎 / Webhook / 手动发布这三类信号源。
 *
 *   engine = "okx"
 *     OKX 原生跟单：调 OKX 的 first-copy-settings 在本账户建立跟单关系，
 *     之后带单员的开平仓由 **OKX 自己的引擎实时同步**，本站不参与下单。
 *     适用于从 OKX 导入的带单员信号源（source === "okx"）。
 *
 * 这两条互不影响。okx 模式下的收益、持仓都以 OKX 为准，本地不做任何估算。
 */

const OKX_MGN_MODES = ["cross", "isolated", "copy"] as const;
const OKX_CLOSE_TYPES = ["market_close", "copy_close", "manual_close"] as const;

function pick<T extends readonly string[]>(list: T, v: any, dflt: T[number]): T[number] {
  return (list as readonly string[]).includes(String(v)) ? (String(v) as T[number]) : dflt;
}

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, error: "未登录" }, { status: 401 });

  const relations = await filter<CopyRelation>("copyRelations", (r) => r.userId === user.id);

  // 可选：拉一次 OKX 上的真实跟单持仓（只有当用户绑了 OKX Key 时才可能成功）
  let okxPositions: any[] | null = null;
  let okxError: string | undefined;
  if (req.nextUrl.searchParams.get("okxPositions") === "1") {
    const key = await pickApiKey(user.id, undefined, "okx");
    const cred = key ? await tradingCredentials(key) : null;
    if (!cred) {
      okxError = "尚未绑定可用的 OKX API Key";
    } else {
      try {
        // 跟单持仓分品类查询：SWAP 与 SPOT 是两套独立的子仓位账本，必须分别拉再合并。
        // 单个品类失败不影响另一个（例如账户没开通现货跟单）。
        const [swap, spot] = await Promise.all([
          getMyCopyPositions(cred, undefined, "SWAP").catch(() => [] as any[]),
          getMyCopyPositions(cred, undefined, "SPOT").catch(() => [] as any[]),
        ]);
        okxPositions = [...swap, ...spot];
      } catch (e: any) {
        okxError = friendlyError(String(e?.message ?? e));
      }
    }
  }

  return NextResponse.json({ ok: true, relations, okxPositions, okxError });
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, error: "未登录" }, { status: 401 });

  const b = await req.json().catch(() => ({} as any));
  const trader = await getSource(String(b.traderId ?? ""));
  if (!trader) return NextResponse.json({ ok: false, error: "信号源不存在" }, { status: 404 });
  if (trader.status !== "live") {
    return NextResponse.json({ ok: false, error: "该信号源已暂停，无法跟单" }, { status: 409 });
  }

  // 席位上限 / 重复跟单（两条链路共用）
  const plan = PLANS.find((p) => p.id === user.planId) ?? PLANS[0];
  const existing = await filter<CopyRelation>("copyRelations", (r) => r.userId === user.id);
  if (plan.limits.copySlots >= 0 && existing.length >= plan.limits.copySlots) {
    return NextResponse.json(
      { ok: false, error: `当前套餐（${plan.name}）最多 ${plan.limits.copySlots} 个跟单席位，请先取关或升级套餐` },
      { status: 400 }
    );
  }
  if (existing.some((r) => r.traderId === trader.id && r.status !== "stopped")) {
    return NextResponse.json({ ok: false, error: `已经在跟 ${trader.name} 了` }, { status: 400 });
  }

  /* ================= OKX 原生跟单 ================= */
  if (trader.source === "okx") {
    const uniqueCode = trader.okx?.uniqueCode;
    if (!uniqueCode) {
      return NextResponse.json({ ok: false, error: "该信号源缺少 OKX uniqueCode，请到「信号源管理」重新同步" }, { status: 400 });
    }

    // OKX 原生跟单必须用 OKX 的 Key —— 其它交易所的 Key 在这里没有意义
    const key = await pickApiKey(user.id, typeof b.apiKeyId === "string" ? b.apiKeyId : undefined, "okx");
    if (!key) {
      return NextResponse.json(
        { ok: false, error: "OKX 原生跟单需要绑定 OKX 的 API Key（需含 Passphrase），请先到「API 管理」绑定" },
        { status: 400 }
      );
    }
    const cred = await tradingCredentials(key);
    if (!cred) {
      return NextResponse.json({ ok: false, error: "无法解密该 OKX 凭据，请重新绑定" }, { status: 400 });
    }

    const copyMode: OkxCopyParams["copyMode"] = b.copyMode === "ratio_copy" ? "ratio_copy" : "fixed_amount";
    // 品类必须跟着带单员走：SWAP 带单员只能用 SWAP 跟，SPOT 同理。
    // 历史数据可能没有 instType 字段，兜底 SWAP（当时只导入过合约）。
    const instType: OkxInstType = trader.okx.instType ?? "SWAP";
    const params: OkxCopyParams = {
      uniqueCode,
      instType,
      copyMgnMode: pick(OKX_MGN_MODES, b.copyMgnMode, "copy"),
      copyInstIdType: b.copyInstIdType === "custom" ? "custom" : "copy",
      copyMode,
      copyTotalAmt: Number(b.copyTotalAmt),
      copyAmt: copyMode === "fixed_amount" ? Number(b.copyAmt) : undefined,
      copyRatio: copyMode === "ratio_copy" ? Number(b.copyRatio) : undefined,
      tpRatio: b.tpRatio != null && Number(b.tpRatio) > 0 ? Number(b.tpRatio) : undefined,
      slRatio: b.slRatio != null && Number(b.slRatio) > 0 ? Number(b.slRatio) : undefined,
      subPosCloseType: pick(OKX_CLOSE_TYPES, b.subPosCloseType, "copy_close"),
      startedAt: Date.now(),
    };

    // 用 OKX 的实时限额校验，避免明知必然失败的请求打过去
    try {
      const lim = await fetchPublicConfig(instType);
      if (!params.copyTotalAmt || params.copyTotalAmt <= 0) {
        return NextResponse.json({ ok: false, error: "请填写跟单总额" }, { status: 400 });
      }
      if (params.copyTotalAmt > lim.maxCopyTotalAmt) {
        return NextResponse.json(
          { ok: false, error: `跟单总额超过 OKX 上限 ${lim.maxCopyTotalAmt} USDT` },
          { status: 400 }
        );
      }
      if (copyMode === "fixed_amount") {
        if (!params.copyAmt || params.copyAmt <= 0) {
          return NextResponse.json({ ok: false, error: "固定金额模式请填写单笔跟单金额" }, { status: 400 });
        }
        if (params.copyAmt < lim.minCopyAmt || params.copyAmt > lim.maxCopyAmt) {
          return NextResponse.json(
            { ok: false, error: `单笔金额需在 OKX 允许的 ${lim.minCopyAmt} ~ ${lim.maxCopyAmt} USDT 之间` },
            { status: 400 }
          );
        }
        if (params.copyAmt > params.copyTotalAmt) {
          return NextResponse.json({ ok: false, error: "单笔金额不能大于跟单总额" }, { status: 400 });
        }
      } else if (!params.copyRatio || params.copyRatio <= 0 || params.copyRatio > lim.maxCopyRatio) {
        return NextResponse.json(
          { ok: false, error: `跟单比例需在 0 ~ ${lim.maxCopyRatio} 之间` },
          { status: 400 }
        );
      }
      if (params.slRatio != null && params.slRatio > lim.maxSlRatio) {
        return NextResponse.json({ ok: false, error: `止损比例不能超过 ${lim.maxSlRatio}` }, { status: 400 });
      }
      if (params.tpRatio != null && params.tpRatio > lim.maxTpRatio) {
        return NextResponse.json({ ok: false, error: `止盈比例不能超过 ${lim.maxTpRatio}` }, { status: 400 });
      }
    } catch (e: any) {
      return NextResponse.json(
        { ok: false, error: `读取 OKX 跟单限额失败，暂不能建立跟单：${String(e?.message ?? e)}` },
        { status: 502 }
      );
    }

    try {
      await firstCopy(cred, params);
    } catch (e: any) {
      const msg = friendlyError(String(e?.message ?? e));
      await update<any>("apiKeys", (k) => k.id === key.id, { lastError: msg });
      return NextResponse.json({ ok: false, error: `OKX 拒绝建立跟单：${msg}` }, { status: 502 });
    }

    const rel: CopyRelation = {
      id: uid("cr"),
      userId: user.id,
      traderId: trader.id,
      capital: params.copyTotalAmt,
      mode: copyMode === "ratio_copy" ? "ratio" : "fixed",
      ratio: params.copyRatio ?? 0,
      leverage: 0,
      stopLossPct: (params.slRatio ?? 0) * 100,
      takeProfitPct: (params.tpRatio ?? 0) * 100,
      status: "running",
      pnl: 0,
      pnlPct: 0,
      createdAt: Date.now(),
      copiedTrades: 0,
      apiKeyId: key.id,
      engine: "okx",
      okx: params,
      lastSyncAt: Date.now(),
    };

    await insert<CopyRelation>("copyRelations", rel);
    return NextResponse.json({
      ok: true,
      relation: rel,
      message: `已在 OKX 上建立跟单：${trader.name}（${copyMode === "ratio_copy" ? `按比例 ${params.copyRatio}%` : `每笔 ${params.copyAmt} USDT`}，总额 ${params.copyTotalAmt} USDT）。开平仓由 OKX 引擎实时同步，本站不再自行下单。`,
    });
  }

  /* ================= 本站自建链路 ================= */
  const capital = Number(b.capital);
  if (!capital || capital <= 0) {
    return NextResponse.json({ ok: false, error: "请填写大于 0 的跟单资金" }, { status: 400 });
  }

  const keys = await filter<any>("apiKeys", (k) => k.userId === user.id && k.status === "active");
  if (!keys.length) {
    return NextResponse.json(
      { ok: false, error: "还没绑定可用的交易所 API，请先到「API 管理」绑定后再跟单" },
      { status: 400 }
    );
  }

  const rel: CopyRelation = {
    id: uid("cr"),
    userId: user.id,
    traderId: trader.id,
    capital,
    mode: b.mode === "ratio" ? "ratio" : "fixed",
    ratio: Number(b.ratio ?? 0),
    leverage: Math.min(Math.max(Number(b.leverage ?? 1), 1), 125),
    stopLossPct: Math.max(Number(b.stopLossPct ?? 0), 0),
    takeProfitPct: Math.max(Number(b.takeProfitPct ?? 0), 0),
    status: "running",
    pnl: 0,
    pnlPct: 0,
    createdAt: Date.now(),
    copiedTrades: 0,
    apiKeyId: typeof b.apiKeyId === "string" && b.apiKeyId ? b.apiKeyId : keys[0].id,
    notionalTotal: 0,
    failedTrades: 0,
    engine: "local",
  };

  await insert<CopyRelation>("copyRelations", rel);
  return NextResponse.json({ ok: true, relation: rel });
}

export async function PATCH(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, error: "未登录" }, { status: 401 });
  const { id, ...patch } = await req.json().catch(() => ({} as any));

  const rows = await filter<CopyRelation>("copyRelations", (r) => r.id === id && r.userId === user.id);
  const rel = rows[0];
  if (!rel) return NextResponse.json({ ok: false, error: "跟单关系不存在" }, { status: 404 });

  // 只允许改这几个字段，避免前端顺手把 pnl / copiedTrades 改掉
  const allowed: Partial<CopyRelation> = {};
  if (patch.status && ["running", "paused", "stopped"].includes(patch.status)) allowed.status = patch.status;
  if (patch.capital !== undefined) allowed.capital = Number(patch.capital);
  if (patch.leverage !== undefined) allowed.leverage = Math.min(Math.max(Number(patch.leverage), 1), 125);
  if (patch.stopLossPct !== undefined) allowed.stopLossPct = Math.max(Number(patch.stopLossPct), 0);
  if (patch.takeProfitPct !== undefined) allowed.takeProfitPct = Math.max(Number(patch.takeProfitPct), 0);
  if (patch.apiKeyId !== undefined) allowed.apiKeyId = String(patch.apiKeyId);

  // OKX 原生跟单：改金额/止盈止损必须同步到 OKX，否则本地记录与 OKX 实际设置会脱节
  if (rel.engine === "okx" && rel.okx && patch.status === undefined) {
    const key = await pickApiKey(user.id, rel.apiKeyId, "okx");
    const cred = key ? await tradingCredentials(key) : null;
    if (!cred) return NextResponse.json({ ok: false, error: "无法解密 OKX 凭据，请重新绑定" }, { status: 400 });

    const next: OkxCopyParams = {
      ...rel.okx,
      copyTotalAmt: patch.capital !== undefined ? Number(patch.capital) : rel.okx.copyTotalAmt,
      tpRatio: patch.takeProfitPct !== undefined ? Number(patch.takeProfitPct) / 100 : rel.okx.tpRatio,
      slRatio: patch.stopLossPct !== undefined ? Number(patch.stopLossPct) / 100 : rel.okx.slRatio,
    };

    try {
      await amendCopy(cred, next);
    } catch (e: any) {
      return NextResponse.json(
        { ok: false, error: `同步到 OKX 失败：${friendlyError(String(e?.message ?? e))}` },
        { status: 502 }
      );
    }
    allowed.okx = next;
    allowed.lastSyncAt = Date.now();
  }

  await update<CopyRelation>("copyRelations", (r) => r.id === id && r.userId === user.id, allowed);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, error: "未登录" }, { status: 401 });
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ ok: false, error: "缺少 id" }, { status: 400 });

  const rows = await filter<CopyRelation>("copyRelations", (r) => r.id === id && r.userId === user.id);
  const rel = rows[0];
  if (!rel) return NextResponse.json({ ok: false, error: "跟单关系不存在" }, { status: 404 });

  // OKX 原生跟单：必须在 OKX 侧停止，否则那边会继续跟单
  if (rel.engine === "okx" && rel.okx) {
    const key = await pickApiKey(user.id, rel.apiKeyId, "okx");
    const cred = key ? await tradingCredentials(key) : null;
    if (!cred) {
      return NextResponse.json(
        { ok: false, error: "无法解密 OKX 凭据，无法在 OKX 侧停止跟单。请先修复 API Key，否则 OKX 上会继续跟单。" },
        { status: 400 }
      );
    }

    // 默认 manual_close：只停止跟单、保留已有持仓由用户自己处理 —— 破坏性最小。
    // 想立刻平仓就显式传 subPosCloseType=market_close。
    const closeType = pick(
      OKX_CLOSE_TYPES,
      req.nextUrl.searchParams.get("subPosCloseType"),
      "manual_close"
    );

    try {
      await stopCopy(cred, rel.okx.uniqueCode, closeType, rel.okx.instType ?? "SWAP");
    } catch (e: any) {
      return NextResponse.json(
        { ok: false, error: `在 OKX 侧停止跟单失败：${friendlyError(String(e?.message ?? e))}` },
        { status: 502 }
      );
    }

    await remove("copyRelations", (r) => r.id === id && r.userId === user.id);
    const explain: Record<string, string> = {
      manual_close: "已停止跟单，已有持仓保留在你账户里，需要自己处理。",
      market_close: "已停止跟单并市价平掉了已有持仓。",
      copy_close: "已停止跟单，已有持仓等带单员平仓时同步平掉。",
    };
    return NextResponse.json({ ok: true, message: explain[closeType] });
  }

  await remove("copyRelations", (r) => r.id === id && r.userId === user.id);
  return NextResponse.json({ ok: true });
}

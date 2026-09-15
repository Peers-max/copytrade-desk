import { NextRequest, NextResponse } from "next/server";
import { filter, insert, remove, uid, update } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { getSource } from "@/lib/sources";
import { PLANS } from "@/lib/seed";
import type { CopyRelation } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, error: "未登录" }, { status: 401 });
  return NextResponse.json({
    ok: true,
    relations: await filter<CopyRelation>("copyRelations", (r) => r.userId === user.id),
  });
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, error: "未登录" }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const trader = await getSource(String(b.traderId ?? ""));
  if (!trader) return NextResponse.json({ ok: false, error: "信号源不存在" }, { status: 404 });
  if (trader.status !== "live") {
    return NextResponse.json({ ok: false, error: "该信号源已暂停，无法跟单" }, { status: 409 });
  }

  const capital = Number(b.capital);
  if (!capital || capital <= 0) {
    return NextResponse.json({ ok: false, error: "请填写大于 0 的跟单资金" }, { status: 400 });
  }

  // 实盘前置条件：必须有可用的交易所 API —— 否则跟单只是空跑
  const keys = await filter<any>("apiKeys", (k) => k.userId === user.id && k.status === "active");
  if (!keys.length) {
    return NextResponse.json(
      { ok: false, error: "还没绑定可用的交易所 API，请先到「API 管理」绑定后再跟单" },
      { status: 400 }
    );
  }

  // 席位上限
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
  };

  await insert<CopyRelation>("copyRelations", rel);
  return NextResponse.json({ ok: true, relation: rel });
}

export async function PATCH(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, error: "未登录" }, { status: 401 });
  const { id, ...patch } = await req.json().catch(() => ({}));

  // 只允许改这几个字段，避免前端顺手把 pnl / copiedTrades 改掉
  const allowed: Partial<CopyRelation> = {};
  if (patch.status && ["running", "paused", "stopped"].includes(patch.status)) allowed.status = patch.status;
  if (patch.capital !== undefined) allowed.capital = Number(patch.capital);
  if (patch.leverage !== undefined) allowed.leverage = Math.min(Math.max(Number(patch.leverage), 1), 125);
  if (patch.stopLossPct !== undefined) allowed.stopLossPct = Math.max(Number(patch.stopLossPct), 0);
  if (patch.takeProfitPct !== undefined) allowed.takeProfitPct = Math.max(Number(patch.takeProfitPct), 0);
  if (patch.apiKeyId !== undefined) allowed.apiKeyId = String(patch.apiKeyId);

  await update<CopyRelation>("copyRelations", (r) => r.id === id && r.userId === user.id, allowed);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, error: "未登录" }, { status: 401 });
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ ok: false, error: "缺少 id" }, { status: 400 });
  await remove("copyRelations", (r) => r.id === id && r.userId === user.id);
  return NextResponse.json({ ok: true });
}

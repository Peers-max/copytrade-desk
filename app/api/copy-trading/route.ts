import { NextRequest, NextResponse } from "next/server";
import { filter, insert, remove, uid, update } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import type { CopyRelation } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, error: "未登录" }, { status: 401 });
  return NextResponse.json({ ok: true, relations: await filter<CopyRelation>("copyRelations", (r) => r.userId === user.id) });
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, error: "未登录" }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  if (!b.traderId || !b.capital) {
    return NextResponse.json({ ok: false, error: "请选择交易员并填写跟单资金" }, { status: 400 });
  }
  const rel: CopyRelation = {
    id: uid("cr"),
    userId: user.id,
    traderId: b.traderId,
    capital: Number(b.capital),
    mode: b.mode === "ratio" ? "ratio" : "fixed",
    ratio: Number(b.ratio ?? 0),
    leverage: Number(b.leverage ?? 1),
    stopLossPct: Number(b.stopLossPct ?? 20),
    takeProfitPct: Number(b.takeProfitPct ?? 50),
    status: "running",
    pnl: 0,
    pnlPct: 0,
    createdAt: Date.now(),
    copiedTrades: 0,
  };
  await insert<CopyRelation>("copyRelations", rel);
  return NextResponse.json({ ok: true, relation: rel });
}

export async function PATCH(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, error: "未登录" }, { status: 401 });
  const { id, ...patch } = await req.json().catch(() => ({}));
  await update<CopyRelation>("copyRelations", (r) => r.id === id && r.userId === user.id, patch);
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

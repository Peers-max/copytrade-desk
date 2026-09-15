import { NextRequest, NextResponse } from "next/server";
import { all, filter, insert, remove, uid, update } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { getStrategies } from "@/lib/seed";
import type { Strategy } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getSessionUser();
  const strategies = await getStrategies();
  if (!user) return NextResponse.json({ ok: true, strategies, subs: [] });
  const subs = await filter<any>("strategySubs", (s) => s.userId === user.id);
  return NextResponse.json({ ok: true, strategies, subs });
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, error: "未登录" }, { status: 401 });
  const { strategyId, capital } = await req.json().catch(() => ({}));
  const st = (await all<Strategy>("strategies")).find((s) => s.id === strategyId);
  if (!st) return NextResponse.json({ ok: false, error: "策略不存在" }, { status: 400 });
  const existing = (await filter<any>("strategySubs", (s) => s.userId === user.id && s.strategyId === strategyId))[0];
  if (existing) return NextResponse.json({ ok: false, error: "已订阅该策略" }, { status: 400 });
  const sub = {
    id: uid("ss"),
    userId: user.id,
    strategyId,
    capital: Number(capital || st.minCapital),
    running: false,
    pnl: 0,
    createdAt: Date.now(),
  };
  await insert("strategySubs", sub);
  return NextResponse.json({ ok: true, sub });
}

export async function PATCH(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, error: "未登录" }, { status: 401 });
  const { id, running, capital } = await req.json().catch(() => ({}));
  await update<any>("strategySubs", (s) => s.id === id && s.userId === user.id, { running, capital });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, error: "未登录" }, { status: 401 });
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ ok: false, error: "缺少 id" }, { status: 400 });
  await remove("strategySubs", (s) => s.id === id && s.userId === user.id);
  return NextResponse.json({ ok: true });
}

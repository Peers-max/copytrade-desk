import { NextRequest, NextResponse } from "next/server";
import { filter, insert, uid, update } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { PLANS } from "@/lib/seed";
import type { Invoice, User } from "@/lib/types";

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, error: "未登录" }, { status: 401 });
  const { planId, cycle } = await req.json().catch(() => ({}));
  const plan = PLANS.find((p) => p.id === planId);
  if (!plan) return NextResponse.json({ ok: false, error: "套餐不存在" }, { status: 400 });
  const c = cycle === "yearly" ? "yearly" : "monthly";
  const amount = c === "yearly" ? plan.priceYearly : plan.priceMonthly;
  const days = c === "yearly" ? 365 : 30;
  const base = Math.max(Date.now(), user.planExpiresAt || Date.now());

  await update<User>("users", (u) => u.id === user.id, {
    planId: plan.id,
    planExpiresAt: base + days * 86400000,
  });

  const inv: Invoice = {
    id: uid("in"),
    userId: user.id,
    planId: plan.id,
    amount,
    cycle: c,
    status: "paid",
    createdAt: Date.now(),
    method: "USDT (TRC20)",
  };
  await insert<Invoice>("invoices", inv);

  await insert("notifications", {
    id: uid("nt"),
    userId: user.id,
    type: "billing",
    title: "订阅已更新",
    body: `已切换至 ${plan.name}（${c === "yearly" ? "年付" : "月付"}），支付 ${amount} USDT。`,
    read: false,
    ts: Date.now(),
  });

  return NextResponse.json({ ok: true, invoice: inv, plan });
}

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, error: "未登录" }, { status: 401 });
  const invoices = (await filter<Invoice>("invoices", (i) => i.userId === user.id)).sort((a, b) => b.createdAt - a.createdAt);
  return NextResponse.json({
    ok: true,
    plans: PLANS,
    current: user.planId,
    expiresAt: user.planExpiresAt,
    invoices,
  });
}

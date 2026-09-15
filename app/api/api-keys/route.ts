import { NextRequest, NextResponse } from "next/server";
import { filter, insert, remove, uid, update } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { EXCHANGES } from "@/lib/seed";
import type { ApiKey } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, error: "未登录" }, { status: 401 });
  return NextResponse.json({ ok: true, apiKeys: await filter<ApiKey>("apiKeys", (k) => k.userId === user.id), exchanges: EXCHANGES });
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, error: "未登录" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const { exchange, label, apiKey, secret, passphrase } = body;
  if (!exchange || !apiKey || !secret) {
    return NextResponse.json({ ok: false, error: "交易所 / API Key / Secret 必填" }, { status: 400 });
  }
  const masked = apiKey.slice(0, 3) + "***" + apiKey.slice(-4);
  const rec: ApiKey = {
    id: uid("ak"),
    userId: user.id,
    exchange,
    label: label || "默认账户",
    masked,
    permissions: ["读取", "交易"],
    status: "active",
    createdAt: Date.now(),
    lastSyncAt: Date.now(),
    ipWhitelist: "43.135.18.22 / 129.204.66.19",
  };
  await insert<ApiKey>("apiKeys", rec);
  return NextResponse.json({ ok: true, apiKey: rec, note: passphrase ? "已保存 Passphrase" : undefined });
}

export async function PATCH(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, error: "未登录" }, { status: 401 });
  const { id, status } = await req.json().catch(() => ({}));
  await update<ApiKey>("apiKeys", (k) => k.id === id && k.userId === user.id, { status });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, error: "未登录" }, { status: 401 });
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ ok: false, error: "缺少 id" }, { status: 400 });
  await remove("apiKeys", (k) => k.id === id && k.userId === user.id);
  return NextResponse.json({ ok: true });
}

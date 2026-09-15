import { NextRequest, NextResponse } from "next/server";
import { filter, remove, update } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { bindApiKey, refreshApiKey } from "@/lib/keys";
import { EXCHANGES } from "@/lib/seed";
import type { ApiKey } from "@/lib/types";

export const dynamic = "force-dynamic";

/** 永远不下发密文与明文凭据 */
function publicKey(k: ApiKey) {
  const { apiKeyCipher, secretCipher, passphraseCipher, ...rest } = k;
  return rest;
}

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, error: "未登录" }, { status: 401 });
  const keys = await filter<ApiKey>("apiKeys", (k) => k.userId === user.id);
  return NextResponse.json({ ok: true, apiKeys: keys.map(publicKey), exchanges: EXCHANGES });
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, error: "未登录" }, { status: 401 });

  const body = await req.json().catch(() => ({}));

  // 绑定即校验：会用你给的 Key 真去交易所签一次名，拉账户快照
  const result = await bindApiKey(user.id, {
    exchange: body.exchange,
    label: body.label,
    apiKey: body.apiKey,
    secret: body.secret,
    passphrase: body.passphrase,
  });

  if (!result.ok || !result.apiKey || !result.snapshot) {
    return NextResponse.json({ ok: false, error: result.error ?? "绑定失败" }, { status: 400 });
  }

  const { apiKey, snapshot } = result;
  return NextResponse.json({
    ok: true,
    apiKey: publicKey(apiKey),
    snapshot: {
      uid: snapshot.uid,
      accountMode: snapshot.accountMode,
      equityUsdt: snapshot.equityUsdt,
      availableUsdt: snapshot.availableUsdt,
      positions: snapshot.positions.length,
      permissions: snapshot.permissions,
    },
  });
}

/** PATCH：暂停 / 启用，或 { action: "refresh" } 重新拉一次账户快照 */
export async function PATCH(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, error: "未登录" }, { status: 401 });
  const body = await req.json().catch(() => ({}));

  if (body.action === "refresh") {
    const r = await refreshApiKey(body.id, user.id);
    if (!r.ok) return NextResponse.json({ ok: false, error: r.error }, { status: 400 });
    return NextResponse.json({ ok: true, apiKey: r.apiKey ? publicKey(r.apiKey) : undefined });
  }

  const status = body.status === "active" ? "active" : body.status === "invalid" ? "invalid" : "paused";
  await update<ApiKey>("apiKeys", (k) => k.id === body.id && k.userId === user.id, { status });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, error: "未登录" }, { status: 401 });
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ ok: false, error: "缺少 id" }, { status: 400 });
  await remove("apiKeys", (k) => k.id === id && k.userId === user.id);
  return NextResponse.json({ ok: true });
}

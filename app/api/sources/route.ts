import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createSource, deleteSource, listSources, rotateWebhookToken, updateSource } from "@/lib/sources";
import { SYMBOLS } from "@/lib/seed";
import type { QuantConfig, SignalSource, Trader } from "@/lib/types";

export const dynamic = "force-dynamic";

function origin(req: NextRequest): string {
  return process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || req.nextUrl.origin;
}

/** 对外暴露时去掉 webhookToken 之外的敏感内容；token 本身站主要用，保留。 */
function withUrl(t: Trader, base: string) {
  return {
    ...t,
    webhookUrl: t.webhookToken ? `${base}/api/webhook/signal?token=${t.webhookToken}` : undefined,
  };
}

export async function GET(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ ok: false, error: "需要站主权限" }, { status: 403 });
  const base = origin(req);
  const sources = (await listSources()).map((t) => withUrl(t, base));
  return NextResponse.json({ ok: true, sources, symbols: SYMBOLS, baseUrl: base });
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ ok: false, error: "需要站主权限" }, { status: 403 });

  const b = await req.json().catch(() => ({}));
  const name = String(b.name ?? "").trim();
  if (!name) return NextResponse.json({ ok: false, error: "请填写信号源名称" }, { status: 400 });

  const source: SignalSource = ["quant", "webhook", "manual"].includes(b.source) ? b.source : "manual";
  const symbols: string[] = Array.isArray(b.symbols) && b.symbols.length ? b.symbols : ["BTC/USDT"];

  let quant: QuantConfig | undefined;
  if (source === "quant") {
    const kind = ["ema_cross", "rsi_revert", "breakout", "grid"].includes(b.quant?.kind)
      ? b.quant.kind
      : "ema_cross";
    quant = {
      kind,
      interval: b.quant?.interval || "15m",
      params: typeof b.quant?.params === "object" && b.quant.params ? b.quant.params : {},
    };
  }

  const trader = await createSource(admin.id, {
    name,
    tagline: b.tagline,
    source,
    risk: b.risk,
    symbols,
    quant,
    note: b.note,
    style: b.style,
  });

  return NextResponse.json({ ok: true, source: withUrl(trader, origin(req)) });
}

export async function PATCH(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ ok: false, error: "需要站主权限" }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  const id = String(b.id ?? "");
  if (!id) return NextResponse.json({ ok: false, error: "缺少 id" }, { status: 400 });

  if (b.action === "rotate") {
    const token = await rotateWebhookToken(id);
    return NextResponse.json({ ok: true, token, webhookUrl: `${origin(req)}/api/webhook/signal?token=${token}` });
  }

  const patch: Partial<Trader> = {};
  for (const k of ["name", "tagline", "status", "risk", "style", "note", "symbols", "quant"] as const) {
    if (b[k] !== undefined) (patch as any)[k] = b[k];
  }
  await updateSource(id, patch);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ ok: false, error: "需要站主权限" }, { status: 403 });
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ ok: false, error: "缺少 id" }, { status: 400 });
  await deleteSource(id);
  return NextResponse.json({ ok: true });
}

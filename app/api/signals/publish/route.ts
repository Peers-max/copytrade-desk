import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { emitSignal } from "@/lib/executor";
import { getSource } from "@/lib/sources";

export const dynamic = "force-dynamic";

/**
 * 手动发布信号（站主专用）。
 *
 * 场景：你在别处看到一个值得跟的仓位（某个 KOL 的公开带单、你自己的人肉判断），
 * 希望它立刻同步到你/用户的交易所账户 —— 就在这里填一笔。
 */
export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ ok: false, error: "需要站主权限" }, { status: 403 });

  const b = await req.json().catch(() => ({}));
  const trader = await getSource(String(b.traderId ?? ""));
  if (!trader) return NextResponse.json({ ok: false, error: "信号源不存在" }, { status: 404 });
  if (trader.status !== "live") {
    return NextResponse.json({ ok: false, error: "该信号源已暂停，请先启用" }, { status: 409 });
  }
  // OKX 带单员的跟单由 OKX 原生引擎负责，本站再发一次信号会导致重复开仓
  if (trader.source === "okx") {
    return NextResponse.json(
      {
        ok: false,
        error: `「${trader.name}」是 OKX 带单员，跟单由 OKX 原生引擎实时同步，不需要也不允许手动发信号。请到「跟单交易」页建立跟单关系。`,
      },
      { status: 400 }
    );
  }

  const side = String(b.side ?? "").toUpperCase() === "SHORT" ? "SHORT" : "LONG";
  const action = ["OPEN", "CLOSE", "ADD", "REDUCE"].includes(String(b.action ?? "").toUpperCase())
    ? (String(b.action).toUpperCase() as "OPEN" | "CLOSE" | "ADD" | "REDUCE")
    : "OPEN";

  try {
    const report = await emitSignal({
      trader,
      symbol: String(b.symbol ?? trader.symbols[0] ?? "BTC/USDT"),
      side,
      action,
      price: Number(b.price) || undefined,
      leverage: Number(b.leverage) || undefined,
      source: "manual",
      note: typeof b.note === "string" ? b.note.slice(0, 200) : `由 ${admin.nickname} 手动发布`,
      onlyUserId: b.onlyMe === true ? admin.id : undefined,
    });

    return NextResponse.json({
      ok: true,
      signalId: report.signal.id,
      dispatched: report.dispatched,
      succeeded: report.succeeded,
      failed: report.failed,
      results: report.signal.results,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 });
  }
}

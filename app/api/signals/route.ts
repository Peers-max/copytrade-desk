import { NextRequest, NextResponse } from "next/server";
import { all, insert, uid } from "@/lib/db";
import { seedIfNeeded } from "@/lib/seed";
import type { Signal } from "@/lib/types";

export const dynamic = "force-dynamic";

const SYMBOLS = ["BTC/USDT", "ETH/USDT", "SOL/USDT", "BNB/USDT", "XRP/USDT", "TON/USDT"];
const ACTIONS: Signal["action"][] = ["OPEN", "CLOSE", "ADD", "REDUCE"];

export async function GET(req: NextRequest) {
  seedIfNeeded();
  const limit = Number(req.nextUrl.searchParams.get("limit") ?? 8);

  // 每 ~8 秒概率性生成一条新信号，模拟真实信号流
  const last = (await all<Signal>("signals")).sort((a, b) => b.ts - a.ts)[0];
  if (!last || Date.now() - last.ts > 8000) {
    const traders = await all<{ id: string; name: string }>("traders");
    const t = traders[Math.floor(Math.random() * traders.length)];
    const sym = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
    const price =
      sym === "BTC/USDT"
        ? 68000 + Math.random() * 800
        : sym === "ETH/USDT"
        ? 3500 + Math.random() * 60
        : sym === "SOL/USDT"
        ? 165 + Math.random() * 6
        : sym === "BNB/USDT"
        ? 588 + Math.random() * 10
        : sym === "XRP/USDT"
        ? 0.61 + Math.random() * 0.02
        : 7.1 + Math.random() * 0.2;
    await insert<Signal>("signals", {
      id: uid("sg"),
      ts: Date.now(),
      traderId: t?.id ?? "tr_1",
      traderName: t?.name ?? "TrendMaster",
      symbol: sym,
      side: Math.random() > 0.42 ? "LONG" : "SHORT",
      action: ACTIONS[Math.floor(Math.random() * ACTIONS.length)],
      price: Number(price.toFixed(price > 100 ? 1 : 4)),
      leverage: [1, 2, 3, 5, 10][Math.floor(Math.random() * 5)],
      status: Math.random() > 0.15 ? "filled" : "pending",
    });
  }

  const signals = (await all<Signal>("signals"))
    .sort((a, b) => b.ts - a.ts)
    .slice(0, Math.min(limit, 30));
  return NextResponse.json({ ok: true, signals });
}

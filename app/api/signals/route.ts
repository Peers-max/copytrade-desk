import { NextRequest, NextResponse } from "next/server";
import { all } from "@/lib/db";
import { bootstrapIfNeeded } from "@/lib/seed";
import type { Signal } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * 信号流（只读）。
 *
 * ⚠️ 早期版本在这里「每 8 秒概率性生成一条新信号」并且随机编造价格、
 * 方向、杠杆 —— 那纯粹是给演示 UI 造数据用的。实盘环境下这是最危险的一类
 * 代码：用户会以为那是一条真信号。现在它只读数据库，没有信号就返回空数组。
 *
 * 信号的唯一来源是 lib/executor.ts 的 emitSignal()，只有三条入口：
 * 量化引擎、Webhook、站主手动发布。
 */
export async function GET(req: NextRequest) {
  await bootstrapIfNeeded();
  const limit = Math.min(Number(req.nextUrl.searchParams.get("limit") ?? 20) || 20, 100);
  const traderId = req.nextUrl.searchParams.get("traderId");

  let signals = await all<Signal>("signals");
  if (traderId) signals = signals.filter((s) => s.traderId === traderId);

  signals = signals.sort((a, b) => b.ts - a.ts).slice(0, limit);
  return NextResponse.json({ ok: true, signals });
}

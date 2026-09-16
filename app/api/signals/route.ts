import { NextRequest, NextResponse } from "next/server";
import { all, remove } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
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

/**
 * 删除信号记录（仅站主）。
 *
 * 用途：接入调试、Webhook 联调、误发信号之后清理痕迹。
 * 只删「信号流」这一张记录表，不碰成交记录（trades）与跟单关系。
 *
 *   DELETE /api/signals?id=sg_xxx        删单条
 *   DELETE /api/signals?traderId=tr_xxx  删某个信号源的全部信号
 *   DELETE /api/signals?all=1            清空全部信号
 */
export async function DELETE(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ ok: false, error: "需要站主权限" }, { status: 403 });

  const id = req.nextUrl.searchParams.get("id");
  const traderId = req.nextUrl.searchParams.get("traderId");
  const allFlag = req.nextUrl.searchParams.get("all");

  if (!id && !traderId && !allFlag) {
    return NextResponse.json(
      { ok: false, error: "请指定 id、traderId 或 all=1" },
      { status: 400 },
    );
  }

  const before = (await all<Signal>("signals")).length;

  if (id) await remove("signals", (s: any) => s.id === id);
  else if (traderId) await remove("signals", (s: any) => s.traderId === traderId);
  else if (allFlag) await remove("signals", () => true);

  const after = (await all<Signal>("signals")).length;
  return NextResponse.json({ ok: true, deleted: before - after, remaining: after });
}

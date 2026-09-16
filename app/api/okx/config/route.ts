import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { fetchPublicConfig } from "@/lib/okx-copy";
import type { OkxInstType } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * OKX 跟单平台限额（公开接口，无需鉴权）。
 *
 * 前端在提交跟单前必须据此校验，否则会明知必然失败还往 OKX 打请求。
 * 实测值（2026-09）：minCopyAmt=10、maxCopyAmt=100000、maxCopyRatio=100、
 * maxCopyTotalAmt=2000000、maxSlRatio=0.75、maxTpRatio=1.5。
 *
 * 限额按品类分开取（?instType=SWAP|SPOT），现货与合约的上限不一定相同。
 */
export async function GET(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ ok: false, error: "需要站主权限" }, { status: 403 });

  const instType: OkxInstType =
    (req.nextUrl.searchParams.get("instType") ?? "").toUpperCase() === "SPOT" ? "SPOT" : "SWAP";

  try {
    const limits = await fetchPublicConfig(instType);
    return NextResponse.json({ ok: true, instType, limits });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: `读取 OKX 跟单限额失败：${String(e?.message ?? e)}` },
      { status: 502 }
    );
  }
}

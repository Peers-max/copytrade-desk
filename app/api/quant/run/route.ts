import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { safeEqual } from "@/lib/crypto";
import { runQuantEngine } from "@/lib/quant";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * 跑一轮量化引擎。
 *
 * 两种调用方式：
 * 1. 站主在「信号源管理」页点按钮 —— 走 cookie 会话鉴权
 * 2. 定时任务（GitHub Actions）—— 走 `x-tick-token` 请求头，
 *    对应 Worker 密钥 `TICK_TOKEN`，避免把站主密码暴露给 CI
 */
function tickAuthorized(req: NextRequest): boolean {
  const expected = process.env.TICK_TOKEN;
  if (!expected) return false;
  const got = req.headers.get("x-tick-token") ?? "";
  return safeEqual(got, expected);
}

async function handle(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin && !tickAuthorized(req)) {
    return NextResponse.json({ ok: false, error: "需要站主权限或有效的定时任务令牌" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  try {
    const report = await runQuantEngine({ traderId: body?.traderId });
    return NextResponse.json({ ok: true, report });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  return handle(req);
}

export async function GET(req: NextRequest) {
  return handle(req);
}

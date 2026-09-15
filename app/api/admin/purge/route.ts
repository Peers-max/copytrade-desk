import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { requireAdmin, SESSION_COOKIE, createSession } from "@/lib/auth";
import { purgeBusinessData } from "@/lib/settings";
import { update } from "@/lib/db";
import type { User } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * 清空全部业务数据（不可逆）。
 *
 * 只会保留站主账号本身。调用前请先导出备份：
 *   线上数据存在 Workers KV 的 db:v2 键里，见 scripts/backup-kv.mjs。
 *
 * 必须带 ?confirm=PURGE，避免误触。
 *
 * 注意：清库会连 sessions 一起清掉，所以这里在清完后立刻给站主重发一个会话，
 * 否则用户会被自己踢下线、还得重新登录。
 */
export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ ok: false, error: "需要站主权限" }, { status: 403 });

  if (req.nextUrl.searchParams.get("confirm") !== "PURGE") {
    return NextResponse.json(
      { ok: false, error: "该操作不可逆，请在 URL 上追加 ?confirm=PURGE 明确确认" },
      { status: 400 }
    );
  }

  const report = await purgeBusinessData();

  // 保活：重建站主账号与会话
  const now = Date.now();
  const kept: User = {
    ...admin,
    role: "admin",
    balance: 0,
    createdAt: admin.createdAt ?? now,
  };
  await update<User>("users", (u) => u.id === admin.id, kept).catch(() => undefined);
  const sess = await createSession(admin.id).catch(() => null);
  if (sess) {
    const jar = await cookies();
    jar.set(SESSION_COOKIE, sess.token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
  }

  return NextResponse.json({ ok: true, report });
}

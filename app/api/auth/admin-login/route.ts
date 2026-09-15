import { NextRequest, NextResponse } from "next/server";
import {
  SESSION_COOKIE,
  adminLoginEnabled,
  createSession,
  ensureAdminUser,
  verifyAdminCredentials,
} from "@/lib/auth";
import { seedIfNeeded } from "@/lib/seed";

/**
 * 站主账号登录（用户名 + 密码）。
 * 凭据来自 Worker 密钥 ADMIN_USER / ADMIN_PASS，不随代码一起发布。
 */
export async function POST(req: NextRequest) {
  await seedIfNeeded();

  if (!adminLoginEnabled()) {
    return NextResponse.json(
      { ok: false, error: "未配置管理员凭据（需设置 ADMIN_USER / ADMIN_PASS）" },
      { status: 503 },
    );
  }

  const { username, password } = await req.json().catch(() => ({}));
  if (!username || !password) {
    return NextResponse.json({ ok: false, error: "请输入用户名与密码" }, { status: 400 });
  }

  if (!verifyAdminCredentials(String(username), String(password))) {
    return NextResponse.json({ ok: false, error: "用户名或密码错误" }, { status: 401 });
  }

  const user = await ensureAdminUser(String(username).trim());
  const session = await createSession(user.id);

  const res = NextResponse.json({
    ok: true,
    user: { id: user.id, email: user.email, nickname: user.nickname },
  });
  res.cookies.set(SESSION_COOKIE, session.token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    expires: new Date(session.expiresAt),
  });
  return res;
}

import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, checkEmailCode, createSession, ensureUser } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const { email, code } = await req.json().catch(() => ({}));
  if (!email || !code) {
    return NextResponse.json({ ok: false, error: "邮箱与验证码不能为空" }, { status: 400 });
  }
  if (!await checkEmailCode(email, code)) {
    return NextResponse.json({ ok: false, error: "验证码错误或已过期" }, { status: 400 });
  }
  const user = await ensureUser(email);
  const session = await createSession(user.id);
  const res = NextResponse.json({ ok: true, user: { id: user.id, email: user.email, nickname: user.nickname } });
  res.cookies.set(SESSION_COOKIE, session.token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    expires: new Date(session.expiresAt),
  });
  return res;
}

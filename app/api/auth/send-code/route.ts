import { NextRequest, NextResponse } from "next/server";
import { issueEmailCode } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const { email } = await req.json().catch(() => ({}));
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ ok: false, error: "请输入有效的邮箱地址" }, { status: 400 });
  }
  const { code, expiresAt } = await issueEmailCode(email);
  return NextResponse.json({
    ok: true,
    // 演示环境直接回传验证码，真实环境应通过邮件发送
    code,
    demo: true,
    expiresAt,
  });
}

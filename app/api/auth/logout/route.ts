import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE, destroySession } from "@/lib/auth";

export async function POST() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await destroySession(token);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}

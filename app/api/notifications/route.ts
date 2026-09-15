import { NextRequest, NextResponse } from "next/server";
import { filter, update } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import type { Notification } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, error: "未登录" }, { status: 401 });
  const items = (await filter<Notification>("notifications", (n) => n.userId === user.id)).sort((a, b) => b.ts - a.ts);
  return NextResponse.json({ ok: true, notifications: items, unread: items.filter((n) => !n.read).length });
}

export async function PATCH(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, error: "未登录" }, { status: 401 });
  const { id, all: markAll } = await req.json().catch(() => ({}));
  if (markAll) {
    const unread = await filter<Notification>("notifications", (n) => n.userId === user.id && !n.read);
    for (const n of unread) {
      await update<Notification>("notifications", (x) => x.id === n.id, { read: true });
    }
  }
  return NextResponse.json({ ok: true });
}

import { NotificationsClient } from "@/components/console/notifications-client";
import { getSessionUser } from "@/lib/auth";
import { filter } from "@/lib/db";
import { bootstrapIfNeeded } from "@/lib/seed";
import type { Notification } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "消息通知" };

export default async function NotificationsPage() {
  await bootstrapIfNeeded();
  const user = (await getSessionUser())!;
  const items = (await filter<Notification>("notifications", (n) => n.userId === user.id)).sort((a, b) => b.ts - a.ts);
  return <NotificationsClient items={items} />;
}

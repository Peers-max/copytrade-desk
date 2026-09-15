"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Bell, CheckCheck, Megaphone, ShieldAlert, Wallet } from "lucide-react";
import { Badge, cn } from "@/components/ui";
import { PageHeader } from "@/components/console/ui";
import { timeAgo } from "@/lib/format";
import type { Notification } from "@/lib/types";

const ICONS: Record<Notification["type"], any> = {
  signal: Bell,
  risk: ShieldAlert,
  system: Megaphone,
  billing: Wallet,
};

const TONE: Record<Notification["type"], string> = {
  signal: "bg-wise-mint text-wise-darkgreen",
  risk: "bg-[#f6465d]/12 text-[#f6465d]",
  system: "bg-surface text-muted-foreground",
  billing: "bg-warning/15 text-[#8a6d00]",
};

export function NotificationsClient({ items: initial }: { items: Notification[] }) {
  const router = useRouter();
  const [items, setItems] = useState(initial);
  const [filterType, setFilterType] = useState<"all" | Notification["type"]>("all");

  async function markRead(id?: string) {
    setItems((prev) => prev.map((n) => (!id || n.id === id ? { ...n, read: true } : n)));
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(id ? { id } : { all: true }),
    });
    router.refresh();
  }

  const list = items.filter((n) => filterType === "all" || n.type === filterType);
  const unread = items.filter((n) => !n.read).length;

  return (
    <>
      <PageHeader
        title="消息通知"
        desc={`共 ${items.length} 条消息 · ${unread} 条未读`}
        actions={
          <button onClick={() => markRead()} className="btn-ghost">
            <CheckCheck size={15} /> 全部标为已读
          </button>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {(
          [
            ["all", "全部"],
            ["signal", "交易信号"],
            ["risk", "风险提醒"],
            ["billing", "账单"],
            ["system", "系统"],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setFilterType(k as any)}
            className={cn(
              "rounded-pill border px-3.5 py-2 text-[13px] font-medium transition",
              filterType === k ? "border-transparent bg-foreground text-background" : "border-border bg-card text-muted-foreground"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {list.map((n) => {
          const Icon = ICONS[n.type];
          return (
            <div
              key={n.id}
              className={cn(
                "flex gap-3.5 rounded-3xl border bg-card p-4 transition",
                n.read ? "border-border" : "border-wise-green/50 bg-wise-mint/25"
              )}
            >
              <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl", TONE[n.type])}>
                <Icon size={16} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-[14px] font-semibold">{n.title}</span>
                  {!n.read ? <Badge tone="green">未读</Badge> : null}
                </div>
                <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{n.body}</p>
                <div className="mt-1.5 text-[11.5px] text-muted-foreground">{timeAgo(n.ts)}</div>
              </div>
              {!n.read ? (
                <button
                  onClick={() => markRead(n.id)}
                  className="h-fit rounded-pill border border-border px-3 py-1.5 text-[12px] font-medium transition hover:bg-surface"
                >
                  标为已读
                </button>
              ) : null}
            </div>
          );
        })}
        {list.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-border py-14 text-center text-[13.5px] text-muted-foreground">
            暂无消息
          </div>
        ) : null}
      </div>
    </>
  );
}

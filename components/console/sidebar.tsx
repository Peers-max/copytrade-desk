"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  ChartBar,
  Bell,
  ChartCandlestick,
  ChevronDown,
  Copy,
  KeyRound,
  Layers,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Menu,
  ShoppingBag,
  Store,
  Radio,
  User as UserIcon,
  Wallet,
  X,
} from "lucide-react";
import { Logo } from "@/components/logo";
import { cn } from "@/components/ui";
import { ThemeToggle } from "@/components/theme";

const GROUPS = [
  {
    title: "交易",
    items: [
      { href: "/dashboard", label: "仪表盘", icon: LayoutDashboard },
      { href: "/copy-trading", label: "跟单交易", icon: Copy },
      { href: "/sources", label: "信号源管理", icon: Radio },
      { href: "/strategies", label: "策略市场", icon: Store },
      { href: "/my-strategy", label: "我的策略", icon: Layers },
    ],
  },
  {
    title: "账户",
    items: [
      { href: "/api-keys", label: "API 管理", icon: KeyRound },
      { href: "/wallet", label: "钱包订阅", icon: Wallet },
      { href: "/profile", label: "个人中心", icon: UserIcon },
    ],
  },
  {
    title: "市场",
    items: [
      { href: "/market", label: "实时行情", icon: ChartCandlestick },
      { href: "/data-board", label: "数据看板", icon: ChartBar },
      { href: "/notifications", label: "消息通知", icon: Bell },
    ],
  },
  {
    title: "更多",
    items: [
      { href: "/mall", label: "积分商城", icon: ShoppingBag },
      { href: "/promotion", label: "推广返佣", icon: Megaphone },
    ],
  },
];

export function ConsoleSidebar({
  user,
  unread,
}: {
  user: { nickname: string; email: string; planName: string; avatarHue: number };
  unread: number;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const nav = (
    <nav className="flex flex-col gap-6">
      {GROUPS.map((g) => (
        <div key={g.title}>
          <div className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
            {g.title}
          </div>
          <div className="space-y-0.5">
            {g.items.map((it) => {
              const active = pathname === it.href;
              return (
                <Link
                  key={it.href}
                  href={it.href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "flex items-center gap-2.5 rounded-xl px-3 py-2 text-[13.5px] font-medium transition",
                    active
                      ? "bg-wise-green text-wise-darkgreen"
                      : "text-muted-foreground hover:bg-surface hover:text-foreground"
                  )}
                >
                  <it.icon size={16} />
                  <span className="flex-1">{it.label}</span>
                  {it.href === "/notifications" && unread > 0 ? (
                    <span className="flex h-4 min-w-4 items-center justify-center rounded-pill bg-[#f6465d] px-1 text-[10px] font-bold text-white">
                      {unread}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );

  return (
    <>
      {/* desktop */}
      <aside className="hidden w-[236px] shrink-0 border-r border-border bg-background lg:block">
        <div className="sticky top-0 flex h-screen flex-col px-3 py-4">
          <Link href="/" className="mb-5 flex items-center gap-2 px-3">
            <Logo size={26} />
            <span className="text-[16px] font-bold">币策</span>
            <span className="ml-auto inline-flex items-center gap-1 rounded-pill bg-[#f6465d]/12 px-2 py-0.5 text-[10px] font-bold text-[#f6465d]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#f6465d]" />
              实盘
            </span>
          </Link>
          <div className="flex-1 overflow-y-auto pr-1 no-scrollbar">{nav}</div>
          <UserBox user={user} />
        </div>
      </aside>

      {/* mobile */}
      <div className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-border bg-background px-4 lg:hidden">
        <Link href="/" className="flex items-center gap-2">
          <Logo size={24} />
          <span className="text-[15px] font-bold">币策</span>
        </Link>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <button
            onClick={() => setOpen((v) => !v)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-card"
            aria-label="菜单"
          >
            {open ? <X size={16} /> : <Menu size={16} />}
          </button>
        </div>
        {open ? (
          <div className="absolute inset-x-0 top-14 max-h-[80vh] overflow-y-auto border-b border-border bg-background px-4 pb-6 pt-4">
            {nav}
            <div className="mt-6">
              <UserBox user={user} />
            </div>
          </div>
        ) : null}
      </div>
    </>
  );
}

function UserBox({ user }: { user: { nickname: string; email: string; planName: string; avatarHue: number } }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative mt-4 border-t border-border pt-3">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-left transition hover:bg-surface"
      >
        <div
          className="flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-bold text-wise-darkgreen"
          style={{ background: `hsl(${user.avatarHue} 72% 78%)` }}
        >
          {user.nickname.slice(0, 2).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-semibold">{user.nickname}</div>
          <div className="truncate text-[11px] text-muted-foreground">{user.email}</div>
        </div>
        <ChevronDown size={14} className="text-muted-foreground" />
      </button>
      {open ? (
        <div className="absolute bottom-full left-0 right-0 mb-1 overflow-hidden rounded-2xl border border-border bg-card p-1.5 shadow-card">
          <div className="px-2.5 py-2 text-[11.5px] text-muted-foreground">
            当前套餐：<span className="font-semibold text-foreground">{user.planName}</span>
          </div>
          <Link
            href="/profile"
            className="flex items-center gap-2 rounded-xl px-2.5 py-2 text-[13px] transition hover:bg-surface"
          >
            <UserIcon size={14} /> 个人中心
          </Link>
          <Link
            href="/wallet"
            className="flex items-center gap-2 rounded-xl px-2.5 py-2 text-[13px] transition hover:bg-surface"
          >
            <Wallet size={14} /> 钱包订阅
          </Link>
          <button
            onClick={async () => {
              await fetch("/api/auth/logout", { method: "POST" });
              location.href = "/";
            }}
            className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-[13px] text-[#f6465d] transition hover:bg-surface"
          >
            <LogOut size={14} /> 退出登录
          </button>
        </div>
      ) : null}
    </div>
  );
}

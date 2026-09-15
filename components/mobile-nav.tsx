"use client";

import Link from "next/link";
import { Menu, X } from "lucide-react";
import { useState } from "react";
import { ThemeToggle } from "./theme";

const NAV = [
  { href: "/#features", label: "核心能力" },
  { href: "/#advantages", label: "为什么币策" },
  { href: "/pricing", label: "定价" },
  { href: "/tutorials", label: "新手教程" },
  { href: "/login", label: "登录" },
  { href: "/dashboard", label: "开始跟单" },
];

export function MobileNav() {
  const [open, setOpen] = useState(false);
  return (
    <div className="md:hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="菜单"
        className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-card"
      >
        {open ? <X size={17} /> : <Menu size={17} />}
      </button>
      {open ? (
        <div className="fixed inset-x-0 top-16 z-40 border-b border-border bg-background px-5 pb-5 pt-3">
          <div className="flex flex-col">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                onClick={() => setOpen(false)}
                className="border-b border-border/60 py-3 text-[15px] font-medium last:border-0"
              >
                {n.label}
              </Link>
            ))}
          </div>
          <div className="mt-4">
            <ThemeToggle />
          </div>
        </div>
      ) : null}
    </div>
  );
}

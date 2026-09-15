import Link from "next/link";
import { Logo } from "./logo";
import { ThemeToggle } from "./theme";
import { MobileNav } from "./mobile-nav";

const NAV = [
  { href: "/#features", label: "核心能力" },
  { href: "/#advantages", label: "为什么币策" },
  { href: "/pricing", label: "定价" },
  { href: "/cost", label: "成本报告" },
  { href: "/tutorials", label: "新手教程" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-border/70 bg-background/80 backdrop-blur-xl">
      <div className="container-x flex h-16 items-center justify-between gap-4">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2">
            <Logo />
            <span className="text-[17px] font-bold tracking-tight">币策</span>
          </Link>
          <nav className="hidden items-center gap-7 md:flex">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className="text-[14px] font-medium text-muted-foreground transition hover:text-foreground"
              >
                {n.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle className="hidden sm:inline-flex" />
          <Link
            href="/login"
            className="hidden rounded-pill px-4 py-2 text-sm font-semibold text-muted-foreground transition hover:text-foreground sm:inline-flex"
          >
            登录
          </Link>
          <Link href="/dashboard" className="btn-primary hidden sm:inline-flex">
            开始跟单
          </Link>
          <MobileNav />
        </div>
      </div>
    </header>
  );
}

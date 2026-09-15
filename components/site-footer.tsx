import Link from "next/link";
import { Logo } from "./logo";

const GROUPS = [
  {
    title: "产品",
    links: [
      { href: "/#features", label: "核心能力" },
      { href: "/#how-it-works", label: "三步上手" },
      { href: "/market", label: "实时行情" },
      { href: "/strategies", label: "策略市场" },
    ],
  },
  {
    title: "资源",
    links: [
      { href: "/tutorials", label: "新手教程" },
      { href: "/pricing", label: "订阅定价" },
      { href: "/cost", label: "成本与定价报告" },
      { href: "/promotion", label: "推广返佣" },
      { href: "/data-board", label: "数据看板" },
    ],
  },
  {
    title: "法务",
    links: [
      { href: "/terms", label: "服务条款" },
      { href: "/privacy", label: "隐私政策" },
      { href: "/agreement/copy-trading", label: "跟单服务协议" },
      { href: "/agreement/quantitative-trading", label: "量化交易协议" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-background">
      <div className="container-x py-14">
        <div className="grid gap-10 md:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div>
            <div className="flex items-center gap-2">
              <Logo size={26} />
              <span className="text-[16px] font-bold">币策</span>
            </div>
            <p className="mt-3 max-w-xs text-[13px] leading-relaxed text-muted-foreground">
              专业加密货币跟单交易平台。资金留在你自己的交易所，我们只执行交易，利润 100% 归你。
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              {["Binance", "OKX", "Bybit", "Bitget", "Gate", "HTX", "BitMart", "Hotcoin"].map((e) => (
                <span key={e} className="chip">
                  {e}
                </span>
              ))}
            </div>
          </div>
          {GROUPS.map((g) => (
            <div key={g.title}>
              <div className="text-[13px] font-semibold">{g.title}</div>
              <ul className="mt-3 space-y-2.5">
                {g.links.map((l) => (
                  <li key={l.href + l.label}>
                    <Link
                      href={l.href}
                      className="text-[13px] text-muted-foreground transition hover:text-foreground"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-10 flex flex-col items-start justify-between gap-3 border-t border-border pt-6 text-[12px] text-muted-foreground sm:flex-row sm:items-center">
          <div>© {new Date().getFullYear()} 币策 Coince. 保留所有权利。</div>
          <div className="flex flex-wrap items-center gap-4">
            <span>数字资产交易存在风险，请谨慎评估自身风险承受能力。</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

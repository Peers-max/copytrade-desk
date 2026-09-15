import Link from "next/link";
import { Check, Minus, Sparkles } from "lucide-react";
import { SectionTitle, cn } from "@/components/ui";
import { PricingToggle } from "./pricing-toggle";
import { PLANS } from "@/lib/seed";

export const metadata = { title: "订阅定价" };

const FAQ = [
  {
    q: "币策会抽走我的利润吗？",
    a: "不会。币策永久零分润，下单、改单、平仓全链路零抽成，交易利润 100% 归你。我们只收取固定的软件订阅费。",
  },
  {
    q: "资金安全如何保障？",
    a: "资产始终留在你自己的交易所账户中。API 只申请读取与交易权限，永不申请提现权限，并支持 IP 白名单与权限随时撤销。",
  },
  {
    q: "跟单有人员上限吗？",
    a: "没有。不同于 CEX 跟单 200–500 人的名额限制，币策不设跟单人数上限，也无固定锁定期，随时可以跟单或取消。",
  },
  {
    q: "支持哪些交易所？",
    a: "目前支持 Binance、OKX、Bybit、Bitget、Gate、HTX、BitMart、Hotcoin 共 8 家主流交易所，可在「API 管理」中一键绑定。",
  },
  {
    q: "可以随时升级或降级吗？",
    a: "可以。升级立即生效并按差价折算；降级在当前计费周期结束后生效，不会中断正在运行的跟单。",
  },
  {
    q: "信号延迟有多大？",
    a: "专业版为标准秒级同步；旗舰版走专线直连，延迟最低。基础版为 3–5 秒延迟通道。",
  },
];

const COMPARE = [
  { k: "跟单席位", basic: "2 个", pro: "8 个", elite: "不限" },
  { k: "交易所 API 绑定", basic: "1 个", pro: "4 个", elite: "不限" },
  { k: "量化策略", basic: "1 个", pro: "5 个", elite: "不限" },
  { k: "信号延迟", basic: "3–5 秒", pro: "秒级", elite: "专线直连" },
  { k: "自定义止盈止损", basic: false, pro: true, elite: true },
  { k: "跨交易所资产视图", basic: false, pro: true, elite: true },
  { k: "归因分析", basic: false, pro: true, elite: true },
  { k: "子账户与团队权限", basic: false, pro: false, elite: true },
  { k: "开放 API / Webhook", basic: false, pro: false, elite: true },
  { k: "专属顾问", basic: false, pro: false, elite: true },
];

export default function PricingPage() {
  return (
    <>
      <section className="relative overflow-hidden pb-10 pt-14 sm:pt-20">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute left-1/2 top-[-220px] h-[420px] w-[820px] -translate-x-1/2 rounded-full bg-wise-green/20 blur-[120px]" />
        </div>
        <div className="container-x">
          <SectionTitle
            eyebrow="零分润 · 只收订阅费"
            title="简单透明的订阅定价"
            desc="利润 100% 归你，我们只收固定的软件服务费。月付随时取消，年付相当于省 2 个月。"
          />
          <PricingToggle plans={PLANS} />
        </div>
      </section>

      <section className="py-14">
        <div className="container-x">
          <SectionTitle title="功能对比" desc="选择最适合你的方案" />
          <div className="mt-8 overflow-x-auto">
            <table className="w-full min-w-[640px] border-separate border-spacing-0 overflow-hidden rounded-3xl border border-border bg-card">
              <thead>
                <tr>
                  <th className="border-b border-border px-5 py-3.5 text-left text-[13px] font-semibold">能力</th>
                  {PLANS.map((p) => (
                    <th key={p.id} className="border-b border-border px-5 py-3.5 text-left text-[13px] font-semibold">
                      {p.name}
                      {p.popular ? (
                        <span className="ml-2 rounded-pill bg-wise-green px-2 py-0.5 text-[10.5px] font-bold text-wise-darkgreen">
                          推荐
                        </span>
                      ) : null}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {COMPARE.map((row, i) => (
                  <tr key={row.k} className={i % 2 ? "bg-surface/50" : ""}>
                    <td className="px-5 py-3 text-[13px] text-muted-foreground">{row.k}</td>
                    {(["basic", "pro", "elite"] as const).map((k) => (
                      <td key={k} className="px-5 py-3 text-[13px]">
                        {row[k] === true ? (
                          <Check size={16} className="text-wise-green" />
                        ) : row[k] === false ? (
                          <Minus size={16} className="text-muted-foreground/50" />
                        ) : (
                          <span className="font-medium">{row[k]}</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="pb-16">
        <div className="container-x">
          <SectionTitle title="常见问题" />
          <div className="mx-auto mt-8 grid max-w-3xl gap-3">
            {FAQ.map((f) => (
              <details key={f.q} className="group rounded-3xl border border-border bg-card px-5 py-4">
                <summary className="flex cursor-pointer items-center justify-between gap-4 text-[14px] font-semibold">
                  {f.q}
                  <span className="text-muted-foreground transition group-open:rotate-45">+</span>
                </summary>
                <p className="mt-2.5 text-[13.5px] leading-relaxed text-muted-foreground">{f.a}</p>
              </details>
            ))}
          </div>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Link href="/dashboard" className="btn-primary px-6 py-3">
              <Sparkles size={16} /> 开始免费体验
            </Link>
            <Link href="/tutorials" className="btn-ghost px-6 py-3">
              先看新手教程
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}

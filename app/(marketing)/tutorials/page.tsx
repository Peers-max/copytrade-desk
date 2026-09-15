import Link from "next/link";
import { ArrowRight, BookOpen, KeyRound, ShieldCheck, Zap } from "lucide-react";
import { SectionTitle } from "@/components/ui";
import { TutorialTabs } from "./tutorial-tabs";

export const metadata = { title: "新手教程" };

export default function TutorialsPage() {
  return (
    <>
      <section className="relative overflow-hidden pb-10 pt-14">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute left-1/2 top-[-220px] h-[420px] w-[820px] -translate-x-1/2 rounded-full bg-wise-green/20 blur-[120px]" />
        </div>
        <div className="container-x">
          <SectionTitle
            eyebrow="新手教程"
            title="3 分钟完成 API 绑定"
            desc="选择你使用的交易所，跟着步骤走完即可开始跟单。整个过程只授权「读取 + 交易」，永不申请提现权限。"
          />
          <div className="mx-auto mt-8 grid max-w-3xl gap-3 sm:grid-cols-3">
            {[
              { icon: KeyRound, t: "只授权交易", d: "不申请提现权限，资金无法被转出" },
              { icon: ShieldCheck, t: "IP 白名单", d: "仅允许币策出口 IP 调用你的 API" },
              { icon: Zap, t: "秒级生效", d: "绑定后立即开始接收并同步信号" },
            ].map((c) => (
              <div key={c.t} className="flex gap-3 rounded-3xl border border-border bg-card p-4">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-wise-mint text-wise-darkgreen">
                  <c.icon size={17} />
                </span>
                <div>
                  <div className="text-[13.5px] font-semibold">{c.t}</div>
                  <div className="mt-0.5 text-[12px] text-muted-foreground">{c.d}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="pb-16">
        <div className="container-x">
          <TutorialTabs />
        </div>
      </section>

      <section className="border-t border-border bg-surface/40 py-14">
        <div className="container-x">
          <SectionTitle title="新手必读" />
          <div className="mx-auto mt-8 grid max-w-4xl gap-3 sm:grid-cols-2">
            {[
              {
                t: "账户模式必须正确",
                d: "欧易等交易所需将账户模式设为「单币种保证金」或「跨币种保证金」，简单交易模式无法运行合约跟单。",
              },
              {
                t: "密码短语只显示一次",
                d: "OKX 的 Passphrase 创建后不再展示，请立即复制并保存到密码管理器。",
              },
              {
                t: "先小额试跑",
                d: "建议首次跟单先用 100–500 USDT 试运行 24 小时，确认信号同步与撮合正常后再加仓。",
              },
              {
                t: "设置止损再睡觉",
                d: "在跟单参数中设置最大回撤与止损比例，风控引擎会在触发时自动暂停跟单。",
              },
            ].map((x) => (
              <div key={x.t} className="rounded-3xl border border-border bg-card p-5">
                <div className="flex items-center gap-2 text-[14px] font-semibold">
                  <BookOpen size={16} className="text-wise-green" /> {x.t}
                </div>
                <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">{x.d}</p>
              </div>
            ))}
          </div>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Link href="/api-keys" className="btn-primary px-6 py-3">
              前往绑定 API <ArrowRight size={16} />
            </Link>
            <Link href="/pricing" className="btn-ghost px-6 py-3">
              查看订阅定价
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}

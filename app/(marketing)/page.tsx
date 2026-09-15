import Link from "next/link";
import {
  Activity,
  ArrowRight,
  ChartBar,
  Bell,
  Check,
  Cpu,
  Gauge,
  Globe,
  Layers,
  ChartLine,
  Lock,
  Radio,
  Shield,
  Users,
  Wallet,
  X,
  Zap,
} from "lucide-react";
import { Badge, SectionTitle, Sparkline } from "@/components/ui";
import { SignalFeed } from "@/components/home/signal-feed";
import { DashboardPreview } from "@/components/home/dashboard-preview";
import { buildMarket } from "@/lib/market";
import { all } from "@/lib/db";
import { seedIfNeeded } from "@/lib/seed";
import type { Signal } from "@/lib/types";

const EXCHANGES_ROW1 = [
  { name: "Binance", src: "/icons/binance.png" },
  { name: "OKX", src: "/icons/okx.png" },
  { name: "Bybit", src: "/icons/bybit.png" },
  { name: "Bitget", src: "/icons/bitget.png" },
];
const EXCHANGES_ROW2 = [
  { name: "Gate", src: "/icons-flat/gate.png" },
  { name: "HTX", src: "/icons-flat/htx.png" },
  { name: "BitMart", src: "/icons-flat/bitmart.png" },
  { name: "Hotcoin", src: "/icons-flat/hotcoin.png" },
];

const PAIN_POINTS = [
  {
    img: "/images/emotional_determined.png",
    title: "情绪化决策",
    desc: "恐惧和贪婪容易让你追涨杀跌，账户慢慢被消耗。",
  },
  {
    img: "/images/missing_point.png",
    title: "错失良机",
    desc: "市场 24/7，你不可能一直盯盘，关键机会总被错过。",
  },
  {
    img: "/images/lack_experience.png",
    title: "缺乏策略验证",
    desc: "没有经过回测的系统，交易就像赌博。",
  },
];

const CEX_ISSUES = [
  {
    img: "/images/profit_cut.png",
    title: "20% 抽成吃掉一半利润",
    desc: "多数 CEX 跟单对盈利抽成 10–20%，长期下来几乎吃掉半年收益；亏损却要自己扛，分润与风险完全不对等。",
  },
  {
    img: "/images/quota_locked.png",
    title: "名额抢不到、时间锁死",
    desc: "热门交易员跟单名额 200–500 人早已约满，你只能退而求其次跟二线选手；时间锁定、退出冷静期，灵活性近乎为零。",
  },
];

const FEATURES = [
  {
    icon: Cpu,
    title: "策略算法精准",
    desc: "量化策略实时适应市场波动，不靠运气靠系统。",
    href: "/strategies",
    cta: "了解更多",
  },
  {
    icon: Globe,
    title: "跨交易所无缝连接",
    desc: "Binance、OKX、Bitget、Gate、Bybit 等 8 大主流交易所一站打通，一个账号即可同步跟单。",
    href: "/api-keys",
    cta: "查看支持列表",
  },
  {
    icon: Shield,
    title: "银行级安全",
    desc: "资金留在你自己的交易所钱包，我们只执行交易。",
    href: "/privacy",
    cta: "安全白皮书",
  },
  {
    icon: Radio,
    title: "全天候自动执行",
    desc: "一次设定，持续运转。币策 7×24 小时接收信号、执行下单、管理仓位，告别盯盘焦虑。",
    href: "/copy-trading",
    cta: "了解自动化",
  },
];

const EXPERT_POINTS = [
  {
    img: "/images/expert_watch.png",
    title: "专家盯盘",
    desc: "顶级交易员 24 小时研究行情、判断趋势，你不用再守着屏幕。",
  },
  {
    img: "/images/precise_timing.png",
    title: "精准择时",
    desc: "什么时候开仓、什么时候止损止盈，都交给有多年盘感的专家判断。",
  },
  {
    img: "/images/dynamic_position.png",
    title: "动态管仓",
    desc: "行情反转时主动减仓对冲，市场机会来临时加仓跟进，风险和收益都有人把关。",
  },
];

const STEPS = [
  { title: "注册", desc: "邮箱验证 30 秒搞定。" },
  { title: "绑 API", desc: "只授权读取 + 交易，永不申请提现权限。" },
  { title: "开跟", desc: "挑交易员或策略，点「跟单」。等它帮你赚。" },
];

const WIN_CARDS = [
  {
    icon: ChartBar,
    title: "专业仪表盘",
    desc: "PnL 分析 + 跨交易所统一资产视图。",
  },
  {
    icon: Gauge,
    title: "智能风险管理",
    desc: "自定义止盈止损 + 多维度风控引擎。",
  },
  {
    icon: Lock,
    title: "资产安全保障",
    desc: "资产不离开交易所，API 仅执行不提现。",
  },
];

const TESTIMONIALS = [
  "币策彻底改变了我的交易方式。跟单的精准度无与伦比。",
  "起初我很怀疑，但结果说明了一切。完全自动化的收益！",
  "仪表盘非常直观。我可以一站式追踪所有跟单交易。",
  "安全可靠。终于找到了一个我可以放心托付密钥的跟单平台。",
  "我见过的最佳执行速度。与其他平台相比，滑点极低。",
  "用了一个月，体验非常好。自动跟单解放了双手，收益一目了然。",
  "API 集成做得很流畅，绑定后几秒就同步了，效率极高，强烈推荐。",
  "社区功能很棒，能看到其他人的策略分享，学习交流的好平台。",
];

export default async function HomePage() {
  seedIfNeeded();
  const market = buildMarket();
  const signals = (await all<Signal>("signals"))
    .sort((a, b) => b.ts - a.ts)
    .slice(0, 6);

  return (
    <>
      {/* ---------------- HERO ---------------- */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute left-1/2 top-[-260px] h-[520px] w-[920px] -translate-x-1/2 rounded-full bg-wise-green/25 blur-[130px]" />
          <div className="absolute right-[-160px] top-40 h-[380px] w-[380px] rounded-full bg-wise-green/10 blur-[110px]" />
        </div>
        <div className="container-x grid items-center gap-12 pb-14 pt-14 lg:grid-cols-[1.05fr_0.95fr] lg:gap-10 lg:pb-20 lg:pt-20">
          <div>
            <div className="mb-5 inline-flex items-center gap-2 rounded-pill border border-border bg-card px-3 py-1.5 text-[12px] text-muted-foreground">
              <span className="flex h-1.5 w-1.5 rounded-full bg-wise-green" />
              已支持 8 家主流交易所 · 零分润
            </div>
            <h1 className="text-balance text-[38px] font-bold leading-[1.08] tracking-tight sm:text-[54px] lg:text-[60px]">
              跟顶级交易员
              <br />
              一起赚
            </h1>
            <p className="mt-5 max-w-lg text-[15px] leading-relaxed text-muted-foreground sm:text-[17px]">
              一键跟随，秒级同步到你的账户
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link href="/dashboard" className="btn-primary px-6 py-3 text-[15px]">
                开始跟单 <ArrowRight size={17} />
              </Link>
              <Link href="/#how-it-works" className="btn-ghost px-6 py-3 text-[15px]">
                如何运作
              </Link>
            </div>

            <div className="mt-9">
              <div className="mb-3 text-[12px] text-muted-foreground">支持的主流交易所</div>
              <div className="flex flex-wrap items-center gap-2">
                {[...EXCHANGES_ROW1, ...EXCHANGES_ROW2].map((e) => (
                  <div
                    key={e.name}
                    className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-card"
                    title={e.name}
                  >
                    <img src={e.src} alt={e.name} className="h-5 w-5 object-contain" />
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-9 grid max-w-md grid-cols-3 gap-4">
              {[
                { k: "0%", v: "利润分润" },
                { k: "8", v: "交易所接入" },
                { k: "∞", v: "跟单名额" },
              ].map((s) => (
                <div key={s.v}>
                  <div className="num text-[24px] font-bold leading-none">{s.k}</div>
                  <div className="mt-1 text-[12px] text-muted-foreground">{s.v}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="relative">
            <SignalFeed initial={signals} />
            <div className="mt-3 rounded-3xl border border-border bg-card p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[12px] font-semibold">近 30 日跟单收益</span>
                <Badge tone="green">+8.24%</Badge>
              </div>
              <Sparkline
                data={[100, 102, 101, 105, 108, 107, 112, 110, 116, 114, 119, 118, 124]}
                width={420}
                height={64}
              />
            </div>
          </div>
        </div>
      </section>

      {/* ---------------- 人工盯盘 ---------------- */}
      <section className="border-y border-border bg-surface/40 py-16 sm:py-20">
        <div className="container-x">
          <SectionTitle
            eyebrow="交易者的真实困境"
            title="人工盯盘，赢不过系统"
            desc="亏损的三个最常见原因"
          />
          <div className="mt-10 grid gap-5 sm:grid-cols-3">
            {PAIN_POINTS.map((p) => (
              <div key={p.title} className="card-surface overflow-hidden">
                <div className="aspect-[16/10] w-full overflow-hidden bg-surface">
                  <img src={p.img} alt={p.title} className="h-full w-full object-cover" />
                </div>
                <div className="p-5">
                  <div className="text-[15px] font-semibold">{p.title}</div>
                  <p className="mt-2 text-[13.5px] leading-relaxed text-muted-foreground">{p.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- 传统跟单 ---------------- */}
      <section className="py-16 sm:py-20">
        <div className="container-x">
          <SectionTitle title="传统跟单，利润拿不全" desc="CEX 跟单正在被忽略的两道坎" />
          <div className="mt-10 grid gap-5 sm:grid-cols-2">
            {CEX_ISSUES.map((c) => (
              <div key={c.title} className="card-surface overflow-hidden">
                <div className="aspect-[16/8] w-full overflow-hidden bg-surface">
                  <img src={c.img} alt={c.title} className="h-full w-full object-cover" />
                </div>
                <div className="p-6">
                  <div className="flex items-center gap-2 text-[16px] font-semibold">
                    <X size={17} className="text-[#f6465d]" />
                    {c.title}
                  </div>
                  <p className="mt-2.5 text-[13.5px] leading-relaxed text-muted-foreground">{c.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- 核心能力 ---------------- */}
      <section id="features" className="scroll-mt-20 border-y border-border bg-surface/40 py-16 sm:py-20">
        <div className="container-x">
          <SectionTitle
            eyebrow="币策为专业跟单而生"
            title={
              <>
                为专业跟单而生
                <span className="ml-2 align-middle text-wise-green">+8.24%</span>
              </>
            }
          />
          <div className="mt-10 grid gap-5 sm:grid-cols-2">
            {FEATURES.map((f) => (
              <Link key={f.title} href={f.href} className="card-surface group p-6 transition hover:border-wise-green/50">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-wise-mint text-wise-darkgreen">
                  <f.icon size={20} />
                </div>
                <div className="mt-4 text-[16px] font-semibold">{f.title}</div>
                <p className="mt-2 text-[13.5px] leading-relaxed text-muted-foreground">{f.desc}</p>
                <div className="mt-4 inline-flex items-center gap-1 text-[13px] font-semibold text-wise-darkgreen dark:text-wise-green">
                  {f.cta} <ArrowRight size={14} className="transition group-hover:translate-x-0.5" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- 优势 ---------------- */}
      <section id="advantages" className="scroll-mt-20 py-16 sm:py-20">
        <div className="container-x">
          <SectionTitle title="把利润与名额还给你" desc="零抽成、零排队、永久有效" />
          <div className="mt-10 grid gap-5 lg:grid-cols-2">
            <div className="rounded-card-lg border border-border bg-card p-7 sm:p-9">
              <div className="inline-flex items-center gap-2 rounded-pill bg-wise-green px-3 py-1 text-[12px] font-bold text-wise-darkgreen">
                <Wallet size={14} /> 利润 100% 归你
              </div>
              <p className="mt-4 text-[13.5px] leading-relaxed text-muted-foreground">
                打破传统渠道高达 20% 的分润体系，永久零分润，无任何隐藏费用。
              </p>
              <ul className="mt-6 space-y-4">
                {[
                  { t: "交易利润 100% 归用户所有", d: "下单 / 改单 / 平仓全链路零抽成" },
                  { t: "链上透明可查", d: "承诺条款不可篡改，公开可审计" },
                  { t: "永久有效", d: "不限时间、不限额度、不限人数" },
                ].map((i) => (
                  <li key={i.t} className="flex gap-3">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-wise-green text-wise-darkgreen">
                      <Check size={13} strokeWidth={3} />
                    </span>
                    <div>
                      <div className="text-[14px] font-semibold">{i.t}</div>
                      <div className="text-[12.5px] text-muted-foreground">{i.d}</div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-card-lg border border-border bg-card p-7 sm:p-9">
              <div className="inline-flex items-center gap-2 rounded-pill bg-foreground px-3 py-1 text-[12px] font-bold text-background">
                <Users size={14} /> 打破跟单名额上限
              </div>
              <p className="mt-4 text-[13.5px] leading-relaxed text-muted-foreground">
                币安、OKX、Bybit 等 CEX 跟单普遍限制单交易员跟单人数，需抢名额、排队。币策不设上限。
              </p>
              <ul className="mt-6 space-y-4">
                {[
                  { t: "不设跟单人数上限", d: "热门交易员不抢名额、不排队" },
                  { t: "随时跟单或取消", d: "灵活进出，无锁定期" },
                  { t: "平等享受", d: "每位用户平等享有跟单机会" },
                ].map((i) => (
                  <li key={i.t} className="flex gap-3">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-foreground text-background">
                      <Check size={13} strokeWidth={3} />
                    </span>
                    <div>
                      <div className="text-[14px] font-semibold">{i.t}</div>
                      <div className="text-[12.5px] text-muted-foreground">{i.d}</div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------- 专家 ---------------- */}
      <section className="border-y border-border bg-surface/40 py-16 sm:py-20">
        <div className="container-x">
          <SectionTitle title="让专家替你打理" desc="盘感、择时、管仓 —— 由真人顶级交易员为你操刀" />
          <div className="mt-10 grid gap-5 sm:grid-cols-3">
            {EXPERT_POINTS.map((e) => (
              <div key={e.title} className="card-surface overflow-hidden">
                <div className="aspect-[16/10] w-full overflow-hidden bg-surface">
                  <img src={e.img} alt={e.title} className="h-full w-full object-cover" />
                </div>
                <div className="p-5">
                  <div className="text-[15px] font-semibold">{e.title}</div>
                  <p className="mt-2 text-[13.5px] leading-relaxed text-muted-foreground">{e.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- 三步 ---------------- */}
      <section id="how-it-works" className="scroll-mt-20 py-16 sm:py-20">
        <div className="container-x">
          <SectionTitle title="三步搞定" />
          <div className="mt-10 grid gap-5 sm:grid-cols-3">
            {STEPS.map((s, i) => (
              <div key={s.title} className="card-surface relative p-7">
                <div className="num text-[46px] font-black leading-none text-wise-green/70">0{i + 1}</div>
                <div className="mt-3 text-[17px] font-semibold">{s.title}</div>
                <p className="mt-2 text-[13.5px] leading-relaxed text-muted-foreground">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- 致胜 ---------------- */}
      <section className="border-y border-border bg-surface/40 py-16 sm:py-20">
        <div className="container-x">
          <SectionTitle title="助你致胜" />
          <div className="mt-10 grid gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
            <div className="space-y-3">
              {WIN_CARDS.map((w) => (
                <div key={w.title} className="flex gap-4 rounded-3xl border border-border bg-card p-5">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-wise-mint text-wise-darkgreen">
                    <w.icon size={18} />
                  </div>
                  <div>
                    <div className="text-[15px] font-semibold">{w.title}</div>
                    <p className="mt-1 text-[13px] text-muted-foreground">{w.desc}</p>
                  </div>
                </div>
              ))}
              <div className="flex flex-wrap gap-3 pt-2">
                <Link href="/dashboard" className="btn-primary">
                  进入仪表盘 <ArrowRight size={16} />
                </Link>
                <Link href="/pricing" className="btn-ghost">
                  查看定价
                </Link>
              </div>
            </div>
            <div>
              <DashboardPreview initial={market} />
            </div>
          </div>
        </div>
      </section>

      {/* ---------------- 评价 ---------------- */}
      <section className="overflow-hidden py-16 sm:py-20">
        <div className="container-x">
          <SectionTitle title="深受交易者信赖" />
        </div>
        <div className="mt-10 space-y-4">
          <Marquee items={TESTIMONIALS} />
          <Marquee items={[...TESTIMONIALS].reverse()} reverse />
        </div>
      </section>

      {/* ---------------- CTA ---------------- */}
      <section className="pb-20 pt-4">
        <div className="container-x">
          <div className="relative overflow-hidden rounded-card-lg border border-border bg-wise-green px-7 py-12 text-center sm:px-14 sm:py-16">
            <div className="pointer-events-none absolute -left-20 -top-20 h-64 w-64 rounded-full bg-white/30 blur-3xl" />
            <h2 className="text-balance text-[28px] font-bold leading-tight text-wise-darkgreen sm:text-[40px]">
              今天就让顶级交易员替你下单
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-[14px] text-wise-darkgreen/75 sm:text-[16px]">
              30 秒完成注册与 API 绑定，零分润、无名额限制，随时可取消。
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 rounded-pill bg-wise-darkgreen px-7 py-3 text-[15px] font-semibold text-wise-green transition hover:opacity-90"
              >
                免费开始 <ArrowRight size={17} />
              </Link>
              <Link
                href="/tutorials"
                className="inline-flex items-center gap-2 rounded-pill border border-wise-darkgreen/25 px-7 py-3 text-[15px] font-semibold text-wise-darkgreen transition hover:bg-white/25"
              >
                看新手教程
              </Link>
            </div>
            <div className="mt-7 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[12px] text-wise-darkgreen/70">
              {[
                { icon: Shield, t: "资产不离开交易所" },
                { icon: Zap, t: "秒级信号同步" },
                { icon: Activity, t: "7×24 自动执行" },
                { icon: Layers, t: "多交易所统一管理" },
                { icon: Bell, t: "实时风险提醒" },
              ].map((f) => (
                <span key={f.t} className="inline-flex items-center gap-1.5">
                  <f.icon size={13} /> {f.t}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

function Marquee({ items, reverse }: { items: string[]; reverse?: boolean }) {
  const doubled = [...items, ...items];
  return (
    <div className="mask-fade-x overflow-hidden">
      <div
        className="flex w-max gap-4"
        style={{
          animation: `marquee 40s linear infinite`,
          animationDirection: reverse ? "reverse" : "normal",
        }}
      >
        {doubled.map((t, i) => (
          <div
            key={i}
            className="w-[300px] shrink-0 rounded-3xl border border-border bg-card p-5"
          >
            <div className="flex items-center gap-1 text-wise-green">
              {Array.from({ length: 5 }).map((_, k) => (
                <svg key={k} width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
              ))}
            </div>
            <p className="mt-2.5 line-clamp-2 text-[12.5px] leading-relaxed text-muted-foreground">{t}</p>
            <div className="mt-3 flex items-center gap-2">
              <div className="h-6 w-6 rounded-full bg-wise-green/70" />
              <span className="text-[11.5px] font-medium">交易者 {String.fromCharCode(65 + (i % 8))}**</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

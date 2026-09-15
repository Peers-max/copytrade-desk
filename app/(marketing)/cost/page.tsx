import Link from "next/link";
import { ArrowRight, Check, Download, TrendingDown, TrendingUp } from "lucide-react";
import { Badge, Donut, SectionTitle, cn } from "@/components/ui";
import {
  ARPU_NEW,
  ARPU_NOW,
  BUSINESS,
  CF_INFRA,
  CF_INFRA_SAVING,
  CF_INFRA_SAVING_YEAR,
  CF_INFRA_TOTAL,
  CF_TAKEAWAYS,
  COST_STRUCTURE,
  COST_TOTAL,
  COST_TOTAL_CF,
  HEADCOUNT,
  HEADCOUNT_TOTAL,
  INFRA,
  INFRA_COMPARE,
  INFRA_GROUPS,
  INFRA_TOTAL,
  MARKETING,
  MARKETING_TOTAL,
  OPTIMIZATIONS,
  OPTIMIZATION_TOTAL,
  PLANS_PRICE,
  PRICE_BANDS,
  PROFIT_NOW,
  REVENUE_NOW,
  SCALE_COMPARE,
  SCALE_TABLE,
  SCENARIOS_CF,
  SCENARIOS,
  THIRD_PARTY,
  THIRD_PARTY_TOTAL,
  UNIT_ECONOMICS,
  UNIT_INFRA_CF,
  VARIABLE_TOTAL,
} from "@/lib/cost-model";

export const metadata = { title: "运营成本测算与定价优化方案" };

const fmt = (n: number) => n.toLocaleString("zh-CN", { maximumFractionDigits: 0 });
const fmtMoney = (n: number) => `¥${fmt(n)}`;
const pct = (n: number, total: number) => `${((n / total) * 100).toFixed(1)}%`;

const GROUP_COLORS: Record<string, string> = {
  计算: "#9fe870",
  "数据库与缓存": "#4cc9f0",
  "带宽与 CDN": "#ffd11a",
  存储: "#b388ff",
  容灾: "#ff9f45",
};

export default function CostReportPage() {
  const techTotal = INFRA_TOTAL + THIRD_PARTY_TOTAL;

  return (
    <>
      {/* HERO */}
      <section className="relative overflow-hidden border-b border-border">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute left-1/2 top-[-220px] h-[420px] w-[820px] -translate-x-1/2 rounded-full bg-wise-green/20 blur-[120px]" />
        </div>
        <div className="container-x py-14 sm:py-20">
          <SectionTitle
            eyebrow="铲子型 SaaS · 单位经济模型"
            title="运营成本测算与订阅定价优化方案"
            desc="基于复刻站点的完整技术栈（8 交易所行情聚合、跟单信号引擎、执行与风控、订阅计费）所做的成本建模。所有价格为 2026 年主流云厂商公开挂牌价估算。"
          />

          <div className="mx-auto mt-10 grid max-w-4xl gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi label="月收入" value={fmtMoney(REVENUE_NOW)} sub={`${BUSINESS.paying.toLocaleString()} 付费用户 · ARPU $${ARPU_NOW.toFixed(2)}`} />
            <Kpi label="月运营成本" value={fmtMoney(COST_TOTAL)} sub="含人力、营销、合规" />
            <Kpi label="营业利润" value={fmtMoney(PROFIT_NOW)} sub={`净利率 ${((PROFIT_NOW / REVENUE_NOW) * 100).toFixed(1)}%`} tone="up" />
            <Kpi
              label="技术成本占比"
              value={pct(techTotal, COST_TOTAL)}
              sub={`服务器+带宽+存储+第三方 ${fmtMoney(techTotal)}`}
            />
          </div>

          <div className="mx-auto mt-6 flex max-w-4xl flex-wrap items-center justify-center gap-3">
            <Link href="/pricing" className="btn-primary px-6 py-3">
              查看现价目表 <ArrowRight size={16} />
            </Link>
            <a href="/docs/成本测算与定价方案.md" download className="btn-ghost px-6 py-3">
              <Download size={16} /> 下载完整报告（Markdown）
            </a>
          </div>
        </div>
      </section>

      {/* 0. Cloudflare + GitHub 免费层方案 */}
      <section className="border-b border-border bg-wise-green/[0.04] py-14">
        <div className="container-x">
          <SectionTitle
            align="left"
            eyebrow="架构优化 · 已在本站点落地"
            title="零、Cloudflare + GitHub 免费层：基础设施成本降 98.6%"
            desc="本站点实际部署在 Cloudflare Workers 上。决定性差异是 Cloudflare 不收出口流量费——而出口带宽在传统架构里是第三大开销，且随用户量线性增长。"
          />

          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi label="基础设施月成本" value={fmtMoney(CF_INFRA_TOTAL)} sub={`原 ${fmtMoney(INFRA_TOTAL)}`} tone="up" />
            <Kpi
              label="降幅"
              value={`${((CF_INFRA_SAVING / INFRA_TOTAL) * 100).toFixed(1)}%`}
              sub={`月省 ${fmtMoney(CF_INFRA_SAVING)}`}
              tone="up"
            />
            <Kpi label="年化节省" value={fmtMoney(CF_INFRA_SAVING_YEAR)} sub="含出口带宽归零" tone="up" />
            <Kpi
              label="单用户基础设施成本"
              value={`¥${UNIT_INFRA_CF.toFixed(2)}`}
              sub={`原 ¥${(INFRA_TOTAL / BUSINESS.paying).toFixed(2)} / 月`}
              tone="up"
            />
          </div>

          <div className="mt-10 grid gap-6 lg:grid-cols-2">
            {/* 分组对比 */}
            <div className="rounded-2xl border border-border bg-card p-6">
              <h3 className="text-sm font-semibold">分组对比（月支出）</h3>
              <div className="mt-5 space-y-4">
                {INFRA_COMPARE.map((r) => (
                  <div key={r.group}>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">{r.group}</span>
                      <span className="tabular-nums">
                        <span className="mr-2 text-muted-foreground line-through">{fmtMoney(r.traditional)}</span>
                        <span className="font-semibold text-wise-green">
                          {r.cloudflare === 0 ? "¥0" : fmtMoney(r.cloudflare)}
                        </span>
                      </span>
                    </div>
                    <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-wise-green"
                        style={{ width: `${Math.max((r.cloudflare / r.traditional) * 100, 1.5)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
                条形长度 = 新方案相对原方案的占比。带宽与 CDN 因 Cloudflare 免收出口流量费直接归零。
              </p>
            </div>

            {/* 规模弹性 */}
            <div className="rounded-2xl border border-border bg-card p-6">
              <h3 className="text-sm font-semibold">规模弹性：用户翻倍，成本几乎不动</h3>
              <div className="mt-5 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground">
                      <th className="py-2 text-left font-medium">付费用户</th>
                      <th className="py-2 text-right font-medium">传统架构</th>
                      <th className="py-2 text-right font-medium">Cloudflare</th>
                      <th className="py-2 text-right font-medium">单用户</th>
                    </tr>
                  </thead>
                  <tbody>
                    {SCALE_COMPARE.map((r) => (
                      <tr key={r.users} className="border-b border-border/50 last:border-0">
                        <td className="py-2">{r.users.toLocaleString()}</td>
                        <td className="py-2 text-right tabular-nums text-muted-foreground">{fmtMoney(r.traditional)}</td>
                        <td className="py-2 text-right tabular-nums font-semibold text-wise-green">
                          {fmtMoney(r.cloudflare)}
                        </td>
                        <td className="py-2 text-right tabular-nums text-muted-foreground">
                          ¥{(r.cloudflare / r.users).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
                传统架构下 1,000 → 30,000 用户，基础设施涨 9.8 倍；Cloudflare 方案下仅涨
                {(2600 / 80).toFixed(1)} 倍且绝对值仍不足三千元，边际成本近乎为零。
              </p>
            </div>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {CF_TAKEAWAYS.map((t) => (
              <div key={t.title} className="rounded-xl border border-border bg-card p-5">
                <div className="flex items-start gap-3">
                  <Check size={16} className="mt-0.5 shrink-0 text-wise-green" />
                  <div>
                    <p className="text-sm font-semibold">{t.title}</p>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{t.desc}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 1. 成本结构 */}
      <section className="py-14">
        <div className="container-x">
          <SectionTitle
            align="left"
            title="一、总成本结构：钱到底花在哪"
            desc="用户最关心的服务器、带宽、存储与第三方服务，合计只占总成本的 5.6%。真正的大头是人力与获客。"
          />

          <div className="mt-8 grid gap-5 lg:grid-cols-[1fr_1.25fr] lg:items-center">
            <div className="card-surface flex flex-col items-center p-6">
              <div className="relative">
                <Donut size={196} data={COST_STRUCTURE.map((c) => ({ name: c.name, value: c.value, pct: 0 }))} />
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-[11px] text-muted-foreground">月总成本</span>
                  <span className="num text-[17px] font-bold">{fmtMoney(COST_TOTAL)}</span>
                </div>
              </div>
              <div className="mt-5 w-full space-y-2">
                {COST_STRUCTURE.map((c) => (
                  <div key={c.name} className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: c.color }} />
                    <span className="flex-1 text-[13px]">{c.name}</span>
                    <span className="num text-[12.5px] font-semibold">{fmtMoney(c.value)}</span>
                    <span className="num w-12 text-right text-[12px] text-muted-foreground">{pct(c.value, COST_TOTAL)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <Bar label="人力成本" value={HEADCOUNT_TOTAL} total={COST_TOTAL} color="#9fe870" note="后端 2 / 前端 1 / 量化 1 / SRE 0.5 / 客服 2 / 产品 1" />
              <Bar label="获客与营销" value={MARKETING_TOTAL} total={COST_TOTAL} color="#4cc9f0" note="KOL 5.5 万 / 内容 2.5 万 / 投放 3 万 / 活动 1 万" />
              <Bar label="变动成本（支付 + 返佣）" value={VARIABLE_TOTAL} total={COST_TOTAL} color="#ffd11a" note="支付通道 1% + 推广返佣约 3%" />
              <Bar label="安全与合规" value={25000} total={COST_TOTAL} color="#b388ff" note="KYC/AML、法务、渗透测试、保险" />
              <Bar label="基础设施" value={INFRA_TOTAL} total={COST_TOTAL} color="#ff9f45" note="计算 / 数据库 / 带宽 / 存储 / 容灾" />
              <Bar label="第三方服务" value={THIRD_PARTY_TOTAL} total={COST_TOTAL} color="#f6465d" note="行情源 / 通知 / 监控 / WAF" />

              <div className="mt-5 rounded-2xl border border-warning/40 bg-warning/10 p-4">
                <p className="text-[13px] leading-relaxed">
                  <strong className="font-semibold">关键结论：</strong>
                  降价空间不是由云账单决定的。人力 + 获客占 <strong>75.6%</strong>，
                  而服务器带宽存储第三方仅占 <strong>5.6%</strong>。
                  因此优化顺序应是：先压缩技术侧（可省 25.6%），再用省下的空间换价格弹性。
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. 基础设施 */}
      <section className="border-y border-border bg-surface/40 py-14">
        <div className="container-x">
          <SectionTitle
            align="left"
            title="二、基础设施与第三方服务明细"
            desc={`合计 ${fmtMoney(techTotal)}/月。带宽与 CDN 是内部最大科目（${pct(
              INFRA_GROUPS.find((g) => g.name === "带宽与 CDN")!.value,
              INFRA_TOTAL
            )}），源于行情长连接实时广播。`}
          />

          <div className="mt-8 grid gap-5 lg:grid-cols-2">
            <div className="card-surface p-5">
              <h3 className="text-[15px] font-semibold">基础设施构成（¥{fmt(INFRA_TOTAL)}/月）</h3>
              <div className="mt-4 flex gap-1.5">
                {INFRA_GROUPS.map((g) => (
                  <div
                    key={g.name}
                    className="h-3 rounded-pill"
                    style={{ width: `${(g.value / INFRA_TOTAL) * 100}%`, background: GROUP_COLORS[g.name] }}
                    title={`${g.name} ${fmtMoney(g.value)}`}
                  />
                ))}
              </div>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
                {INFRA_GROUPS.map((g) => (
                  <span key={g.name} className="flex items-center gap-1.5 text-[12px]">
                    <span className="h-2 w-2 rounded-sm" style={{ background: GROUP_COLORS[g.name] }} />
                    {g.name} {pct(g.value, INFRA_TOTAL)}
                  </span>
                ))}
              </div>
              <table className="mt-5 w-full">
                <tbody>
                  {INFRA.map((i) => (
                    <tr key={i.name} className="border-b border-border/50 last:border-0">
                      <td className="py-2.5 pr-3 text-[12.5px]">
                        <span className="mr-2 inline-block h-2 w-2 rounded-sm" style={{ background: GROUP_COLORS[i.group] }} />
                        {i.name}
                      </td>
                      <td className="num py-2.5 text-right text-[12.5px] font-semibold">{fmt(i.cost)}</td>
                      <td className="num w-12 py-2.5 text-right text-[11.5px] text-muted-foreground">
                        {pct(i.cost, INFRA_TOTAL)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="space-y-5">
              <div className="card-surface p-5">
                <h3 className="text-[15px] font-semibold">
                  第三方服务与工具（¥{fmt(THIRD_PARTY_TOTAL)}/月）
                </h3>
                <div className="mt-3 space-y-2">
                  {THIRD_PARTY.map((t) => (
                    <div key={t.name} className="flex items-center justify-between text-[12.5px]">
                      <span className="text-muted-foreground">{t.name}</span>
                      <span className="num font-semibold">{fmt(t.cost)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="card-surface p-5">
                <h3 className="text-[15px] font-semibold">人力成本（¥{fmt(HEADCOUNT_TOTAL)}/月）</h3>
                <div className="mt-3 space-y-2">
                  {HEADCOUNT.map((h) => (
                    <div key={h.role} className="flex items-center justify-between text-[12.5px]">
                      <span className="text-muted-foreground">
                        {h.role} × {h.count}
                      </span>
                      <span className="num font-semibold">{fmt(h.count * h.unit)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="card-surface p-5">
                <h3 className="text-[15px] font-semibold">规模效应：单用户基础设施成本</h3>
                <div className="mt-3 space-y-2">
                  {SCALE_TABLE.map((s) => (
                    <div key={s.users} className="flex items-center gap-3">
                      <span className="num w-16 text-[12.5px] text-muted-foreground">{fmt(s.users)} 人</span>
                      <div className="h-2 flex-1 overflow-hidden rounded-pill bg-surface">
                        <div
                          className="h-full rounded-pill bg-wise-green"
                          style={{ width: `${(s.per / 12) * 100}%` }}
                        />
                      </div>
                      <span className="num w-20 text-right text-[12.5px] font-semibold">¥{s.per.toFixed(2)}/人</span>
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-[11.5px] leading-relaxed text-muted-foreground">
                  从 3,000 增至 10,000 用户，单用户基础设施成本仅下降 22% —— 规模摊薄不足以支撑降价，
                  真正的杠杆在留存与 LTV。
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. 单位经济 */}
      <section className="py-14">
        <div className="container-x">
          <SectionTitle align="left" title="三、单位经济与价格下限" desc="铲子型 SaaS 的典型特征：高固定成本、极低边际成本。" />
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {UNIT_ECONOMICS.map((u) => (
              <div key={u.k} className="card-surface p-5">
                <div className="text-[12.5px] text-muted-foreground">{u.k}</div>
                <div className="num mt-2 text-[24px] font-bold leading-none">{u.v}</div>
                <div className="mt-1.5 text-[12px] text-muted-foreground">{u.sub}</div>
              </div>
            ))}
          </div>
          <div className="mt-6 rounded-3xl border border-border bg-card p-6">
            <h3 className="text-[15px] font-semibold">三个价格刻度</h3>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              {[
                { k: "技术盈亏平衡", v: "$3.3/月", d: "只覆盖基础设施 + 变动成本，无经营意义", tone: "default" as const },
                { k: "全成本覆盖", v: "$19.5/月", d: "含人力与营销摊销，是有意义的价格地板", tone: "warn" as const },
                { k: "维持 50% 净利", v: "$39/月", d: "推荐守住的健康线", tone: "green" as const },
              ].map((x) => (
                <div key={x.k} className="rounded-2xl border border-border bg-surface/60 p-4">
                  <Badge tone={x.tone}>{x.k}</Badge>
                  <div className="num mt-2 text-[22px] font-bold">{x.v}</div>
                  <div className="mt-1 text-[12px] leading-relaxed text-muted-foreground">{x.d}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 4. 成本优化 */}
      <section className="border-y border-border bg-surface/40 py-14">
        <div className="container-x">
          <SectionTitle
            align="left"
            title="四、成本侧优化：先省出 ¥6,100/月"
            desc={`技术侧（基础设施 + 第三方）从 ${fmtMoney(techTotal)} 降至 ${fmtMoney(
              techTotal - OPTIMIZATION_TOTAL
            )}，降幅 25.6%，且不牺牲信号延迟与服务质量。`}
          />
          <div className="mx-auto mt-8 grid max-w-3xl gap-3">
            {OPTIMIZATIONS.map((o) => (
              <div key={o.item} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4">
                <Check size={16} className="shrink-0 text-wise-green" />
                <span className="flex-1 text-[13.5px]">{o.item}</span>
                <span className="num shrink-0 text-[13.5px] font-semibold text-[#0ecb81]">−¥{fmt(o.save)}</span>
              </div>
            ))}
            <div className="flex items-center justify-between rounded-2xl border border-wise-green bg-wise-mint/40 px-4 py-3.5">
              <span className="text-[14px] font-bold text-wise-darkgreen">合计可释放</span>
              <span className="num text-[16px] font-bold text-wise-darkgreen">¥{fmt(OPTIMIZATION_TOTAL)}/月</span>
            </div>
          </div>
        </div>
      </section>

      {/* 5. 降价方案 */}
      <section className="py-14">
        <div className="container-x">
          <SectionTitle align="left" title="五、降价情景对比" desc="价格弹性按保守的 −1.2 建模（降 10% 带来 12% 付费用户增量）。" />
          <div className="mt-8 overflow-x-auto">
            <table className="w-full min-w-[760px] border-separate border-spacing-0 overflow-hidden rounded-3xl border border-border bg-card">
              <thead>
                <tr>
                  {["方案", "ARPU", "付费用户", "月收入", "月成本", "月利润", "净利率", "利润变化"].map((h) => (
                    <th key={h} className="border-b border-border px-4 py-3 text-left text-[12.5px] font-semibold">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {SCENARIOS.map((s) => {
                  const delta = ((s.profit - PROFIT_NOW) / PROFIT_NOW) * 100;
                  return (
                    <tr key={s.id} className={cn(s.highlight && "bg-wise-mint/30")}>
                      <td className="border-b border-border/60 px-4 py-3.5 text-[13px] font-semibold">
                        {s.name}
                        <div className="text-[11.5px] font-normal text-muted-foreground">{s.note}</div>
                      </td>
                      <td className="num border-b border-border/60 px-4 py-3.5 text-[13px]">${s.arpu.toFixed(2)}</td>
                      <td className="num border-b border-border/60 px-4 py-3.5 text-[13px]">{fmt(s.users)}</td>
                      <td className="num border-b border-border/60 px-4 py-3.5 text-[13px]">{fmtMoney(s.revenue)}</td>
                      <td className="num border-b border-border/60 px-4 py-3.5 text-[13px] text-muted-foreground">
                        {fmtMoney(s.cost)}
                      </td>
                      <td className="num border-b border-border/60 px-4 py-3.5 text-[13px] font-semibold">
                        {fmtMoney(s.profit)}
                      </td>
                      <td className="num border-b border-border/60 px-4 py-3.5 text-[13px]">
                        {(s.margin * 100).toFixed(1)}%
                      </td>
                      <td className="num border-b border-border/60 px-4 py-3.5 text-[13px]">
                        {s.id === "now" ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          <span className={cn("inline-flex items-center gap-1", delta >= 0 ? "text-[#0ecb81]" : "text-[#f6465d]")}>
                            {delta >= 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                            {delta.toFixed(1)}%
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-[12.5px] leading-relaxed text-muted-foreground">
            注：B 方案在弹性 −1.5（付费用户 +40%）时，MRR 反而比现状高 2.1%，利润仅下降 4.8%。
            降价的价值在于用户规模、长期 LTV 与抬高后来者的获客门槛，而非短期利润。
          </p>
        </div>
      </section>

      {/* 6. 建议价目 */}
      <section className="border-t border-border bg-surface/40 py-14">
        <div className="container-x">
          <SectionTitle
            align="left"
            title="六、建议价目与可行定价区间"
            desc={`加权 ARPU 从 $${ARPU_NOW.toFixed(2)} 降至 $${ARPU_NEW.toFixed(2)}（−27%），仍可维持约 62% 净利率。`}
          />

          <div className="mt-8 grid gap-4 lg:grid-cols-3">
            {PLANS_PRICE.proposed.map((p, i) => {
              const cur = PLANS_PRICE.current[i];
              return (
                <div
                  key={p.id}
                  className={cn(
                    "rounded-card-lg border bg-card p-6",
                    p.id === "pro" ? "border-wise-green shadow-glow" : "border-border"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[15px] font-bold">{p.name}</span>
                    {p.id === "pro" ? <Badge tone="green">主力</Badge> : null}
                  </div>
                  <div className="mt-4 flex items-baseline gap-2">
                    <span className="num text-[34px] font-bold leading-none">${p.monthly}</span>
                    <span className="text-[13px] text-muted-foreground">/月</span>
                    <span className="ml-1 text-[13px] text-muted-foreground line-through">${cur.monthly}</span>
                  </div>
                  <div className="mt-1.5 text-[12.5px] text-muted-foreground">
                    年付 ${p.yearly}（原 ${cur.yearly}）≈ ${(p.yearly / 12).toFixed(1)}/月
                  </div>
                  <div className="mt-3">
                    <Badge tone="green">
                      降幅 {Math.round((1 - p.monthly / cur.monthly) * 100)}%
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-8 overflow-x-auto">
            <table className="w-full min-w-[560px] border-separate border-spacing-0 overflow-hidden rounded-3xl border border-border bg-card">
              <thead>
                <tr>
                  {["套餐", "价格下限", "建议锚点", "价格上限", "现价", "说明"].map((h) => (
                    <th key={h} className="border-b border-border px-4 py-3 text-left text-[12.5px] font-semibold">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PRICE_BANDS.map((p, i) => (
                  <tr key={p.plan}>
                    <td className="border-b border-border/60 px-4 py-3 text-[13px] font-medium">{p.plan}</td>
                    <td className="num border-b border-border/60 px-4 py-3 text-[13px] text-muted-foreground">${p.low}</td>
                    <td className="num border-b border-border/60 px-4 py-3 text-[13px] font-bold text-wise-darkgreen dark:text-wise-green">
                      ${p.anchor}
                    </td>
                    <td className="num border-b border-border/60 px-4 py-3 text-[13px] text-muted-foreground">${p.high}</td>
                    <td className="num border-b border-border/60 px-4 py-3 text-[13px] text-muted-foreground line-through">
                      ${p.now}
                    </td>
                    <td className="border-b border-border/60 px-4 py-3 text-[12px] text-muted-foreground">
                      {[
                        "低于 $15 会拉低客群质量并抬高风控成本",
                        "主力营收档，低于 $49 会侵蚀旗舰版",
                        "价值锚，不建议大幅降，用于衬托专业版",
                      ][i]}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* 7. 落地动作 */}
      <section className="py-14">
        <div className="container-x">
          <SectionTitle align="left" title="七、落地顺序与风险护栏" />
          <div className="mx-auto mt-8 grid max-w-4xl gap-3 sm:grid-cols-2">
            {[
              { t: "先优化成本，再动价格", d: "先落地 ¥6,100/月 的技术侧优化，把降价空间挣出来，避免直接侵蚀利润。" },
              { t: "分档分批，不一刀切", d: "基础版与新用户先试点 4–6 周，A/B 验证真实弹性后再推广到专业版。" },
              { t: "老用户保护", d: "存量用户按原价 grandfathering 12 个月，或补偿等值积分 / 延长订阅期。" },
              { t: "年付优先引导", d: "年付用户流失率约为月付的 1/3，把降价资源重点投向年付。" },
              { t: "加免费层而非全线降价", d: "体验版（1 席位 / 500 USDT 上限 / 延迟 10 秒）拉新，$59 专业版变现。" },
              { t: "同步提升单位价值", d: "专业版增加归因分析与跨所资产视图，让 $59 显得「更值」而非「更便宜」。" },
            ].map((x) => (
              <div key={x.t} className="rounded-3xl border border-border bg-card p-5">
                <div className="text-[14px] font-semibold">{x.t}</div>
                <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">{x.d}</p>
              </div>
            ))}
          </div>

          <div className="mx-auto mt-8 max-w-4xl rounded-3xl border border-[#f6465d]/30 bg-[#f6465d]/5 p-6">
            <h3 className="text-[15px] font-semibold text-[#f6465d]">风险提示与监控护栏</h3>
            <ul className="mt-3 space-y-2 text-[13px] leading-relaxed text-muted-foreground">
              <li>· 若真实价格弹性低于 −0.8，B 方案利润将下滑 15% 以上 —— 必须先小流量验证再全面推行。</li>
              <li>· 护栏指标：净利率不低于 55%、月流失率上升不超过 1 个百分点、单用户客服工单量不翻倍，任一触线即暂停。</li>
              <li>· 带宽优化不得牺牲信号延迟 —— 延迟是跟单产品核心体验，应使用差分推送而非降低推送频率。</li>
              <li>· KYC/AML 与法务成本随用户线性增长，属于刚性支出，不能作为降价腾挪空间。</li>
              <li>· 旗舰版维持 $149+ 高价位，避免品牌形象从「专业工具」下移为「低价工具」。</li>
            </ul>
          </div>
        </div>
      </section>
    </>
  );
}

function Kpi({ label, value, sub, tone }: { label: string; value: string; sub: string; tone?: "up" }) {
  return (
    <div className="card-surface p-5">
      <div className="text-[12.5px] text-muted-foreground">{label}</div>
      <div className={cn("num mt-2 text-[24px] font-bold leading-none", tone === "up" ? "text-[#0ecb81]" : "")}>
        {value}
      </div>
      <div className="mt-1.5 text-[11.5px] text-muted-foreground">{sub}</div>
    </div>
  );
}

function Bar({
  label,
  value,
  total,
  color,
  note,
}: {
  label: string;
  value: number;
  total: number;
  color: string;
  note: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <span className="text-[13.5px] font-semibold">{label}</span>
        <span className="num text-[13.5px] font-bold">
          {fmtMoney(value)} <span className="text-[11.5px] font-normal text-muted-foreground">{pct(value, total)}</span>
        </span>
      </div>
      <div className="mt-2 h-2.5 overflow-hidden rounded-pill bg-surface">
        <div className="h-full rounded-pill" style={{ width: `${(value / total) * 100}%`, background: color }} />
      </div>
      <div className="mt-2 text-[11.5px] text-muted-foreground">{note}</div>
    </div>
  );
}

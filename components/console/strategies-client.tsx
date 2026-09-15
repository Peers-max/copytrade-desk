"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Search } from "lucide-react";
import { Badge, RiskPill, Sparkline, cn } from "@/components/ui";
import { PageHeader } from "@/components/console/ui";
import { fmtPct, fmtUsd } from "@/lib/format";
import type { Strategy } from "@/lib/types";

export function StrategiesClient({
  strategies,
  subscribed,
}: {
  strategies: Strategy[];
  subscribed: string[];
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [risk, setRisk] = useState<"all" | "low" | "medium" | "high">("all");
  const [subs, setSubs] = useState<string[]>(subscribed);
  const [busy, setBusy] = useState("");

  const list = useMemo(() => {
    return strategies.filter((s) => {
      const kw = q.trim().toLowerCase();
      const okKw = !kw || s.name.toLowerCase().includes(kw) || s.type.includes(kw) || s.desc.toLowerCase().includes(kw);
      const okRisk = risk === "all" || s.risk === risk;
      return okKw && okRisk;
    });
  }, [strategies, q, risk]);

  async function subscribe(s: Strategy) {
    setBusy(s.id);
    const r = await fetch("/api/strategies", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ strategyId: s.id, capital: s.minCapital }),
    });
    const j = await r.json();
    setBusy("");
    if (j.ok) {
      setSubs((p) => [...p, s.id]);
      router.refresh();
    }
  }

  return (
    <>
      <PageHeader
        title="策略市场"
        desc="经过回测与实盘验证的量化策略，订阅后即可在你的交易所自动运行。"
        actions={
          <a href="/my-strategy" className="btn-ghost">
            我的策略 ({subs.length})
          </a>
        }
      />

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 rounded-2xl border border-border bg-card px-3.5 py-2.5">
          <Search size={15} className="text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="搜索策略名称 / 类型"
            className="w-52 bg-transparent text-[13.5px] outline-none placeholder:text-muted-foreground/60"
          />
        </div>
        <div className="flex gap-1.5">
          {(
            [
              ["all", "全部"],
              ["low", "低风险"],
              ["medium", "中风险"],
              ["high", "高风险"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setRisk(k)}
              className={cn(
                "rounded-pill border px-3.5 py-2 text-[13px] font-medium transition",
                risk === k ? "border-transparent bg-foreground text-background" : "border-border bg-card text-muted-foreground"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {list.map((s) => {
          const isSub = subs.includes(s.id);
          return (
            <div key={s.id} className="card-surface flex flex-col p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[14.5px] font-semibold">{s.name}</div>
                  <div className="mt-0.5 text-[12px] text-muted-foreground">{s.type}</div>
                </div>
                <RiskPill risk={s.risk} />
              </div>
              <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground">{s.desc}</p>

              <div className="mt-4 grid grid-cols-3 gap-3">
                <div>
                  <div className="text-[11px] text-muted-foreground">近 30 日</div>
                  <div className="num text-[15px] font-bold text-[#0ecb81]">{fmtPct(s.roi30d)}</div>
                </div>
                <div>
                  <div className="text-[11px] text-muted-foreground">胜率</div>
                  <div className="num text-[15px] font-bold">{s.winRate}%</div>
                </div>
                <div>
                  <div className="text-[11px] text-muted-foreground">最大回撤</div>
                  <div className="num text-[15px] font-bold text-[#f6465d]">{s.maxDrawdown}%</div>
                </div>
              </div>

              <div className="mt-4 flex items-end justify-between">
                <div className="text-[11.5px] leading-5 text-muted-foreground">
                  最低 {fmtUsd(s.minCapital, 0)} USDT · Sharpe {s.sharpe}
                  <br />
                  {s.followers.toLocaleString()} 人订阅
                </div>
                <Sparkline data={s.curve.slice(-24)} width={88} height={32} />
              </div>

              <button
                onClick={() => !isSub && subscribe(s)}
                disabled={isSub || busy === s.id}
                className={cn(
                  "mt-4 inline-flex items-center justify-center gap-1.5 rounded-pill px-4 py-2.5 text-[13.5px] font-semibold transition",
                  isSub ? "bg-surface text-muted-foreground" : "bg-wise-green text-wise-darkgreen hover:opacity-90"
                )}
              >
                {isSub ? (
                  <>
                    <Check size={15} /> 已订阅
                  </>
                ) : busy === s.id ? (
                  "订阅中…"
                ) : (
                  "订阅策略"
                )}
              </button>
            </div>
          );
        })}
      </div>

      <div className="mt-6 rounded-3xl border border-warning/40 bg-warning/10 p-4 text-[12.5px] leading-relaxed">
        <Badge tone="warn">风险提示</Badge>
        <span className="ml-2 text-muted-foreground">
          回测收益基于历史数据，未计入实盘滑点与极端行情；策略在不同市场状态下表现可能显著不同，请先用小额资金试运行。
        </span>
      </div>
    </>
  );
}

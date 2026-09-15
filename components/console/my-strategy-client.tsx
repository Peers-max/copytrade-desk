"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pause, Play, Trash2 } from "lucide-react";
import { Badge, RiskPill, Sparkline, cn } from "@/components/ui";
import { PageHeader, Td, Th } from "@/components/console/ui";
import { fmtPct, fmtUsd, signClass, timeAgo } from "@/lib/format";
import type { Strategy } from "@/lib/types";

export type MySub = {
  id: string;
  strategyId: string;
  capital: number;
  running: boolean;
  pnl: number;
  createdAt: number;
};

export function MyStrategyClient({ strategies, subs }: { strategies: Strategy[]; subs: MySub[] }) {
  const router = useRouter();
  const [items, setItems] = useState<MySub[]>(subs);

  async function patch(id: string, patch: Partial<MySub>) {
    setItems((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
    await fetch("/api/strategies", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, ...patch }),
    });
    router.refresh();
  }

  async function del(id: string) {
    setItems((prev) => prev.filter((s) => s.id !== id));
    await fetch(`/api/strategies?id=${id}`, { method: "DELETE" });
    router.refresh();
  }

  const totalCapital = items.reduce((a, s) => a + s.capital, 0);
  const totalPnl = items.reduce((a, s) => a + s.pnl, 0);

  return (
    <>
      <PageHeader
        title="我的策略"
        desc={`共 ${items.length} 个策略 · 占用资金 ${fmtUsd(totalCapital)} USDT · 累计盈亏 ${
          totalPnl >= 0 ? "+" : ""
        }${fmtUsd(totalPnl)} USDT`}
        actions={
          <a href="/strategies" className="btn-primary">
            去策略市场
          </a>
        }
      />

      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        {[
          { k: "运行中", v: items.filter((s) => s.running).length },
          { k: "已暂停", v: items.filter((s) => !s.running).length },
          { k: "累计盈亏", v: `${totalPnl >= 0 ? "+" : ""}${fmtUsd(totalPnl)}` },
        ].map((x) => (
          <div key={x.k} className="card-surface p-4">
            <div className="text-[12.5px] text-muted-foreground">{x.k}</div>
            <div className="num mt-1.5 text-[22px] font-bold">{x.v}</div>
          </div>
        ))}
      </div>

      <div className="card-surface overflow-x-auto p-0">
        {items.length === 0 ? (
          <div className="py-14 text-center text-[13.5px] text-muted-foreground">还没有订阅策略。</div>
        ) : (
          <table className="w-full">
            <thead className="border-b border-border">
              <tr>
                <Th>策略</Th>
                <Th>分配资金</Th>
                <Th>近 30 日</Th>
                <Th>我的盈亏</Th>
                <Th>订阅时间</Th>
                <Th>状态</Th>
                <Th>操作</Th>
              </tr>
            </thead>
            <tbody>
              {items.map((s) => {
                const st = strategies.find((x) => x.id === s.strategyId);
                if (!st) return null;
                return (
                  <tr key={s.id} className="border-b border-border/60 last:border-0">
                    <Td>
                      <div className="flex items-center gap-3">
                        <Sparkline data={st.curve.slice(-20)} width={64} height={26} />
                        <div>
                          <div className="font-medium">{st.name}</div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[11px] text-muted-foreground">{st.type}</span>
                            <RiskPill risk={st.risk} />
                          </div>
                        </div>
                      </div>
                    </Td>
                    <Td className="num">{fmtUsd(s.capital)} USDT</Td>
                    <Td className="num text-[#0ecb81]">{fmtPct(st.roi30d)}</Td>
                    <Td className={cn("num font-semibold", signClass(s.pnl))}>
                      {s.pnl >= 0 ? "+" : ""}
                      {fmtUsd(s.pnl)}
                    </Td>
                    <Td className="text-muted-foreground">{timeAgo(s.createdAt)}</Td>
                    <Td>
                      <Badge tone={s.running ? "green" : "default"}>{s.running ? "运行中" : "已暂停"}</Badge>
                    </Td>
                    <Td>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => patch(s.id, { running: !s.running })}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition hover:bg-surface"
                        >
                          {s.running ? <Pause size={14} /> : <Play size={14} />}
                        </button>
                        <button
                          onClick={() => del(s.id)}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card text-[#f6465d] transition hover:bg-surface"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

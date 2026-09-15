"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Pause, Play, Plus, Search, Settings2, Trash2, X } from "lucide-react";
import { Avatar, Badge, RiskPill, Sparkline, cn } from "@/components/ui";
import { PageHeader, Panel, Td, Th } from "@/components/console/ui";
import { fmtPct, fmtUsd, signClass, timeAgo } from "@/lib/format";
import type { CopyRelation, Trader } from "@/lib/types";

type SortKey = "roi30d" | "winRate" | "followers" | "maxDrawdown";

export function CopyTradingClient({
  traders,
  relations: initialRelations,
}: {
  traders: Trader[];
  relations: CopyRelation[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"market" | "mine">("market");
  const [q, setQ] = useState("");
  const [risk, setRisk] = useState<"all" | "low" | "medium" | "high">("all");
  const [sort, setSort] = useState<SortKey>("roi30d");
  const [relations, setRelations] = useState<CopyRelation[]>(initialRelations);
  const [modal, setModal] = useState<Trader | null>(null);
  const [form, setForm] = useState<{
    capital: number;
    leverage: number;
    mode: "fixed" | "ratio";
    ratio: number;
    stopLossPct: number;
    takeProfitPct: number;
  }>({ capital: 1000, leverage: 3, mode: "fixed", ratio: 20, stopLossPct: 20, takeProfitPct: 50 });
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");

  const list = useMemo(() => {
    let out = traders.filter((t) => {
      const kw = q.trim().toLowerCase();
      const matchKw = !kw || t.name.toLowerCase().includes(kw) || t.style.includes(kw) || t.tags.some((x) => x.includes(kw));
      const matchRisk = risk === "all" || t.risk === risk;
      return matchKw && matchRisk;
    });
    out = [...out].sort((a, b) => (sort === "maxDrawdown" ? a[sort] - b[sort] : (b[sort] as number) - (a[sort] as number)));
    return out;
  }, [traders, q, risk, sort]);

  const following = new Set(relations.map((r) => r.traderId));

  async function createFollow() {
    if (!modal) return;
    setBusy(true);
    const r = await fetch("/api/copy-trading", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ traderId: modal.id, ...form }),
    });
    const j = await r.json();
    setBusy(false);
    if (!j.ok) return setToast(j.error ?? "创建失败");
    setRelations((prev) => [...prev, j.relation]);
    setModal(null);
    setToast(`已开始跟单 ${modal.name}`);
    setTimeout(() => setToast(""), 2400);
    router.refresh();
  }

  async function patch(id: string, patch: Partial<CopyRelation>) {
    setRelations((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    await fetch("/api/copy-trading", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, ...patch }),
    });
    router.refresh();
  }

  async function del(id: string) {
    setRelations((prev) => prev.filter((r) => r.id !== id));
    await fetch(`/api/copy-trading?id=${id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <>
      <PageHeader
        title="跟单交易"
        desc="选择交易员，一键跟随。资金留在你的交易所，随时可暂停或取消。"
        actions={
          <div className="flex rounded-pill border border-border bg-card p-1">
            {(["market", "mine"] as const).map((k) => (
              <button
                key={k}
                onClick={() => setTab(k)}
                className={cn(
                  "rounded-pill px-4 py-1.5 text-[13px] font-semibold transition",
                  tab === k ? "bg-wise-green text-wise-darkgreen" : "text-muted-foreground"
                )}
              >
                {k === "market" ? "交易员广场" : `我的跟单 (${relations.length})`}
              </button>
            ))}
          </div>
        }
      />

      {tab === "market" ? (
        <>
          <div className="mb-5 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 rounded-2xl border border-border bg-card px-3.5 py-2.5">
              <Search size={15} className="text-muted-foreground" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="搜索交易员 / 风格 / 标签"
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
            <div className="ml-auto flex items-center gap-2 text-[13px] text-muted-foreground">
              排序
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortKey)}
                className="rounded-xl border border-border bg-card px-3 py-2 text-[13px] outline-none"
              >
                <option value="roi30d">近 30 日收益</option>
                <option value="winRate">胜率</option>
                <option value="followers">跟单人数</option>
                <option value="maxDrawdown">最大回撤（低→高）</option>
              </select>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {list.map((t) => (
              <div key={t.id} className="card-surface flex flex-col p-5">
                <div className="flex items-start gap-3">
                  <Avatar name={t.name} hue={t.avatarHue} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-[14.5px] font-semibold">{t.name}</span>
                      {t.verified ? (
                        <span className="rounded bg-wise-mint px-1.5 py-0.5 text-[10px] font-bold text-wise-darkgreen">
                          已认证
                        </span>
                      ) : null}
                    </div>
                    <div className="truncate text-[12px] text-muted-foreground">{t.tagline}</div>
                  </div>
                  <RiskPill risk={t.risk} />
                </div>

                <div className="mt-4 grid grid-cols-3 gap-3">
                  <Metric label="近 30 日" value={fmtPct(t.roi30d)} tone="up" />
                  <Metric label="胜率" value={`${t.winRate}%`} />
                  <Metric label="最大回撤" value={`${t.maxDrawdown}%`} tone="down" />
                </div>

                <div className="mt-3 flex items-end justify-between">
                  <div className="text-[11.5px] leading-5 text-muted-foreground">
                    累计 {fmtPct(t.roiTotal, 0)} · Sharpe {t.sharpe}
                    <br />
                    {t.followers.toLocaleString()} 人跟单 · AUM ${(t.aum / 1e6).toFixed(1)}M
                  </div>
                  <Sparkline data={t.curve.slice(-28)} width={92} height={34} />
                </div>

                <button
                  onClick={() => {
                    setModal(t);
                    setForm({ capital: 1000, leverage: 3, mode: "fixed", ratio: 20, stopLossPct: 20, takeProfitPct: 50 });
                  }}
                  disabled={following.has(t.id)}
                  className={cn(
                    "mt-4 inline-flex items-center justify-center gap-1.5 rounded-pill px-4 py-2.5 text-[13.5px] font-semibold transition",
                    following.has(t.id) ? "bg-surface text-muted-foreground" : "bg-wise-green text-wise-darkgreen hover:opacity-90"
                  )}
                >
                  {following.has(t.id) ? "已跟单" : (
                    <>
                      <Plus size={15} /> 跟单
                    </>
                  )}
                </button>
              </div>
            ))}
          </div>
        </>
      ) : (
        <Panel title="我的跟单" desc="暂停后不再同步新信号，已开仓位保持不动" bodyClassName="p-0">
          {relations.length === 0 ? (
            <div className="py-14 text-center text-[13.5px] text-muted-foreground">还没有跟单，去「交易员广场」挑一个吧。</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b border-border">
                  <tr>
                    <Th>交易员</Th>
                    <Th>跟单资金</Th>
                    <Th>模式 / 杠杆</Th>
                    <Th>止损 / 止盈</Th>
                    <Th>盈亏</Th>
                    <Th>状态</Th>
                    <Th>操作</Th>
                  </tr>
                </thead>
                <tbody>
                  {relations.map((r) => {
                    const t = traders.find((x) => x.id === r.traderId);
                    return (
                      <tr key={r.id} className="border-b border-border/60 last:border-0">
                        <Td>
                          <div className="flex items-center gap-2">
                            <div
                              className="flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold text-wise-darkgreen"
                              style={{ background: `hsl(${t?.avatarHue ?? 90} 72% 78%)` }}
                            >
                              {(t?.name ?? "??").slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <div className="font-medium">{t?.name}</div>
                              <div className="text-[11px] text-muted-foreground">
                                {timeAgo(r.createdAt)}开始 · 同步 {r.copiedTrades} 笔
                              </div>
                            </div>
                          </div>
                        </Td>
                        <Td className="num">{fmtUsd(r.capital)} USDT</Td>
                        <Td>
                          {r.mode === "fixed" ? "固定金额" : `按比例 ${r.ratio}%`} · {r.leverage}x
                        </Td>
                        <Td className="num">
                          {r.stopLossPct}% / {r.takeProfitPct}%
                        </Td>
                        <Td className={cn("num font-semibold", signClass(r.pnl))}>
                          {r.pnl >= 0 ? "+" : ""}
                          {fmtUsd(r.pnl)} ({fmtPct(r.pnlPct, 1)})
                        </Td>
                        <Td>
                          <Badge tone={r.status === "running" ? "green" : "default"}>
                            {r.status === "running" ? "运行中" : r.status === "paused" ? "已暂停" : "已停止"}
                          </Badge>
                        </Td>
                        <Td>
                          <div className="flex items-center gap-1">
                            <IconBtn
                              onClick={() => patch(r.id, { status: r.status === "running" ? "paused" : "running" })}
                              title={r.status === "running" ? "暂停" : "继续"}
                            >
                              {r.status === "running" ? <Pause size={14} /> : <Play size={14} />}
                            </IconBtn>
                            <IconBtn title="参数"><Settings2 size={14} /></IconBtn>
                            <IconBtn onClick={() => del(r.id)} title="取消跟单" danger>
                              <Trash2 size={14} />
                            </IconBtn>
                          </div>
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      )}

      {modal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setModal(null)}>
          <div
            className="w-full max-w-[440px] rounded-3xl border border-border bg-card p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="text-[17px] font-bold">跟单 {modal.name}</div>
                <div className="mt-0.5 text-[12.5px] text-muted-foreground">{modal.tagline}</div>
              </div>
              <button onClick={() => setModal(null)} className="text-muted-foreground">
                <X size={18} />
              </button>
            </div>

            <div className="mt-5 space-y-4">
              <Field label="跟单模式">
                <div className="flex gap-2">
                  {(["fixed", "ratio"] as const).map((m) => (
                    <button
                      key={m}
                      onClick={() => setForm({ ...form, mode: m })}
                      className={cn(
                        "flex-1 rounded-xl border px-3 py-2.5 text-[13px] font-medium transition",
                        form.mode === m ? "border-wise-green bg-wise-mint text-wise-darkgreen" : "border-border"
                      )}
                    >
                      {m === "fixed" ? "固定金额" : "按比例跟单"}
                    </button>
                  ))}
                </div>
              </Field>

              <Field label={form.mode === "fixed" ? "跟单资金 (USDT)" : "跟单比例 (%)"}>
                <input
                  type="number"
                  value={form.mode === "fixed" ? form.capital : form.ratio || 20}
                  onChange={(e) =>
                    setForm(
                      form.mode === "fixed"
                        ? { ...form, capital: Number(e.target.value) }
                        : { ...form, ratio: Number(e.target.value) }
                    )
                  }
                  className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-[14px] outline-none focus:border-wise-green"
                />
              </Field>

              <Field label={`杠杆 ${form.leverage}x`}>
                <input
                  type="range"
                  min={1}
                  max={20}
                  value={form.leverage}
                  onChange={(e) => setForm({ ...form, leverage: Number(e.target.value) })}
                  className="w-full accent-wise-green"
                />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="止损 (%)">
                  <input
                    type="number"
                    value={form.stopLossPct}
                    onChange={(e) => setForm({ ...form, stopLossPct: Number(e.target.value) })}
                    className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-[14px] outline-none focus:border-wise-green"
                  />
                </Field>
                <Field label="止盈 (%)">
                  <input
                    type="number"
                    value={form.takeProfitPct}
                    onChange={(e) => setForm({ ...form, takeProfitPct: Number(e.target.value) })}
                    className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-[14px] outline-none focus:border-wise-green"
                  />
                </Field>
              </div>
            </div>

            <button onClick={createFollow} disabled={busy} className="btn-primary mt-6 w-full py-3">
              {busy ? "创建中…" : "确认跟单"}
            </button>
            <p className="mt-3 text-center text-[11.5px] text-muted-foreground">
              资金不会离开你的交易所，平台仅获取交易权限。
            </p>
          </div>
        </div>
      ) : null}

      {toast ? (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-pill bg-foreground px-5 py-2.5 text-[13px] font-medium text-background shadow-card">
          {toast}
        </div>
      ) : null}
    </>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: "up" | "down" }) {
  return (
    <div>
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div
        className={cn(
          "num text-[15px] font-bold",
          tone === "up" ? "text-[#0ecb81]" : tone === "down" ? "text-[#f6465d]" : ""
        )}
      >
        {value}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-[12.5px] font-medium text-muted-foreground">{label}</span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

function IconBtn({
  children,
  onClick,
  title,
  danger,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  title?: string;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={cn(
        "inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card transition hover:bg-surface",
        danger ? "text-[#f6465d]" : "text-muted-foreground"
      )}
    >
      {children}
    </button>
  );
}

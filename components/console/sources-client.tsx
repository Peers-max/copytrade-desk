"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  Activity,
  Copy as CopyIcon,
  Link2,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Send,
  Trash2,
  Webhook,
  X,
  Zap,
} from "lucide-react";
import { Badge, cn } from "@/components/ui";
import { PageHeader, Panel } from "@/components/console/ui";
import { fmtUsd, timeAgo } from "@/lib/format";
import type { Trader } from "@/lib/types";

type SourceItem = Trader & { webhookUrl?: string };

const KIND_LABEL: Record<string, string> = {
  ema_cross: "EMA 均线交叉",
  rsi_revert: "RSI 均值回归",
  breakout: "区间突破",
  grid: "网格",
};

const INTERVALS = ["1m", "5m", "15m", "1h", "4h", "1d"];

export function SourcesClient({
  initial,
  symbols,
  baseUrl,
}: {
  initial: SourceItem[];
  symbols: string[];
  baseUrl: string;
}) {
  const router = useRouter();
  const [sources, setSources] = useState<SourceItem[]>(initial);
  const [createOpen, setCreateOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");
  const [error, setError] = useState("");
  const [runReport, setRunReport] = useState<any>(null);
  const [publishing, setPublishing] = useState<SourceItem | null>(null);

  const [form, setForm] = useState<{
    name: string;
    tagline: string;
    source: "quant" | "webhook" | "manual";
    risk: "low" | "medium" | "high";
    symbols: string[];
    kind: string;
    interval: string;
    params: string;
    note: string;
  }>({
    name: "",
    tagline: "",
    source: "quant",
    risk: "medium",
    symbols: ["BTC/USDT"],
    kind: "ema_cross",
    interval: "15m",
    params: '{"fast":12,"slow":26}',
    note: "",
  });

  function flash(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      flash("已复制到剪贴板");
    } catch {
      flash("复制失败，请手动选中复制");
    }
  }

  async function create() {
    setBusy(true);
    setError("");
    let params: any = {};
    if (form.source === "quant") {
      try {
        params = form.params.trim() ? JSON.parse(form.params) : {};
      } catch {
        setBusy(false);
        return setError("策略参数不是合法 JSON，例如 {\"fast\":12,\"slow\":26}");
      }
    }
    const r = await fetch("/api/sources", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        tagline: form.tagline,
        source: form.source,
        risk: form.risk,
        symbols: form.symbols,
        note: form.note,
        quant: form.source === "quant" ? { kind: form.kind, interval: form.interval, params } : undefined,
      }),
    });
    const j = await r.json();
    setBusy(false);
    if (!j.ok) return setError(j.error ?? "创建失败");
    setSources((p) => [j.source, ...p]);
    setCreateOpen(false);
    flash("信号源已创建");
    router.refresh();
  }

  async function patch(id: string, body: any, okMsg?: string) {
    const r = await fetch("/api/sources", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, ...body }),
    });
    const j = await r.json();
    if (j.ok && okMsg) flash(okMsg);
    router.refresh();
    return j;
  }

  async function del(id: string, name: string) {
    if (!confirm(`删除信号源「${name}」？已有的跟单关系会保留但不再有新信号。`)) return;
    await fetch(`/api/sources?id=${id}`, { method: "DELETE" });
    setSources((p) => p.filter((s) => s.id !== id));
    flash("已删除");
    router.refresh();
  }

  async function runQuant(id?: string) {
    setBusy(true);
    setRunReport(null);
    const r = await fetch("/api/quant/run", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(id ? { traderId: id } : {}),
    });
    const j = await r.json();
    setBusy(false);
    if (!j.ok) return flash(j.error ?? "运行失败");
    setRunReport(j.report);
    flash(`引擎跑完：检查 ${j.report?.ran ?? 0} 个信号源，有效信号 ${j.report?.emitted ?? 0} 笔`);
    router.refresh();
  }

  return (
    <>
      <PageHeader
        title="信号源管理"
        desc="跟单列表里的「交易员」，本质就是一个信号源。三种接入方式：内置量化引擎、外部 Webhook、手动发布。"
        actions={
          <>
            <button onClick={() => runQuant()} disabled={busy} className="btn-ghost">
              <Zap size={15} /> 立即运行一轮
            </button>
            <button onClick={() => setCreateOpen(true)} className="btn-primary">
              <Plus size={15} /> 新建信号源
            </button>
          </>
        }
      />

      <div className="mb-5 grid gap-4 md:grid-cols-3">
        <HowCard
          icon={Activity}
          title="内置量化引擎"
          desc="服务端定时拉真实 K 线算指标（EMA 交叉 / RSI 回归 / 区间突破 / 网格），触发条件即发信号。自包含，不依赖外部。"
        />
        <HowCard
          icon={Webhook}
          title="外部 Webhook"
          desc="每个 Webhook 信号源有一个带 token 的独享地址。TradingView 预警、你自己的程序、第三方信号都能推进来。"
        />
        <HowCard
          icon={Send}
          title="手动发布"
          desc="看到值得跟的仓位，在下面「手动发布信号」里填一笔，立刻真实同步下去。"
        />
      </div>

      <Panel title="信号源列表" desc={`共 ${sources.length} 个`} bodyClassName="p-0">
        {sources.length === 0 ? (
          <div className="py-14 text-center text-[13.5px] text-muted-foreground">
            还没有信号源。先创建一个量化策略型，或建一个 Webhook 型把外部信号接进来。
          </div>
        ) : (
          <div className="divide-y divide-border">
            {sources.map((s) => (
              <div key={s.id} className="px-5 py-4">
                <div className="flex flex-wrap items-start gap-3">
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-[12px] font-bold text-wise-darkgreen"
                    style={{ background: `hsl(${s.avatarHue} 72% 78%)` }}
                  >
                    {s.name.slice(0, 2).toUpperCase()}
                  </div>

                  <div className="min-w-[180px] flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[14px] font-semibold">{s.name}</span>
                      <Badge tone={s.status === "live" ? "green" : "default"}>
                        {s.status === "live" ? "运行中" : "已暂停"}
                      </Badge>
                      <span className="rounded bg-surface px-1.5 py-0.5 text-[10.5px] font-semibold text-muted-foreground">
                        {s.source === "quant" ? "量化引擎" : s.source === "webhook" ? "Webhook" : "手动发布"}
                      </span>
                    </div>
                    <div className="mt-0.5 text-[12px] text-muted-foreground">{s.tagline}</div>
                    <div className="mt-1 text-[11.5px] text-muted-foreground">
                      覆盖 {(s.symbols ?? []).join(" · ") || "—"}
                      {s.quant ? ` · ${KIND_LABEL[s.quant.kind] ?? s.quant.kind} · ${s.quant.interval}` : ""}
                      {s.lastSignalAt ? ` · 最近信号 ${timeAgo(s.lastSignalAt)}` : " · 尚无信号"}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-5 text-right">
                    <Mini label="信号" value={String(s.trades ?? 0)} />
                    <Mini label="跟单人数" value={String(s.followers ?? 0)} />
                    <Mini label="AUM" value={fmtUsd(s.aum ?? 0, 0)} />
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => patch(s.id, { status: s.status === "live" ? "paused" : "live" }, s.status === "live" ? "已暂停" : "已启用")}
                      className="inline-flex h-8 items-center gap-1 rounded-lg border border-border px-2.5 text-[12px] transition hover:bg-surface"
                    >
                      {s.status === "live" ? <Pause size={13} /> : <Play size={13} />}
                      {s.status === "live" ? "暂停" : "启用"}
                    </button>
                    {s.source === "quant" ? (
                      <button
                        onClick={() => runQuant(s.id)}
                        disabled={busy}
                        className="inline-flex h-8 items-center gap-1 rounded-lg border border-border px-2.5 text-[12px] transition hover:bg-surface"
                      >
                        <RefreshCw size={13} /> 跑一轮
                      </button>
                    ) : null}
                    <button
                      onClick={() => setPublishing(s)}
                      className="inline-flex h-8 items-center gap-1 rounded-lg border border-border px-2.5 text-[12px] transition hover:bg-surface"
                    >
                      <Send size={13} /> 发信号
                    </button>
                    <button
                      onClick={() => del(s.id, s.name)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border text-[#f6465d] transition hover:bg-surface"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                {s.source === "webhook" ? (
                  <div className="mt-3 flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-surface/60 px-3.5 py-2.5">
                    <Link2 size={14} className="shrink-0 text-muted-foreground" />
                    <code className="min-w-0 flex-1 truncate font-mono text-[11.5px]">
                      {s.webhookUrl ?? `${baseUrl}/api/webhook/signal?token=${s.webhookToken ?? ""}`}
                    </code>
                    <button
                      onClick={() => copy(s.webhookUrl ?? `${baseUrl}/api/webhook/signal?token=${s.webhookToken ?? ""}`)}
                      className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-2 py-1 text-[11.5px] transition hover:bg-surface"
                    >
                      <CopyIcon size={12} /> 复制
                    </button>
                    <button
                      onClick={async () => {
                        const j = await patch(s.id, { action: "rotate" });
                        if (j.ok) {
                          setSources((p) =>
                            p.map((x) => (x.id === s.id ? { ...x, webhookToken: j.token, webhookUrl: j.webhookUrl } : x))
                          );
                          flash("Token 已轮换，旧地址立即失效");
                        }
                      }}
                      className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-2 py-1 text-[11.5px] transition hover:bg-surface"
                    >
                      <RefreshCw size={12} /> 轮换 token
                    </button>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </Panel>

      {runReport ? (
        <Panel className="mt-5" title="上一轮引擎运行结果" desc={`检查 ${runReport.ran} 个信号源`}>
          {runReport.items?.length ? (
            <div className="space-y-2">
              {runReport.items.map((it: any, i: number) => (
                <div key={i} className="flex flex-wrap items-center gap-2 rounded-xl border border-border px-3 py-2 text-[12.5px]">
                  <span className="font-medium">{it.traderName}</span>
                  <span className="text-muted-foreground">{it.symbol}</span>
                  <span className={it.side === "LONG" ? "text-[#0ecb81]" : "text-[#f6465d]"}>
                    {it.side === "LONG" ? "多" : "空"} · {it.action}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-muted-foreground">{it.reason}</span>
                  {it.error ? (
                    <span className="text-[#f6465d]">{it.error}</span>
                  ) : (
                    <span className="text-muted-foreground">
                      下发 {it.dispatched} · 成功 {it.succeeded} · 失败 {it.failed}
                    </span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[13px] text-muted-foreground">这一轮没有任何策略触发条件（正常，指标没交叉就不该发信号）。</p>
          )}
        </Panel>
      ) : null}

      {publishing ? (
        <PublishModal
          source={publishing}
          symbols={symbols}
          onClose={() => setPublishing(null)}
          onDone={(msg) => {
            flash(msg);
            setPublishing(null);
            router.refresh();
          }}
        />
      ) : null}

      {createOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4" onClick={() => setCreateOpen(false)}>
          <div className="w-full max-w-[520px] rounded-3xl border border-border bg-card p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between">
              <div>
                <div className="text-[17px] font-bold">新建信号源</div>
                <div className="mt-0.5 text-[12.5px] text-muted-foreground">创建后立刻出现在跟单列表里</div>
              </div>
              <button onClick={() => setCreateOpen(false)} className="text-muted-foreground">
                <X size={18} />
              </button>
            </div>

            <div className="mt-5 space-y-4">
              <Field label="名称">
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="例如：BTC 趋势追踪 A"
                  className="input-base"
                />
              </Field>

              <Field label="一句话说明（会显示在跟单列表）">
                <input
                  value={form.tagline}
                  onChange={(e) => setForm({ ...form, tagline: e.target.value })}
                  placeholder="例如：EMA12/26 金叉开多、死叉开空"
                  className="input-base"
                />
              </Field>

              <Field label="信号来源">
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      ["quant", "内置量化引擎"],
                      ["webhook", "外部 Webhook"],
                      ["manual", "手动发布"],
                    ] as const
                  ).map(([k, label]) => (
                    <button
                      key={k}
                      onClick={() =>
                        setForm({
                          ...form,
                          source: k,
                          params: k === "quant" ? form.params || '{"fast":12,"slow":26}' : form.params,
                        })
                      }
                      className={cn(
                        "rounded-xl border px-2 py-2.5 text-[12.5px] font-medium transition",
                        form.source === k ? "border-wise-green bg-wise-mint text-wise-darkgreen" : "border-border"
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </Field>

              {form.source === "quant" ? (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="策略类型">
                      <select
                        value={form.kind}
                        onChange={(e) => {
                          const kind = e.target.value;
                          const defaults: Record<string, string> = {
                            ema_cross: '{"fast":12,"slow":26}',
                            rsi_revert: '{"period":14,"low":30,"high":70,"exit":50}',
                            breakout: '{"lookback":20}',
                            grid: '{"gridPct":1.5}',
                          };
                          setForm({ ...form, kind, params: defaults[kind] ?? "{}" });
                        }}
                        className="input-base"
                      >
                        {Object.entries(KIND_LABEL).map(([k, v]) => (
                          <option key={k} value={k}>
                            {v}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="K 线周期">
                      <select value={form.interval} onChange={(e) => setForm({ ...form, interval: e.target.value })} className="input-base">
                        {INTERVALS.map((i) => (
                          <option key={i} value={i}>
                            {i}
                          </option>
                        ))}
                      </select>
                    </Field>
                  </div>
                  <Field label="策略参数（JSON）">
                    <input value={form.params} onChange={(e) => setForm({ ...form, params: e.target.value })} className="input-base font-mono" />
                  </Field>
                </>
              ) : null}

              <Field label="覆盖的交易对">
                <div className="flex flex-wrap gap-1.5">
                  {symbols.map((s) => {
                    const on = form.symbols.includes(s);
                    return (
                      <button
                        key={s}
                        onClick={() =>
                          setForm({
                            ...form,
                            symbols: on ? form.symbols.filter((x) => x !== s) : [...form.symbols, s],
                          })
                        }
                        className={cn(
                          "rounded-pill border px-3 py-1.5 text-[12px] font-medium transition",
                          on ? "border-wise-green bg-wise-mint text-wise-darkgreen" : "border-border text-muted-foreground"
                        )}
                      >
                        {s}
                      </button>
                    );
                  })}
                </div>
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="风险等级">
                  <select
                    value={form.risk}
                    onChange={(e) => setForm({ ...form, risk: e.target.value as any })}
                    className="input-base"
                  >
                    <option value="low">低风险</option>
                    <option value="medium">中风险</option>
                    <option value="high">高风险</option>
                  </select>
                </Field>
                <Field label="备注（可留空）">
                  <input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} className="input-base" />
                </Field>
              </div>

              {error ? <p className="text-[12.5px] text-[#f6465d]">{error}</p> : null}
            </div>

            <button onClick={create} disabled={busy} className="btn-primary mt-6 w-full py-3">
              {busy ? "创建中…" : "创建信号源"}
            </button>
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

/* ------------------------------------------------------------------ */

function PublishModal({
  source,
  symbols,
  onClose,
  onDone,
}: {
  source: SourceItem;
  symbols: string[];
  onClose: () => void;
  onDone: (msg: string) => void;
}) {
  const [f, setF] = useState({
    symbol: source.symbols?.[0] ?? symbols[0],
    side: "LONG" as "LONG" | "SHORT",
    action: "OPEN" as "OPEN" | "CLOSE" | "ADD" | "REDUCE",
    price: "",
    leverage: String(source.quant ? 3 : 1),
    note: "",
    onlyMe: false,
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function submit() {
    setBusy(true);
    setErr("");
    const r = await fetch("/api/signals/publish", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        traderId: source.id,
        symbol: f.symbol,
        side: f.side,
        action: f.action,
        price: f.price ? Number(f.price) : undefined,
        leverage: Number(f.leverage) || undefined,
        note: f.note,
        onlyMe: f.onlyMe,
      }),
    });
    const j = await r.json();
    setBusy(false);
    if (!j.ok) return setErr(j.error ?? "发布失败");
    onDone(`信号已下发：成功 ${j.succeeded} · 失败 ${j.failed}`);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-[460px] rounded-3xl border border-border bg-card p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <div>
            <div className="text-[17px] font-bold">向「{source.name}」发布信号</div>
            <div className="mt-0.5 text-[12.5px] text-muted-foreground">会立刻按跟单关系在交易所真实下单</div>
          </div>
          <button onClick={onClose} className="text-muted-foreground">
            <X size={18} />
          </button>
        </div>

        <div className="mt-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="交易对">
              <select value={f.symbol} onChange={(e) => setF({ ...f, symbol: e.target.value })} className="input-base">
                {Array.from(new Set([...(source.symbols ?? []), ...symbols])).map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="方向">
              <div className="flex gap-2">
                {(["LONG", "SHORT"] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setF({ ...f, side: s })}
                    className={cn(
                      "flex-1 rounded-xl border px-2 py-2.5 text-[13px] font-semibold transition",
                      f.side === s
                        ? s === "LONG"
                          ? "border-[#0ecb81] bg-[#0ecb81]/12 text-[#0ecb81]"
                          : "border-[#f6465d] bg-[#f6465d]/12 text-[#f6465d]"
                        : "border-border"
                    )}
                  >
                    {s === "LONG" ? "开多" : "开空"}
                  </button>
                ))}
              </div>
            </Field>
          </div>

          <Field label="动作">
            <div className="grid grid-cols-4 gap-2">
              {(["OPEN", "ADD", "REDUCE", "CLOSE"] as const).map((a) => (
                <button
                  key={a}
                  onClick={() => setF({ ...f, action: a })}
                  className={cn(
                    "rounded-xl border px-2 py-2 text-[12px] font-medium transition",
                    f.action === a ? "border-wise-green bg-wise-mint text-wise-darkgreen" : "border-border"
                  )}
                >
                  {a === "OPEN" ? "开仓" : a === "ADD" ? "加仓" : a === "REDUCE" ? "减仓" : "平仓"}
                </button>
              ))}
            </div>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="价格（留空取最新价）">
              <input value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} placeholder="市价" className="input-base" />
            </Field>
            <Field label="杠杆">
              <input value={f.leverage} onChange={(e) => setF({ ...f, leverage: e.target.value })} className="input-base" />
            </Field>
          </div>

          <Field label="备注">
            <input value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder="例如：人工判断，4H 结构突破" className="input-base" />
          </Field>

          <label className="flex items-center gap-2 text-[12.5px] text-muted-foreground">
            <input type="checkbox" checked={f.onlyMe} onChange={(e) => setF({ ...f, onlyMe: e.target.checked })} className="accent-wise-green" />
            只下给我自己的账户（不广播给其他跟单者）
          </label>

          {err ? <p className="text-[12.5px] text-[#f6465d]">{err}</p> : null}
        </div>

        <button onClick={submit} disabled={busy} className="btn-primary mt-6 w-full py-3">
          {busy ? "下发中…" : "确认下发"}
        </button>
      </div>
    </div>
  );
}

function HowCard({ icon: Icon, title, desc }: { icon: any; title: string; desc: string }) {
  return (
    <div className="card-surface p-5">
      <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-wise-mint">
        <Icon size={17} className="text-wise-darkgreen" />
      </span>
      <div className="mt-3 text-[14px] font-semibold">{title}</div>
      <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">{desc}</p>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="num text-[13.5px] font-semibold">{value}</div>
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

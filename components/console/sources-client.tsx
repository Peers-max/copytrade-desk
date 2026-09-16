"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Activity,
  Copy as CopyIcon,
  Download,
  Link2,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Send,
  ShieldAlert,
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

const SOURCE_LABEL: Record<string, string> = {
  okx: "OKX 带单员",
  quant: "量化引擎",
  webhook: "Webhook",
  manual: "手动发布",
};

/** OKX 的收益率/胜率都是小数，×100 才是百分比 */
function pct(v: any, digits = 1): string {
  const x = Number(v);
  if (!Number.isFinite(x)) return "—";
  return `${x >= 0 ? "+" : ""}${(x * 100).toFixed(digits)}%`;
}

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
  const [okxOpen, setOkxOpen] = useState(false);

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
        desc="跟单列表里的「交易员」，本质就是一个信号源。可接入 OKX 官方带单员、内置量化引擎、外部 Webhook，或由站主手动发布。"
        actions={
          <>
            <button onClick={() => setOkxOpen(true)} className="btn-ghost">
              <Download size={15} /> 从 OKX 导入带单员
            </button>
            <button onClick={() => runQuant()} disabled={busy} className="btn-ghost">
              <Zap size={15} /> 立即运行一轮
            </button>
            <button onClick={() => setCreateOpen(true)} className="btn-primary">
              <Plus size={15} /> 新建信号源
            </button>
          </>
        }
      />

      <div className="mb-5 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <HowCard
          icon={Download}
          title="OKX 官方带单员"
          desc="从 OKX 跟单平台拉真实带单员名册：AUM、跟单人数、收益曲线、胜率全部是 OKX 的真实数据。跟单走 OKX 原生引擎，实时同步开平仓。"
        />
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
                  {s.avatarUrl ? (
                    <img
                      src={s.avatarUrl}
                      alt={s.name}
                      className="h-10 w-10 shrink-0 rounded-2xl object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-[12px] font-bold text-wise-darkgreen"
                      style={{ background: `hsl(${s.avatarHue} 72% 78%)` }}
                    >
                      {s.name.slice(0, 2).toUpperCase()}
                    </div>
                  )}

                  <div className="min-w-[180px] flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[14px] font-semibold">{s.name}</span>
                      <Badge tone={s.status === "live" ? "green" : "default"}>
                        {s.status === "live" ? "运行中" : "已暂停"}
                      </Badge>
                      <span className="rounded bg-surface px-1.5 py-0.5 text-[10.5px] font-semibold text-muted-foreground">
                        {SOURCE_LABEL[s.source] ?? s.source}
                      </span>
                      {s.source === "okx" && s.okx?.hidesPositions ? (
                        <span className="inline-flex items-center gap-1 rounded bg-[#faeeda] px-1.5 py-0.5 text-[10.5px] font-semibold text-[#854f0b]">
                          <ShieldAlert size={11} /> 持仓隐藏
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-0.5 text-[12px] text-muted-foreground">{s.tagline}</div>
                    <div className="mt-1 text-[11.5px] text-muted-foreground">
                      覆盖 {(s.symbols ?? []).join(" · ") || "—"}
                      {s.quant ? ` · ${KIND_LABEL[s.quant.kind] ?? s.quant.kind} · ${s.quant.interval}` : ""}
                      {s.source === "okx"
                        ? ` · 带单 ${s.okx?.leadDays ?? "—"} 天 · 胜率 ${pct(s.okx?.winRatio)}`
                        : s.lastSignalAt
                          ? ` · 最近信号 ${timeAgo(s.lastSignalAt)}`
                          : " · 尚无信号"}
                    </div>
                    {s.source === "okx" && s.okx?.hidesPositions ? (
                      <div className="mt-1 text-[11px] text-[#854f0b]">
                        该带单员隐藏了当前持仓。自建镜像无法跟，但 OKX 原生跟单不受影响——OKX 自己会同步他的成交。
                      </div>
                    ) : null}
                  </div>

                  {s.source === "okx" ? (
                    <div className="grid grid-cols-3 gap-5 text-right">
                      <Mini
                        label="累计收益"
                        value={pct(s.okx?.pnlRatio, 2)}
                        tone={Number(s.okx?.pnlRatio) >= 0 ? "up" : "down"}
                      />
                      <Mini label="跟单人数" value={String(s.followers ?? 0)} />
                      <Mini label="AUM" value={fmtUsd(s.aum ?? 0, 0)} />
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-5 text-right">
                      <Mini label="信号" value={String(s.trades ?? 0)} />
                      <Mini label="跟单人数" value={String(s.followers ?? 0)} />
                      <Mini label="AUM" value={fmtUsd(s.aum ?? 0, 0)} />
                    </div>
                  )}

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
                    {s.source === "okx" ? null : (
                      <button
                        onClick={() => setPublishing(s)}
                        className="inline-flex h-8 items-center gap-1 rounded-lg border border-border px-2.5 text-[12px] transition hover:bg-surface"
                      >
                        <Send size={13} /> 发信号
                      </button>
                    )}
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

      {okxOpen ? (
        <OkxImportModal
          onClose={() => setOkxOpen(false)}
          onDone={(msg) => {
            flash(msg);
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

type OkxRank = {
  uniqueCode: string;
  nickName: string;
  portLink?: string;
  aum: number;
  copyTraderNum: number;
  accCopyTraderNum: number;
  leadDays: number;
  pnl: number;
  roiRatio: number;
  winRatio: number;
  traderInsts: string[];
  ccy: string;
};

const LEAD_DAYS_OPTIONS: Array<[string, string]> = [
  ["", "不限带单时长"],
  ["1", "≥ 7 天"],
  ["2", "≥ 30 天"],
  ["3", "≥ 90 天"],
  ["4", "≥ 180 天"],
];

const SORT_OPTIONS: Array<[string, string]> = [
  ["overview", "综合排序"],
  ["pnl_ratio", "按收益率"],
  ["pnl", "按累计盈亏"],
  ["aum", "按管理资金"],
  ["win_ratio", "按胜率"],
  ["current_copy_trader_pnl", "按跟单者收益"],
];

/**
 * 从 OKX 跟单平台导入真实带单员。
 *
 * 这里展示的每一个数字都直接来自 OKX 的公开接口，本地不做任何估算或加工。
 * 注意 OKX 的收益率/胜率是小数，展示时统一 ×100。
 */
function OkxImportModal({ onClose, onDone }: { onClose: () => void; onDone: (msg: string) => void }) {
  const [ranks, setRanks] = useState<OkxRank[]>([]);
  const [imported, setImported] = useState<Record<string, string>>({});
  const [limits, setLimits] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState("");
  const [importSummary, setImportSummary] = useState<any[]>([]);

  const [sortType, setSortType] = useState("overview");
  const [minLeadDays, setMinLeadDays] = useState("");
  const [minAum, setMinAum] = useState("");
  const [page, setPage] = useState(1);
  const [dataVer, setDataVer] = useState<string | undefined>(undefined);

  async function load(opts?: { page?: number; sortType?: string; minLeadDays?: string; minAum?: string; dataVer?: string }) {
    const p = opts?.page ?? page;
    const s = opts?.sortType ?? sortType;
    const d = opts?.minLeadDays ?? minLeadDays;
    const a = opts?.minAum ?? minAum;
    const v = opts?.dataVer ?? dataVer;

    setLoading(true);
    setErr("");
    try {
      const qs = new URLSearchParams({ limit: "20", page: String(p), sortType: s });
      if (d) qs.set("minLeadDays", d);
      if (a) qs.set("minAum", a);
      if (v) qs.set("dataVer", v);

      const r = await fetch(`/api/okx/traders?${qs}`);
      const j = await r.json();
      if (!j.ok) {
        setErr(j.error ?? "读取失败");
        setRanks([]);
      } else {
        setRanks(j.ranks ?? []);
        setImported(j.imported ?? {});
        setLimits(j.limits ?? null);
        if (j.dataVer) setDataVer(j.dataVer);
        if (!j.ranks?.length) setErr("这个筛选条件下 OKX 没有返回带单员，放宽条件试试。");
      }
    } catch (e: any) {
      setErr(String(e?.message ?? e));
    }
    setLoading(false);
  }

  useEffect(() => {
    load({ page: 1, dataVer: undefined });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function doImport(codes: string[]) {
    if (!codes.length) return;
    setBusy(codes[0]);
    setErr("");
    try {
      const r = await fetch("/api/okx/traders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ uniqueCodes: codes }),
      });
      const j = await r.json();
      if (!j.ok) {
        setErr(j.error ?? "导入失败");
      } else {
        setImportSummary(j.results ?? []);
        const okCount = j.imported ?? 0;
        const failCount = j.failed ?? 0;
        onDone(failCount ? `导入完成：成功 ${okCount} 个，失败 ${failCount} 个` : `已导入 ${okCount} 个 OKX 带单员`);
        await load();
      }
    } catch (e: any) {
      setErr(String(e?.message ?? e));
    }
    setBusy("");
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4" onClick={onClose}>
      <div className="my-4 w-full max-w-[760px] rounded-3xl border border-border bg-card p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <div>
            <div className="text-[17px] font-bold">从 OKX 导入带单员</div>
            <div className="mt-0.5 text-[12.5px] text-muted-foreground">
              数据直接来自 OKX 跟单平台公开接口，非本地编造。导入后跟单走 OKX 原生引擎。
            </div>
          </div>
          <button onClick={onClose} className="text-muted-foreground">
            <X size={18} />
          </button>
        </div>

        <div className="mt-4 flex flex-wrap items-end gap-3">
          <label className="block">
            <span className="text-[12px] font-medium text-muted-foreground">排序</span>
            <select
              value={sortType}
              onChange={(e) => {
                setSortType(e.target.value);
                setPage(1);
                setDataVer(undefined);
                load({ page: 1, sortType: e.target.value, dataVer: undefined });
              }}
              className="input-base mt-1 w-[150px]"
            >
              {SORT_OPTIONS.map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-[12px] font-medium text-muted-foreground">带单时长</span>
            <select
              value={minLeadDays}
              onChange={(e) => {
                setMinLeadDays(e.target.value);
                setPage(1);
                setDataVer(undefined);
                load({ page: 1, minLeadDays: e.target.value, dataVer: undefined });
              }}
              className="input-base mt-1 w-[130px]"
            >
              {LEAD_DAYS_OPTIONS.map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-[12px] font-medium text-muted-foreground">最低管理资金（USDT）</span>
            <input
              value={minAum}
              onChange={(e) => setMinAum(e.target.value)}
              onBlur={() => {
                setPage(1);
                setDataVer(undefined);
                load({ page: 1, dataVer: undefined });
              }}
              placeholder="不限"
              className="input-base mt-1 w-[150px]"
            />
          </label>
          <button
            onClick={() => {
              setPage(1);
              setDataVer(undefined);
              load({ page: 1, dataVer: undefined });
            }}
            disabled={loading}
            className="btn-ghost"
          >
            <RefreshCw size={14} /> 刷新
          </button>
        </div>

        {limits ? (
          <div className="mt-3 rounded-2xl border border-border bg-surface/60 px-3.5 py-2.5 text-[11.5px] text-muted-foreground">
            OKX 跟单限额（实时取自平台）：单笔 {limits.minCopyAmt} ~ {fmtUsd(limits.maxCopyAmt, 0)} ·
            跟单总额上限 {fmtUsd(limits.maxCopyTotalAmt, 0)} · 跟单比例上限 {limits.maxCopyRatio}% ·
            止损上限 {(limits.maxSlRatio * 100).toFixed(0)}% · 止盈上限 {(limits.maxTpRatio * 100).toFixed(0)}%
          </div>
        ) : null}

        {err ? <p className="mt-3 text-[12.5px] text-[#f6465d]">{err}</p> : null}

        <div className="mt-4 max-h-[50vh] overflow-y-auto rounded-2xl border border-border">
          {loading ? (
            <div className="py-12 text-center text-[13px] text-muted-foreground">正在从 OKX 拉取带单员…</div>
          ) : !ranks.length ? (
            <div className="py-12 text-center text-[13px] text-muted-foreground">没有可导入的带单员</div>
          ) : (
            <div className="divide-y divide-border">
              {ranks.map((r) => {
                const already = imported[r.uniqueCode];
                const isBusy = busy === r.uniqueCode;
                return (
                  <div key={r.uniqueCode} className="flex flex-wrap items-center gap-3 px-4 py-3">
                    {r.portLink ? (
                      <img src={r.portLink} alt={r.nickName} className="h-9 w-9 shrink-0 rounded-xl object-cover" loading="lazy" />
                    ) : (
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-wise-mint text-[11px] font-bold text-wise-darkgreen">
                        {r.nickName.slice(0, 2).toUpperCase()}
                      </div>
                    )}

                    <div className="min-w-[150px] flex-1">
                      <div className="text-[13.5px] font-semibold">{r.nickName}</div>
                      <div className="text-[11px] text-muted-foreground">
                        带单 {r.leadDays} 天 · {r.traderInsts?.length ?? 0} 个品种 · <span className="font-mono">{r.uniqueCode}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4 text-right">
                      <Mini
                        label="累计收益"
                        value={`${r.roiRatio >= 0 ? "+" : ""}${(r.roiRatio * 100).toFixed(2)}%`}
                        tone={r.roiRatio >= 0 ? "up" : "down"}
                      />
                      <Mini label="胜率" value={`${(r.winRatio * 100).toFixed(1)}%`} />
                      <Mini label="AUM" value={fmtUsd(r.aum, 0)} />
                    </div>

                    <div className="grid grid-cols-1 gap-4 text-right">
                      <Mini label="跟单人数" value={`${r.copyTraderNum} / ${r.accCopyTraderNum} 累计`} />
                    </div>

                    <button
                      onClick={() => doImport([r.uniqueCode])}
                      disabled={isBusy}
                      className={already ? "btn-ghost" : "btn-primary"}
                    >
                      {isBusy ? "处理中…" : already ? <><RefreshCw size={13} /> 刷新</> : <><Download size={13} /> 导入</>}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="mt-4 flex items-center justify-between">
          <div className="flex gap-2">
            <button
              onClick={() => {
                const p = Math.max(page - 1, 1);
                setPage(p);
                load({ page: p });
              }}
              disabled={page <= 1 || loading}
              className="btn-ghost"
            >
              上一页
            </button>
            <button
              onClick={() => {
                const p = page + 1;
                setPage(p);
                load({ page: p });
              }}
              disabled={loading || ranks.length < 20}
              className="btn-ghost"
            >
              下一页
            </button>
            <span className="self-center text-[12px] text-muted-foreground">第 {page} 页</span>
          </div>
          <div className="text-[11.5px] text-muted-foreground">
            已导入 {Object.keys(imported).length} 个
          </div>
        </div>

        {importSummary.length ? (
          <div className="mt-4 space-y-1.5 rounded-2xl border border-border p-3">
            {importSummary.map((it: any, i: number) => (
              <div key={i} className="flex flex-wrap items-center gap-2 text-[12px]">
                <span className="font-medium">{it.name ?? it.uniqueCode}</span>
                {it.ok ? (
                  <>
                    <span className="text-[#0ecb81]">{it.action === "created" ? "已导入" : "已刷新"}</span>
                    <span className="text-muted-foreground">
                      累计收益 {(Number(it.roiTotal) || 0).toFixed(2)}% · 胜率 {(Number(it.winRate) || 0).toFixed(1)}% · 带单 {it.leadDays} 天
                    </span>
                    {it.hidesPositions ? (
                      <span className="text-[#854f0b]">该带单员隐藏持仓（不影响 OKX 原生跟单）</span>
                    ) : null}
                  </>
                ) : (
                  <span className="text-[#f6465d]">{it.error}</span>
                )}
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

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

function Mini({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  /** 涨跌配色与全站保持一致：涨绿跌红 */
  tone?: "up" | "down";
}) {
  return (
    <div>
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div
        className="num text-[13.5px] font-semibold"
        style={tone ? { color: tone === "up" ? "#0ecb81" : "#f6465d" } : undefined}
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

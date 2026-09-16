"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Pause, Play, Plus, Radio, Search, Settings2, Trash2, TriangleAlert, X } from "lucide-react";
import { Avatar, Badge, RiskPill, Sparkline, cn } from "@/components/ui";
import { PageHeader, Panel, Td, Th } from "@/components/console/ui";
import { fmtPct, fmtUsd, signClass, timeAgo } from "@/lib/format";
import type { CopyRelation, OkxInstType, Trader } from "@/lib/types";

type SortKey = "roi30d" | "winRate" | "followers" | "maxDrawdown" | "roiTotal" | "aum";

type KeyOption = { id: string; exchange: string; label: string; masked: string };

const SOURCE_LABEL: Record<string, string> = {
  okx: "OKX 带单员",
  quant: "量化引擎",
  webhook: "Webhook",
  manual: "手动发布",
};

export function CopyTradingClient({
  traders,
  relations: initialRelations,
  apiKeys,
  isAdmin,
}: {
  traders: Trader[];
  relations: CopyRelation[];
  apiKeys: KeyOption[];
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"market" | "mine">("market");
  const [q, setQ] = useState("");
  const [risk, setRisk] = useState<"all" | "low" | "medium" | "high">("all");
  /** 品类筛选：合约 / 现货在 OKX 是两套独立名册 */
  const [instFilter, setInstFilter] = useState<"all" | OkxInstType>("all");
  /** 卡片渐进渲染：全量导入后可能有 300+ 个信号源，一次性渲染会卡 */
  const [shown, setShown] = useState(24);
  const [sort, setSort] = useState<SortKey>("roiTotal");
  const [relations, setRelations] = useState<CopyRelation[]>(initialRelations);
  const [modal, setModal] = useState<Trader | null>(null);
  const [form, setForm] = useState<{
    capital: number;
    leverage: number;
    mode: "fixed" | "ratio";
    ratio: number;
    stopLossPct: number;
    takeProfitPct: number;
    apiKeyId: string;
  }>({
    capital: 100,
    leverage: 3,
    mode: "fixed",
    ratio: 20,
    stopLossPct: 10,
    takeProfitPct: 30,
    apiKeyId: apiKeys[0]?.id ?? "",
  });
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");
  const [error, setError] = useState("");

  /** OKX 原生跟单参数。字段名与 OKX CopySettingsRequest 对齐。 */
  const [okxForm, setOkxForm] = useState({
    copyMode: "fixed_amount" as "fixed_amount" | "ratio_copy",
    copyTotalAmt: 100,
    copyAmt: 10,
    copyRatio: 10,
    copyMgnMode: "copy" as "copy" | "cross" | "isolated",
    copyInstIdType: "copy" as "copy" | "custom",
    tpRatio: 0.3,
    slRatio: 0.1,
    subPosCloseType: "copy_close" as "copy_close" | "market_close" | "manual_close",
  });
  /** OKX 限额按品类分开存：现货与合约的上限不一定相同 */
  const [okxLimits, setOkxLimits] = useState<Record<string, any>>({});

  useEffect(() => {
    Promise.all(
      (["SWAP", "SPOT"] as const).map((it) =>
        fetch(`/api/okx/config?instType=${it}`)
          .then((r) => r.json())
          .then((j) => (j?.ok ? ([it, j.limits] as const) : null))
          .catch(() => null)
      )
    ).then((rows) => {
      const m: Record<string, any> = {};
      for (const row of rows) if (row) m[row[0]] = row[1];
      setOkxLimits(m);
    });
  }, []);

  const instOf = (t: Trader): OkxInstType => t.okx?.instType ?? "SWAP";
  const limitOf = (t: Trader | null) => (t ? (okxLimits[instOf(t)] ?? null) : null);

  const okxKeys = apiKeys.filter((k) => k.exchange === "okx");

  const list = useMemo(() => {
    let out = traders.filter((t) => {
      const kw = q.trim().toLowerCase();
      const matchKw =
        !kw ||
        t.name.toLowerCase().includes(kw) ||
        t.tagline.includes(kw) ||
        (t.okx?.uniqueCode ?? "").toLowerCase().includes(kw) ||
        (t.tags ?? []).some((x) => x.includes(kw));
      const matchRisk = risk === "all" || t.risk === risk;
      const matchInst = instFilter === "all" || (t.source === "okx" && instOf(t) === instFilter);
      return matchKw && matchRisk && matchInst;
    });
    out = [...out].sort((a, b) => (sort === "maxDrawdown" ? (a[sort] ?? 0) - (b[sort] ?? 0) : (b[sort] ?? 0) - (a[sort] ?? 0)));
    return out;
  }, [traders, q, risk, sort, instFilter]);

  const following = new Set(relations.map((r) => r.traderId));

  // 筛选条件一变就回到第一屏，避免「筛完了却停在第 5 屏」的割裂感
  useEffect(() => {
    setShown(24);
  }, [q, risk, sort, instFilter]);

  function flash(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 2600);
  }

  async function createFollow() {
    if (!modal) return;
    setBusy(true);
    setError("");

    const isOkx = modal.source === "okx";
    const body = isOkx
      ? { traderId: modal.id, apiKeyId: form.apiKeyId, ...okxForm }
      : { traderId: modal.id, ...form };

    const r = await fetch("/api/copy-trading", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const j = await r.json();
    setBusy(false);
    if (!j.ok) {
      setError(j.error ?? "创建失败");
      return;
    }
    setRelations((prev) => [...prev, j.relation]);
    setModal(null);
    flash(j.message ?? `已开始跟单 ${modal.name}，等信号来就会真实下单`);
    router.refresh();
  }

  async function patch(id: string, p: Partial<CopyRelation>) {
    setRelations((prev) => prev.map((r) => (r.id === id ? { ...r, ...p } : r)));
    await fetch("/api/copy-trading", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, ...p }),
    });
    router.refresh();
  }

  async function del(id: string) {
    const rel = relations.find((r) => r.id === id);
    const isOkxRel = rel?.engine === "okx";

    const msg = isOkxRel
      ? "取消跟单？会在 OKX 侧调用「停止跟单」，已有持仓**保留在你的账户里**（不会自动平掉），需要你手动处理。\n\n确定继续？"
      : "取消跟单？已开的仓位不会自动平掉，需要你到交易所手动处理。";
    if (!confirm(msg)) return;

    setError("");
    const r = await fetch(`/api/copy-trading?id=${id}`, { method: "DELETE" });
    const j = await r.json().catch(() => ({}));
    if (!j.ok) {
      setError(j.error ?? "取消失败");
      flash(j.error ?? "取消失败");
      return;
    }
    setRelations((prev) => prev.filter((x) => x.id !== id));
    flash(j.message ?? "已取消跟单");
    router.refresh();
  }

  const noKey = apiKeys.length === 0;
  /** 当前弹窗对应品类的 OKX 限额（合约/现货分开取） */
  const modalLimits = limitOf(modal);

  return (
    <>
      <PageHeader
        title="跟单交易"
        desc="选定信号源后，它发出的每一笔信号都会在你的交易所账户真实成交。资金始终留在你自己的交易所。"
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

      {noKey ? (
        <div className="mb-5 flex flex-wrap items-center gap-3 rounded-3xl border border-warning/40 bg-warning/10 p-4">
          <TriangleAlert size={18} className="text-warning" />
          <p className="flex-1 text-[13px] leading-relaxed text-muted-foreground">
            你还没有绑定可用的交易所 API。跟单要真下单，必须先绑定——只授权「读取 + 交易」，不要开提现权限。
          </p>
          <Link href="/api-keys" className="btn-primary shrink-0">
            <KeyRound size={15} /> 去绑定
          </Link>
        </div>
      ) : okxKeys.length === 0 ? (
        <div className="mb-5 flex flex-wrap items-center gap-3 rounded-3xl border border-warning/40 bg-warning/10 p-4">
          <TriangleAlert size={18} className="text-warning" />
          <p className="flex-1 text-[13px] leading-relaxed text-muted-foreground">
            你还没绑定 <b>OKX</b> 的 API Key。跟着 OKX 官方带单员走的是 OKX 原生跟单，必须用 OKX 的 Key
            （需要 Passphrase）；其它交易所的 Key 在这里用不上。
          </p>
          <Link href="/api-keys" className="btn-primary shrink-0">
            <KeyRound size={15} /> 去绑定 OKX
          </Link>
        </div>
      ) : null}

      {tab === "market" ? (
        traders.length === 0 ? (
          <EmptySources isAdmin={isAdmin} />
        ) : (
          <>
            <div className="mb-5 flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 rounded-2xl border border-border bg-card px-3.5 py-2.5">
                <Search size={15} className="text-muted-foreground" />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="搜索信号源 / 风格 / 标签"
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
              <div className="flex gap-1.5">
                {(
                  [
                    ["all", "全部品类"],
                    ["SWAP", "合约"],
                    ["SPOT", "现货"],
                  ] as const
                ).map(([k, label]) => (
                  <button
                    key={k}
                    onClick={() => setInstFilter(k)}
                    className={cn(
                      "rounded-pill border px-3.5 py-2 text-[13px] font-medium transition",
                      instFilter === k
                        ? "border-transparent bg-foreground text-background"
                        : "border-border bg-card text-muted-foreground"
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
                  <option value="roiTotal">累计收益</option>
                  <option value="aum">管理资金 (AUM)</option>
                  <option value="roi30d">近 30 日收益</option>
                  <option value="winRate">胜率</option>
                  <option value="followers">跟单人数</option>
                  <option value="maxDrawdown">最大回撤（低→高）</option>
                </select>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {list.slice(0, shown).map((t) => {
                const isOkx = t.source === "okx";
                const hasStats = (t.trades ?? 0) > 0;
                return (
                  <div key={t.id} className="card-surface flex flex-col p-5">
                    <div className="flex items-start gap-3">
                      <Avatar name={t.name} hue={t.avatarHue} src={t.avatarUrl} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate text-[14.5px] font-semibold">{t.name}</span>
                          <span className="rounded bg-surface px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                            {SOURCE_LABEL[t.source] ?? t.source}
                          </span>
                          {t.source === "okx" ? (
                            <span
                              className={cn(
                                "rounded px-1.5 py-0.5 text-[10px] font-semibold",
                                instOf(t) === "SPOT"
                                  ? "bg-[#e8f3ff] text-[#1b5fa8]"
                                  : "bg-wise-mint text-wise-darkgreen"
                              )}
                            >
                              {instOf(t) === "SPOT" ? "现货" : "合约"}
                            </span>
                          ) : null}
                          {t.verified ? (
                            <span className="rounded bg-wise-mint px-1.5 py-0.5 text-[10px] font-bold text-wise-darkgreen">
                              运行中
                            </span>
                          ) : null}
                        </div>
                        <div className="truncate text-[12px] text-muted-foreground">{t.tagline}</div>
                      </div>
                      <RiskPill risk={t.risk} />
                    </div>

                    <div className="mt-4 grid grid-cols-3 gap-3">
                      {isOkx ? (
                        <>
                          <Metric
                            label="累计收益"
                            value={fmtPct(t.roiTotal, 2)}
                            tone={t.roiTotal >= 0 ? "up" : "down"}
                          />
                          <Metric label="胜率" value={`${(t.winRate ?? 0).toFixed(1)}%`} />
                          <Metric label="带单天数" value={`${t.okx?.leadDays ?? "—"} 天`} />
                        </>
                      ) : (
                        <>
                          <Metric
                            label="近 30 日"
                            value={hasStats ? fmtPct(t.roi30d) : "—"}
                            tone={hasStats ? (t.roi30d >= 0 ? "up" : "down") : undefined}
                          />
                          <Metric label="胜率" value={hasStats ? `${t.winRate}%` : "—"} />
                          <Metric label="最大回撤" value={hasStats ? `${t.maxDrawdown}%` : "—"} />
                        </>
                      )}
                    </div>

                    <div className="mt-3 flex items-end justify-between">
                      <div className="text-[11.5px] leading-5 text-muted-foreground">
                        {isOkx ? (
                          <>
                            OKX 官方带单员 · {t.followers ?? 0} 人跟单
                            <br />
                            AUM {fmtUsd(t.aum ?? 0, 0)} · 累计盈亏 {fmtUsd(Number(t.okx?.pnl) || 0, 0)}
                            <br />
                            覆盖 {(t.symbols ?? []).slice(0, 3).join(" · ") || "—"}
                            {(t.symbols ?? []).length > 3 ? ` 等 ${(t.symbols ?? []).length} 个品种` : ""}
                          </>
                        ) : (
                          <>
                            信号 {t.trades ?? 0} 条 · 累计 {hasStats ? fmtPct(t.roiTotal, 0) : "—"}
                            <br />
                            {t.followers ?? 0} 人跟单 · AUM {fmtUsd(t.aum ?? 0, 0)}
                            <br />
                            覆盖 {(t.symbols ?? []).join(" · ") || "—"}
                          </>
                        )}
                      </div>
                      {t.curve?.length ? (
                        <Sparkline data={t.curve.slice(-28)} width={92} height={34} />
                      ) : (
                        <span className="text-[11px] text-muted-foreground">暂无曲线</span>
                      )}
                    </div>

                    {isOkx && t.okx?.hidesPositions ? (
                      <p className="mt-2 rounded-xl bg-[#faeeda] px-2.5 py-1.5 text-[11px] leading-relaxed text-[#854f0b]">
                        该带单员隐藏了当前持仓。OKX 原生跟单不受影响——由 OKX 引擎同步他的成交，本站不需要知道他在买什么。
                      </p>
                    ) : null}

                    <button
                      onClick={() => {
                        setError("");
                        setModal(t);
                        setForm({
                          capital: 100,
                          leverage: 3,
                          mode: "fixed",
                          ratio: 20,
                          stopLossPct: 10,
                          takeProfitPct: 30,
                          // OKX 带单员必须配 OKX 的 Key，其它交易所的 Key 在这里没有意义
                          apiKeyId: (t.source === "okx" ? okxKeys[0]?.id : apiKeys[0]?.id) ?? "",
                        });
                      }}
                      disabled={following.has(t.id)}
                      className={cn(
                        "mt-4 inline-flex items-center justify-center gap-1.5 rounded-pill px-4 py-2.5 text-[13.5px] font-semibold transition",
                        following.has(t.id) ? "bg-surface text-muted-foreground" : "bg-wise-green text-wise-darkgreen hover:opacity-90"
                      )}
                    >
                      {following.has(t.id) ? (
                        "已跟单"
                      ) : (
                        <>
                          <Plus size={15} /> 跟单
                        </>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>

            {list.length > shown ? (
              <div className="mt-5 flex flex-col items-center gap-2">
                <button onClick={() => setShown((n) => n + 24)} className="btn-ghost">
                  显示更多（还有 {list.length - shown} 个）
                </button>
                <span className="text-[12px] text-muted-foreground">
                  已显示 {Math.min(shown, list.length)} / {list.length} 个
                </span>
              </div>
            ) : list.length > 24 ? (
              <div className="mt-5 text-center text-[12px] text-muted-foreground">
                已显示全部 {list.length} 个
              </div>
            ) : null}
          </>
        )
      ) : (
        <Panel title="我的跟单" desc="暂停后不再同步新信号，已开仓位保持不动" bodyClassName="p-0">
          {relations.length === 0 ? (
            <div className="py-14 text-center text-[13.5px] text-muted-foreground">还没有跟单，去「交易员广场」挑一个吧。</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b border-border">
                  <tr>
                    <Th>信号源</Th>
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
                    const isOkxRel = r.engine === "okx";
                    return (
                      <tr key={r.id} className="border-b border-border/60 last:border-0">
                        <Td>
                          <div className="flex items-center gap-2">
                            {t?.avatarUrl ? (
                              <img src={t.avatarUrl} alt={t.name} className="h-7 w-7 shrink-0 rounded-full object-cover" loading="lazy" />
                            ) : (
                              <div
                                className="flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold text-wise-darkgreen"
                                style={{ background: `hsl(${t?.avatarHue ?? 90} 72% 78%)` }}
                              >
                                {(t?.name ?? "??").slice(0, 2).toUpperCase()}
                              </div>
                            )}
                            <div>
                              <div className="flex items-center gap-1.5 font-medium">
                                {t?.name ?? "信号源已删除"}
                                {isOkxRel ? (
                                  <span className="rounded bg-[#e1f5ee] px-1.5 py-0.5 text-[10px] font-semibold text-[#085041]">
                                    OKX 原生
                                  </span>
                                ) : null}
                              </div>
                              <div className="text-[11px] text-muted-foreground">
                                {timeAgo(r.createdAt)}开始
                                {isOkxRel ? " · 开平仓由 OKX 引擎同步" : ` · 同步 ${r.copiedTrades} 笔`}
                                {r.failedTrades ? ` · 失败 ${r.failedTrades} 笔` : ""}
                              </div>
                              {r.lastError ? (
                                <div className="text-[11px] text-[#f6465d]">{r.lastError}</div>
                              ) : null}
                            </div>
                          </div>
                        </Td>
                        <Td className="num">{fmtUsd(r.capital)} USDT</Td>
                        <Td>
                          {isOkxRel ? (
                            <>
                              {r.okx?.copyMode === "ratio_copy" ? `按比例 ${r.okx.copyRatio}%` : `每笔 ${fmtUsd(r.okx?.copyAmt ?? 0)} U`}
                              <div className="text-[11px] text-muted-foreground">
                                {r.okx?.copyMgnMode === "copy" ? "跟随带单员保证金" : r.okx?.copyMgnMode === "cross" ? "全仓" : "逐仓"}
                              </div>
                            </>
                          ) : (
                            <>
                              {r.mode === "fixed" ? "固定金额" : `按比例 ${r.ratio}%`} · {r.leverage}x
                            </>
                          )}
                        </Td>
                        <Td className="num">{r.stopLossPct}% / {r.takeProfitPct}%</Td>
                        <Td className="num">
                          {isOkxRel ? (
                            // OKX 原生跟单的收益由 OKX 结算，本地没有也不该编一个数字出来
                            <span className="text-[12px] text-muted-foreground">以 OKX 为准</span>
                          ) : (
                            <span className={cn("font-semibold", signClass(r.pnl))}>
                              {r.pnl >= 0 ? "+" : ""}
                              {fmtUsd(r.pnl)} ({fmtPct(r.pnlPct, 1)})
                            </span>
                          )}
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
                            <IconBtn title="参数（在交易所侧生效，暂只读）">
                              <Settings2 size={14} />
                            </IconBtn>
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
            className="w-full max-w-[460px] rounded-3xl border border-border bg-card p-6"
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
              <Field label={modal.source === "okx" ? "用哪个 OKX 账户跟单" : "用哪个交易所账户执行"}>
                <select
                  value={form.apiKeyId}
                  onChange={(e) => setForm({ ...form, apiKeyId: e.target.value })}
                  className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-[14px] outline-none focus:border-wise-green"
                >
                  {(modal.source === "okx" ? okxKeys : apiKeys).map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.exchange.toUpperCase()} · {k.label} ({k.masked})
                    </option>
                  ))}
                </select>
                {modal.source === "okx" && !okxKeys.length ? (
                  <p className="mt-1.5 text-[11.5px] text-[#f6465d]">
                    还没有 OKX 的 API Key。OKX 原生跟单必须用 OKX 的 Key，请先到「API 管理」绑定。
                  </p>
                ) : null}
              </Field>

              {modal.source === "okx" ? (
                <>
                  <div className="rounded-2xl border border-[#0f6e56]/25 bg-[#e1f5ee] p-3.5 text-[12px] leading-relaxed text-[#085041]">
                    这是 <b>OKX 原生跟单</b>：在你的 OKX 账户里正式建立跟单关系，之后带单员的开平仓由
                    OKX 引擎实时同步。本站不参与下单 —— 所以没有轮询延迟、没有价格偏离，带单员隐藏持仓也能跟。
                  </div>

                  <Field label="跟单方式">
                    <div className="flex gap-2">
                      {(
                        [
                          ["fixed_amount", "固定金额"],
                          ["ratio_copy", "按比例"],
                        ] as const
                      ).map(([k, label]) => (
                        <button
                          key={k}
                          onClick={() => setOkxForm({ ...okxForm, copyMode: k })}
                          className={cn(
                            "flex-1 rounded-xl border px-3 py-2.5 text-[13px] font-medium transition",
                            okxForm.copyMode === k ? "border-wise-green bg-wise-mint text-wise-darkgreen" : "border-border"
                          )}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </Field>

                  <div className="grid grid-cols-2 gap-3">
                    <Field label="跟单总额 (USDT)">
                      <input
                        type="number"
                        value={okxForm.copyTotalAmt}
                        onChange={(e) => setOkxForm({ ...okxForm, copyTotalAmt: Number(e.target.value) })}
                        className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-[14px] outline-none focus:border-wise-green"
                      />
                    </Field>
                    <Field label={okxForm.copyMode === "fixed_amount" ? "单笔金额 (USDT)" : "跟单比例 (%)"}>
                      <input
                        type="number"
                        value={okxForm.copyMode === "fixed_amount" ? okxForm.copyAmt : okxForm.copyRatio}
                        onChange={(e) =>
                          setOkxForm(
                            okxForm.copyMode === "fixed_amount"
                              ? { ...okxForm, copyAmt: Number(e.target.value) }
                              : { ...okxForm, copyRatio: Number(e.target.value) }
                          )
                        }
                        className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-[14px] outline-none focus:border-wise-green"
                      />
                    </Field>
                  </div>

                  <Field label="保证金模式">
                    <div className="flex gap-2">
                      {(
                        [
                          ["copy", "跟随带单员"],
                          ["cross", "全仓"],
                          ["isolated", "逐仓"],
                        ] as const
                      ).map(([k, label]) => (
                        <button
                          key={k}
                          onClick={() => setOkxForm({ ...okxForm, copyMgnMode: k })}
                          className={cn(
                            "flex-1 rounded-xl border px-2 py-2.5 text-[12.5px] font-medium transition",
                            okxForm.copyMgnMode === k ? "border-wise-green bg-wise-mint text-wise-darkgreen" : "border-border"
                          )}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </Field>

                  <div className="grid grid-cols-2 gap-3">
                    <Field label="止损比例 (%)，0 = 不限">
                      <input
                        type="number"
                        step="1"
                        value={Math.round(okxForm.slRatio * 100)}
                        onChange={(e) => setOkxForm({ ...okxForm, slRatio: Number(e.target.value) / 100 })}
                        className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-[14px] outline-none focus:border-wise-green"
                      />
                    </Field>
                    <Field label="止盈比例 (%)，0 = 不限">
                      <input
                        type="number"
                        step="1"
                        value={Math.round(okxForm.tpRatio * 100)}
                        onChange={(e) => setOkxForm({ ...okxForm, tpRatio: Number(e.target.value) / 100 })}
                        className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-[14px] outline-none focus:border-wise-green"
                      />
                    </Field>
                  </div>

                  <Field label="取消跟单时如何处置已有持仓">
                    <select
                      value={okxForm.subPosCloseType}
                      onChange={(e) => setOkxForm({ ...okxForm, subPosCloseType: e.target.value as any })}
                      className="w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-[14px] outline-none focus:border-wise-green"
                    >
                      <option value="copy_close">跟随带单员平仓（他平我就平）</option>
                      <option value="market_close">立即市价平仓</option>
                      <option value="manual_close">只停止跟单，持仓我自己处理</option>
                    </select>
                  </Field>

                  {modalLimits ? (
                    <div className="rounded-2xl border border-border bg-surface/60 p-3.5 text-[12px] leading-relaxed text-muted-foreground">
                      OKX {modal ? (instOf(modal) === "SPOT" ? "现货" : "合约") : ""}跟单实时限额：单笔 {modalLimits.minCopyAmt} ~{" "}
                      {fmtUsd(modalLimits.maxCopyAmt, 0)} USDT ·
                      总额上限 {fmtUsd(modalLimits.maxCopyTotalAmt, 0)} · 比例上限 {modalLimits.maxCopyRatio}% ·
                      止损上限 {(modalLimits.maxSlRatio * 100).toFixed(0)}% · 止盈上限{" "}
                      {(modalLimits.maxTpRatio * 100).toFixed(0)}%
                    </div>
                  ) : null}
                </>
              ) : (
                <>
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
                          {m === "fixed" ? "固定保证金" : "按资金比例"}
                        </button>
                      ))}
                    </div>
                  </Field>

                  <Field label={form.mode === "fixed" ? "每笔分配保证金 (USDT)" : "分配比例 (%)"}>
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

                  <div className="rounded-2xl border border-border bg-surface/60 p-3.5 text-[12px] leading-relaxed text-muted-foreground">
                    信号到达时，平台会在你选定的交易所账户按市价开仓，名义额 ≈ 保证金 × {form.leverage}
                    。止损止盈会作为条件单直接挂在交易所侧，即使平台离线也会生效。
                  </div>
                </>
              )}

              {error ? <p className="text-[12.5px] text-[#f6465d]">{error}</p> : null}
            </div>

            <button
              onClick={createFollow}
              disabled={busy || (modal.source === "okx" && !okxKeys.length)}
              className="btn-primary mt-6 w-full py-3"
            >
              {busy ? "创建中…" : modal.source === "okx" ? "在 OKX 上确认跟单" : "确认跟单"}
            </button>
            <p className="mt-3 text-center text-[11.5px] text-muted-foreground">
              实盘操作。请先用小额资金试跑一次，确认下单参数无误后再放大。
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

function EmptySources({ isAdmin }: { isAdmin: boolean }) {
  return (
    <Panel>
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-3xl bg-surface">
          <Radio size={24} className="text-muted-foreground" />
        </span>
        <div>
          <div className="text-[15px] font-semibold">还没有可跟的信号源</div>
          <p className="mx-auto mt-1.5 max-w-[460px] text-[13px] leading-relaxed text-muted-foreground">
            交易员广场里的每一个「交易员」，本质是一个信号源。所有演示数据都已经清空，
            现在这里只会显示真实存在、正在运行的信号源。
          </p>
        </div>
        {isAdmin ? (
          <Link href="/sources" className="btn-primary">
            去创建第一个信号源
          </Link>
        ) : (
          <p className="text-[12.5px] text-muted-foreground">请等待站主配置信号源。</p>
        )}
      </div>
    </Panel>
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

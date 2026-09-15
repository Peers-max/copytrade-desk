"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  CircleCheck,
  KeyRound,
  Pause,
  Play,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
  TriangleAlert,
  X,
} from "lucide-react";
import { Badge, cn } from "@/components/ui";
import { PageHeader, Panel } from "@/components/console/ui";
import { EXCHANGE_LABEL, fmtUsd, timeAgo } from "@/lib/format";
import type { ApiKey } from "@/lib/types";

type Ex = { id: string; name: string; cn: string; tradable?: boolean; blockedFromWorker?: boolean };

export function ApiKeysClient({
  keys: initial,
  exchanges,
}: {
  keys: ApiKey[];
  exchanges: Ex[];
}) {
  const router = useRouter();
  const [keys, setKeys] = useState<ApiKey[]>(initial);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ exchange: "binance", label: "", apiKey: "", secret: "", passphrase: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [snapshot, setSnapshot] = useState<any>(null);

  const current = exchanges.find((e) => e.id === form.exchange);
  const needsPassphrase = ["okx", "bitget"].includes(form.exchange);

  async function submit() {
    if (!form.apiKey || !form.secret) return setError("请填写 API Key 与 Secret");
    setError("");
    setSnapshot(null);
    setBusy(true);
    const r = await fetch("/api/api-keys", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(form),
    });
    const j = await r.json();
    setBusy(false);
    if (!j.ok) return setError(j.error ?? "绑定失败");
    setKeys((p) => [...p, j.apiKey]);
    setSnapshot(j.snapshot);
    router.refresh();
  }

  async function toggle(k: ApiKey) {
    const status = k.status === "active" ? "paused" : "active";
    setKeys((p) => p.map((x) => (x.id === k.id ? { ...x, status } : x)));
    await fetch("/api/api-keys", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: k.id, status }),
    });
    router.refresh();
  }

  async function refresh(k: ApiKey) {
    setKeys((p) => p.map((x) => (x.id === k.id ? { ...x, lastError: undefined } : x)));
    const r = await fetch("/api/api-keys", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: k.id, action: "refresh" }),
    });
    const j = await r.json();
    if (j.ok && j.apiKey) {
      setKeys((p) => p.map((x) => (x.id === k.id ? { ...x, ...j.apiKey } : x)));
    } else {
      setKeys((p) => p.map((x) => (x.id === k.id ? { ...x, status: "invalid", lastError: j.error } : x)));
    }
    router.refresh();
  }

  async function del(id: string) {
    if (!confirm("解绑后，使用该 Key 的跟单将无法下单。确定解绑？")) return;
    setKeys((p) => p.filter((x) => x.id !== id));
    await fetch(`/api/api-keys?id=${id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <>
      <PageHeader
        title="API 管理"
        desc="绑定后会立刻用你的 Key 向交易所签一次名做真实校验。只授权「读取 + 交易」，平台永不申请提现权限。"
        actions={
          <button onClick={() => { setOpen(true); setError(""); setSnapshot(null); }} className="btn-primary">
            <Plus size={15} /> 绑定交易所
          </button>
        }
      />

      <div className="mb-5 flex flex-wrap gap-3">
        <div className="flex flex-1 gap-3 rounded-3xl border border-border bg-card p-4">
          <ShieldCheck size={18} className="mt-0.5 shrink-0 text-wise-green" />
          <div className="text-[13px] leading-relaxed text-muted-foreground">
            Secret 与 Passphrase 采用 AES-256-GCM 加密后存储，明文不落盘。建议在交易所侧同时开启 IP 白名单，
            只允许本服务的出口 IP 调用。
            <span className="ml-1 font-medium text-foreground">
              若绑定时被拒且提示「带有提现权限」，说明该 Key 权限开多了，请去交易所关掉提现后重新创建。
            </span>
          </div>
        </div>
        <a href="/tutorials" className="btn-ghost self-center">
          查看绑定教程
        </a>
        <a href="/api/diag" target="_blank" rel="noreferrer" className="btn-ghost self-center">
          出网诊断
        </a>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {keys.map((k) => {
          const ex = exchanges.find((e) => e.id === k.exchange);
          return (
            <div key={k.id} className="card-surface p-5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-surface">
                    <img src={`/icons/${k.exchange}.png`} alt="" className="h-5 w-5 object-contain" />
                  </span>
                  <div>
                    <div className="text-[14px] font-semibold">{ex?.name ?? EXCHANGE_LABEL[k.exchange] ?? k.exchange}</div>
                    <div className="text-[11.5px] text-muted-foreground">{k.label}</div>
                  </div>
                </div>
                <Badge tone={k.status === "active" ? "green" : k.status === "invalid" ? "red" : "default"}>
                  {k.status === "active" ? "已连接" : k.status === "invalid" ? "校验失败" : "已暂停"}
                </Badge>
              </div>

              <div className="mt-4 space-y-2 text-[12.5px]">
                <Row k="API Key" v={k.masked} mono />
                <Row k="权限" v={(k.permissions ?? []).join(" / ") || "—"} />
                {k.uid ? <Row k="账户 UID" v={k.uid} mono /> : null}
                {k.accountMode ? <Row k="账户模式" v={k.accountMode} /> : null}
                <Row k="账户权益" v={`${fmtUsd(k.equityUsdt ?? 0)} USDT`} tone="strong" />
                <Row k="可用" v={`${fmtUsd(k.availableUsdt ?? 0)} USDT`} />
                <Row k="持仓数" v={`${k.positionCount ?? 0}`} />
                <Row k="最近校验" v={k.lastSyncAt ? timeAgo(k.lastSyncAt) : "—"} />
              </div>

              {k.lastError ? (
                <div className="mt-3 flex gap-2 rounded-2xl border border-[#f6465d]/30 bg-[#f6465d]/8 p-3">
                  <TriangleAlert size={14} className="mt-0.5 shrink-0 text-[#f6465d]" />
                  <p className="text-[11.5px] leading-relaxed text-[#f6465d]">{k.lastError}</p>
                </div>
              ) : null}

              <div className="mt-4 flex gap-2">
                <button
                  onClick={() => refresh(k)}
                  className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-pill border border-border py-2 text-[13px] font-medium transition hover:bg-surface"
                >
                  <RefreshCw size={14} /> 刷新
                </button>
                <button
                  onClick={() => toggle(k)}
                  className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-pill border border-border py-2 text-[13px] font-medium transition hover:bg-surface"
                >
                  {k.status === "active" ? <Pause size={14} /> : <Play size={14} />}
                  {k.status === "active" ? "暂停" : "启用"}
                </button>
                <button
                  onClick={() => del(k.id)}
                  className="inline-flex items-center justify-center gap-1.5 rounded-pill border border-border px-4 py-2 text-[13px] font-medium text-[#f6465d] transition hover:bg-surface"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <Panel className="mt-5" title="支持的交易所" desc="「本环境不可用」= 适配器已实现，但 Cloudflare 出口被该交易所拒绝">
        <div className="flex flex-wrap gap-2">
          {exchanges.map((e) => (
            <span
              key={e.id}
              className={cn(
                "chip px-3.5 py-2 text-[12.5px]",
                e.blockedFromWorker
                  ? "border-[#f6465d]/30 bg-[#f6465d]/8 text-[#f6465d]"
                  : e.tradable
                  ? "border-wise-green/50 bg-wise-mint/40"
                  : "opacity-70"
              )}
            >
              <img src={`/icons/${e.id}.png`} alt="" className="h-3.5 w-3.5 object-contain" />
              {e.name} · {e.cn}
              {e.blockedFromWorker ? (
                <span className="ml-1 font-semibold">本环境不可用</span>
              ) : e.tradable ? (
                <span className="ml-1 font-semibold text-wise-darkgreen">可实盘</span>
              ) : (
                <span className="ml-1 text-muted-foreground">即将支持</span>
              )}
            </span>
          ))}
        </div>
      </Panel>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4" onClick={() => setOpen(false)}>
          <div className="w-full max-w-[500px] rounded-3xl border border-border bg-card p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between">
              <div>
                <div className="text-[17px] font-bold">绑定交易所 API</div>
                <div className="mt-0.5 text-[12.5px] text-muted-foreground">只授权读取与交易，切勿开启提现权限</div>
              </div>
              <button onClick={() => setOpen(false)} className="text-muted-foreground">
                <X size={18} />
              </button>
            </div>

            {snapshot ? (
              <div className="mt-5 rounded-2xl border border-wise-green/40 bg-wise-mint/40 p-4">
                <div className="flex items-center gap-2 text-[13.5px] font-semibold text-wise-darkgreen">
                  <CircleCheck size={16} /> 校验通过，账户已连接
                </div>
                <div className="mt-2.5 space-y-1.5 text-[12.5px]">
                  <Row k="账户模式" v={snapshot.accountMode ?? "—"} />
                  <Row k="账户权益" v={`${fmtUsd(snapshot.equityUsdt ?? 0)} USDT`} tone="strong" />
                  <Row k="可用余额" v={`${fmtUsd(snapshot.availableUsdt ?? 0)} USDT`} />
                  <Row k="当前持仓" v={`${snapshot.positions ?? 0} 个`} />
                  <Row k="已授予权限" v={(snapshot.permissions ?? []).join(" / ")} />
                </div>
                <button
                  onClick={() => {
                    setOpen(false);
                    setForm({ exchange: "binance", label: "", apiKey: "", secret: "", passphrase: "" });
                  }}
                  className="btn-primary mt-4 w-full py-2.5"
                >
                  完成
                </button>
              </div>
            ) : (
              <>
                <div className="mt-5 space-y-4">
                  <div>
                    <span className="text-[12.5px] font-medium text-muted-foreground">交易所</span>
                    <div className="mt-1.5 grid grid-cols-4 gap-2">
                      {exchanges.map((e) => (
                        <button
                          key={e.id}
                          disabled={e.tradable === false}
                          onClick={() => setForm({ ...form, exchange: e.id })}
                          title={e.tradable === false ? "实盘适配器尚未启用" : undefined}
                          className={cn(
                            "rounded-xl border px-2 py-2.5 text-[12.5px] font-medium transition",
                            form.exchange === e.id ? "border-wise-green bg-wise-mint text-wise-darkgreen" : "border-border",
                            e.tradable === false ? "cursor-not-allowed opacity-40" : ""
                          )}
                        >
                          {e.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  <Input label="备注名" value={form.label} onChange={(v) => setForm({ ...form, label: v })} placeholder="例如：主账户 · 合约" />
                  <Input label="API Key" value={form.apiKey} onChange={(v) => setForm({ ...form, apiKey: v })} placeholder="粘贴 API Key" mono />
                  <Input
                    label="Secret Key"
                    value={form.secret}
                    onChange={(v) => setForm({ ...form, secret: v })}
                    placeholder="粘贴 Secret Key（加密保存，不在前端留存）"
                    mono
                  />
                  {needsPassphrase ? (
                    <Input
                      label="Passphrase 密码短语"
                      value={form.passphrase}
                      onChange={(v) => setForm({ ...form, passphrase: v })}
                      placeholder={form.exchange === "okx" ? "OKX 必填，创建 Key 时自己设的那串" : "Bitget 必填"}
                      mono
                    />
                  ) : null}

                  <div className="flex gap-3 rounded-2xl border border-warning/40 bg-warning/10 p-3.5">
                    <TriangleAlert size={16} className="mt-0.5 shrink-0 text-warning" />
                    <p className="text-[12px] leading-relaxed text-muted-foreground">
                      确认已在交易所侧
                      <span className="font-medium text-foreground">关闭提现权限</span>
                      ，只保留「读取 + 交易」。
                      {current?.name ? `${current.name} 若开启提现，绑定时会被直接拒绝。` : ""}
                      绑定后请先用小额资金试跑一次。
                    </p>
                  </div>

                  {current?.blockedFromWorker ? (
                    <div className="flex gap-3 rounded-2xl border border-[#f6465d]/40 bg-[#f6465d]/8 p-3.5">
                      <TriangleAlert size={16} className="mt-0.5 shrink-0 text-[#f6465d]" />
                      <p className="text-[12px] leading-relaxed text-[#f6465d]">
                        <span className="font-semibold">当前部署环境下 {current.name} 不可用。</span>
                        本服务跑在 Cloudflare Workers 上，实测币安会返回 403 / 451「restricted location」、
                        Bybit 返回 403 地区封锁 —— 验签和下单都会被挡在门外。请改用
                        <span className="font-semibold"> OKX</span>；若必须用 {current.name}，
                        需要把执行层部署到非 Cloudflare 的主机。
                      </p>
                    </div>
                  ) : null}

                  {error ? <p className="text-[12.5px] text-[#f6465d]">{error}</p> : null}

                  <button onClick={submit} disabled={busy} className="btn-primary w-full py-3">
                    <KeyRound size={15} /> {busy ? "正在向交易所验签…" : "确认绑定"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}

function Row({ k, v, mono, tone }: { k: string; v: string; mono?: boolean; tone?: "strong" }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="shrink-0 text-muted-foreground">{k}</span>
      <span className={cn("truncate text-right", mono ? "font-mono" : "", tone === "strong" ? "font-semibold" : "")}>
        {v}
      </span>
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
  placeholder,
  mono,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  mono?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-[12.5px] font-medium text-muted-foreground">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn("input-base mt-1.5", mono ? "font-mono" : "")}
      />
    </label>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { TriangleAlert, KeyRound, Pause, Play, Plus, ShieldCheck, Trash2, X } from "lucide-react";
import { Badge, cn } from "@/components/ui";
import { PageHeader, Panel } from "@/components/console/ui";
import { EXCHANGE_LABEL } from "@/lib/format";
import type { ApiKey } from "@/lib/types";

type Ex = { id: string; name: string; cn: string };

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

  async function submit() {
    if (!form.apiKey || !form.secret) return setError("请填写 API Key 与 Secret");
    setError("");
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
    setOpen(false);
    setForm({ exchange: "binance", label: "", apiKey: "", secret: "", passphrase: "" });
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

  async function del(id: string) {
    setKeys((p) => p.filter((x) => x.id !== id));
    await fetch(`/api/api-keys?id=${id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <>
      <PageHeader
        title="API 管理"
        desc="绑定交易所 API 后，币策才能代你执行跟单。仅申请「读取 + 交易」权限。"
        actions={
          <button onClick={() => setOpen(true)} className="btn-primary">
            <Plus size={15} /> 绑定交易所
          </button>
        }
      />

      <div className="mb-5 flex flex-wrap gap-3">
        <div className="flex flex-1 gap-3 rounded-3xl border border-border bg-card p-4">
          <ShieldCheck size={18} className="mt-0.5 text-wise-green" />
          <div className="text-[13px] leading-relaxed text-muted-foreground">
            币策永不申请提现权限，你的资产始终留在本人的交易所账户。建议同时开启 IP 白名单，仅允许
            <span className="mx-1 font-mono text-foreground">43.135.18.22 / 129.204.66.19</span>
            调用。
          </div>
        </div>
        <a href="/tutorials" className="btn-ghost self-center">
          查看绑定教程
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
                    <div className="text-[14px] font-semibold">{ex?.name ?? EXCHANGE_LABEL[k.exchange]}</div>
                    <div className="text-[11.5px] text-muted-foreground">{k.label}</div>
                  </div>
                </div>
                <Badge tone={k.status === "active" ? "green" : "default"}>
                  {k.status === "active" ? "已连接" : "已暂停"}
                </Badge>
              </div>

              <div className="mt-4 space-y-2 text-[12.5px]">
                <Row k="API Key" v={k.masked} mono />
                <Row k="权限" v={k.permissions.join(" / ")} />
                <Row
                  k="最近同步"
                  v={new Date(k.lastSyncAt).toLocaleString("zh-CN", { hour12: false })}
                />
                <Row k="IP 白名单" v={k.ipWhitelist} mono />
              </div>

              <div className="mt-4 flex gap-2">
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
                  <Trash2 size={14} /> 解绑
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <Panel className="mt-5" title="支持的交易所">
        <div className="flex flex-wrap gap-2">
          {exchanges.map((e) => (
            <span key={e.id} className="chip px-3.5 py-2 text-[12.5px]">
              <img src={`/icons/${e.id}.png`} alt="" className="h-3.5 w-3.5 object-contain" />
              {e.name} · {e.cn}
            </span>
          ))}
        </div>
      </Panel>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4" onClick={() => setOpen(false)}>
          <div className="w-full max-w-[480px] rounded-3xl border border-border bg-card p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between">
              <div>
                <div className="text-[17px] font-bold">绑定交易所 API</div>
                <div className="mt-0.5 text-[12.5px] text-muted-foreground">只授权读取与交易，切勿开启提现权限</div>
              </div>
              <button onClick={() => setOpen(false)} className="text-muted-foreground">
                <X size={18} />
              </button>
            </div>

            <div className="mt-5 space-y-4">
              <div>
                <span className="text-[12.5px] font-medium text-muted-foreground">交易所</span>
                <div className="mt-1.5 grid grid-cols-4 gap-2">
                  {exchanges.map((e) => (
                    <button
                      key={e.id}
                      onClick={() => setForm({ ...form, exchange: e.id })}
                      className={cn(
                        "rounded-xl border px-2 py-2.5 text-[12.5px] font-medium transition",
                        form.exchange === e.id ? "border-wise-green bg-wise-mint text-wise-darkgreen" : "border-border"
                      )}
                    >
                      {e.name}
                    </button>
                  ))}
                </div>
              </div>

              <Input
                label="备注名"
                value={form.label}
                onChange={(v) => setForm({ ...form, label: v })}
                placeholder="例如：主账户 · 合约"
              />
              <Input label="API Key" value={form.apiKey} onChange={(v) => setForm({ ...form, apiKey: v })} placeholder="粘贴 API Key" mono />
              <Input
                label="Secret Key"
                value={form.secret}
                onChange={(v) => setForm({ ...form, secret: v })}
                placeholder="粘贴 Secret Key（仅本地加密保存）"
                mono
              />
              {["okx", "bitget"].includes(form.exchange) ? (
                <Input
                  label="Passphrase 密码短语"
                  value={form.passphrase}
                  onChange={(v) => setForm({ ...form, passphrase: v })}
                  placeholder={form.exchange === "okx" ? "OKX 必填" : "Bitget 必填"}
                  mono
                />
              ) : null}

              <div className="flex gap-3 rounded-2xl border border-warning/40 bg-warning/10 p-3.5">
                <TriangleAlert size={16} className="mt-0.5 shrink-0 text-warning" />
                <p className="text-[12px] leading-relaxed text-muted-foreground">
                  请确认已在交易所侧关闭提现权限，并将币策出口 IP 加入白名单。绑定后请先用小额资金试跑。
                </p>
              </div>

              {error ? <p className="text-[12.5px] text-[#f6465d]">{error}</p> : null}

              <button onClick={submit} disabled={busy} className="btn-primary w-full py-3">
                <KeyRound size={15} /> {busy ? "绑定中…" : "确认绑定"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function Row({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="shrink-0 text-muted-foreground">{k}</span>
      <span className={cn("truncate text-right", mono ? "font-mono" : "")}>{v}</span>
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
        className={cn(
          "mt-1.5 w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-[14px] outline-none focus:border-wise-green",
          mono ? "font-mono" : ""
        )}
      />
    </label>
  );
}

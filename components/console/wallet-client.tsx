"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Check, CreditCard, LoaderCircle, Receipt, Wallet as WalletIcon } from "lucide-react";
import { Badge, cn } from "@/components/ui";
import { PageHeader, Panel, Td, Th } from "@/components/console/ui";
import { fmtDate, fmtUsd } from "@/lib/format";
import type { Invoice, Plan } from "@/lib/types";

export function WalletClient({
  plans,
  currentPlanId,
  expiresAt,
  balance,
  invoices: initialInvoices,
}: {
  plans: Plan[];
  currentPlanId: string;
  expiresAt: number;
  balance: number;
  invoices: Invoice[];
}) {
  const router = useRouter();
  const [yearly, setYearly] = useState(true);
  const [planId, setPlanId] = useState(currentPlanId);
  const [busy, setBusy] = useState("");
  const [invoices, setInvoices] = useState<Invoice[]>(initialInvoices);
  const [msg, setMsg] = useState("");

  async function subscribe(p: Plan) {
    setBusy(p.id);
    const r = await fetch("/api/subscription", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ planId: p.id, cycle: yearly ? "yearly" : "monthly" }),
    });
    const j = await r.json();
    setBusy("");
    if (!j.ok) return setMsg(j.error ?? "订阅失败");
    setPlanId(p.id);
    setInvoices((prev) => [j.invoice, ...prev]);
    setMsg(`已订阅 ${p.name}，支付 ${j.invoice.amount} USDT`);
    setTimeout(() => setMsg(""), 3000);
    router.refresh();
  }

  const cur = plans.find((p) => p.id === planId) ?? plans[0];

  return (
    <>
      <PageHeader title="钱包订阅" desc="管理你的订阅方案、账单与支付方式" />

      {msg ? (
        <div className="mb-4 rounded-2xl border border-wise-green/40 bg-wise-mint px-4 py-3 text-[13px] font-medium text-wise-darkgreen">
          {msg}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="card-surface p-5">
          <div className="flex items-center gap-2 text-[12.5px] text-muted-foreground">
            <WalletIcon size={15} /> 账户余额
          </div>
          <div className="num mt-2 text-[26px] font-bold">{fmtUsd(balance)}</div>
          <div className="mt-1 text-[12px] text-muted-foreground">USDT · 可用于订阅续费</div>
          <button className="btn-primary mt-4 w-full py-2.5">
            <CreditCard size={15} /> 充值
          </button>
        </div>
        <div className="card-surface p-5">
          <div className="text-[12.5px] text-muted-foreground">当前套餐</div>
          <div className="mt-2 flex items-center gap-2">
            <span className="text-[22px] font-bold">{cur.name}</span>
            <Badge tone="green">生效中</Badge>
          </div>
          <div className="mt-1 text-[12px] text-muted-foreground">
            到期时间 {new Date(expiresAt).toLocaleDateString("zh-CN")}
          </div>
          <div className="mt-3 space-y-1 text-[12px] text-muted-foreground">
            <div>跟单席位 {cur.limits.copySlots < 0 ? "不限" : `${cur.limits.copySlots} 个`}</div>
            <div>API 绑定 {cur.limits.apiKeys < 0 ? "不限" : `${cur.limits.apiKeys} 个`}</div>
            <div>信号延迟 {cur.limits.signals}</div>
          </div>
        </div>
        <div className="card-surface p-5">
          <div className="text-[12.5px] text-muted-foreground">累计消费</div>
          <div className="num mt-2 text-[26px] font-bold">
            {fmtUsd(invoices.reduce((a, i) => a + i.amount, 0), 0)}
          </div>
          <div className="mt-1 text-[12px] text-muted-foreground">共 {invoices.length} 笔账单 · 全部以 USDT 结算</div>
          <div className="mt-4 rounded-xl bg-surface px-3 py-2 text-[12px] text-muted-foreground">
            支付方式：USDT (TRC20)
          </div>
        </div>
      </div>

      <div className="mt-6 flex items-center justify-between">
        <h2 className="text-[16px] font-semibold">选择方案</h2>
        <div className="flex items-center gap-3">
          <span className={cn("text-[13px]", !yearly ? "font-semibold" : "text-muted-foreground")}>月付</span>
          <button
            onClick={() => setYearly((v) => !v)}
            className={cn("relative h-6 w-11 rounded-pill transition", yearly ? "bg-wise-green" : "bg-border")}
          >
            <span className={cn("absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all", yearly ? "left-[22px]" : "left-0.5")} />
          </button>
          <span className={cn("text-[13px]", yearly ? "font-semibold" : "text-muted-foreground")}>年付</span>
          <Badge tone="green">省 2 个月</Badge>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        {plans.map((p) => {
          const price = yearly ? p.priceYearly : p.priceMonthly;
          const isCur = p.id === planId;
          return (
            <div key={p.id} className={cn("card-surface flex flex-col p-5", isCur && "border-wise-green")}>
              <div className="flex items-center justify-between">
                <span className="text-[15px] font-bold">{p.name}</span>
                {isCur ? <Badge tone="green">当前</Badge> : p.popular ? <Badge tone="dark">推荐</Badge> : null}
              </div>
              <div className="mt-3 flex items-baseline gap-1">
                <span className="num text-[30px] font-bold">${price}</span>
                <span className="text-[13px] text-muted-foreground">/ {yearly ? "年" : "月"}</span>
              </div>
              <ul className="mt-4 flex-1 space-y-2">
                {p.features.slice(0, 5).map((f) => (
                  <li key={f} className="flex gap-2 text-[12.5px] text-muted-foreground">
                    <Check size={13} className="mt-0.5 shrink-0 text-wise-green" /> {f}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => subscribe(p)}
                disabled={isCur || busy === p.id}
                className={cn(
                  "mt-5 rounded-pill px-4 py-2.5 text-[13.5px] font-semibold transition",
                  isCur ? "bg-surface text-muted-foreground" : "bg-wise-green text-wise-darkgreen hover:opacity-90"
                )}
              >
                {busy === p.id ? <LoaderCircle size={15} className="mx-auto animate-spin" /> : isCur ? "当前方案" : "切换到此方案"}
              </button>
            </div>
          );
        })}
      </div>

      <Panel className="mt-6" title="账单记录" desc="所有订阅与续费记录" bodyClassName="p-0">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-border">
              <tr>
                <Th>时间</Th>
                <Th>方案</Th>
                <Th>周期</Th>
                <Th>金额</Th>
                <Th>支付方式</Th>
                <Th>状态</Th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((i) => {
                const p = plans.find((x) => x.id === i.planId);
                return (
                  <tr key={i.id} className="border-b border-border/60 last:border-0">
                    <Td className="text-muted-foreground">{fmtDate(i.createdAt)}</Td>
                    <Td className="font-medium">{p?.name ?? i.planId}</Td>
                    <Td>{i.cycle === "yearly" ? "年付" : "月付"}</Td>
                    <Td className="num font-semibold">{fmtUsd(i.amount, 0)} USDT</Td>
                    <Td className="text-muted-foreground">{i.method}</Td>
                    <Td>
                      <Badge tone={i.status === "paid" ? "green" : "default"}>
                        {i.status === "paid" ? "已支付" : i.status === "pending" ? "待支付" : "已退款"}
                      </Badge>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {invoices.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-12 text-[13px] text-muted-foreground">
            <Receipt size={20} /> 暂无账单
          </div>
        ) : null}
      </Panel>
    </>
  );
}

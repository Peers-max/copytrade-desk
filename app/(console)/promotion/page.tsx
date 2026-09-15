import { Copy, Gift, Link2, Users, Wallet } from "lucide-react";
import { Badge } from "@/components/ui";
import { PageHeader, Panel, StatCard, Td, Th } from "@/components/console/ui";
import { getSessionUser } from "@/lib/auth";
import { fmtDate, fmtUsd } from "@/lib/format";
import { PromotionClient } from "@/components/console/promotion-client";

export const dynamic = "force-dynamic";
export const metadata = { title: "推广返佣" };

const REFERRALS = [
  { name: "Alex***", plan: "专业版", cycle: "年付", amount: 790, commission: 158, at: Date.now() - 86400000 * 3 },
  { name: "Mia***", plan: "基础版", cycle: "月付", amount: 29, commission: 5.8, at: Date.now() - 86400000 * 8 },
  { name: "Ken***", plan: "旗舰版", cycle: "年付", amount: 1990, commission: 398, at: Date.now() - 86400000 * 15 },
  { name: "Yun***", plan: "专业版", cycle: "月付", amount: 79, commission: 15.8, at: Date.now() - 86400000 * 22 },
  { name: "Leo***", plan: "基础版", cycle: "年付", amount: 290, commission: 58, at: Date.now() - 86400000 * 31 },
];

export default async function PromotionPage() {
  const user = (await getSessionUser())!;
  const totalCommission = REFERRALS.reduce((a, r) => a + r.commission, 0);

  return (
    <>
      <PageHeader title="推广返佣" desc="邀请好友订阅币策，终身享受 20% 佣金，上不封顶" />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="累计邀请" value={`${REFERRALS.length} 人`} sub="其中 3 人已付费" icon={Users} />
        <StatCard label="累计佣金" value={`${fmtUsd(totalCommission)} USDT`} sub="可提现至钱包余额" icon={Wallet} tone="up" />
        <StatCard label="待结算" value={`${fmtUsd(21.6)} USDT`} sub="冷却期 7 天后到账" icon={Gift} />
        <StatCard label="佣金比例" value="20%" sub="Lv.2 推广大使" icon={Link2} />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_1.1fr]">
        <Panel title="我的邀请">
          <PromotionClient code={user.referralCode} />
          <div className="mt-5 space-y-3 border-t border-border pt-4">
            {[
              { t: "好友通过你的链接注册", d: "双方各得 200 积分" },
              { t: "好友完成首次付费订阅", d: "你获得订单金额 20% 的 USDT 佣金" },
              { t: "好友续费", d: "持续获得 20% 佣金，终身有效" },
            ].map((x) => (
              <div key={x.t} className="flex gap-2.5 text-[13px]">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-wise-green" />
                <div>
                  <div className="font-medium">{x.t}</div>
                  <div className="text-[12px] text-muted-foreground">{x.d}</div>
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="佣金等级">
          <div className="space-y-3">
            {[
              { lv: "Lv.1", name: "推广员", req: "邀请 0–4 人", rate: "15%", on: false },
              { lv: "Lv.2", name: "推广大使", req: "邀请 5–19 人", rate: "20%", on: true },
              { lv: "Lv.3", name: "金牌合伙人", req: "邀请 20–49 人", rate: "25%", on: false },
              { lv: "Lv.4", name: "战略合伙人", req: "邀请 50 人以上", rate: "30% + 团队奖励", on: false },
            ].map((t) => (
              <div
                key={t.lv}
                className={`flex items-center gap-3 rounded-2xl border p-4 ${
                  t.on ? "border-wise-green bg-wise-mint/30" : "border-border bg-card"
                }`}
              >
                <span className="w-10 text-[13px] font-bold">{t.lv}</span>
                <div className="flex-1">
                  <div className="text-[13.5px] font-semibold">{t.name}</div>
                  <div className="text-[12px] text-muted-foreground">{t.req}</div>
                </div>
                <span className="num text-[14px] font-bold">{t.rate}</span>
                {t.on ? <Badge tone="green">当前</Badge> : null}
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <Panel className="mt-5" title="邀请记录" bodyClassName="p-0">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-border">
              <tr>
                <Th>好友</Th>
                <Th>订阅方案</Th>
                <Th>订单金额</Th>
                <Th>佣金</Th>
                <Th>时间</Th>
                <Th>状态</Th>
              </tr>
            </thead>
            <tbody>
              {REFERRALS.map((r) => (
                <tr key={r.name} className="border-b border-border/60 last:border-0">
                  <Td className="font-medium">{r.name}</Td>
                  <Td>
                    {r.plan} · {r.cycle === "yearly" ? "年付" : "月付"}
                  </Td>
                  <Td className="num">{fmtUsd(r.amount, 0)} USDT</Td>
                  <Td className="num font-semibold text-[#0ecb81]">+{fmtUsd(r.commission)}</Td>
                  <Td className="text-muted-foreground">{fmtDate(r.at)}</Td>
                  <Td>
                    <Badge tone="green">已结算</Badge>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}

import { Bell, KeyRound, Shield, UserRound } from "lucide-react";
import { Badge, cn } from "@/components/ui";
import { PageHeader, Panel } from "@/components/console/ui";
import { getSessionUser } from "@/lib/auth";
import { count, filter } from "@/lib/db";
import { PLANS, bootstrapIfNeeded } from "@/lib/seed";
import { fmtDate } from "@/lib/format";
import { ProfileForm } from "@/components/console/profile-form";
import type { ApiKey } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "个人中心" };

export default async function ProfilePage() {
  await bootstrapIfNeeded();
  const user = (await getSessionUser())!;
  const plan = PLANS.find((p) => p.id === user.planId) ?? PLANS[0];
  const keys = await filter<ApiKey>("apiKeys", (k) => k.userId === user.id);
  const copies = await count("copyRelations", (r: any) => r.userId === user.id);
  const unread = await count("notifications", (n: any) => n.userId === user.id && !n.read);

  return (
    <>
      <PageHeader title="个人中心" desc="管理你的账户资料、偏好与安全设置" />

      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-5">
          <Panel title="基本资料">
            <ProfileForm
              user={{ nickname: user.nickname, email: user.email, riskProfile: user.riskProfile, avatarHue: user.avatarHue }}
            />
          </Panel>

          <Panel title="安全设置">
            <div className="space-y-3">
              {[
                {
                  icon: Shield,
                  t: "两步验证 (2FA)",
                  d: "建议开启，登录与修改 API 时需二次确认",
                  on: false,
                },
                {
                  icon: KeyRound,
                  t: "API 提现权限",
                  d: "平台已永久关闭，资金无法被转出",
                  on: true,
                  lock: true,
                },
                {
                  icon: Bell,
                  t: "风控推送",
                  d: "回撤、爆仓预警与信号异常实时通知",
                  on: true,
                },
                {
                  icon: UserRound,
                  t: "登录提醒",
                  d: "新设备登录时发送邮件提醒",
                  on: true,
                },
              ].map((s) => (
                <div key={s.t} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4">
                  <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-surface text-muted-foreground">
                    <s.icon size={16} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13.5px] font-semibold">{s.t}</div>
                    <div className="text-[12px] text-muted-foreground">{s.d}</div>
                  </div>
                  <span
                    className={cn(
                      "rounded-pill px-2.5 py-1 text-[11.5px] font-semibold",
                      s.on ? "bg-wise-mint text-wise-darkgreen" : "bg-surface text-muted-foreground"
                    )}
                  >
                    {s.on ? "已开启" : "未开启"}
                  </span>
                </div>
              ))}
            </div>
          </Panel>
        </div>

        <div className="space-y-5">
          <Panel title="账户概览">
            <div className="flex items-center gap-3">
              <div
                className="flex h-14 w-14 items-center justify-center rounded-full text-[18px] font-bold text-wise-darkgreen"
                style={{ background: `hsl(${user.avatarHue} 72% 78%)` }}
              >
                {user.nickname.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <div className="text-[16px] font-bold">{user.nickname}</div>
                <div className="text-[12.5px] text-muted-foreground">{user.email}</div>
              </div>
            </div>
            <dl className="mt-5 space-y-2.5 border-t border-border pt-4 text-[13px]">
              {[
                ["当前套餐", plan.name],
                ["套餐到期", new Date(user.planExpiresAt).toLocaleDateString("zh-CN")],
                ["已绑定 API", `${keys.length} 个`],
                ["跟单关系", `${copies} 条`],
                ["未读消息", `${unread} 条`],
                ["注册时间", fmtDate(user.createdAt)],
                ["邀请码", user.referralCode],
              ].map(([k, v]) => (
                <div key={k} className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd className="font-medium">{v}</dd>
                </div>
              ))}
            </dl>
          </Panel>

          <Panel title="账户等级">
            <div className="flex items-center gap-2">
              <Badge tone="green">Lv.3 进阶交易者</Badge>
              <span className="text-[12px] text-muted-foreground">再跟单 2 位交易员可升级</span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-pill bg-surface">
              <div className="h-full w-[62%] bg-wise-green" />
            </div>
            <div className="mt-2 text-right text-[11.5px] text-muted-foreground">成长值 620 / 1000</div>
          </Panel>
        </div>
      </div>
    </>
  );
}

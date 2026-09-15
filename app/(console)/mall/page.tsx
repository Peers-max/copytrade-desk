import { Gift, Sparkles, Tag, Ticket, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui";
import { PageHeader, Panel } from "@/components/console/ui";
import { getSessionUser } from "@/lib/auth";
import { MallClient, type MallItem } from "@/components/console/mall-client";

export const dynamic = "force-dynamic";
export const metadata = { title: "积分商城" };

const ITEMS: MallItem[] = [
  { id: "m1", name: "订阅 8 折券", desc: "适用于任意套餐的月付或年付续费", points: 800, tag: "热门", icon: "Tag", stock: 128 },
  { id: "m2", name: "跟单席位 +2", desc: "在当前套餐基础上额外增加 2 个跟单席位，30 天有效", points: 1200, tag: "限时", icon: "TrendingUp", stock: 56 },
  { id: "m3", name: "旗舰策略 7 天体验", desc: "解锁策略市场中 3 个旗舰量化策略，试用 7 天", points: 1500, tag: "", icon: "Sparkles", stock: 30 },
  { id: "m4", name: "信号延迟加速包", desc: "7 天内信号通道升级为专线直连", points: 2000, tag: "稀缺", icon: "Ticket", stock: 12 },
  { id: "m5", name: "专属客服通道", desc: "30 天内工单 5 分钟内响应", points: 600, tag: "", icon: "Gift", stock: 999 },
  { id: "m6", name: "币策限定周边", desc: "限量 T 恤 + 贴纸包，兑换后 7 个工作日寄出", points: 3000, tag: "实物", icon: "Gift", stock: 8 },
];

export default async function MallPage() {
  const user = (await getSessionUser())!;
  const points = 2480;
  const earned = 1240;
  const spent = 760;

  return (
    <>
      <PageHeader title="积分商城" desc="签到、跟单、邀请好友都能赚积分，兑换订阅折扣与增值服务" />

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="card-surface p-5">
          <div className="text-[12.5px] text-muted-foreground">可用积分</div>
          <div className="num mt-2 text-[28px] font-bold">{points.toLocaleString()}</div>
          <div className="mt-1 text-[12px] text-muted-foreground">≈ 可抵扣 $24.8 订阅费</div>
        </div>
        <div className="card-surface p-5">
          <div className="text-[12.5px] text-muted-foreground">累计获得</div>
          <div className="num mt-2 text-[28px] font-bold">{earned.toLocaleString()}</div>
          <div className="mt-1 text-[12px] text-muted-foreground">近 30 日 +320</div>
        </div>
        <div className="card-surface p-5">
          <div className="text-[12.5px] text-muted-foreground">累计消耗</div>
          <div className="num mt-2 text-[28px] font-bold">{spent.toLocaleString()}</div>
          <div className="mt-1 text-[12px] text-muted-foreground">共兑换 4 件商品</div>
        </div>
      </div>

      <MallClient items={ITEMS} points={points} />

      <Panel className="mt-6" title="如何赚积分">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { t: "每日签到", d: "+10 积分，连续 7 天额外 +50" },
            { t: "完成一笔跟单", d: "+20 积分，每日上限 100" },
            { t: "邀请好友注册", d: "+200 积分 / 人" },
            { t: "好友完成付费", d: "+500 积分 / 人" },
          ].map((x) => (
            <div key={x.t} className="rounded-2xl border border-border bg-surface/60 p-4">
              <div className="text-[13.5px] font-semibold">{x.t}</div>
              <div className="mt-1 text-[12px] text-muted-foreground">{x.d}</div>
            </div>
          ))}
        </div>
        <div className="mt-4">
          <Badge tone="default">积分有效期 12 个月，逾期未使用将自动清零</Badge>
        </div>
      </Panel>
    </>
  );
}

"use client";

import { useState } from "react";
import { Check, Gift, Sparkles, Tag, Ticket, TrendingUp } from "lucide-react";
import { Badge, cn } from "@/components/ui";

export type MallItem = {
  id: string;
  name: string;
  desc: string;
  points: number;
  tag: string;
  icon: string;
  stock: number;
};

const ICONS: Record<string, any> = { Tag, TrendingUp, Sparkles, Ticket, Gift };

export function MallClient({ items, points }: { items: MallItem[]; points: number }) {
  const [owned, setOwned] = useState<string[]>([]);
  const [toast, setToast] = useState("");

  function redeem(it: MallItem) {
    if (points < it.points) {
      setToast("积分不足");
      setTimeout(() => setToast(""), 2000);
      return;
    }
    setOwned((p) => [...p, it.id]);
    setToast(`已兑换「${it.name}」`);
    setTimeout(() => setToast(""), 2400);
  }

  return (
    <>
      <h2 className="mb-4 mt-8 text-[16px] font-semibold">可兑换商品</h2>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((it) => {
          const Icon = ICONS[it.icon] ?? Gift;
          const isOwned = owned.includes(it.id);
          return (
            <div key={it.id} className="card-surface flex flex-col p-5">
              <div className="flex items-start justify-between">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-wise-mint text-wise-darkgreen">
                  <Icon size={19} />
                </span>
                {it.tag ? <Badge tone={it.tag === "稀缺" ? "warn" : "green"}>{it.tag}</Badge> : null}
              </div>
              <div className="mt-4 text-[15px] font-semibold">{it.name}</div>
              <p className="mt-1.5 flex-1 text-[12.5px] leading-relaxed text-muted-foreground">{it.desc}</p>
              <div className="mt-4 flex items-end justify-between">
                <div>
                  <div className="num text-[20px] font-bold">{it.points}</div>
                  <div className="text-[11px] text-muted-foreground">积分 · 剩余 {it.stock}</div>
                </div>
                <button
                  onClick={() => redeem(it)}
                  disabled={isOwned}
                  className={cn(
                    "rounded-pill px-4 py-2.5 text-[13px] font-semibold transition",
                    isOwned ? "bg-surface text-muted-foreground" : "bg-wise-green text-wise-darkgreen hover:opacity-90"
                  )}
                >
                  {isOwned ? (
                    <>
                      <Check size={14} className="mr-1 inline" /> 已兑换
                    </>
                  ) : (
                    "立即兑换"
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {toast ? (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-pill bg-foreground px-5 py-2.5 text-[13px] font-medium text-background shadow-card">
          {toast}
        </div>
      ) : null}
    </>
  );
}

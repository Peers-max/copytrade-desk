"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { cn } from "@/components/ui";

export function ProfileForm({
  user,
}: {
  user: { nickname: string; email: string; riskProfile: string; avatarHue: number };
}) {
  const [nickname, setNickname] = useState(user.nickname);
  const [risk, setRisk] = useState(user.riskProfile);
  const [saved, setSaved] = useState(false);

  function save() {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="space-y-4">
      <label className="block">
        <span className="text-[12.5px] font-medium text-muted-foreground">昵称</span>
        <input
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          className="mt-1.5 w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-[14px] outline-none focus:border-wise-green"
        />
      </label>

      <label className="block">
        <span className="text-[12.5px] font-medium text-muted-foreground">邮箱</span>
        <input
          value={user.email}
          disabled
          className="mt-1.5 w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-[14px] text-muted-foreground outline-none"
        />
      </label>

      <div>
        <span className="text-[12.5px] font-medium text-muted-foreground">风险偏好</span>
        <div className="mt-1.5 grid grid-cols-3 gap-2">
          {["稳健", "均衡", "进取"].map((r) => (
            <button
              key={r}
              onClick={() => setRisk(r)}
              className={cn(
                "rounded-xl border px-3 py-2.5 text-[13px] font-medium transition",
                risk === r ? "border-wise-green bg-wise-mint text-wise-darkgreen" : "border-border"
              )}
            >
              {r}
            </button>
          ))}
        </div>
        <p className="mt-2 text-[11.5px] text-muted-foreground">
          风险偏好将用于推荐交易员与策略，并作为默认风控参数的参考。
        </p>
      </div>

      <button onClick={save} className="btn-primary">
        {saved ? <Check size={15} /> : null} {saved ? "已保存" : "保存修改"}
      </button>
    </div>
  );
}

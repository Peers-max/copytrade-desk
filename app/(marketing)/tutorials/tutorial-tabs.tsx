"use client";

import { useState } from "react";
import { TriangleAlert, ClipboardCopy } from "lucide-react";
import { cn } from "@/components/ui";

type Step = { title: string; body: string[] };

const DATA: Record<string, { name: string; warn?: string; steps: Step[] }> = {
  okx: {
    name: "欧易 OKX",
    warn: "额外需要 Passphrase 密码短语，自己设并记下来。账户模式需设为「单币种保证金」或「跨币种保证金」，简单交易模式无法跑合约。",
    steps: [
      { title: "打开 OKX App", body: ["登录回到「交易所」首页。"] },
      { title: "找 API 入口", body: ["点左上角头像 → 滑到「更多」找 API，进入。"] },
      { title: "点「创建 API key」", body: ["页面底部绿色按钮。"] },
      {
        title: "填写表单",
        body: [
          "备注名：自定义（任意填，方便识别即可）",
          "账户：主账户",
          "用途：API 交易",
          "IP 白名单：粘贴币策出口 IP",
          "权限：只勾「交易」",
          "密码短语：自己设一串字符，必须记下来",
          "填完点「提交全部」。",
        ],
      },
      { title: "创建成功", body: ["弹窗点「好的」进入详情页。"] },
      {
        title: "复制 API key + Secret key",
        body: ["Secret key 仅显示一次，立刻复制保存。", "到币策「账户管理 → 绑定 API」选「欧易 OKX」，填入 Key / Secret / 密码短语。"],
      },
    ],
  },
  binance: {
    name: "币安 Binance",
    warn: "建议使用「系统生成的 API Key」。权限只勾选「启用合约」与「读取」，切勿勾选「启用提现」。",
    steps: [
      { title: "进入 API 管理", body: ["网页端右上角头像 → 账户 → API 管理。"] },
      { title: "创建 API", body: ["选择「系统生成」API Key，输入标签名称后确认创建。"] },
      { title: "完成安全验证", body: ["按提示完成邮箱、手机与身份验证。"] },
      {
        title: "编辑权限与白名单",
        body: ["权限：勾选「读取」+「启用合约」", "不要勾选「启用提现」", "IP 白名单：粘贴币策出口 IP 后保存。"],
      },
      { title: "回填到币策", body: ["复制 API Key 与 Secret Key，到「账户管理 → 绑定 API」选择币安并填入。"] },
    ],
  },
  bybit: {
    name: "Bybit",
    warn: "Bybit 需区分「统一交易账户」。跟单合约请在 UTA 账户下创建 API。",
    steps: [
      { title: "打开 API 页面", body: ["头像 → 账户与身份 → API → 创建新密钥。"] },
      { title: "选择类型", body: ["选择「API 交易」或「系统生成的 API 密钥」。"] },
      { title: "设置权限", body: ["合约：勾选「合约交易」与「读取」", "不要勾选「提现」", "绑定 IP 白名单。" ] },
      { title: "回填到币策", body: ["保存后复制 Key / Secret，到币策绑定页面选择 Bybit 填入。"] },
    ],
  },
  bitget: {
    name: "Bitget",
    warn: "Bitget 同样需要 Passphrase，请务必保存。",
    steps: [
      { title: "进入 API 管理", body: ["头像 → 安全中心 → API 管理 → 创建 API。"] },
      { title: "填写信息", body: ["备注名自定义，输入 Passphrase 并记牢。"] },
      { title: "权限设置", body: ["勾选「只读」与「合约交易」，不要勾选提现。", "粘贴币策出口 IP 到白名单。"] },
      { title: "回填到币策", body: ["复制 Key / Secret / Passphrase，在币策绑定页选择 Bitget 填入。"] },
    ],
  },
  gate: {
    name: "Gate.io",
    warn: "Gate 的 APIv4 需单独勾选「合约」权限，且同样不要开启提现。",
    steps: [
      { title: "创建 API", body: ["头像 → API 管理 → 创建 API v4 密钥。"] },
      { title: "选择权限", body: ["勾选「合约」读取与交易权限，关闭「提现」。"] },
      { title: "IP 白名单", body: ["粘贴币策出口 IP 并保存。"] },
      { title: "回填到币策", body: ["复制 Key / Secret，在币策绑定页选择 Gate 填入。"] },
    ],
  },
};

const TABS = Object.keys(DATA);

export function TutorialTabs() {
  const [tab, setTab] = useState("okx");
  const cur = DATA[tab];

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex flex-wrap gap-2">
        {TABS.map((k) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={cn(
              "rounded-pill border px-4 py-2 text-[13px] font-semibold transition",
              tab === k ? "border-transparent bg-wise-green text-wise-darkgreen" : "border-border bg-card text-muted-foreground hover:text-foreground"
            )}
          >
            {DATA[k].name}
          </button>
        ))}
      </div>

      <div className="mt-5 rounded-card-lg border border-border bg-card p-6 sm:p-8">
        <h2 className="text-[19px] font-bold">{cur.name} API 绑定</h2>
        {cur.warn ? (
          <div className="mt-4 flex gap-3 rounded-2xl border border-warning/40 bg-warning/10 p-4">
            <TriangleAlert size={17} className="mt-0.5 shrink-0 text-warning" />
            <p className="text-[13px] leading-relaxed">{cur.warn}</p>
          </div>
        ) : null}

        <ol className="mt-6 space-y-5">
          {cur.steps.map((s, i) => (
            <li key={s.title} className="flex gap-4">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-wise-green text-[13px] font-bold text-wise-darkgreen">
                {i + 1}
              </span>
              <div className="min-w-0">
                <div className="text-[14.5px] font-semibold">{s.title}</div>
                <ul className="mt-1.5 space-y-1">
                  {s.body.map((b) => (
                    <li key={b} className="text-[13.5px] leading-relaxed text-muted-foreground">
                      {b}
                    </li>
                  ))}
                </ul>
              </div>
            </li>
          ))}
        </ol>

        <div className="mt-7 rounded-2xl border border-border bg-surface p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[12.5px] font-semibold">币策出口 IP 白名单</div>
              <div className="mt-1 font-mono text-[12.5px] text-muted-foreground">
                43.135.18.22 / 129.204.66.19
              </div>
            </div>
            <button
              onClick={() => navigator.clipboard?.writeText("43.135.18.22 / 129.204.66.19")}
              className="inline-flex items-center gap-1.5 rounded-pill border border-border bg-card px-3.5 py-2 text-[12.5px] font-semibold transition hover:bg-surface"
            >
              <ClipboardCopy size={14} /> 复制
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

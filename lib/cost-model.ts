export const FX = 7.2;

export const BUSINESS = {
  registered: 50000,
  mau: 12000,
  paying: 3000,
  mix: { basic: 0.45, pro: 0.45, elite: 0.1 },
  yearlyShare: 0.55,
  copyRelations: 8000,
  dailySignals: 15000,
  dailyOrders: 40000,
  wsPeak: 5000,
  exchanges: 8,
};

export const PLANS_PRICE = {
  current: [
    { id: "basic", name: "基础版", monthly: 29, yearly: 290 },
    { id: "pro", name: "专业版", monthly: 79, yearly: 790 },
    { id: "elite", name: "旗舰版", monthly: 199, yearly: 1990 },
  ],
  proposed: [
    { id: "basic", name: "基础版", monthly: 19, yearly: 190 },
    { id: "pro", name: "专业版", monthly: 59, yearly: 588 },
    { id: "elite", name: "旗舰版", monthly: 149, yearly: 1490 },
  ],
};

/** 混合后（年付占比 55%）的单套餐 ARPU */
export function blended(monthly: number, yearly: number, share = BUSINESS.yearlyShare) {
  return monthly * (1 - share) + (yearly / 12) * share;
}

export function arpuOf(plans: typeof PLANS_PRICE.current) {
  const m = BUSINESS.mix;
  return (
    m.basic * blended(plans[0].monthly, plans[0].yearly) +
    m.pro * blended(plans[1].monthly, plans[1].yearly) +
    m.elite * blended(plans[2].monthly, plans[2].yearly)
  );
}

export const ARPU_NOW = arpuOf(PLANS_PRICE.current); // 62.22
export const ARPU_NEW = arpuOf(PLANS_PRICE.proposed); // 45.38
export const MRR_NOW = ARPU_NOW * BUSINESS.paying;
export const REVENUE_NOW = MRR_NOW * FX;

/** 基础设施成本明细 */
export const INFRA = [
  { group: "计算", name: "应用 / Web 服务器（6 × 4C8G）", cost: 1800 },
  { group: "计算", name: "行情聚合常驻 worker（2 × 4C8G）", cost: 900 },
  { group: "计算", name: "跟单执行引擎（2 × 8C16G 低延迟）", cost: 1600 },
  { group: "计算", name: "回测 / 批处理（Spot 实例）", cost: 600 },
  { group: "数据库与缓存", name: "PostgreSQL 主从 8C32G + 500GB SSD", cost: 2200 },
  { group: "数据库与缓存", name: "Redis 集群 16GB", cost: 800 },
  { group: "数据库与缓存", name: "时序库 / OLAP（K 线成交 2TB）", cost: 900 },
  { group: "带宽与 CDN", name: "CDN 静态分发 8TB × ¥0.18/GB", cost: 1440 },
  { group: "带宽与 CDN", name: "源站出网 4.5TB（WS 行情 + API）", cost: 2475 },
  { group: "带宽与 CDN", name: "负载均衡 / EIP / 跨 AZ", cost: 600 },
  { group: "存储", name: "对象存储 3TB + 请求费", cost: 480 },
  { group: "存储", name: "块存储与快照 1.5TB SSD", cost: 1320 },
  { group: "容灾", name: "跨地域备份与备用可用区", cost: 1500 },
];

export const INFRA_TOTAL = INFRA.reduce((a, b) => a + b.cost, 0); // 16615

export const INFRA_GROUPS = ["计算", "数据库与缓存", "带宽与 CDN", "存储", "容灾"].map((g) => ({
  name: g,
  value: INFRA.filter((i) => i.group === g).reduce((a, b) => a + b.cost, 0),
}));

export const THIRD_PARTY = [
  { name: "第三方行情源授权（校验 / 灾备）", cost: 2500 },
  { name: "邮件 + 短信通知", cost: 700 },
  { name: "监控 / 日志 / APM", cost: 1500 },
  { name: "WAF + DDoS 高防", cost: 2000 },
  { name: "客服工单系统", cost: 400 },
  { name: "域名 / SSL / 企业邮箱", cost: 100 },
];
export const THIRD_PARTY_TOTAL = THIRD_PARTY.reduce((a, b) => a + b.cost, 0); // 7200

export const COMPLIANCE = [
  { name: "KYC / AML 服务", cost: 8000 },
  { name: "法务顾问与合规咨询", cost: 9000 },
  { name: "渗透测试与安全审计（摊销）", cost: 5000 },
  { name: "责任保险及其他", cost: 3000 },
];
export const COMPLIANCE_TOTAL = COMPLIANCE.reduce((a, b) => a + b.cost, 0); // 25000

export const HEADCOUNT = [
  { role: "后端工程师", count: 2, unit: 35000 },
  { role: "前端工程师", count: 1, unit: 28000 },
  { role: "量化 / 策略", count: 1, unit: 40000 },
  { role: "运维 SRE", count: 0.5, unit: 35000 },
  { role: "客服", count: 2, unit: 9000 },
  { role: "产品运营", count: 1, unit: 25000 },
];
export const HEADCOUNT_TOTAL = HEADCOUNT.reduce((a, b) => a + b.count * b.unit, 0); // 198500

export const MARKETING = [
  { name: "KOL / 社群合作", cost: 55000 },
  { name: "内容与 SEO", cost: 25000 },
  { name: "效果投放", cost: 30000 },
  { name: "活动与物料", cost: 10000 },
];
export const MARKETING_TOTAL = MARKETING.reduce((a, b) => a + b.cost, 0); // 120000

export const VARIABLE_RATE = 0.04; // 支付通道 1% + 推广返佣 3%
export const VARIABLE_TOTAL = Math.round(REVENUE_NOW * VARIABLE_RATE); // 53759

export const COST_STRUCTURE = [
  { name: "人力成本", value: HEADCOUNT_TOTAL, color: "#9fe870" },
  { name: "获客与营销", value: MARKETING_TOTAL, color: "#4cc9f0" },
  { name: "变动成本（支付+返佣）", value: VARIABLE_TOTAL, color: "#ffd11a" },
  { name: "安全与合规", value: COMPLIANCE_TOTAL, color: "#b388ff" },
  { name: "基础设施", value: INFRA_TOTAL, color: "#ff9f45" },
  { name: "第三方服务", value: THIRD_PARTY_TOTAL, color: "#f6465d" },
];
export const COST_TOTAL = COST_STRUCTURE.reduce((a, b) => a + b.value, 0); // 421074

export const PROFIT_NOW = REVENUE_NOW - COST_TOTAL;

/** 成本侧优化清单 */
export const OPTIMIZATIONS = [
  { item: "计算：预留实例 / 节省计划替代按量付费", save: 1470 },
  { item: "带宽：行情差分推送 + 边缘聚合 + 本地节流", save: 1400 },
  { item: "存储：冷热分层 + 生命周期策略", save: 540 },
  { item: "CDN：预付费流量包替代后付费", save: 290 },
  { item: "第三方：自研行情为主，商业数据源降级为灾备", save: 1800 },
  { item: "可观测性：日志降采样 + APM 自托管", save: 600 },
];
export const OPTIMIZATION_TOTAL = OPTIMIZATIONS.reduce((a, b) => a + b.save, 0); // 6100

/** 降价情景（弹性 -1.2） */
export const SCENARIOS = [
  {
    id: "now",
    name: "现状",
    arpu: ARPU_NOW,
    users: BUSINESS.paying,
    cost: COST_TOTAL,
    note: "维持现有价目",
    highlight: false,
  },
  {
    id: "a",
    name: "A 温和降价 −15%",
    arpu: ARPU_NOW * 0.85,
    users: Math.round(BUSINESS.paying * 1.18),
    cost: 452000,
    note: "仅调整基础版与新客",
    highlight: false,
  },
  {
    id: "b",
    name: "B 结构性降价 −27%（推荐）",
    arpu: ARPU_NEW,
    users: Math.round(BUSINESS.paying * 1.32),
    cost: 488970,
    note: "基础 $19 / 专业 $59 / 旗舰 $149",
    highlight: true,
  },
  {
    id: "c",
    name: "C 激进降价 −40%",
    arpu: ARPU_NOW * 0.6,
    users: Math.round(BUSINESS.paying * 1.6),
    cost: 540000,
    note: "风险高，再提价极难",
    highlight: false,
  },
].map((s) => {
  const revenue = s.arpu * s.users * FX;
  return { ...s, revenue, profit: revenue - s.cost, margin: (revenue - s.cost) / revenue };
});

export const UNIT_ECONOMICS = [
  { k: "ARPU", v: `¥${(ARPU_NOW * FX).toFixed(1)} / 月`, sub: `$${ARPU_NOW.toFixed(2)}` },
  { k: "单用户基础设施成本", v: `¥${(INFRA_TOTAL / BUSINESS.paying).toFixed(2)} / 月`, sub: "仅服务器/带宽/存储" },
  { k: "单用户全成本", v: `¥${(COST_TOTAL / BUSINESS.paying).toFixed(2)} / 月`, sub: "含人力与营销" },
  { k: "技术盈亏平衡价", v: "$3.3 / 月", sub: "只覆盖技术与变动成本" },
  { k: "全成本覆盖价", v: "$19.5 / 月", sub: "有经营意义的价格地板" },
  { k: "LTV / CAC", v: "21.5×", sub: "健康线 > 3" },
];

export const PRICE_BANDS = [
  { plan: "基础版", low: 15, anchor: 19, high: 24, now: 29 },
  { plan: "专业版（主力）", low: 49, anchor: 59, high: 69, now: 79 },
  { plan: "旗舰版", low: 129, anchor: 149, high: 179, now: 199 },
];

export const SCALE_TABLE = [
  { users: 1000, cost: 11500 },
  { users: 3000, cost: 16500 },
  { users: 5000, cost: 21500 },
  { users: 10000, cost: 43000 },
  { users: 30000, cost: 113000 },
].map((r) => ({ ...r, per: r.cost / r.users }));

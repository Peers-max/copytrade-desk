import { hmacSha256Base64 } from "@/lib/crypto";
import {
  type AccountSnapshot,
  type Credentials,
  type ExchangeAdapter,
  type OrderRequest,
  type OrderResult,
  emptyResult,
  floorToStep,
  fromOkxInstId,
  timedFetch,
  toOkxInstId,
} from "./base";

/**
 * OKX 永续合约（SWAP）适配器。
 *
 * 与币安的差异，也是最容易踩坑的地方：
 * 1. **下单单位是「张」不是「币」**：sz = 名义价值 ÷ 价格 ÷ ctVal。ctVal 只能从
 *    /api/v5/public/instruments 拿到，必须实时查（各币种合约面值不同）。
 * 2. **必须带 Passphrase**，且签名串是 `时间戳 + 方法 + 请求路径(含query) + body`。
 * 3. **账户模式决定下单参数**：net_mode 用 posSide=net + reduceOnly 平仓；
 *    long_short_mode 必须显式给 posSide=long/short。
 * 4. **权限位无法通过公开接口读取**，所以这里只能确认「读取 + 交易」可用，
 *    提现权限需要用户在 OKX 后台自行确认（绑定页有明确提示）。
 */

const BASE = "https://www.okx.com";

type OkxResp = { code: string; msg?: string; data?: any[] };

async function okxFetch(
  path: string,
  c: Credentials,
  method: "GET" | "POST" = "GET",
  body?: any
): Promise<OkxResp> {
  const timestamp = new Date().toISOString();
  const bodyStr = body ? JSON.stringify(body) : "";
  const sign = await hmacSha256Base64(c.secret, `${timestamp}${method}${path}${bodyStr}`);

  const res = await timedFetch(`${BASE}${path}`, {
    method,
    headers: {
      "OK-ACCESS-KEY": c.apiKey,
      "OK-ACCESS-SIGN": sign,
      "OK-ACCESS-TIMESTAMP": timestamp,
      "OK-ACCESS-PASSPHRASE": c.passphrase ?? "",
      "Content-Type": "application/json",
      "x-simulated-trading": "0",
    },
    body: method === "POST" ? bodyStr : undefined,
  });

  const json: OkxResp = await res.json().catch(() => ({ code: String(res.status) } as OkxResp));
  if (json.code !== "0") {
    throw new Error(`OKX ${json.code}: ${json.msg || `HTTP ${res.status}`}`);
  }
  return json;
}

/* ---------------- 合约面值缓存 ---------------- */

type Instrument = { ctVal: number; lotSz: number; minSz: number; tickSz: number };
const instCache = new Map<string, { at: number; v: Instrument }>();

async function instrument(symbol: string): Promise<Instrument | null> {
  const instId = toOkxInstId(symbol);
  const hit = instCache.get(instId);
  if (hit && Date.now() - hit.at < 10 * 60_000) return hit.v;
  try {
    const r = await timedFetch(`${BASE}/api/v5/public/instruments?instType=SWAP&instId=${instId}`);
    const j: OkxResp = await r.json();
    const d = j?.data?.[0];
    if (!d) return null;
    const v: Instrument = {
      ctVal: Number(d.ctVal) || 1,
      lotSz: Number(d.lotSz) || 1,
      minSz: Number(d.minSz) || 1,
      tickSz: Number(d.tickSz) || 0.1,
    };
    instCache.set(instId, { at: Date.now(), v });
    return v;
  } catch {
    return null;
  }
}

async function tickerPrice(symbol: string): Promise<number> {
  try {
    const r = await timedFetch(`${BASE}/api/v5/market/ticker?instId=${toOkxInstId(symbol)}`);
    const j: OkxResp = await r.json();
    return Number(j?.data?.[0]?.last) || 0;
  } catch {
    return 0;
  }
}

async function positions(c: Credentials): Promise<any[]> {
  try {
    const j = await okxFetch("/api/v5/account/positions?instType=SWAP", c);
    return j.data ?? [];
  } catch {
    return [];
  }
}

const ACCT_LV: Record<string, string> = {
  "1": "简单交易模式",
  "2": "单币种保证金模式",
  "3": "跨币种保证金模式",
  "4": "组合保证金模式",
};

/* ---------------- 适配器 ---------------- */

export const okxAdapter: ExchangeAdapter = {
  id: "okx",
  label: "欧易 OKX",
  needsPassphrase: true,
  tradable: true,

  async verify(c: Credentials): Promise<AccountSnapshot> {
    const cfg = await okxFetch("/api/v5/account/config", c);
    const conf = cfg.data?.[0] ?? {};
    const acctLv = String(conf.acctLv ?? "1");
    const posMode = String(conf.posMode ?? "net_mode");

    const bal = await okxFetch("/api/v5/account/balance", c);
    const b = bal.data?.[0] ?? {};
    const usdt = (b.details ?? []).find((d: any) => d.ccy === "USDT");

    const pos = await positions(c);

    return {
      uid: String(conf.uid ?? conf.mainUid ?? "") || undefined,
      accountMode: `${posMode === "long_short_mode" ? "双向持仓" : "单向持仓"} · ${ACCT_LV[acctLv] ?? `账户等级 ${acctLv}`}`,
      // OKX 不提供 API Key 权限查询接口，这里只能确认「读取 + 交易」链路通
      permissions: ["读取", "交易"],
      hasWithdraw: false,
      equityUsdt: Number(b.totalEq) || 0,
      availableUsdt: Number(usdt?.availEq ?? usdt?.availBal ?? usdt?.eq) || 0,
      positions: pos
        .filter((p: any) => Number(p.pos) !== 0)
        .map((p: any) => ({
          symbol: fromOkxInstId(String(p.instId)),
          side: String(p.posSide) === "short" || Number(p.pos) < 0 ? ("SHORT" as const) : ("LONG" as const),
          qty: Math.abs(Number(p.pos)) * (Number(p.ctVal) || 1) / 1,
          entryPrice: Number(p.avgPx) || 0,
          markPrice: Number(p.markPx) || 0,
          unrealizedPnl: Number(p.upl) || 0,
          leverage: Number(p.lever) || 0,
        })),
    };
  },

  async placeOrder(c: Credentials, o: OrderRequest): Promise<OrderResult> {
    const instId = toOkxInstId(o.symbol);
    const inst = await instrument(o.symbol);
    if (!inst) return emptyResult(`OKX 无此永续合约：${instId}`);

    const isOpen = o.action === "OPEN" || o.action === "ADD";
    const isLong = o.side === "LONG";

    const cfg = await okxFetch("/api/v5/account/config", c).catch(() => null);
    const posMode = String(cfg?.data?.[0]?.posMode ?? "net_mode");
    const hedge = posMode === "long_short_mode";

    let price = o.price && o.price > 0 ? o.price : await tickerPrice(o.symbol);
    if (!price) return emptyResult(`无法获取 ${o.symbol} 最新价，已跳过`);

    // 币数 -> 张数
    const qtyBase = o.qtyBase && o.qtyBase > 0 ? o.qtyBase : o.notionalUsdt / price;
    let sz = floorToStep(qtyBase / inst.ctVal, inst.lotSz);
    if (sz <= 0) {
      return emptyResult(
        `下单量过小：${o.notionalUsdt.toFixed(2)} USDT ÷ ${price} = ${qtyBase.toFixed(8)} 币，` +
          `不足 1 张（1 张 = ${inst.ctVal} 币）`
      );
    }
    if (sz < inst.minSz) {
      return emptyResult(`下单张数 ${sz} 低于 OKX 最小张数 ${inst.minSz}，请提高跟单资金或杠杆`);
    }

    const notional = sz * inst.ctVal * price;

    if (isOpen && o.leverage && o.leverage > 0) {
      const lever = String(Math.min(Math.max(Math.round(o.leverage), 1), 125));
      await okxFetch("/api/v5/account/set-leverage", c, "POST", {
        instId,
        lever,
        mgnMode: "cross",
      }).catch(() => undefined);
    }

    // 方向映射
    let side: "buy" | "sell";
    const posSide = hedge ? (isLong ? "long" : "short") : "net";
    if (isOpen) {
      side = isLong ? "buy" : "sell";
    } else {
      // 平仓永远是反向
      side = isLong ? "sell" : "buy";
    }

    const body: Record<string, any> = {
      instId,
      tdMode: "cross",
      side,
      posSide,
      ordType: "market",
      sz: String(sz),
      clOrdId: o.clientId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 32),
    };
    if (!isOpen && !hedge) body.reduceOnly = true;

    let resp: OkxResp;
    try {
      resp = await okxFetch("/api/v5/trade/order", c, "POST", body);
    } catch (e: any) {
      return emptyResult(String(e?.message ?? e), { qty: sz * inst.ctVal, notionalUsdt: notional });
    }

    const ord = resp.data?.[0] ?? {};
    if (ord.sCode && ord.sCode !== "0") {
      return emptyResult(
        `OKX ${ord.sCode}: ${ord.sMsg || "下单被拒"}`,
        { qty: sz * inst.ctVal, notionalUsdt: notional }
      );
    }

    // 开仓后在 OKX 侧挂上条件单（止盈止损，reduceOnly）
    let slOrderId: string | undefined;
    let tpOrderId: string | undefined;
    if (isOpen && (o.stopLossPrice || o.takeProfitPrice)) {
      const algo: Record<string, any> = {
        instId,
        tdMode: "cross",
        side: isLong ? "sell" : "buy",
        posSide,
        ordType: "conditional",
        sz: String(sz),
      };
      if (!hedge) algo.reduceOnly = true;
      if (o.takeProfitPrice && o.takeProfitPrice > 0) {
        algo.tpTriggerPx = String(o.takeProfitPrice);
        algo.tpOrdPx = "-1"; // 触发后市价
      }
      if (o.stopLossPrice && o.stopLossPrice > 0) {
        algo.slTriggerPx = String(o.stopLossPrice);
        algo.slOrdPx = "-1";
      }
      const ar = await okxFetch("/api/v5/trade/order-algo", c, "POST", algo).catch(() => null);
      const algoId = ar?.data?.[0]?.algoId;
      if (algoId) {
        slOrderId = algo.slTriggerPx ? String(algoId) : undefined;
        tpOrderId = algo.tpTriggerPx ? String(algoId) : undefined;
      }
    }

    return {
      ok: true,
      orderId: String(ord.ordId ?? ""),
      qty: sz * inst.ctVal,
      notionalUsdt: notional,
      avgPrice: price,
      slOrderId,
      tpOrderId,
      raw: ord,
    };
  },
};

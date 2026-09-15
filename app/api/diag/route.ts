import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * 出网连通性诊断（站主专用）。
 *
 * 为什么需要它：Cloudflare Worker 的出口 IP 会被部分交易所拒绝（币安对
 * 数据中心/受限地区返回 403/451）。一旦出网不通，行情、校验、下单全部失效 ——
 * 这是实盘链路上最致命也最难排查的一类问题，所以单独给它一个探针。
 *
 * 用法：登录站主后台后访问 GET /api/diag
 */

const TARGETS: Array<{ name: string; url: string }> = [
  { name: "币安 合约行情", url: "https://fapi.binance.com/fapi/v1/time" },
  { name: "币安 合约24h", url: "https://fapi.binance.com/fapi/v1/ticker/24hr?symbol=BTCUSDT" },
  { name: "币安 现货", url: "https://api.binance.com/api/v3/time" },
  { name: "币安 备用域名1", url: "https://fapi1.binance.com/fapi/v1/time" },
  { name: "币安 备用域名2", url: "https://fapi2.binance.com/fapi/v1/time" },
  { name: "币安 备用域名3", url: "https://fapi3.binance.com/fapi/v1/time" },
  { name: "OKX 公共行情", url: "https://www.okx.com/api/v5/public/time" },
  { name: "OKX 备用域名", url: "https://aws.okx.com/api/v5/public/time" },
  { name: "Bybit 公共行情", url: "https://api.bybit.com/v5/market/time" },
  { name: "Gate 公共行情", url: "https://api.gateio.ws/api/v4/spot/time" },
];

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ ok: false, error: "需要站主权限" }, { status: 403 });

  const results = await Promise.all(
    TARGETS.map(async (t) => {
      const started = Date.now();
      try {
        const ctl = new AbortController();
        const timer = setTimeout(() => ctl.abort(), 8000);
        const res = await fetch(t.url, { signal: ctl.signal });
        clearTimeout(timer);
        const body = await res.text().catch(() => "");
        return {
          name: t.name,
          url: t.url,
          ok: res.ok,
          status: res.status,
          ms: Date.now() - started,
          body: body.slice(0, 180),
        };
      } catch (e: any) {
        return {
          name: t.name,
          url: t.url,
          ok: false,
          status: 0,
          ms: Date.now() - started,
          error: String(e?.message ?? e),
        };
      }
    })
  );

  return NextResponse.json({
    ok: true,
    runtime: {
      colo: (globalThis as any)?.navigator?.userAgent ?? "unknown",
      now: new Date().toISOString(),
    },
    results,
  });
}

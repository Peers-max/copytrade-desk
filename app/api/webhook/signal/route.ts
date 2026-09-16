import { NextRequest, NextResponse } from "next/server";
import { all } from "@/lib/db";
import { safeEqual } from "@/lib/crypto";
import { emitSignal } from "@/lib/executor";
import type { Trader } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * 外部信号接入（Webhook）。
 *
 * 用法：POST /api/webhook/signal?token=<信号源的 webhookToken>
 * body（JSON）：
 *   {
 *     "symbol": "BTC/USDT",
 *     "side":   "LONG" | "SHORT",       // 也接受 buy/sell、long/short
 *     "action": "OPEN" | "CLOSE" | "ADD" | "REDUCE",   // 默认 OPEN
 *     "price":  68000,                  // 可省略，省略则取最新价
 *     "leverage": 5,
 *     "note":   "TradingView 预警：EMA 金叉"
 *   }
 *
 * 也可以直接用 TradingView 的 webhook，body 写：
 *   {"symbol":"{{ticker}}/USDT","side":"{{strategy.order.action}}","action":"OPEN"}
 *
 * 收到后会**广播给该信号源下所有正在跟单的用户**，在各自交易所真实下单。
 * token 即凭据，请勿泄露；泄露了可以在信号源管理页一键轮换。
 */

function normalizeSide(v: any): "LONG" | "SHORT" | null {
  const s = String(v ?? "").trim().toLowerCase();
  if (["long", "buy", "b", "多", "开多"].includes(s)) return "LONG";
  if (["short", "sell", "s", "空", "开空"].includes(s)) return "SHORT";
  return null;
}

function normalizeAction(v: any): "OPEN" | "CLOSE" | "ADD" | "REDUCE" {
  const s = String(v ?? "").trim().toLowerCase();
  if (s === "close" || s === "exit" || s === "平仓") return "CLOSE";
  if (s === "add" || s === "increase" || s === "加仓") return "ADD";
  if (s === "reduce" || s === "减仓") return "REDUCE";
  return "OPEN";
}

/**
 * 把各来源的写法统一成 "BASE/QUOTE"。必须覆盖的真实来源：
 *   - TradingView 现货预警：{{ticker}} = "BTCUSDT"
 *   - TradingView 永续预警：{{ticker}} = "BTCUSDT.P"   ← 加密永续用户的标准写法
 *   - 手工 / 其他平台：BTC-USDT-SWAP、ETHUSDT_PERP、BINANCE:BTCUSDT
 */
function normalizeSymbol(v: any): string {
  let raw = String(v ?? "").trim().toUpperCase();
  if (!raw) return "";

  // 1. 去掉交易所前缀：BINANCE:BTCUSDT → BTCUSDT
  if (raw.includes(":")) raw = raw.split(":").pop() || raw;
  if (raw.includes("/")) return raw;

  // 2. 去掉合约后缀：BTCUSDT.P / BTC-USDT-SWAP / ETHUSDT_PERP → 基础符号
  raw = raw.replace(/(PERPETUAL|PERP|SWAP|P)$/, "").replace(/[._-]+$/, "");

  // 3. 剩余的分隔符按 BASE-QUOTE 处理
  if (raw.includes("-")) {
    const [b, q] = raw.split("-");
    return q ? `${b}/${q}` : `${b}/USDT`;
  }

  for (const q of ["USDT", "USDC"]) {
    if (raw.endsWith(q) && raw.length > q.length) return `${raw.slice(0, -q.length)}/${q}`;
  }
  return `${raw}/USDT`;
}

export async function POST(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") ?? "";
  if (!token) return NextResponse.json({ ok: false, error: "缺少 token" }, { status: 401 });

  const trader = (await all<Trader>("traders")).find((t) => t.webhookToken && safeEqual(t.webhookToken, token));
  if (!trader) return NextResponse.json({ ok: false, error: "token 无效" }, { status: 401 });
  if (trader.status !== "live") {
    return NextResponse.json({ ok: false, error: `信号源「${trader.name}」已暂停，未执行` }, { status: 409 });
  }

  const body = await req.json().catch(() => ({}));
  const symbol = normalizeSymbol(body.symbol);
  const side = normalizeSide(body.side);
  const action = normalizeAction(body.action);

  if (!symbol) return NextResponse.json({ ok: false, error: "缺少 symbol" }, { status: 400 });
  if (!side) return NextResponse.json({ ok: false, error: "side 无法识别，请传 LONG/SHORT 或 buy/sell" }, { status: 400 });

  try {
    const report = await emitSignal({
      trader,
      symbol,
      side,
      action,
      price: Number(body.price) || undefined,
      leverage: Number(body.leverage) || undefined,
      source: "webhook",
      note: typeof body.note === "string" ? body.note.slice(0, 200) : undefined,
    });

    return NextResponse.json({
      ok: true,
      signalId: report.signal.id,
      symbol,
      side,
      action,
      price: report.signal.price,
      dispatched: report.dispatched,
      succeeded: report.succeeded,
      failed: report.failed,
      results: report.signal.results,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 });
  }
}

/** 便于在浏览器里确认地址是否有效 */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") ?? "";
  if (!token) return NextResponse.json({ ok: false, error: "缺少 token" }, { status: 401 });
  const trader = (await all<Trader>("traders")).find((t) => t.webhookToken && safeEqual(t.webhookToken, token));
  if (!trader) return NextResponse.json({ ok: false, error: "token 无效" }, { status: 401 });
  return NextResponse.json({
    ok: true,
    source: { id: trader.id, name: trader.name, status: trader.status, symbols: trader.symbols },
    usage: 'POST 此地址，body: {"symbol":"BTC/USDT","side":"LONG","action":"OPEN"}',
  });
}

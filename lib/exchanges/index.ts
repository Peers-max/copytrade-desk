import { binanceAdapter } from "./binance";
import { okxAdapter } from "./okx";
import type { ExchangeAdapter } from "./base";

export * from "./base";

/**
 * 适配器注册表。
 *
 * 当前已打通实盘下单的只有币安与 OKX（用户实际使用的两家）。
 * 其余交易所在 UI 上标注「即将支持」，绑定接口会明确报错而不是假装成功 ——
 * 拿一个没实现的下单逻辑去承载真金白银，比直接报错危险得多。
 */

const REGISTRY: Record<string, ExchangeAdapter> = {
  binance: binanceAdapter,
  okx: okxAdapter,
};

export const TRADABLE_EXCHANGES = Object.keys(REGISTRY);

function unsupported(id: string, label: string, needsPassphrase = false): ExchangeAdapter {
  const msg = `${label} 的实盘适配器尚未启用，当前支持：币安、OKX。`;
  return {
    id,
    label,
    needsPassphrase,
    tradable: false,
    async verify() {
      throw new Error(msg);
    },
    async placeOrder() {
      return { ok: false, error: msg, qty: 0, notionalUsdt: 0 };
    },
  };
}

const STUBS: Record<string, ExchangeAdapter> = {
  bybit: unsupported("bybit", "Bybit"),
  bitget: unsupported("bitget", "Bitget", true),
  gate: unsupported("gate", "Gate.io"),
  htx: unsupported("htx", "火币 HTX"),
  bitmart: unsupported("bitmart", "BitMart"),
  hotcoin: unsupported("hotcoin", "热币"),
};

export function getAdapter(exchange: string): ExchangeAdapter | null {
  return REGISTRY[exchange] ?? STUBS[exchange] ?? null;
}

export function isTradable(exchange: string): boolean {
  return Boolean(REGISTRY[exchange]?.tradable);
}

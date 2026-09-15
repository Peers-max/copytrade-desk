import "server-only";

import { decryptSecret, encryptSecret, maskKey } from "./crypto";
import { filter, insert, update } from "./db";
import { getAdapter, type AccountSnapshot, type Credentials } from "./exchanges";
import type { ApiKey } from "./types";

/**
 * API Key 的领域操作：绑定 / 校验 / 取用 / 刷新。
 *
 * 安全约定（与源站文案一致）：
 * - Secret 与 Passphrase 一律 AES-256-GCM 加密后入库，明文不落盘；
 * - 只接受「读取 + 交易」权限，交易所若明确回报可提现，直接拒绝绑定；
 * - 任何解密/校验失败都把 Key 标为 invalid，避免拿着坏凭据反复打交易所。
 */

export type BindInput = {
  exchange: string;
  label?: string;
  apiKey: string;
  secret: string;
  passphrase?: string;
};

/**
 * 注意：项目 tsconfig 里 strict=false，判别联合（discriminated union）不会
 * 正常收窄，所以这里用扁平结构 + 可选字段，避免调用方被迫做类型断言。
 */
export type BindResult = {
  ok: boolean;
  error?: string;
  apiKey?: ApiKey;
  snapshot?: AccountSnapshot;
};

/** 绑定：先真实验签，验签通过才落库。 */
export async function bindApiKey(userId: string, input: BindInput): Promise<BindResult> {
  const exchange = String(input.exchange || "").trim();
  const apiKey = String(input.apiKey || "").trim();
  const secret = String(input.secret || "").trim();
  const passphrase = input.passphrase ? String(input.passphrase).trim() : undefined;

  if (!exchange || !apiKey || !secret) {
    return { ok: false, error: "交易所 / API Key / Secret 必填" };
  }

  const adapter = getAdapter(exchange);
  if (!adapter) return { ok: false, error: `不支持的交易所：${exchange}` };
  if (!adapter.tradable) {
    return { ok: false, error: `${adapter.label} 的实盘适配器尚未启用，当前支持：币安、OKX。` };
  }
  if (adapter.needsPassphrase && !passphrase) {
    return { ok: false, error: `${adapter.label} 必须填写 Passphrase 密码短语` };
  }

  // ---- 真实校验：签名、权限、余额、持仓 ----
  let snapshot: AccountSnapshot;
  try {
    snapshot = await adapter.verify({ exchange, apiKey, secret, passphrase });
  } catch (e: any) {
    return { ok: false, error: friendlyError(String(e?.message ?? e)) };
  }
  if (snapshot.hasWithdraw) {
    return {
      ok: false,
      error:
        "该 API Key 带有「提现」权限，已拒绝绑定。请到交易所把提现权限关掉，" +
        "只保留「读取 + 交易」后重新生成 Key。",
    };
  }
  if (!snapshot.permissions.includes("交易")) {
    return { ok: false, error: "该 API Key 没有交易权限，无法用于跟单下单。" };
  }

  // ---- 落库（密文） ----
  const now = Date.now();
  const rec: ApiKey = {
    id: `ak_${now.toString(36)}${Math.random().toString(36).slice(2, 8)}`,
    userId,
    exchange,
    label: input.label?.trim() || `${adapter.label} 默认账户`,
    masked: maskKey(apiKey),
    permissions: snapshot.permissions,
    status: "active",
    createdAt: now,
    lastSyncAt: now,
    ipWhitelist: "—",
    apiKeyCipher: await encryptSecret(apiKey),
    secretCipher: await encryptSecret(secret),
    passphraseCipher: passphrase ? await encryptSecret(passphrase) : undefined,
    uid: snapshot.uid,
    accountMode: snapshot.accountMode,
    equityUsdt: snapshot.equityUsdt,
    availableUsdt: snapshot.availableUsdt,
    positionCount: snapshot.positions.length,
    verifiedAt: now,
    hasWithdraw: snapshot.hasWithdraw,
    lastError: undefined,
  };

  await insert<ApiKey>("apiKeys", rec);
  return { ok: true, apiKey: rec, snapshot };
}

/** 把交易所返回的英文错误翻译成用户能照做的中文提示。 */
function friendlyError(msg: string): string {
  // 出网被拒：这是本部署环境（Cloudflare Workers）最常见的失败，
  // 实测币安返回 403/451、Bybit 返回 403 —— 报文里往往只有一句 "fetch failed"，
  // 不翻译的话用户根本不知道发生了什么。
  if (/fetch failed|failed to fetch|aborted|AbortError|timeout|ECONN|ENOTFOUND|ETIMEDOUT|network/i.test(msg)) {
    return (
      "网络不可达：本服务部署在 Cloudflare Workers 上，币安与 Bybit 会拒绝其出口 IP" +
      "（实测币安 403/451「restricted location」、Bybit 403 地区封锁），因此这两家在当前" +
      "部署下无法下单。请改用 OKX（实测可用）；如必须用币安，需要把执行层部署到非 Cloudflare 的主机。" +
      "可访问 /api/diag 查看实时出网探测结果。"
    );
  }
  if (/403|Forbidden|451/.test(msg)) {
    return "交易所拒绝了本服务的出口 IP（403/451 地区限制）。可访问 /api/diag 查看是哪一环被挡。";
  }
  if (/invalid api-key|api-key format invalid|Invalid API key/i.test(msg)) {
    return "API Key 无效：请检查是否复制完整、是否与 Secret 属于同一组。";
  }
  if (/signature|Signature for this request is not valid|-2015/i.test(msg)) {
    return "签名校验失败：Secret 不正确，或 Passphrase 填错。";
  }
  if (/-1021|timestamp|Timestamp/i.test(msg)) {
    return "时间戳超窗：请检查服务器时间是否准确（币安要求误差小于 1 秒）。";
  }
  if (/IP|whitelist|not in the whitelist/i.test(msg)) {
    return "IP 白名单拦截：请把本服务的出口 IP 加入该 API Key 的白名单。";
  }
  if (/permission|not authorized|50111|50110/i.test(msg)) {
    return "权限不足：请确认该 Key 勾选了「读取」与「交易」权限。";
  }
  if (/ctVal|instrument|does not exist/i.test(msg)) {
    return "该交易所没有这个合约交易对。";
  }
  return msg;
}

/** 取出可用的明文凭据（仅在下单链路内部调用）。 */
export async function tradingCredentials(rec: ApiKey): Promise<Credentials | null> {
  const apiKey = await decryptSecret(rec.apiKeyCipher);
  const secret = await decryptSecret(rec.secretCipher);
  if (!apiKey || !secret) return null;
  const passphrase = rec.passphraseCipher ? await decryptSecret(rec.passphraseCipher) : undefined;
  return { exchange: rec.exchange, apiKey, secret, passphrase };
}

/** 用户可用的 Key：默认取第一个 active 的。 */
export async function pickApiKey(userId: string, preferredId?: string, exchange?: string): Promise<ApiKey | null> {
  const rows = await filter<ApiKey>("apiKeys", (k) => k.userId === userId && k.status === "active");
  if (!rows.length) return null;
  if (preferredId) {
    const hit = rows.find((k) => k.id === preferredId);
    if (hit) return hit;
  }
  if (exchange) {
    const hit = rows.find((k) => k.exchange === exchange);
    if (hit) return hit;
  }
  return rows[0];
}

/** 重新拉一次账户快照，更新权益/持仓/错误信息。 */
export async function refreshApiKey(id: string, userId: string): Promise<{ ok: boolean; error?: string; apiKey?: ApiKey }> {
  const rows = await filter<ApiKey>("apiKeys", (k) => k.id === id && k.userId === userId);
  const rec = rows[0];
  if (!rec) return { ok: false, error: "API Key 不存在" };

  const adapter = getAdapter(rec.exchange);
  const cred = await tradingCredentials(rec);
  if (!adapter || !cred) {
    await update<ApiKey>("apiKeys", (k) => k.id === id, {
      status: "invalid",
      lastError: "无法解密凭据，请重新绑定（可能是服务端主密钥变更）",
    });
    return { ok: false, error: "无法解密凭据，请重新绑定。" };
  }

  try {
    const snap = await adapter.verify(cred);
    const patch: Partial<ApiKey> = {
      status: "active",
      permissions: snap.permissions,
      uid: snap.uid,
      accountMode: snap.accountMode,
      equityUsdt: snap.equityUsdt,
      availableUsdt: snap.availableUsdt,
      positionCount: snap.positions.length,
      lastSyncAt: Date.now(),
      verifiedAt: Date.now(),
      hasWithdraw: snap.hasWithdraw,
      lastError: undefined,
    };
    await update<ApiKey>("apiKeys", (k) => k.id === id, patch);
    return { ok: true, apiKey: { ...rec, ...patch } as ApiKey };
  } catch (e: any) {
    const msg = friendlyError(String(e?.message ?? e));
    await update<ApiKey>("apiKeys", (k) => k.id === id, { status: "invalid", lastError: msg, lastSyncAt: Date.now() });
    return { ok: false, error: msg };
  }
}

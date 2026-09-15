import "server-only";

/**
 * 密钥保管与签名工具。
 *
 * - 交易所的 Secret / Passphrase 一律以 AES-256-GCM 密文入库，明文只在
 *   下单的那一瞬间存在于内存里，永不落盘、永不下发到前端。
 * - 全部基于 Web Crypto（`globalThis.crypto.subtle`）：Node 22 与 Cloudflare
 *   Workers 都原生支持，不需要任何原生依赖，也不会因为 edge runtime 而炸。
 *
 * 主密钥来自环境变量 `COINCE_SECRET_KEY`（线上用 wrangler secret 写入）。
 * 未配置时退化到 ADMIN_PASS 派生，并打印告警 —— 生产环境请务必显式配置，
 * 否则一旦改过 ADMIN_PASS，此前存下的密文就再也解不开了。
 */

const enc = new TextEncoder();
const dec = new TextDecoder();

/* ---------------- base64 ---------------- */

function b64encode(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

function b64decode(str: string): Uint8Array {
  const bin = atob(str);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function toHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/* ---------------- 主密钥 ---------------- */

let keyPromise: Promise<CryptoKey> | null = null;
let warned = false;

async function masterSecret(): Promise<string> {
  const explicit = process.env.COINCE_SECRET_KEY;
  if (explicit) return explicit;
  if (!warned) {
    warned = true;
    console.warn(
      "[crypto] 未配置 COINCE_SECRET_KEY，正在用 ADMIN_PASS 派生主密钥。生产环境请执行：wrangler secret put COINCE_SECRET_KEY"
    );
  }
  return `fallback::${process.env.ADMIN_PASS ?? "coince-insecure-dev"}`;
}

async function getKey(): Promise<CryptoKey> {
  if (!keyPromise) {
    keyPromise = (async () => {
      const secret = await masterSecret();
      const raw = await crypto.subtle.digest("SHA-256", enc.encode(`coince::aes256gcm::${secret}`));
      return crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
    })();
  }
  return keyPromise;
}

/* ---------------- AES-256-GCM ---------------- */

const PREFIX = "v1:";

export async function encryptSecret(plain: string | undefined | null): Promise<string> {
  if (!plain) return "";
  const key = await getKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(plain));
  const out = new Uint8Array(iv.length + ct.byteLength);
  out.set(iv, 0);
  out.set(new Uint8Array(ct), iv.length);
  return PREFIX + b64encode(out);
}

/** 解密失败一律返回空串 —— 宁可报「密钥失效」，也不要拿半截垃圾去签名。 */
export async function decryptSecret(payload: string | undefined | null): Promise<string> {
  if (!payload || !payload.startsWith(PREFIX)) return "";
  try {
    const key = await getKey();
    const buf = b64decode(payload.slice(PREFIX.length));
    const iv = buf.slice(0, 12);
    const ct = buf.slice(12);
    const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
    return dec.decode(pt);
  } catch {
    return "";
  }
}

/* ---------------- 展示用脱敏 ---------------- */

export function maskKey(apiKey: string): string {
  if (!apiKey) return "******";
  if (apiKey.length <= 8) return apiKey.slice(0, 2) + "***" + apiKey.slice(-2);
  return apiKey.slice(0, 3) + "***" + apiKey.slice(-4);
}

/** 生成 URL 安全的随机令牌（webhook 接入用）。 */
export function randomToken(bytes = 24): string {
  const buf = crypto.getRandomValues(new Uint8Array(bytes));
  return b64encode(buf).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/* ---------------- 交易所签名用的 HMAC ---------------- */

async function hmacRaw(secret: string, message: string): Promise<ArrayBuffer> {
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  return crypto.subtle.sign("HMAC", key, enc.encode(message));
}

export async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  return toHex(await hmacRaw(secret, message));
}

export async function hmacSha256Base64(secret: string, message: string): Promise<string> {
  return b64encode(new Uint8Array(await hmacRaw(secret, message)));
}

export async function sha256Hex(message: string): Promise<string> {
  return toHex(await crypto.subtle.digest("SHA-256", enc.encode(message)));
}

/** 定长时间比较，避免通过响应时间侧信道推断凭据。 */
export function safeEqual(a: string, b: string): boolean {
  const ab = enc.encode(a);
  const bb = enc.encode(b);
  let diff = ab.length ^ bb.length;
  const n = Math.max(ab.length, bb.length);
  for (let i = 0; i < n; i++) diff |= (ab[i] ?? 0) ^ (bb[i] ?? 0);
  return diff === 0;
}

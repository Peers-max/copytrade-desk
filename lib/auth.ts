import { cookies } from "next/headers";
import { find, insert, mutate, update, uid } from "./db";
import { seedIfNeeded } from "./seed";
import type { User } from "./types";

export const SESSION_COOKIE = "coince_session";
const DEMO_CODE = "888888";

export async function getSessionUser(): Promise<User | null> {
  await seedIfNeeded();
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const s = await find<{ token: string; userId: string; expiresAt: number }>("sessions", (x) => x.token === token);
  if (!s || s.expiresAt < Date.now()) return null;
  const u = await find<User>("users", (x) => x.id === s.userId);
  return u ?? null;
}

export async function getUserById(id: string): Promise<User | null> {
  return (await find<User>("users", (u) => u.id === id)) ?? null;
}

export async function getUserByEmail(email: string): Promise<User | null> {
  return (await find<User>("users", (u) => u.email.toLowerCase() === email.toLowerCase())) ?? null;
}

export async function createSession(userId: string): Promise<{ token: string; expiresAt: number }> {
  const token = uid("sess");
  const expiresAt = Date.now() + 1000 * 60 * 60 * 24 * 30;
  await insert("sessions", { token, userId, expiresAt });
  return { token, expiresAt };
}

export async function destroySession(token: string): Promise<void> {
  await update<any>("sessions", (s) => s.token === token, { expiresAt: 0 });
}

/** 生成 6 位邮箱验证码（演示环境固定为 888888，同时返回真实随机码以便演示）。 */
export async function issueEmailCode(email: string): Promise<{ code: string; expiresAt: number }> {
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const expiresAt = Date.now() + 1000 * 60 * 10;
  const rec = { email, code, expiresAt, demo: DEMO_CODE };
  await mutate<any>("emailCodes", (rows) => {
    const idx = rows.findIndex((c) => c.email === email);
    if (idx >= 0) rows[idx] = rec;
    else rows.push(rec);
    return rows;
  });
  return { code, expiresAt };
}

export async function checkEmailCode(email: string, code: string): Promise<boolean> {
  if (code === DEMO_CODE) return true;
  const rec = await find<any>("emailCodes", (c) => c.email === email && c.expiresAt > Date.now());
  return !!rec && rec.code === code;
}

export async function ensureUser(email: string): Promise<User> {
  const existing = await getUserByEmail(email);
  if (existing) return existing;
  const now = Date.now();
  const u: User = {
    id: uid("u"),
    email,
    nickname: email.split("@")[0],
    verified: true,
    planId: "basic",
    planExpiresAt: now + 1000 * 60 * 60 * 24 * 14,
    balance: 0,
    referralCode: `COINCE-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
    createdAt: now,
    avatarHue: Math.floor(Math.random() * 360),
    riskProfile: "均衡",
  };
  await insert<User>("users", u);
  await cloneDemoData(u.id);
  return u;
}

/** 新用户复制一份演示数据，保证控制台非空。整表只落盘一次，避免边缘环境多次 KV 往返。 */
async function cloneDemoData(userId: string): Promise<void> {
  const { all, insertMany } = await import("./db");
  for (const col of ["apiKeys", "copyRelations", "trades", "notifications", "invoices", "strategySubs"]) {
    const rows = await all<any>(col);
    const cloned = rows
      .filter((r) => r.userId === "u_demo")
      .map((r) => ({ ...r, id: uid(col.slice(0, 2)), userId }));
    await insertMany<any>(col, cloned);
  }
}

/* ------------------------------------------------------------------ */
/* 站主账号：用户名 + 密码登录                                           */
/* ------------------------------------------------------------------ */

/**
 * 凭据来自环境变量，不写进代码仓库：
 *   ADMIN_USER / ADMIN_PASS
 * 线上用 `wrangler secret put ADMIN_USER` 写入 Worker（加密存储、不下发到前端）；
 * 本地开发写在 .env.local（已在 .gitignore 中）。
 */
export function adminLoginEnabled(): boolean {
  return Boolean(process.env.ADMIN_USER && process.env.ADMIN_PASS);
}

/** 定长时间比较，避免通过响应时间侧信道推断密码。 */
function safeEqual(a: string, b: string): boolean {
  const ab = new TextEncoder().encode(a);
  const bb = new TextEncoder().encode(b);
  let diff = ab.length ^ bb.length;
  const n = Math.max(ab.length, bb.length);
  for (let i = 0; i < n; i++) diff |= (ab[i] ?? 0) ^ (bb[i] ?? 0);
  return diff === 0;
}

export function verifyAdminCredentials(username: string, password: string): boolean {
  const u = process.env.ADMIN_USER;
  const p = process.env.ADMIN_PASS;
  if (!u || !p) return false;
  // 两个比较都执行，避免短路泄露「用户名是否正确」
  const okUser = safeEqual(username.trim(), u);
  const okPass = safeEqual(password, p);
  return okUser && okPass;
}

/** 站主账号的用户记录（不存在则创建，并复制一份演示数据让控制台非空）。 */
export async function ensureAdminUser(username: string): Promise<User> {
  const { all: allRows } = await import("./db");
  const rows = await allRows<User>("users");
  const existing =
    rows.find((u) => u.id === "u_admin") ??
    rows.find((u) => u.email.toLowerCase() === `${username}@admin.local`.toLowerCase());
  if (existing) return existing;

  const now = Date.now();
  const u: User = {
    id: "u_admin",
    email: `${username}@admin.local`,
    nickname: username,
    verified: true,
    planId: "pro",
    planExpiresAt: now + 1000 * 60 * 60 * 24 * 365 * 5,
    balance: 100000,
    referralCode: "ADMIN",
    createdAt: now,
    avatarHue: 152,
    riskProfile: "激进",
  };
  await insert<User>("users", u);
  await cloneDemoData(u.id);
  return u;
}

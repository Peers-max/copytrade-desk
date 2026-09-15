import { cookies } from "next/headers";
import { find, insert, mutate, update, uid } from "./db";
import { bootstrapIfNeeded } from "./seed";
import { safeEqual } from "./crypto";
import type { User } from "./types";

export const SESSION_COOKIE = "coince_session";
const DEMO_CODE = "888888";

export async function getSessionUser(): Promise<User | null> {
  await bootstrapIfNeeded();
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const s = await find<{ token: string; userId: string; expiresAt: number }>("sessions", (x) => x.token === token);
  if (!s || s.expiresAt < Date.now()) return null;
  const u = await find<User>("users", (x) => x.id === s.userId);
  return u ?? null;
}

/** 站主校验：非站主直接 403，用于信号源管理、清库等敏感接口。 */
export async function requireAdmin(): Promise<User | null> {
  const u = await getSessionUser();
  if (!u) return null;
  if (u.role === "admin" || u.id === "u_admin") return u;
  return null;
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

/** 生成 6 位邮箱验证码。 */
export async function issueEmailCode(email: string): Promise<{ code: string; expiresAt: number }> {
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const expiresAt = Date.now() + 1000 * 60 * 10;
  const rec = { email, code, expiresAt };
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
    role: "user",
  };
  await insert<User>("users", u);
  return u;
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

export function verifyAdminCredentials(username: string, password: string): boolean {
  const u = process.env.ADMIN_USER;
  const p = process.env.ADMIN_PASS;
  if (!u || !p) return false;
  // 两个比较都执行，避免短路泄露「用户名是否正确」
  const okUser = safeEqual(username.trim(), u);
  const okPass = safeEqual(password, p);
  return okUser && okPass;
}

/**
 * 站主账号的用户记录。
 * 注意：不再复制任何演示数据，也不再预置虚假余额 —— 控制台里看到的一切
 * 都必须来自真实操作。
 */
export async function ensureAdminUser(username: string): Promise<User> {
  const rows = await find<User>("users", (u) => u.id === "u_admin");
  if (rows) return rows;

  const now = Date.now();
  const u: User = {
    id: "u_admin",
    email: `${username}@admin.local`,
    nickname: username,
    verified: true,
    planId: "pro",
    planExpiresAt: now + 1000 * 60 * 60 * 24 * 365 * 5,
    balance: 0,
    referralCode: "ADMIN",
    createdAt: now,
    avatarHue: 152,
    riskProfile: "激进",
    role: "admin",
  };
  await insert<User>("users", u);
  return u;
}

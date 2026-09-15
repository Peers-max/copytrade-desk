import "server-only";

import { readDB, writeDB } from "./store";
import { all } from "./db";

/**
 * 运行时设置与数据维护。
 *
 * `mode` 只保留语义价值：线上为 live，页面上会显示「实盘模式」标识。
 * 无论哪种模式，平台都不会再自动生成任何模拟交易数据。
 */

export type Mode = "live" | "demo";

export async function getSetting<T = any>(key: string, def: T): Promise<T> {
  const rows = await all<{ key: string; value: any }>("settings");
  const hit = rows.find((r) => r.key === key);
  return hit ? (hit.value as T) : def;
}

export async function setSetting(key: string, value: any): Promise<void> {
  const d = await readDB();
  const rows = (d.settings = d.settings ?? []);
  const i = rows.findIndex((r) => r.key === key);
  if (i >= 0) rows[i] = { key, value, at: Date.now() };
  else rows.push({ key, value, at: Date.now() });
  await writeDB(d);
}

export async function getMode(): Promise<Mode> {
  return getSetting<Mode>("mode", "live");
}

export async function setMode(mode: Mode): Promise<void> {
  await setSetting("mode", mode);
}

/* ------------------------------------------------------------------ */
/* 清库                                                                */
/* ------------------------------------------------------------------ */

/** 需要一次性清空的业务表（不含 users，管理员账号要留） */
export const BUSINESS_COLLECTIONS = [
  "traders",
  "strategies",
  "strategySubs",
  "copyRelations",
  "trades",
  "signals",
  "notifications",
  "invoices",
  "apiKeys",
  "sessions",
  "emailCodes",
];

export type PurgeReport = {
  cleared: Record<string, number>;
  keptUsers: string[];
  removedUsers: number;
};

/**
 * 清空全部业务数据，只保留管理员账号。
 *
 * 这是不可逆操作，调用方必须是站主本人（管理接口会鉴权）。
 * 执行前建议先做一次导出备份。
 */
export async function purgeBusinessData(): Promise<PurgeReport> {
  const d = await readDB();
  const cleared: Record<string, number> = {};

  for (const c of BUSINESS_COLLECTIONS) {
    cleared[c] = Array.isArray(d[c]) ? d[c].length : 0;
    d[c] = [];
  }

  const allUsers = Array.isArray(d.users) ? (d.users as any[]) : [];
  const kept = allUsers.filter((u) => u?.id === "u_admin" || u?.role === "admin");
  cleared.users = allUsers.length;
  d.users = kept;
  cleared.users = allUsers.length - kept.length;

  d.meta = [{ key: "purged", at: Date.now(), version: 3 }];
  d.settings = [{ key: "mode", value: "live", at: Date.now() }];

  await writeDB(d);

  return {
    cleared,
    keptUsers: kept.map((u) => `${u.nickname}<${u.email}>`),
    removedUsers: allUsers.length - kept.length,
  };
}

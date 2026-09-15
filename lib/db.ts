import { readDB, writeDB, type AnyRec, type DB } from "@/lib/store";

/**
 * 数据访问层。
 *
 * 全部为异步：本地走文件系统，Cloudflare 边缘走 Workers KV。
 * 保持同步语义（读-改-写），调用方只需 await。
 */

async function db(): Promise<DB> {
  return readDB();
}

async function col<T = AnyRec>(name: string): Promise<T[]> {
  const d = await db();
  if (!d[name]) d[name] = [];
  return d[name] as unknown as T[];
}

async function commit(d: DB): Promise<void> {
  await writeDB(d);
}

export async function collection<T = AnyRec>(name: string): Promise<T[]> {
  return col<T>(name);
}

export async function all<T = AnyRec>(name: string): Promise<T[]> {
  return (await col<T>(name)).slice();
}

export async function find<T = AnyRec>(name: string, pred: (r: T) => boolean): Promise<T | undefined> {
  return (await col<T>(name)).find(pred as any);
}

export async function filter<T = AnyRec>(name: string, pred: (r: T) => boolean): Promise<T[]> {
  return (await col<T>(name)).filter(pred as any);
}

export async function insert<T extends AnyRec>(name: string, rec: T): Promise<T> {
  const d = await db();
  if (!d[name]) d[name] = [];
  d[name].push(rec);
  await commit(d);
  return rec;
}

export async function update<T extends AnyRec>(
  name: string,
  pred: (r: T) => boolean,
  patch: Partial<T>
): Promise<T | undefined> {
  const d = await db();
  const list = (d[name] || []) as unknown as T[];
  const idx = list.findIndex(pred as any);
  if (idx === -1) return undefined;
  list[idx] = { ...list[idx], ...patch };
  d[name] = list as unknown as AnyRec[];
  await commit(d);
  return list[idx];
}

export async function upsert<T extends AnyRec>(name: string, pred: (r: T) => boolean, make: () => T): Promise<T> {
  const existing = await find<T>(name, pred);
  if (existing) return existing;
  const rec = make();
  await insert<T>(name, rec);
  return rec;
}

export async function remove(name: string, pred: (r: AnyRec) => boolean): Promise<number> {
  const d = await db();
  const list = d[name] || [];
  const before = list.length;
  d[name] = list.filter((r) => !pred(r));
  await commit(d);
  return before - d[name].length;
}

export async function count(name: string, pred?: (r: AnyRec) => boolean): Promise<number> {
  if (pred) return (await filter(name, pred)).length;
  return (await col(name)).length;
}

/** 原子地读-改-写整张表，避免多步读写的竞态 */
export async function mutate<T = AnyRec>(name: string, fn: (rows: T[]) => T[] | void): Promise<T[]> {
  const d = await db();
  if (!d[name]) d[name] = [];
  const rows = d[name] as unknown as T[];
  const next = fn(rows) || rows;
  d[name] = next as unknown as AnyRec[];
  await commit(d);
  return next;
}

export async function reset(): Promise<void> {
  await writeDB({});
}

/* ---------------- 纯函数（同步，无副作用） ---------------- */

export function uid(prefix = "id"): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
}

/** 确定性伪随机（mulberry32），保证服务端渲染结果稳定、不触发 hydration 警告 */
export function seededRandom(seed: number) {
  let a = seed >>> 0;
  return function () {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/* ---------------- 种子数据标记 ---------------- */

export async function isSeeded(): Promise<boolean> {
  const rows = await filter<any>("meta", (m) => m.key === "seeded");
  return rows.length > 0;
}

export async function markSeeded(version = 2): Promise<void> {
  await upsert<any>("meta", (m) => m.key === "seeded", () => ({ key: "seeded", version, at: Date.now() }));
}

export async function dbPath(): Promise<string> {
  const { isEdge } = await import("@/lib/store");
  return (await isEdge()) ? "cloudflare-kv://coince-db/db:v2" : ".data/db.json";
}

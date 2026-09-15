/**
 * 存储后端抽象 —— 同一套 API，两种实现：
 *
 * 1. Node (本地开发 `next dev`)  -> 文件系统 .data/db.json
 * 2. Edge (Cloudflare Pages)     -> Workers KV，绑定变量名 COINCE_KV
 *
 * 之所以要抽象：Cloudflare Pages 运行在 V8 隔离环境里，没有持久化文件系统，
 * 原先用 fs 直接读写 JSON 的写法在边缘节点上会直接抛错。
 *
 * 注意：KV 是最终一致 + 单 key 覆盖写，适合演示/中小规模。
 * 若要上生产（多用户并发写订单），应把这一层换成 D1 或 Durable Objects，
 * 接口保持不变即可，无需改动业务代码。
 */

import "server-only";

export type AnyRec = Record<string, any>;
export type DB = Record<string, AnyRec[]>;

const KV_KEY = "db:v2";
const SEED_FLAG = "seeded";

/* ------------------------------------------------------------------ */
/* 后端探测                                                             */
/* ------------------------------------------------------------------ */

type KVLike = {
  get: (key: string, type?: string) => Promise<any>;
  put: (key: string, value: string) => Promise<any>;
};

async function kvBinding(): Promise<KVLike | null> {
  // 1) Cloudflare Worker：OpenNext 运行时上下文中的绑定
  try {
    const spec = "@opennextjs/cloudflare";
    const mod: any = await import(/* webpackIgnore: true */ spec);
    const ctx = typeof mod.getCloudflareContext === "function" ? mod.getCloudflareContext() : undefined;
    const b = ctx?.env?.COINCE_KV;
    if (b && typeof b.get === "function") return b as KVLike;
  } catch {
    /* 非 CF 环境，忽略 */
  }
  // 2) 构建期/运行期注入到 process.env 的绑定
  const fromEnv = (process as any)?.env?.COINCE_KV;
  if (fromEnv && typeof fromEnv.get === "function") return fromEnv as KVLike;
  // 3) 全局兜底
  const fromGlobal = (globalThis as any)?.COINCE_KV;
  if (fromGlobal && typeof fromGlobal.get === "function") return fromGlobal as KVLike;
  return null;
}

/** 是否运行在 Cloudflare 边缘（有 KV 绑定） */
export async function isEdge(): Promise<boolean> {
  return (await kvBinding()) !== null;
}

/* ------------------------------------------------------------------ */
/* Node 文件后端                                                        */
/* ------------------------------------------------------------------ */

const DATA_DIR_NAME = ".data";
const DB_FILE_NAME = "db.json";

async function fileRead(): Promise<DB | null> {
  try {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const file = path.join(process.cwd(), DATA_DIR_NAME, DB_FILE_NAME);
    if (!fs.existsSync(file)) return null;
    const raw = fs.readFileSync(file, "utf8");
    return JSON.parse(raw) as DB;
  } catch {
    return null;
  }
}

async function fileWrite(db: DB): Promise<void> {
  try {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const dir = path.join(process.cwd(), DATA_DIR_NAME);
    const file = path.join(dir, DB_FILE_NAME);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const tmp = file + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(db, null, 2), "utf8");
    fs.renameSync(tmp, file);
  } catch {
    /* 只读环境（例如静态导出）下静默失败 */
  }
}

/* ------------------------------------------------------------------ */
/* 统一读写                                                             */
/* ------------------------------------------------------------------ */

/**
 * 同一 Worker 实例内的内存缓存。
 * 边缘节点没有共享内存，所以这里只用于省掉同一次请求内的重复 KV 读，
 * 不保证跨实例一致 —— 这正是 KV 最终一致性的体现。
 */
let cache: DB | null = null;
let cacheAt = 0;
const CACHE_TTL_MS = 1000;

export async function readDB(): Promise<DB> {
  const kv = await kvBinding();
  if (kv) {
    const now = Date.now();
    if (cache && now - cacheAt < CACHE_TTL_MS) return cache;
    const data = await kv.get(KV_KEY, "json");
    cache = (data as DB) || {};
    cacheAt = now;
    return cache;
  }
  if (cache) return cache;
  cache = (await fileRead()) || {};
  cacheAt = Date.now();
  return cache;
}

export async function writeDB(db: DB): Promise<void> {
  cache = db;
  cacheAt = Date.now();
  const kv = await kvBinding();
  if (kv) {
    await kv.put(KV_KEY, JSON.stringify(db));
    return;
  }
  await fileWrite(db);
}

/** 丢弃内存缓存，强制下次从后端重新读（用于测试或跨请求强制刷新） */
export function invalidate(): void {
  cache = null;
  cacheAt = 0;
}

export { SEED_FLAG };

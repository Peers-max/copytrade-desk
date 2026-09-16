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
  return (await kvBinding()) !== null;
}

/* ------------------------------------------------------------------ */
/* Node 文件后端                                                        */
/* ------------------------------------------------------------------ */

const DATA_DIR_NAME = ".data";
const DB_FILE_NAME = "db.json";

async function fileRead(): Promise<DB | null> {
  try {
    const fs = await import("node:fs");
    const path = await import("node:path");
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
    const fs = await import("node:fs");
    const path = await import("node:path");
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
 *
 * ⚠️ **整库体积预算（2026-09 踩坑记录，重要）**
 *
 * KV 只用一个 key 存整库，意味着**每个请求都要把它整库 JSON.parse 一遍**，
 * 这份开销直接算在 Cloudflare Worker 的 CPU 预算里。
 *
 * 实测代价：把 414 个 OKX 带单员的原始字段全量落盘后，
 * 单 key 涨到约 1.8 MB，于是所有走 `readDB()` 的路径全部间歇 503，
 * 响应体是 `error code: 1102`（Worker CPU 时间超限）——
 * 连 `/api/market` 这种根本不关心 traders 的接口也一起挂掉，因为它同样调用了 `readDB()`。
 * 反倒是 `/login`（不读库）一直 200，这个「选择性故障」正是整库解析开销的铁证。
 *
 * 结论：**存量数据要按「列表真正会渲染什么」来存**，别顺手把交易所原始响应整包塞进来。
 * 具体做法见 `lib/okx-copy.ts` 里 `rankToTrader` 上方的「体积事故备忘」。
 *
 * 上面这个 1 秒 TTL 也救不了这种情况 —— 它只在同一实例内生效，
 * 冷启动/低流量场景每个请求都是新实例，照样得完整解析一次。
 * 真要扩容（多用户并发写订单），应换成 D1 或给每个集合拆独立 key，接口保持不变即可。
 */
let cache: DB | null = null;
let cacheAt = 0;
const CACHE_TTL_MS = 1000;

export async function readDB(): Promise<DB> {
  const kv = await kvBinding();
  if (kv) {
    const now = Date.now();
    if (cache && now - cacheAt < CACHE_TTL_MS) return cache;
    const data = await kv.get(KV_KEY, "json");
    cache = (data as DB) || {};
    cacheAt = now;
    return cache;
  }
  if (cache) return cache;
  cache = (await fileRead()) || {};
  cacheAt = Date.now();
  return cache;
}

export async function writeDB(db: DB): Promise<void> {
  cache = db;
  cacheAt = Date.now();
  const kv = await kvBinding();
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

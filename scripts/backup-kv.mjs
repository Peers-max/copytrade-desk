/**
 * 导出线上 Workers KV 里的整库数据到本地（备份）。
 *
 * 用法：
 *   CLOUDFLARE_API_TOKEN=xxx CLOUDFLARE_ACCOUNT_ID=yyy node scripts/backup-kv.mjs
 *
 * 产出：.data/backup/online-db-<时间戳>.json
 *
 * 说明：整个应用的数据都存在 KV 的 `db:v2` 这一个键上（见 lib/store.ts），
 * 所以备份就是把这一个键原样取回来。做任何清库/迁移前都应该先跑一遍。
 */

import { mkdirSync, writeFileSync } from "node:fs";

const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const KV_NAMESPACE_ID = process.env.CF_KV_NAMESPACE_ID || "583c0b65b15f47b698718cfb3c439f90";
const KV_KEY = process.env.CF_KV_KEY || "db:v2";

if (!ACCOUNT_ID || !API_TOKEN) {
  console.error("缺少 CLOUDFLARE_ACCOUNT_ID 或 CLOUDFLARE_API_TOKEN 环境变量");
  process.exit(1);
}

const url = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/storage/kv/namespaces/${KV_NAMESPACE_ID}/values/${encodeURIComponent(KV_KEY)}`;

const res = await fetch(url, { headers: { Authorization: `Bearer ${API_TOKEN}` } });
if (!res.ok) {
  console.error(`读取失败 HTTP ${res.status}: ${await res.text()}`);
  process.exit(1);
}

const raw = await res.text();
const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);

mkdirSync(".data/backup", { recursive: true });
const file = `.data/backup/online-db-${stamp}.json`;
writeFileSync(file, raw, "utf8");

try {
  const db = JSON.parse(raw);
  console.log(`已备份到 ${file}（${raw.length} 字节）`);
  for (const [k, v] of Object.entries(db)) {
    console.log(`  ${k}: ${Array.isArray(v) ? v.length : 1}`);
  }
} catch {
  console.log(`已备份到 ${file}（${raw.length} 字节，内容不是合法 JSON，请人工检查）`);
}

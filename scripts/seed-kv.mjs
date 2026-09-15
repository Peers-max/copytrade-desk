/**
 * 把本地种子数据（.data/db.json）一次性写入 Cloudflare Workers KV。
 *
 * 用法：
 *   CLOUDFLARE_API_TOKEN=xxx CLOUDFLARE_ACCOUNT_ID=yyy node scripts/seed-kv.mjs
 *
 * 说明：
 * - 线上首次请求其实会自动播种（见 lib/auth.ts 的 seedIfNeeded），
 *   这个脚本是为了「部署后立刻有数据、无需等待首个请求」而准备。
 * - 走 Cloudflare REST API，不依赖 wrangler，避免本地构建链路的版本问题。
 */

import { readFileSync } from "node:fs";

const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const KV_NAMESPACE_ID = process.env.CF_KV_NAMESPACE_ID || "583c0b65b15f47b698718cfb3c439f90";
const KV_KEY = process.env.CF_KV_KEY || "db:v2";
const LOCAL_DB = process.env.LOCAL_DB || ".data/db.json";

if (!ACCOUNT_ID || !API_TOKEN) {
  console.error("缺少 CLOUDFLARE_ACCOUNT_ID 或 CLOUDFLARE_API_TOKEN 环境变量");
  process.exit(1);
}

const api = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/storage/kv/namespaces/${KV_NAMESPACE_ID}/values/${encodeURIComponent(KV_KEY)}`;

const db = JSON.parse(readFileSync(LOCAL_DB, "utf8"));
const payload = JSON.stringify(db);

const res = await fetch(api, {
  method: "PUT",
  headers: {
    Authorization: `Bearer ${API_TOKEN}`,
    "Content-Type": "text/plain",
  },
  body: payload,
});

const text = await res.text();
if (res.ok) {
  const collections = Object.entries(db)
    .map(([k, v]) => `${k}=${Array.isArray(v) ? v.length : 1}`)
    .join(", ");
  console.log(`已写入 KV 键 ${KV_KEY}（${payload.length} 字节）`);
  console.log(`集合统计: ${collections}`);
} else {
  console.error(`写入失败 HTTP ${res.status}: ${text}`);
  process.exit(1);
}

/**
 * 清空线上 Workers KV 里的全部业务数据（不可逆）。
 *
 * 用法：
 *   CLOUDFLARE_API_TOKEN=xxx CLOUDFLARE_ACCOUNT_ID=yyy node scripts/purge-kv.mjs --confirm=PURGE
 *
 * 保留：users 里 id 为 u_admin 或 role=admin 的账号。
 * 清空：traders / strategies / copyRelations / trades / signals / apiKeys /
 *       notifications / invoices / sessions / strategySubs / emailCodes。
 *
 * 强烈建议先跑 scripts/backup-kv.mjs 备份。
 */

import { mkdirSync, writeFileSync } from "node:fs";

const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const KV_NAMESPACE_ID = process.env.CF_KV_NAMESPACE_ID || "583c0b65b15f47b698718cfb3c439f90";
const KV_KEY = process.env.CF_KV_KEY || "db:v2";

if (!process.argv.includes("--confirm=PURGE")) {
  console.error("该操作不可逆。确认请追加 --confirm=PURGE");
  process.exit(1);
}
if (!ACCOUNT_ID || !API_TOKEN) {
  console.error("缺少 CLOUDFLARE_ACCOUNT_ID 或 CLOUDFLARE_API_TOKEN 环境变量");
  process.exit(1);
}

const url = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/storage/kv/namespaces/${KV_NAMESPACE_ID}/values/${encodeURIComponent(KV_KEY)}`;
const headers = { Authorization: `Bearer ${API_TOKEN}` };

// 1) 先取回当前数据并备份
const cur = await fetch(url, { headers });
if (!cur.ok) {
  console.error(`读取失败 HTTP ${cur.status}: ${await cur.text()}`);
  process.exit(1);
}
const raw = await cur.text();
const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
mkdirSync(".data/backup", { recursive: true });
const backup = `.data/backup/pre-purge-${stamp}.json`;
writeFileSync(backup, raw, "utf8");
console.log(`已自动备份到 ${backup}`);

const db = JSON.parse(raw);

// 2) 清理
const CLEAR = [
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

const report = {};
for (const c of CLEAR) {
  report[c] = Array.isArray(db[c]) ? db[c].length : 0;
  db[c] = [];
}

const users = Array.isArray(db.users) ? db.users : [];
const kept = users.filter((u) => u?.id === "u_admin" || u?.role === "admin");
report.users = users.length - kept.length;
db.users = kept;

db.meta = [{ key: "purged", at: Date.now(), version: 3 }];
db.settings = [{ key: "mode", value: "live", at: Date.now() }];

// 3) 写回
const put = await fetch(url, {
  method: "PUT",
  headers: { ...headers, "Content-Type": "text/plain" },
  body: JSON.stringify(db),
});

if (!put.ok) {
  console.error(`写入失败 HTTP ${put.status}: ${await put.text()}`);
  process.exit(1);
}

console.log("清库完成，清掉的记录数：");
for (const [k, v] of Object.entries(report)) console.log(`  ${k}: ${v}`);
console.log("保留的账号：", kept.map((u) => `${u.nickname}<${u.email}>`).join(", ") || "（无）");

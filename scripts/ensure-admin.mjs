/**
 * 在 Cloudflare Workers KV 中确保「站主账号」用户记录存在。
 *
 * 目的：登录接口在发现用户不存在时会现场创建并复制演示数据（多次 KV 写），
 * 首次登录会明显偏慢。先用这个脚本把用户准备好，登录就是一次纯读 + 一次会话写。
 *
 * 用法：
 *   CLOUDFLARE_API_TOKEN=xxx CLOUDFLARE_ACCOUNT_ID=yyy ADMIN_USER=superjohnson node scripts/ensure-admin.mjs
 */

const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const KV_NAMESPACE_ID = process.env.CF_KV_NAMESPACE_ID || "583c0b65b15f47b698718cfb3c439f90";
const KV_KEY = process.env.CF_KV_KEY || "db:v2";
const ADMIN_USER = process.env.ADMIN_USER || "superjohnson";

if (!ACCOUNT_ID || !API_TOKEN) {
  console.error("缺少 CLOUDFLARE_ACCOUNT_ID 或 CLOUDFLARE_API_TOKEN 环境变量");
  process.exit(1);
}

const base = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/storage/kv/namespaces/${KV_NAMESPACE_ID}/values/${encodeURIComponent(KV_KEY)}`;
const headers = { Authorization: `Bearer ${API_TOKEN}` };

const getRes = await fetch(base, { headers });
if (!getRes.ok) {
  console.error(`读取 KV 失败 HTTP ${getRes.status}: ${await getRes.text()}`);
  process.exit(1);
}
const db = await getRes.json();

const users = db.users ?? (db.users = []);
if (users.some((u) => u.id === "u_admin")) {
  console.log("管理员用户已存在，无需处理");
} else {
  const now = Date.now();
  users.push({
    id: "u_admin",
    email: `${ADMIN_USER}@admin.local`,
    nickname: ADMIN_USER,
    verified: true,
    planId: "pro",
    planExpiresAt: now + 1000 * 60 * 60 * 24 * 365 * 5,
    balance: 100000,
    referralCode: "ADMIN",
    createdAt: now,
    avatarHue: 152,
    riskProfile: "激进",
  });

  // 复制一份演示数据，保证控制台不是空的
  let cloned = 0;
  for (const col of ["apiKeys", "copyRelations", "trades", "notifications", "invoices", "strategySubs"]) {
    const rows = db[col] ?? (db[col] = []);
    const fromDemo = rows.filter((r) => r.userId === "u_demo");
    for (const rec of fromDemo) {
      rows.push({ ...rec, id: `${col.slice(0, 2)}_adm${(cloned++).toString(36)}`, userId: "u_admin" });
    }
  }

  const putRes = await fetch(base, {
    method: "PUT",
    headers: { ...headers, "Content-Type": "text/plain" },
    body: JSON.stringify(db),
  });
  if (!putRes.ok) {
    console.error(`写入 KV 失败 HTTP ${putRes.status}: ${await putRes.text()}`);
    process.exit(1);
  }
  console.log(`已创建管理员用户 u_admin（${ADMIN_USER}），并复制 ${cloned} 条演示数据`);
}

console.log("用户列表:", users.map((u) => `${u.id}:${u.nickname}`).join(", "));

/**
 * 线上 Workers KV 整库「瘦身」（体积维护）。
 *
 * 背景 —— 为什么要写这个脚本：
 *   把 414 个 OKX 带单员的**原始字段**全量落盘后，`db:v2` 这一个键涨到约 1.8 MB。
 *   而每次请求 `readDB()` 都要把它整库 JSON.parse 一遍（见 lib/store.ts），
 *   这份开销直接超出 Cloudflare Worker 的 CPU 预算
 *   → 全站走读库的路径间歇/持续返回 `error code: 1102`（HTTP 503）。
 *
 *   ⚠️ 死锁：修数据的接口 `POST /api/okx/traders {mode:"compact"}` 本身也要走 `readDB()`，
 *   所以它自己也跑不起来 —— 这就是为什么必须用这个**绕开 Worker** 的脚本直连 KV。
 *
 * 用法（只体检，不改动）：
 *   CLOUDFLARE_API_TOKEN=xxx CLOUDFLARE_ACCOUNT_ID=yyy node scripts/slim-kv.mjs
 *
 * 用法（真正写回）：
 *   CLOUDFLARE_API_TOKEN=xxx CLOUDFLARE_ACCOUNT_ID=yyy node scripts/slim-kv.mjs --apply
 *
 * 用法（超过阈值才写回 —— 部署流水线用这个，避免每次部署都白写一遍 KV）：
 *   CLOUDFLARE_API_TOKEN=xxx CLOUDFLARE_ACCOUNT_ID=yyy node scripts/slim-kv.mjs --max-kb=1024 --apply
 *
 * 产出：写回前会先把原始内容备份到 .data/backup/online-db-<时间戳>.json
 *
 * 清理规则（与 lib/okx-copy.ts 的 rankToTrader 保持一致，只是就地裁剪、不重建记录）：
 *   - okx.traderInsts   删除 —— 平均 204 个 instId / 人，占整库 72%，列表只用去重后的 symbols
 *   - okx.curve         删除 —— 与 trader.curve 完全重复
 *   - okx.portLink      删除 —— 与 trader.avatarUrl 完全重复
 *   - curve             只留最近 30 个点，压到 2 位小数
 *   - symbols           只留前 8 个
 *   - okx 里的数值      收益率/胜率压到 4 位小数，金额/天数取整（别再存全精度浮点字符串）
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export const CURVE_POINTS = 30;
export const SYMBOL_LIMIT = 8;

const r4 = (x) => Math.round(Number(x) * 10000) / 10000;
const intStr = (x) => String(Math.round(Number(x) || 0));
const r4Str = (x) => String(r4(x));

/** 数值字段是否「本来就是个有效数字」。空串 / undefined 不该被写成 "0"。 */
function hasNum(v) {
  return v !== undefined && v !== null && v !== "" && Number.isFinite(Number(v));
}

/**
 * 就地裁剪一条 trader（返回新对象，不改原对象）。
 * 不重建记录 —— 这样 id / status / note / createdBy 等本地人工字段天然不受影响。
 */
export function slimTrader(t) {
  const before = JSON.stringify(t);
  const next = { ...t };

  if (Array.isArray(next.curve)) {
    next.curve = next.curve.slice(-CURVE_POINTS).map((x) => Math.round(Number(x) * 100) / 100);
  }
  if (Array.isArray(next.symbols)) {
    next.symbols = next.symbols.slice(0, SYMBOL_LIMIT);
  }

  if (next.okx && typeof next.okx === "object") {
    const m = { ...next.okx };

    // 头像只保留 trader.avatarUrl 一份 —— 删之前先确保那份存在，别丢数据
    if (!next.avatarUrl && m.portLink) next.avatarUrl = m.portLink;

    delete m.traderInsts;
    delete m.curve;
    delete m.portLink;

    if (hasNum(m.pnlRatio)) m.pnlRatio = r4Str(m.pnlRatio);
    if (hasNum(m.winRatio)) m.winRatio = r4Str(m.winRatio);
    for (const k of ["pnl", "aum", "leadDays", "copyTraderNum", "accCopyTraderNum"]) {
      if (hasNum(m[k])) m[k] = intStr(m[k]);
    }

    next.okx = m;
  }

  return { trader: next, removedBytes: before.length - JSON.stringify(next).length };
}

/** 裁剪整个 DB。只动 source==="okx" 的记录，其余原样返回。 */
export function slimDB(db) {
  const traders = Array.isArray(db.traders) ? db.traders : [];
  let slimmed = 0;
  let removed = 0;

  const nextTraders = traders.map((t) => {
    if (t?.source !== "okx" || !t?.okx?.uniqueCode) return t;
    const { trader, removedBytes } = slimTrader(t);
    slimmed++;
    removed += removedBytes;
    return trader;
  });

  return { db: { ...db, traders: nextTraders }, slimmed, removed };
}

/* ------------------------------------------------------------------ */
/* CLI                                                                 */
/* ------------------------------------------------------------------ */

async function main() {
  const APPLY = process.argv.includes("--apply");
  // 阈值：整库小于这个值就直接跳过写回。部署流水线里靠它做到「只在出问题时动手」。
  const maxKbArg = process.argv.find((a) => a.startsWith("--max-kb="));
  const MAX_KB = maxKbArg ? Number(maxKbArg.split("=")[1]) || 0 : 0;

  const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
  const API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
  const KV_NAMESPACE_ID = process.env.CF_KV_NAMESPACE_ID || "583c0b65b15f47b698718cfb3c439f90";
  const KV_KEY = process.env.CF_KV_KEY || "db:v2";

  if (!ACCOUNT_ID || !API_TOKEN) {
    console.error("缺少 CLOUDFLARE_ACCOUNT_ID 或 CLOUDFLARE_API_TOKEN 环境变量");
    process.exit(1);
  }

  const url = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/storage/kv/namespaces/${KV_NAMESPACE_ID}/values/${encodeURIComponent(KV_KEY)}`;
  const kb = (s) => (Buffer.byteLength(s, "utf8") / 1024).toFixed(1) + " KB";

  const res = await fetch(url, { headers: { Authorization: `Bearer ${API_TOKEN}` } });
  if (!res.ok) {
    console.error(`读取 KV 失败 HTTP ${res.status}: ${await res.text()}`);
    process.exit(1);
  }
  const raw = await res.text();

  let db;
  try {
    db = JSON.parse(raw);
  } catch (e) {
    console.error(`KV 内容不是合法 JSON，已中止（不做任何写入）：${e.message}`);
    process.exit(1);
  }

  // 备份：任何写回之前先落地一份原始内容
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  mkdirSync(".data/backup", { recursive: true });
  const backupFile = `.data/backup/online-db-${stamp}.json`;
  writeFileSync(backupFile, raw, "utf8");

  const allTraders = Array.isArray(db.traders) ? db.traders : [];
  const okxCount = allTraders.filter((t) => t?.source === "okx" && t?.okx?.uniqueCode).length;

  console.log("=== 体检 ===");
  console.log(`KV 键           ${KV_KEY}`);
  console.log(`读回体积        ${kb(raw)}`);
  console.log(`traders 总数    ${allTraders.length}（其中 OKX 带单员 ${okxCount}）`);
  console.log(`备份            ${backupFile}`);
  for (const [k, v] of Object.entries(db)) {
    if (Array.isArray(v)) console.log(`  ${k.padEnd(16)} n=${String(v.length).padEnd(5)} ${kb(JSON.stringify(v))}`);
  }

  const { db: slim, slimmed, removed } = slimDB(db);
  const out = JSON.stringify(slim);

  console.log("\n=== 瘦身 ===");
  console.log(`处理后记录      ${slimmed} 条`);
  console.log(`回收字节        ${removed} 字节（约 ${(removed / 1024).toFixed(1)} KB）`);
  console.log(`traders 表      ${kb(JSON.stringify(allTraders))} → ${kb(JSON.stringify(slim.traders))}`);
  console.log(
    `整库            ${kb(raw)} → ${kb(out)}` +
      (raw.length ? `   ${((1 - out.length / raw.length) * 100).toFixed(0)}% 压缩` : "")
  );

  // 写回前的完整性校验：集合不能少，traders 条数必须一模一样
  const keysBefore = Object.keys(db).sort().join(",");
  const keysAfter = Object.keys(slim).sort().join(",");
  if (keysBefore !== keysAfter) {
    console.error(`\n✗ 集合结构发生变化（${keysBefore} → ${keysAfter}），已中止，不写入。`);
    process.exit(1);
  }
  if (slim.traders.length !== allTraders.length) {
    console.error(`\n✗ traders 条数变化（${allTraders.length} → ${slim.traders.length}），已中止，不写入。`);
    process.exit(1);
  }

  if (MAX_KB > 0 && raw.length / 1024 <= MAX_KB) {
    console.log(`\n整库已在阈值内（${kb(raw)} ≤ ${MAX_KB} KB），跳过写回。`);
    process.exit(0);
  }

  if (!APPLY) {
    console.log("\n（这是体检模式，没有写回。确认无误后加 --apply 再跑一次。）");
    process.exit(0);
  }

  const put = await fetch(url, {
    method: "PUT",
    headers: { Authorization: `Bearer ${API_TOKEN}`, "Content-Type": "text/plain" },
    body: out,
  });
  const putBody = await put.text();
  if (!put.ok) {
    console.error(`\n✗ 写回失败 HTTP ${put.status}: ${putBody}`);
    process.exit(1);
  }

  console.log(`\n✓ 已写回 KV（${kb(out)}）。`);
  console.log("  KV 写出后全球生效有延迟（最长约 60 秒），稍等一会儿再验证站点。");
  console.log("  验证：curl -s -o /dev/null -w '%{http_code}\\n' https://copytrade.138148178.xyz/api/market");
}

// 只有被直接执行时才跑 CLI，被 import 时只暴露纯函数（方便测试）
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  await main();
}

import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import kvIncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/kv-incremental-cache";

/**
 * OpenNext → Cloudflare Workers 构建配置。
 *
 * incrementalCache 用 KV（绑定名 NEXT_INC_CACHE_KV，见 wrangler.toml），
 * 承载 Next.js 的 ISR / fetch 缓存；与业务数据（COINCE_KV）分开，
 * 避免缓存键和数据键混在同一个命名空间里互相干扰。
 */
export default defineCloudflareConfig({
  incrementalCache: kvIncrementalCache,
});

import { CopyTradingClient } from "@/components/console/copy-trading-client";
import { getSessionUser } from "@/lib/auth";
import { filter } from "@/lib/db";
import { bootstrapIfNeeded, getLiveTraders } from "@/lib/seed";
import type { ApiKey, CopyRelation } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "跟单交易" };

export default async function CopyTradingPage() {
  await bootstrapIfNeeded();
  const user = (await getSessionUser())!;

  const traders = await getLiveTraders();
  const relations = await filter<CopyRelation>("copyRelations", (r) => r.userId === user.id);
  const keys = await filter<ApiKey>("apiKeys", (k) => k.userId === user.id && k.status === "active");

  const isAdmin = user.role === "admin" || user.id === "u_admin";

  return (
    <CopyTradingClient
      traders={traders}
      relations={relations}
      apiKeys={keys.map((k) => ({ id: k.id, exchange: k.exchange, label: k.label, masked: k.masked }))}
      isAdmin={isAdmin}
    />
  );
}

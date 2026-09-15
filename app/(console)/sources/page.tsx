import { redirect } from "next/navigation";
import { SourcesClient } from "@/components/console/sources-client";
import { requireAdmin } from "@/lib/auth";
import { bootstrapIfNeeded, SYMBOLS } from "@/lib/seed";
import { listSources } from "@/lib/sources";

export const dynamic = "force-dynamic";
export const metadata = { title: "信号源管理" };

export default async function SourcesPage() {
  await bootstrapIfNeeded();
  const admin = await requireAdmin();
  if (!admin) redirect("/dashboard");

  const sources = await listSources();
  const base = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "";

  return <SourcesClient initial={sources} symbols={SYMBOLS.map((s) => s.symbol)} baseUrl={base} />;
}

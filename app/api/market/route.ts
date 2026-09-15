import { NextResponse } from "next/server";
import { buildMarket } from "@/lib/market";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ ok: true, snapshot: buildMarket() });
}

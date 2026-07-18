import { NextResponse } from "next/server";
import { demoEnabled, resetDemoData } from "@/lib/demo";

export const dynamic = "force-dynamic";

/**
 * Nightly demo reset, called by the Vercel cron (which sends
 * `Authorization: Bearer ${CRON_SECRET}` automatically). Also bootstraps the
 * demo workspace on first call.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!demoEnabled() || !secret) {
    return NextResponse.json({ error: "Demo is not enabled on this install" }, { status: 404 });
  }
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await resetDemoData();
  return NextResponse.json({ ok: true, resetAt: new Date().toISOString() });
}

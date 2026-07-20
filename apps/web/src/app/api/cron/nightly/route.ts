import { NextResponse } from "next/server";
import { runDailyBriefings } from "@/lib/daily-briefing";
import { runOwnerExports } from "@/lib/export-run";
import { flushOutbox } from "@/lib/outbox";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * The single nightly cron (one slot on Vercel Hobby): flush the email outbox,
 * push client-owned exports to each opted-in workspace's own storage, and email
 * the daily briefing. The standalone /api/outbox/run and /api/exports/run
 * routes stay for manual or self-hosted triggering.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const header = req.headers.get("authorization");
  if (!secret || header !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const outbox = await flushOutbox();
  const exports = await runOwnerExports();
  const briefings = await runDailyBriefings();
  return NextResponse.json({ outbox, exports, briefings });
}

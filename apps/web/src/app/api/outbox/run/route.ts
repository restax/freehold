import { NextResponse } from "next/server";
import { flushOutbox } from "@/lib/outbox";

export const dynamic = "force-dynamic";

/**
 * Manual drain of the outbox, for when someone wants it emptied now.
 *
 * **Not a registered cron, and can't be**: Vercel's Hobby plan allows two
 * cron jobs per project on daily schedules only, and vercel.json spends both
 * on /api/demo/reset and /api/cron/nightly. The nightly run is the only
 * scheduled caller of flushOutbox in production.
 *
 * That is survivable because nothing time-sensitive waits here any more —
 * scheduled mail is held by Resend or Nylas and released on the minute (see
 * lib/outbox.ts). What this drains is the leftovers: schedules past thirty
 * days, and send-as-self mail whose mailbox was unlinked when it was booked.
 * Still CRON_SECRET-gated, so it's safe to point a cron at it if the project
 * ever moves onto a plan that allows one.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const header = req.headers.get("authorization");
  if (!secret || header !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const result = await flushOutbox();
  return NextResponse.json(result);
}

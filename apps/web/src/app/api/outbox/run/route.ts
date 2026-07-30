import { NextResponse } from "next/server";
import { flushOutbox } from "@/lib/outbox";

export const dynamic = "force-dynamic";

/**
 * Hourly cron: drain the outbox. Registered in vercel.json now that the
 * project is on Pro — Hobby caps cron jobs at daily schedules, which is what
 * kept this a callable-but-unregistered endpoint for a while (see git
 * history for that era; nightly's own flushOutbox call was the only
 * scheduled caller in production).
 *
 * Hourly is generous for what actually lands here: scheduled mail is held by
 * Resend or Nylas and released on the minute (see lib/outbox.ts), so this
 * only drains the leftovers those providers wouldn't take — schedules past
 * thirty days, and send-as-self mail whose mailbox was unlinked when it was
 * booked. Neither is time-critical; hourly beats the old daily worst case
 * without needing to be tighter than that.
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

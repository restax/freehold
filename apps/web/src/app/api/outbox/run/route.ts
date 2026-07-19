import { NextResponse } from "next/server";
import { flushOutbox } from "@/lib/outbox";

export const dynamic = "force-dynamic";

/** Hourly cron: deliver due scheduled/quiet-hours-deferred emails. */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const header = req.headers.get("authorization");
  if (!secret || header !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const result = await flushOutbox();
  return NextResponse.json(result);
}

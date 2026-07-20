import { NextResponse } from "next/server";
import { runOwnerExports } from "@/lib/export-run";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Nightly cron: push each opted-in workspace's full export to its own bucket. */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const header = req.headers.get("authorization");
  if (!secret || header !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const result = await runOwnerExports();
  return NextResponse.json(result);
}

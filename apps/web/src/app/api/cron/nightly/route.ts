import { NextResponse } from "next/server";
import { runScheduledBilling } from "@/lib/billing-schedule";
import { runDailyBriefings } from "@/lib/daily-briefing";
import { runOwnerExports } from "@/lib/export-run";
import { runInvoiceReports } from "@/lib/invoice-report";
import { flushOutbox } from "@/lib/outbox";
import { sweepExpiredExports } from "@/lib/storage";
import { runVendorAdRenewals } from "@/lib/vendor-ad-renewals";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * The single nightly cron (one slot on Vercel Hobby): flush the email outbox,
 * push client-owned exports to each opted-in workspace's own storage, sweep
 * yesterday's on-demand "Download everything" artifacts out of the platform
 * bucket, and email the daily briefing. The standalone /api/outbox/run and
 * /api/exports/run routes stay for manual or self-hosted triggering.
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
  const invoiceReports = await runInvoiceReports();
  const exportSweep = await sweepExpiredExports();
  const adRenewals = await runVendorAdRenewals();
  // Consolidated drafts before the invoice report, so a month-boundary run
  // reports the drafts it just created.
  const scheduledBilling = await runScheduledBilling();
  return NextResponse.json({
    outbox,
    exports,
    briefings,
    invoiceReports,
    exportSweep,
    adRenewals,
    scheduledBilling,
  });
}

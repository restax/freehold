import { NextResponse } from "next/server";
import { runScheduledBilling } from "@/lib/billing-schedule";
import { runDailyBriefings } from "@/lib/daily-briefing";
import { runOwnerExports } from "@/lib/export-run";
import { runInvoiceReports } from "@/lib/invoice-report";
import { pruneMcpClients } from "@/lib/mcp-prune";
import { flushOutbox } from "@/lib/outbox";
import { runReviewRequests } from "@/lib/review-requests";
import { sweepExpiredExports } from "@/lib/storage";
import { runVendorAdRenewals } from "@/lib/vendor-ad-renewals";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * The nightly cron: push client-owned exports to each opted-in workspace's
 * own storage, sweep yesterday's on-demand "Download everything" artifacts
 * out of the platform bucket, and email the daily briefing. None of these
 * are time-sensitive the way outbox mail is, so daily suits them fine —
 * that one now runs on its own hourly schedule instead (/api/outbox/run in
 * vercel.json); this still calls flushOutbox too, cheaply, as a safety net
 * in case the hourly one is ever removed or fails silently.
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
  const reviewRequests = await runReviewRequests();
  // Dynamic Client Registration leaves a client row per connection attempt;
  // this is the only thing that ever collects them.
  const mcpPrune = await pruneMcpClients();
  return NextResponse.json({
    outbox,
    exports,
    briefings,
    invoiceReports,
    exportSweep,
    adRenewals,
    scheduledBilling,
    reviewRequests,
    mcpPrune,
  });
}

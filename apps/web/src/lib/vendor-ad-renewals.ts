import { randomBytes } from "node:crypto";
import { prisma } from "@freehold/db";
import { sendPlatformEmail } from "./platform-email";

/**
 * The free-trial → renewal-drip lifecycle for vendor ads.
 *
 * A new advertiser can run for TRIAL_DAYS with no card. When that window ends
 * and they never converted to a paid subscription, the nightly cron pauses the
 * ad (it stops serving) and emails a renewal nudge, then keeps nudging every
 * DRIP_INTERVAL_DAYS until the vendor either pays (a Stripe subscription lights
 * the ad back up via the webhook) or unsubscribes with the one-click link.
 *
 * "Never converted" is `trialEndsAt` set AND `stripeSubscriptionId` null — a
 * paying customer whose card later lapses is Stripe's dunning problem, not this
 * drip's. Everything is app-scoped on the vendor-owned vendor_ad table.
 */

export const TRIAL_DAYS = 90;
export const DRIP_INTERVAL_DAYS = 14;

const DAY_MS = 24 * 3600 * 1000;

export function trialEndFrom(start: Date): Date {
  return new Date(start.getTime() + TRIAL_DAYS * DAY_MS);
}

/** A fresh capability token for the ad's unsubscribe link. */
export function newRenewalToken(): string {
  return randomBytes(18).toString("base64url");
}

/**
 * Is a paused trial due for its next renewal email? Pure so it can be tested:
 * true when no email has gone out yet, or the last one was at least
 * DRIP_INTERVAL_DAYS ago.
 */
export function renewalDue(lastRenewalEmailAt: Date | null, now: Date): boolean {
  if (!lastRenewalEmailAt) return true;
  return now.getTime() - lastRenewalEmailAt.getTime() >= DRIP_INTERVAL_DAYS * DAY_MS;
}

function baseUrl(): string {
  return (process.env.BETTER_AUTH_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

export function adRenewalUrl(token: string): string {
  return `${baseUrl()}/ad-renewal/${token}`;
}

function renewalEmail(
  vendorName: string,
  token: string,
  first: boolean,
): { subject: string; text: string } {
  const manageUrl = `${baseUrl()}/vendor/profile`;
  const stopUrl = adRenewalUrl(token);
  const subject = first
    ? `Your free Freehold ad for ${vendorName} has ended`
    : `Keep ${vendorName} in front of coordinators`;
  const opener = first
    ? "Your 3-month free ad on Freehold just wrapped up, so it's paused for now."
    : "Your Freehold ad is still paused — coordinators in your states aren't seeing you.";
  const text = [
    `Hi ${vendorName},`,
    "",
    opener,
    "",
    "Want to keep it running? Set up billing from your profile and it goes back into the",
    "Sponsored slots the moment payment clears (after a quick review):",
    manageUrl,
    "",
    "Not interested? Stop these reminders with one click:",
    stopUrl,
    "",
    "— Freehold",
  ].join("\n");
  return { subject, text };
}

interface RenewalResult {
  paused: number;
  nudged: number;
  skipped: number;
}

/**
 * The nightly pass. Pauses trials that just ended, then sends the next drip
 * email to any paused, never-converted, still-subscribed trial whose interval
 * has elapsed. Safe to run when platform email is unconfigured — it just pauses
 * and records nothing sent.
 */
export async function runVendorAdRenewals(now: Date = new Date()): Promise<RenewalResult> {
  const result: RenewalResult = { paused: 0, nudged: 0, skipped: 0 };

  // 1) Trials whose window closed and never converted → pause, then treat like
  //    any due drip below (the first email goes out in the same pass).
  const expired = await prisma.vendorAd.findMany({
    where: {
      status: "ACTIVE",
      trialEndsAt: { lt: now },
      stripeSubscriptionId: null,
    },
    select: { id: true },
  });
  for (const ad of expired) {
    await prisma.vendorAd.update({ where: { id: ad.id }, data: { status: "PAUSED" } });
    result.paused += 1;
  }

  // 2) Everyone in the drip pool: paused, never-converted trials that haven't
  //    unsubscribed. Send when due.
  const pool = await prisma.vendorAd.findMany({
    where: {
      status: "PAUSED",
      trialEndsAt: { not: null, lt: now },
      stripeSubscriptionId: null,
      renewalUnsubscribedAt: null,
    },
    select: {
      id: true,
      renewalToken: true,
      lastRenewalEmailAt: true,
      renewalEmailsSent: true,
      vendor: { select: { name: true, email: true, privateEmail: true } },
    },
  });

  for (const ad of pool) {
    if (!renewalDue(ad.lastRenewalEmailAt, now)) {
      result.skipped += 1;
      continue;
    }
    const to = ad.vendor.privateEmail ?? ad.vendor.email;
    const token = ad.renewalToken ?? newRenewalToken();
    try {
      const { subject, text } = renewalEmail(ad.vendor.name, token, ad.renewalEmailsSent === 0);
      await sendPlatformEmail(to, subject, text);
      await prisma.vendorAd.update({
        where: { id: ad.id },
        data: {
          renewalToken: token,
          lastRenewalEmailAt: now,
          renewalEmailsSent: { increment: 1 },
        },
      });
      result.nudged += 1;
    } catch {
      // Email not configured or transient failure — leave the ad for next run.
      result.skipped += 1;
    }
  }

  return result;
}

/** Resolve an unsubscribe token to its ad (bare lookup, no auth). */
export async function resolveAdRenewalToken(token: string) {
  if (!token) return null;
  return prisma.vendorAd.findUnique({
    where: { renewalToken: token },
    select: {
      id: true,
      renewalUnsubscribedAt: true,
      status: true,
      periodEnd: true,
      vendor: { select: { name: true } },
    },
  });
}

/** Stop the drip for the ad behind this token. Idempotent. */
export async function unsubscribeAdRenewal(token: string): Promise<boolean> {
  if (!token) return false;
  const res = await prisma.vendorAd.updateMany({
    where: { renewalToken: token, renewalUnsubscribedAt: null },
    data: { renewalUnsubscribedAt: new Date() },
  });
  return res.count > 0;
}

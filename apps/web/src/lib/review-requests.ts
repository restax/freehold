import { randomBytes } from "node:crypto";
import { prisma, withTenant } from "@freehold/db";
import { emailEnabled, sendTenantEmail } from "@/lib/email";
import { parseEmailPrefs } from "@/lib/email-prefs";
import {
  type EmailContact,
  parseEmailSettings,
  parseEmailTemplates,
  renderEmailHtml,
  renderMerge,
} from "@/lib/email-template";
import { portalOrigin } from "@/lib/portal";
import { reviewDue, reviewLinkExpiry } from "@/lib/reviews";
import { parseAppearance, resolveEmailAccent } from "@/lib/theme";

/**
 * The nightly sweep that asks for a review. Runs across every tenant, since
 * it's cron-driven rather than tied to one workspace's request — mirrors
 * runDailyBriefings' shape in lib/daily-briefing.ts.
 *
 * A transaction is asked exactly once: the WHERE clause excludes any
 * transaction that already has a ClientReview row, and the row is created
 * in the same pass that decides to send, so a retry of this function never
 * double-asks even if the email itself fails afterward.
 */
export async function runReviewRequests(): Promise<{ sent: number; skipped: number }> {
  if (!emailEnabled()) return { sent: 0, skipped: 0 };

  const orgs = await prisma.organization.findMany({ select: { id: true } });
  let sent = 0;
  let skipped = 0;

  for (const org of orgs) {
    const { delayDays, candidates } = await withTenant(org.id, async (tx) => {
      const settings = parseEmailSettings(
        (
          await tx.organization.findUnique({
            where: { id: org.id },
            select: { emailSettings: true },
          })
        )?.emailSettings,
      );
      const txns = await tx.transaction.findMany({
        where: { status: "CLOSED", closeDate: { not: null }, review: null },
        select: {
          id: true,
          propertyAddress: true,
          closeDate: true,
          client: { select: { id: true, name: true, email: true, emailPrefs: true } },
          assignees: {
            orderBy: { createdAt: "asc" },
            take: 1,
            select: { user: { select: { id: true, name: true, phone: true } } },
          },
        },
      });
      return { delayDays: settings.reviewDelayDays ?? 3, candidates: txns };
    });

    for (const txn of candidates) {
      if (!txn.closeDate || !reviewDue(txn.closeDate, delayDays)) {
        skipped++;
        continue;
      }
      if (!txn.client?.email) {
        skipped++;
        continue;
      }
      // Sample/demo data uses reserved .example addresses — never actually send.
      if (/\.(example|test|invalid)$/i.test(txn.client.email.split("@")[1] ?? "")) {
        skipped++;
        continue;
      }
      if (!parseEmailPrefs(txn.client.emailPrefs).review) {
        skipped++;
        continue;
      }

      const coordinator = txn.assignees[0]?.user ?? null;
      const token = randomBytes(24).toString("base64url");
      const now = new Date();

      // Create the row first: even if the send throws below, the file is
      // marked asked and the nightly sweep won't retry it forever.
      const created = await withTenant(org.id, (tx) =>
        tx.clientReview
          .create({
            data: {
              tenantId: org.id,
              transactionId: txn.id,
              clientId: txn.client?.id as string,
              coordinatorId: coordinator?.id ?? null,
              coordinatorName: coordinator?.name ?? null,
              email: txn.client?.email as string,
              token,
              expiresAt: reviewLinkExpiry(now),
              sentAt: now,
            },
          })
          .catch(() => null),
      );
      if (!created) {
        // Another run already claimed this transaction (unique constraint).
        skipped++;
        continue;
      }

      try {
        const orgRow = await prisma.organization.findUniqueOrThrow({
          where: { id: org.id },
          select: { name: true, emailTemplates: true, emailSettings: true, appearanceConfig: true },
        });
        const emailAccent = resolveEmailAccent(parseAppearance(orgRow.appearanceConfig));
        const base = await portalOrigin(org.id);
        const link = `${base}/r/${token}`;
        const template = parseEmailTemplates(orgRow.emailTemplates).review;
        const merge = {
          client_name: txn.client.name,
          property_address: txn.propertyAddress,
          close_date: txn.closeDate.toISOString().slice(0, 10),
          tc_name: coordinator?.name ?? orgRow.name,
          tenant_name: orgRow.name,
          review_link: link,
        };
        const body = renderMerge(template.body, merge);
        const tcCard: EmailContact = {
          heading: "Your transaction coordinator",
          name: coordinator?.name ?? orgRow.name,
          company: orgRow.name,
          phone: coordinator?.phone ?? null,
        };
        await sendTenantEmail({
          tenantId: org.id,
          transactionId: txn.id,
          to: txn.client.email,
          subject: renderMerge(template.subject, merge),
          body,
          html: renderEmailHtml({
            tenantName: orgRow.name,
            body,
            tc: tcCard,
            accent: emailAccent,
            ...parseEmailSettings(orgRow.emailSettings),
          }),
        });
        sent++;
      } catch {
        // The row already exists (asked), so a mail failure here doesn't
        // retry — matches the fire-and-forget posture of the other
        // lifecycle emails. The TC can see an unanswered, unrevoked review
        // row and resend by hand if needed.
      }
    }
  }

  return { sent, skipped };
}

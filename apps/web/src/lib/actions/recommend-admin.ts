"use server";

import { randomBytes } from "node:crypto";
import { prisma } from "@freehold/db";
import { redirect } from "next/navigation";
import { isOperator } from "@/lib/operator";
import { platformEmailEnabled, sendPlatformEmail } from "@/lib/platform-email";
import {
  recommendationEmailHtml,
  recommendationEmailSubject,
  recommendationEmailText,
} from "@/lib/recommend-email";
import { loadTwentyConnection, sendTwentyLead, sendTwentyNote } from "@/lib/twenty";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Where the Twenty CRM connection for admin-sent recommendations lives —
 *  Paul's own real workspace, not a special platform-level config. See
 *  packages/db/prisma/schema.prisma's FriendRecommendation doc comment. */
const CRM_SOURCE_ORG_SLUG = "acme-brokers-inc";

/**
 * The operator-only version of sendRecommendation on /admin/recommendations:
 * same email, but with a name/phone/note captured for a real, curated lead
 * (not the anonymous public form) and pushed into Twenty CRM. Not
 * rate-limited or honeypot-gated — that protection exists for the public,
 * unauthenticated form; this one is already behind isOperator().
 */
export async function sendRecommendationFromAdmin(formData: FormData) {
  if (!(await isOperator())) return;

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const phone = String(formData.get("phone") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim();
  if (!EMAIL_RE.test(email)) {
    redirect("/admin/recommendations?error=invalid");
  }

  if (!platformEmailEnabled()) {
    redirect("/admin/recommendations?error=unavailable");
  }

  const token = randomBytes(24).toString("base64url");
  try {
    await sendPlatformEmail(
      email,
      recommendationEmailSubject(),
      recommendationEmailText(token),
      recommendationEmailHtml(token),
    );
  } catch {
    redirect("/admin/recommendations?error=send");
  }

  // CRM push is best-effort: the email already went out, so a Twenty
  // failure or missing connection shouldn't be reported as this action
  // failing — crmSyncedAt staying null on the row is the visible signal.
  let crmSyncedAt: Date | null = null;
  if (name) {
    const org = await prisma.organization.findFirst({
      where: { slug: CRM_SOURCE_ORG_SLUG },
      select: { id: true },
    });
    if (!org) console.error("sendRecommendationFromAdmin: no org with slug", CRM_SOURCE_ORG_SLUG);
    const conn = org ? await loadTwentyConnection(org.id) : null;
    if (!conn) console.error("sendRecommendationFromAdmin: no Twenty connection for org", org?.id);
    if (conn) {
      const person = await sendTwentyLead(conn, { name, email, phone: phone || null }).catch(
        (err) => {
          console.error("sendRecommendationFromAdmin: sendTwentyLead threw", err);
          return { ok: false } as const;
        },
      );
      if (person.ok) {
        crmSyncedAt = new Date();
        if (note && person.id) {
          await sendTwentyNote(conn, person.id, note).catch((err) =>
            console.error("sendRecommendationFromAdmin: sendTwentyNote threw", err),
          );
        }
      } else {
        console.error("sendRecommendationFromAdmin: sendTwentyLead not ok");
      }
    }
  }

  await prisma.friendRecommendation.create({
    data: {
      name: name || null,
      email,
      phone: phone || null,
      note: note || null,
      token,
      crmSyncedAt,
    },
  });
  redirect("/admin/recommendations?sent=1");
}

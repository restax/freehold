"use server";

import { randomBytes } from "node:crypto";
import { prisma } from "@freehold/db";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { platformEmailEnabled, sendPlatformEmail } from "@/lib/platform-email";
import {
  recommendationEmailHtml,
  recommendationEmailSubject,
  recommendationEmailText,
} from "@/lib/recommend-email";
import { checkRecommendLimit } from "@/lib/recommend-limit";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * The public "send it for you" form on /recommend. No login, no tenant — a
 * visitor types a friend's address and Freehold sends one email on its own
 * behalf. Every write path (rate limit, honeypot, DB row) sits before the
 * actual send so a bad actor can't use this as a spam relay; the DB row is
 * only written after the send succeeds, so /admin/recommendations only ever
 * shows mail that actually went out.
 */
export async function sendRecommendation(formData: FormData) {
  // Honeypot: a real visitor never sees or fills this field (hidden via CSS
  // on the form, not `type="hidden"`, so a bot that only skips hidden
  // inputs still gets caught). Pretend success either way, no signal back.
  if (String(formData.get("website") ?? "").trim() !== "") {
    redirect("/recommend?sent=1");
  }

  const email = String(formData.get("friendEmail") ?? "")
    .trim()
    .toLowerCase();
  if (!EMAIL_RE.test(email)) {
    redirect("/recommend?error=invalid");
  }

  const hdrs = await headers();
  const ip =
    hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() || hdrs.get("x-real-ip") || "unknown";
  if (!checkRecommendLimit(ip).ok) {
    redirect("/recommend?error=limit");
  }

  if (!platformEmailEnabled()) {
    redirect("/recommend?error=unavailable");
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
    redirect("/recommend?error=send");
  }

  await prisma.friendRecommendation.create({ data: { email, token } });
  redirect("/recommend?sent=1");
}

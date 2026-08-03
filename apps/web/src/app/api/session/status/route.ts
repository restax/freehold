import { prisma } from "@freehold/db";
import { getSessionCookie } from "better-auth/cookies";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { effectiveTier } from "@/lib/plans";

export const dynamic = "force-dynamic";

/**
 * Polled by session-guard.tsx to tell "kicked by the concurrent-session
 * limit" apart from an ordinary expiry/sign-out, so the client can show a
 * specific "signed in elsewhere" modal instead of a silent redirect to
 * /login. The session cookie is signed as `${token}.${signature}` (see
 * better-call's signCookieValue) — better-auth's getSessionCookie() returns
 * that raw value without verifying it, so the token is recovered by
 * dropping everything from the last "." on. That's safe to do for a
 * read-only lookup: token ids never contain a dot, and a forged/garbled
 * value just fails to match any row.
 *
 * The raw row is read BEFORE calling auth.api.getSession() and only calls it
 * when the row looks like a normal, unexpired session — better-auth's own
 * getSession deletes any session it finds already expired (session.mjs:
 * "if session expired clean up the session"), which a revoked kick always
 * is (revoke backdates expiresAt to the moment it happened). Calling
 * getSession() first would erase the "superseded" row before this route
 * ever got to read it, collapsing a kick into an indistinguishable expiry.
 */
export async function GET(req: Request) {
  const raw = getSessionCookie(req);
  const token = raw ? raw.replace(/\.[^.]*$/, "") : null;
  if (!token) return NextResponse.json({ ok: false, reason: "signed_out" });

  const record = await prisma.session.findUnique({
    where: { token },
    select: { revoked: true, revokedReason: true, userId: true, expiresAt: true },
  });
  if (!record) return NextResponse.json({ ok: false, reason: "signed_out" });

  if (record.revoked && record.revokedReason === "superseded") {
    const memberships = await prisma.member.findMany({
      where: { userId: record.userId },
      select: { organization: { select: { planTier: true, compTier: true, compExpiresAt: true } } },
    });
    const upsell = memberships.every((m) => effectiveTier(m.organization) !== "BUSINESS");
    return NextResponse.json({ ok: false, reason: "superseded", upsell });
  }

  if (record.revoked || record.expiresAt < new Date()) {
    return NextResponse.json({ ok: false, reason: "signed_out" });
  }

  const session = await auth.api.getSession({ headers: req.headers });
  return NextResponse.json(session ? { ok: true } : { ok: false, reason: "signed_out" });
}

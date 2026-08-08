import { prisma, withTenant } from "@freehold/db";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { shouldCountPing, utcDay } from "@/lib/time-tracking";

export const dynamic = "force-dynamic";

/**
 * The presence ping behind "time on files".
 *
 * A transaction page fires this once a minute while it's open and visible;
 * each accepted ping adds one minute to that (file, person, day) ledger row.
 * The dedupe clock (`shouldCountPing`) means two tabs, a flaky network retry,
 * or an over-eager client can never make a minute count twice.
 *
 * Deliberately quiet in every failure mode: this is telemetry about a page
 * being open, so a bad or stale request gets a cheap 2xx/4xx and no side
 * effects — never an error a user would see.
 */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ ok: false }, { status: 401 });

  let transactionId: string;
  try {
    const body = (await req.json()) as { transactionId?: unknown };
    if (typeof body.transactionId !== "string" || !body.transactionId) throw new Error();
    transactionId = body.transactionId;
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  // Membership is re-derived server-side; the tenant comes from the session's
  // active workspace, never from the request body.
  const tenantId = session.session.activeOrganizationId;
  if (!tenantId) return NextResponse.json({ ok: false }, { status: 403 });
  const member = await prisma.member.findFirst({
    where: { organizationId: tenantId, userId: session.user.id },
    select: { id: true },
  });
  if (!member) return NextResponse.json({ ok: false }, { status: 403 });

  const org = await prisma.organization.findUnique({
    where: { id: tenantId },
    select: { timeTrackingEnabled: true },
  });
  // Feature off = successful no-op, so a page that raced the toggle doesn't
  // surface console errors for a minute.
  if (!org?.timeTrackingEnabled) return NextResponse.json({ ok: true, counted: false });

  const now = new Date();
  const day = utcDay(now);
  const userId = session.user.id;

  const counted = await withTenant(tenantId, async (tx) => {
    // Scoped read doubles as the access check: under RLS a transaction id
    // from another tenant simply doesn't exist here.
    const txn = await tx.transaction.findUnique({
      where: { id: transactionId },
      select: { id: true },
    });
    if (!txn) return null;

    const existing = await tx.transactionTimeEntry.findUnique({
      where: { transactionId_userId_day: { transactionId, userId, day } },
      select: { id: true, lastPingAt: true },
    });

    if (!existing) {
      await tx.transactionTimeEntry.create({
        data: { tenantId, transactionId, userId, day, minutes: 1, touches: 1, lastPingAt: now },
      });
      return true;
    }
    if (!shouldCountPing(existing.lastPingAt, now)) return false;
    await tx.transactionTimeEntry.update({
      where: { id: existing.id },
      data: { minutes: { increment: 1 }, touches: { increment: 1 }, lastPingAt: now },
    });
    return true;
  });

  if (counted === null) return NextResponse.json({ ok: false }, { status: 404 });
  return NextResponse.json({ ok: true, counted });
}

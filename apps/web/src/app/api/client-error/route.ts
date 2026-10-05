import { NextResponse } from "next/server";
import { logError } from "@/lib/error-log";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * The error pages post here so the browser's side of a failure is on record.
 * Signed-in only, so it isn't an open write endpoint, and every field is
 * length-capped by logError.
 */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return new NextResponse(null, { status: 204 });
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const s = (v: unknown) => (typeof v === "string" ? v : null);
  logError({
    source: "client",
    message: s(b.message) ?? "Unknown error",
    stack: s(b.stack),
    digest: s(b.digest),
    path: s(b.path),
    action: "Page error",
    userId: session.user.id,
    userEmail: session.user.email,
    tenantId: session.session.activeOrganizationId ?? null,
    userAgent: req.headers.get("user-agent"),
  });
  return new NextResponse(null, { status: 204 });
}

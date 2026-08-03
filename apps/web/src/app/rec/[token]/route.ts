import { prisma } from "@freehold/db";
import { NextResponse } from "next/server";

/**
 * The tracked link inside a "recommend Freehold" email. Records the first
 * click (updateMany with clickedAt: null in the where clause makes a
 * reload/re-click a no-op rather than overwriting the original timestamp),
 * then sends the visitor on to the live demo either way — a DB hiccup here
 * should never be the reason someone can't see the product.
 */
export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  await prisma.friendRecommendation
    .updateMany({ where: { token, clickedAt: null }, data: { clickedAt: new Date() } })
    .catch(() => {});
  return NextResponse.redirect(new URL("/demo", req.url));
}

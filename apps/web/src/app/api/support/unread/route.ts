import { NextResponse } from "next/server";
import { supportUnreadCount } from "@/lib/support-unread";
import { requireTenant } from "@/lib/tenant";

export const dynamic = "force-dynamic";

/**
 * The sidebar polls this for its "new message" badge: how many operator/Slack
 * replies have arrived since this person last opened the Support page. Cheap
 * (one scoped count), so it's safe to hit on an interval from every open tab.
 */
export async function GET() {
  const { tenantId, userId } = await requireTenant({ allowGuest: true });
  const unread = await supportUnreadCount(tenantId, userId);
  return NextResponse.json({ unread });
}

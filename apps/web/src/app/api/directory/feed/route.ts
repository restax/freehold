import { NextResponse } from "next/server";
import { loadFreeholdFeedRows } from "@/lib/directory-feed";

export const dynamic = "force-dynamic";

/**
 * Outbound syndication: the workspaces on this instance that opted into the
 * directory, in the same shape Freehold consumes from the public directory —
 * so the two can be merged from either side.
 *
 * Only opted-in workspaces appear, and only the fields they filled in for
 * publication. Nothing about transactions, clients, or people is exposed.
 * Read-only and unauthenticated by design: this is the listing a workspace
 * asked to have published. Set FREEHOLD_DIRECTORY_FEED_TOKEN to require a
 * bearer token instead. See docs/directory-api.md.
 */
export async function GET(req: Request) {
  const required = process.env.FREEHOLD_DIRECTORY_FEED_TOKEN?.trim();
  if (required) {
    const header = req.headers.get("authorization");
    const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
    if (token !== required) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  const listings = await loadFreeholdFeedRows();
  return NextResponse.json(
    { source: "freehold", generatedAt: new Date().toISOString(), listings },
    {
      headers: {
        "Cache-Control": "public, max-age=300",
        // Any directory should be able to read a feed meant for publication.
        "Access-Control-Allow-Origin": "*",
      },
    },
  );
}

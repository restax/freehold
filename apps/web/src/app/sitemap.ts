import { opinlyConfig } from "@opinly/next";
import { buildSitemapEntries } from "@opinly/shared";
import type { MetadataRoute } from "next";
import { getOpinlyClient, opinlyEnabled } from "@/lib/opinly";

const BASE = "https://freeholdtc.dev";

/**
 * Rebuilt hourly rather than baked once per deploy.
 *
 * The blog lives in Opinly, not in this repo, so a post published on a
 * Tuesday would otherwise wait for the next deploy to become findable. The
 * webhook already calls revalidatePath("/sitemap.xml") on a content change;
 * this is the floor under it for every case the webhook doesn't cover.
 */
export const revalidate = 3600;

/**
 * The blog's own URLs: posts, categories, authors, tags, and the index.
 *
 * Never allowed to throw. This route is prerendered during the build, and a
 * blog fetch that fails there used to take the whole deploy with it; now a
 * bad response costs the blog URLs on one render, and the next revalidation
 * puts them back. The static pages below are always worth serving.
 */
async function blogEntries(): Promise<MetadataRoute.Sitemap> {
  if (!opinlyEnabled()) return [];
  try {
    return buildSitemapEntries(await getOpinlyClient().routes(), opinlyConfig).map((e) => ({
      url: e.url,
      lastModified: new Date(e.lastModified),
      changeFrequency: "weekly" as const,
      priority: 0.6,
    }));
  } catch (err) {
    console.error("sitemap: opinly routes unavailable, serving static pages only", err);
    return [];
  }
}

/**
 * Marketing + docs pages only. The app (dashboard, portals, tenant sites,
 * auth) is deliberately excluded — robots.ts disallows it too.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const page = (
    path: string,
    priority: number,
    changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"] = "weekly",
  ) => ({ url: `${BASE}${path}`, lastModified: now, changeFrequency, priority });

  const pages = [
    page("/", 1),
    page("/features", 0.9),
    page("/pricing", 0.9),
    page("/blog", 0.8, "daily"),
    page("/integrations", 0.8),
    page("/mcp", 0.8),
    page("/compare", 0.7),
    page("/services", 0.7),
    page("/vendors", 0.7),
    page("/example-site", 0.6),
    page("/docs/api", 0.6),
    page("/docs/zapier", 0.6),
    page("/docs/followupboss", 0.6),
    page("/docs/twenty", 0.6),
    page("/recommend", 0.4, "monthly"),
    page("/terms", 0.3, "monthly"),
    page("/privacy", 0.3, "monthly"),
    page("/subprocessors", 0.3, "monthly"),
  ];

  // /blog is listed above so the index survives an Opinly outage, and Opinly
  // returns it too as the blog's "home" route. First writer wins, so the
  // page's own priority is kept and the URL appears exactly once — a
  // duplicated <loc> is the kind of thing Search Console reports as a
  // problem with the sitemap rather than with the page.
  const seen = new Map<string, MetadataRoute.Sitemap[number]>();
  for (const entry of [...pages, ...(await blogEntries())]) {
    if (!seen.has(entry.url)) seen.set(entry.url, entry);
  }
  return [...seen.values()];
}

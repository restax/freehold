import type { MetadataRoute } from "next";

const BASE = "https://freeholdtc.dev";

/**
 * Marketing + docs pages only. The app (dashboard, portals, tenant sites,
 * auth) is deliberately excluded — robots.ts disallows it too.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const page = (
    path: string,
    priority: number,
    changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"] = "weekly",
  ) => ({ url: `${BASE}${path}`, lastModified: now, changeFrequency, priority });

  return [
    page("/", 1),
    page("/features", 0.9),
    page("/pricing", 0.9),
    page("/integrations", 0.8),
    page("/compare", 0.7),
    page("/services", 0.7),
    page("/example-site", 0.6),
    page("/docs/api", 0.6),
    page("/docs/zapier", 0.6),
    page("/docs/followupboss", 0.6),
    page("/docs/twenty", 0.6),
    page("/recommend", 0.4, "monthly"),
    page("/terms", 0.3, "monthly"),
    page("/privacy", 0.3, "monthly"),
  ];
}

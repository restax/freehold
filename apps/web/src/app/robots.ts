import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // The app itself, plus the routes that are an action rather than a
        // page: one-time token links nobody can open twice, and the
        // sign-in-shaped pages. Crawling those spends budget that should be
        // going to the marketing pages and the blog, and they surface as
        // "crawled, not indexed" noise in Search Console either way.
        disallow: [
          "/dashboard/",
          "/admin",
          "/portal/",
          "/api/",
          "/t/",
          "/login",
          "/signup",
          "/verify-email",
          "/two-factor",
          "/onboarding",
          "/forgot-password",
          "/reset-password",
          "/accept-invitation/",
          "/demo",
          "/site-preview",
          "/r/",
          "/ad-renewal/",
          "/vendor-order/",
        ],
      },
    ],
    sitemap: "https://freeholdtc.dev/sitemap.xml",
  };
}

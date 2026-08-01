import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
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
          // Scratch space for reviewing generated assets before they are used
          // anywhere. Public so it needs no sign-in, but nothing here is
          // finished work and none of it should turn up in search results.
          "/preview/",
        ],
      },
    ],
    sitemap: "https://freeholdtc.dev/sitemap.xml",
  };
}

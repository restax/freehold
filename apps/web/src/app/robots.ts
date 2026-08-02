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
        ],
      },
    ],
    sitemap: "https://freeholdtc.dev/sitemap.xml",
  };
}

"use client";

import { Analytics } from "@vercel/analytics/react";
import posthog from "posthog-js";
import { useEffect } from "react";

/**
 * Site analytics, both env-gated so self-hosted installs track nothing:
 * - Vercel Web Analytics: active only on Vercel deployments (no-op elsewhere).
 * - PostHog: activates when NEXT_PUBLIC_POSTHOG_KEY is set — events, funnels,
 *   session context for the marketing site.
 */
export function SiteAnalytics() {
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    if (key && !posthog.__loaded) {
      posthog.init(key, {
        api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
        capture_pageview: true,
        capture_pageleave: true,
        persistence: "localStorage",
      });
    }
  }, []);

  return <Analytics />;
}

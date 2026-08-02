"use client";

import { Desktop, DeviceMobile } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { SITE_PREVIEW_REFRESH } from "@/lib/site-preview-events";

/**
 * Live preview of the tenant's public site, shown beside the editor on
 * /dashboard/website.
 *
 * An iframe rather than rendering TenantSiteView inline: the site is a
 * full-page layout with its own header, `min-h-screen`, and section
 * backgrounds that bleed edge to edge. Dropped into a dashboard card those
 * fight the surrounding chrome, and the tenant would be judging their
 * homepage by a distorted copy of it. An iframe gives it a real viewport, so
 * what they see is what visitors get — including how it reflows on a phone.
 *
 * Scaled with a transform rather than by shrinking the iframe, because the
 * point of the phone view is to trigger the site's own mobile breakpoints:
 * the iframe is a genuine 390px-wide viewport, then scaled to fit the card.
 */
const WIDTHS = { desktop: 1280, mobile: 390 } as const;
type Device = keyof typeof WIDTHS;

export function SitePreviewPane({ src, published }: { src: string; published: boolean }) {
  const [device, setDevice] = useState<Device>("desktop");
  // Bumped when the designer saves. Part of the iframe's key, so the frame is
  // torn down and re-created — a plain re-render would leave the old document
  // in place, showing the layout the tenant just replaced.
  const [nonce, setNonce] = useState(0);
  useEffect(() => {
    const bump = () => setNonce((n) => n + 1);
    window.addEventListener(SITE_PREVIEW_REFRESH, bump);
    return () => window.removeEventListener(SITE_PREVIEW_REFRESH, bump);
  }, []);

  // Tall enough to take in the whole page at a glance; the iframe scrolls for
  // the rest rather than growing the dashboard page without limit.
  const frameHeight = device === "desktop" ? 1400 : 1500;
  const width = WIDTHS[device];
  // Card is ~620px of usable width at the narrower half of the split.
  const scale = device === "desktop" ? 0.48 : 0.62;

  const tab = (value: Device, label: string, Icon: typeof Desktop) => (
    <button
      type="button"
      onClick={() => setDevice(value)}
      aria-pressed={device === value}
      className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
        device === value
          ? "bg-white text-stone-800 shadow-[0_1px_2px_rgb(41_37_36/0.08)]"
          : "text-stone-500 hover:text-stone-700"
      }`}
    >
      <Icon size={14} aria-hidden />
      {label}
    </button>
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1 rounded-xl bg-stone-100 p-1">
          {tab("desktop", "Desktop", Desktop)}
          {tab("mobile", "Phone", DeviceMobile)}
        </div>
        {!published && (
          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800">
            Not published yet — only you can see this
          </span>
        )}
      </div>

      <div
        className="relative overflow-hidden rounded-xl border border-stone-200 bg-stone-50"
        style={{ height: frameHeight * scale }}
      >
        <iframe
          key={`${device}:${nonce}`}
          src={src}
          title="Website preview"
          // Non-interactive on purpose: this is a picture of the page, not a
          // second place to use it. Clicking a link inside would strand the
          // tenant on a public page inside their own dashboard.
          className="pointer-events-none absolute left-1/2 top-0 origin-top border-0"
          style={{
            width,
            height: frameHeight,
            transform: `translateX(-50%) scale(${scale})`,
            transformOrigin: "top center",
          }}
        />
      </div>
    </div>
  );
}

import { ArrowRight, Sparkle } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { anyLaunchOfferActive, fmtPrice, LAUNCH_OFFER, launchPrice } from "@/lib/launch-offer";

/**
 * Full-width launch-offer announcement bar. Renders nothing unless at least
 * one tier's offer is live (Cloud + that tier's coupon configured + before
 * the deadline), so it self-retires after the deadline with no code change.
 */
export function LaunchBanner() {
  if (!anyLaunchOfferActive()) return null;
  const pro = fmtPrice(launchPrice("PRO"));
  const business = fmtPrice(launchPrice("BUSINESS"));
  return (
    <Link
      href="/pricing"
      className="group block bg-brand-800 text-white transition hover:bg-brand-900"
    >
      <div className="mx-auto flex max-w-6xl items-center justify-center gap-2.5 px-4 py-2.5 text-center text-sm sm:px-6">
        <Sparkle size={16} weight="fill" className="shrink-0 text-brand-200" aria-hidden />
        <p className="font-medium">
          <span className="font-semibold">Launch offer:</span> lock in the discount for good.
          <span className="hidden sm:inline">
            {" "}
            Pro {pro}/mo, Business {business}/mo. Sign up by {LAUNCH_OFFER.deadlineLabel}.
          </span>
        </p>
        <span className="inline-flex shrink-0 items-center gap-1 font-semibold text-brand-100 group-hover:text-white">
          <span className="hidden sm:inline">See pricing</span>
          <ArrowRight size={14} weight="bold" aria-hidden />
        </span>
      </div>
    </Link>
  );
}

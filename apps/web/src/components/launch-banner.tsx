import { ArrowRight, Sparkle } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { fmtPrice, LAUNCH_OFFER, launchOfferActive } from "@/lib/launch-offer";

/**
 * Full-width launch-offer announcement bar. Renders nothing unless the offer is
 * live (Cloud + coupon configured + before the deadline), so it self-retires
 * after the deadline with no code change.
 */
export function LaunchBanner() {
  if (!launchOfferActive()) return null;
  const pro = fmtPrice(LAUNCH_OFFER.pro.launch);
  const business = fmtPrice(LAUNCH_OFFER.business.launch);
  return (
    <Link
      href="/pricing"
      className="group block bg-gradient-to-r from-brand-800 via-brand-700 to-brand-600 text-white transition hover:from-brand-900 hover:via-brand-800 hover:to-brand-700"
    >
      <div className="mx-auto flex max-w-6xl items-center justify-center gap-2.5 px-4 py-2.5 text-center text-sm sm:px-6">
        <Sparkle size={16} weight="fill" className="shrink-0 text-brand-200" aria-hidden />
        <p className="font-medium">
          <span className="font-semibold">Launch offer:</span> lock in 50% off through 2027.
          <span className="hidden sm:inline">
            {" "}
            Pro {pro}, Business {business}/mo. Ends {LAUNCH_OFFER.deadlineLabel}.
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

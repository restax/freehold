import type { Icon } from "@phosphor-icons/react";
import {
  Buildings,
  Check,
  GlobeHemisphereWest,
  Lightning,
  Sparkle,
} from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { PaidPlanCta } from "@/components/free-plan-dialog";
import { LaunchBanner } from "@/components/launch-banner";
import { ExtractionReviewCard, MarketingFooter, MarketingNav } from "@/components/marketing";
import { fmtPrice, LAUNCH_OFFER, launchOfferActive, launchPrice } from "@/lib/launch-offer";
import { PAYMENTS_PAUSED } from "@/lib/payments-paused";

export const metadata = {
  title: "Pricing | Freehold",
  description:
    "Simple pricing with one honest free tier. Cloud from $0, Pro $50 and Business $80 a month. Every new signup gets a 14-day full-Pro trial with no card. Enterprise for standalone installs, self-hosting free forever.",
};

// Rendered per request so the launch offer reflects the current coupon env and
// deadline — a prerendered page would freeze the offer at build time (and not
// self-retire after the deadline).
export const dynamic = "force-dynamic";

const ENTERPRISE_EMAIL = "hello@freeholdtc.dev";

const TIERS: Array<{
  name: string;
  icon: Icon;
  audience: string;
  price: string;
  period: string;
  features: string[];
  cta: string;
  href?: string;
  note?: string;
  featured?: boolean;
  paid?: boolean;
}> = [
  {
    name: "Free",
    icon: Sparkle,
    audience: "For a solo TC getting started.",
    price: "$0",
    period: "forever",
    features: [
      "1 workspace user",
      "2 active transactions at a time",
      "5 client portal accounts",
      "Client portals and e-sign",
      "Data always readable and exportable",
    ],
    cta: "Start free",
    note: "No credit card required",
  },
  {
    name: "Pro",
    icon: Lightning,
    audience: "For working TCs and small teams.",
    price: "$50",
    period: "/ month",
    features: [
      "2 users (portal logins never count)",
      "8 active transactions at a time",
      "Unlimited client portal accounts",
      "AI contract extraction, unmetered",
      "Merge-field document templates",
      "Credential vault with reveal audit",
      "Branded portals, per-client e-sign",
      "Client invoicing with follow-up",
    ],
    cta: "Start with Pro",
    note: "Every signup starts here: 14 days, no credit card",
    featured: true,
    paid: true,
  },
  {
    name: "Business",
    icon: Buildings,
    audience: "For brokerages and title companies.",
    price: "$80",
    period: "/ month",
    features: [
      "Everything in Pro",
      "10 users included",
      "Unlimited active transactions",
      "Unlimited client portal accounts",
      "Priority, real-estate-focused support",
      "Onboarding done with you on a call",
      "Early access to new features",
    ],
    cta: "Start with Business",
    note: "Cancel in two clicks",
    paid: true,
  },
  {
    name: "Enterprise",
    icon: GlobeHemisphereWest,
    audience: "For multi-office and multi-brand operators.",
    price: "Custom",
    period: "",
    features: [
      "Everything in Business",
      "Standalone hosted install, dedicated to you",
      "Multi-tenancy: many brokerages, one system",
      "Multiple locations under one roof",
      "Support, upgrades, and SLAs included",
      "Guided migration and onboarding",
    ],
    cta: "Contact us",
    href: `mailto:${ENTERPRISE_EMAIL}?subject=Freehold%20Enterprise`,
  },
];

const LAUNCH_TIER_BY_NAME: Record<string, "PRO" | "BUSINESS"> = {
  Pro: "PRO",
  Business: "BUSINESS",
};

export default function PricingPage() {
  return (
    <main className="bg-stone-50 text-stone-900">
      <LaunchBanner />
      <MarketingNav />

      <section className="mx-auto max-w-6xl px-4 pb-16 pt-12 sm:px-6 lg:pb-24 lg:pt-16">
        <h1 className="font-display max-w-2xl text-3xl font-bold leading-[1.1] tracking-tight md:text-4xl">
          Simple pricing. One honest free tier.
        </h1>
        <p className="mt-5 max-w-xl leading-relaxed text-stone-600">
          Legacy TC platforms run $99 or more a month. Freehold starts free, and hitting a limit
          never locks your data: existing transactions stay readable and exportable, only creating
          new ones asks you to upgrade. Paid plans include room for{" "}
          <strong className="font-semibold text-stone-900">hundreds of active clients</strong>,
          enough for a TC serving an entire brokerage's agent roster.
        </p>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-stone-500">
          One more difference: we pay no affiliate commissions. Other platforms hand recommenders
          20% of your subscription, forever. Every dollar of a Freehold plan goes into the product,
          and every recommendation you've read of us was unpaid.
        </p>

        {/* Tier cards */}
        <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {TIERS.map((tier) => {
            const TierIcon = tier.icon;
            const launchTier = LAUNCH_TIER_BY_NAME[tier.name];
            const launchUsd =
              tier.paid && launchTier && launchOfferActive(launchTier)
                ? launchPrice(launchTier)
                : undefined;
            return (
              <div
                key={tier.name}
                className={`flex flex-col rounded-xl p-6 ${
                  tier.featured
                    ? "bg-brand-700 text-white shadow-lg shadow-brand-700/20"
                    : "border border-stone-200/70 bg-white"
                }`}
              >
                <span
                  className={`mb-4 grid h-10 w-10 place-items-center rounded-xl ${
                    tier.featured ? "bg-white/15 text-white" : "bg-brand-600/10 text-brand-700"
                  }`}
                >
                  <TierIcon size={20} weight="duotone" aria-hidden />
                </span>
                <h2 className="font-display font-bold">{tier.name}</h2>
                <p
                  className={`mt-1 text-sm ${tier.featured ? "text-brand-50/90" : "text-stone-500"}`}
                >
                  {tier.audience}
                </p>
                <p className="font-display mt-5 text-4xl font-bold tabular-nums">
                  {launchUsd != null && (
                    <span
                      className={`mr-2 align-middle text-2xl font-bold line-through ${
                        tier.featured ? "text-brand-100/70" : "text-stone-400"
                      }`}
                    >
                      {tier.price}
                    </span>
                  )}
                  {launchUsd != null ? fmtPrice(launchUsd) : tier.price}
                  {tier.period && (
                    <span
                      className={`ml-1.5 font-sans text-sm font-normal ${
                        tier.featured ? "text-brand-50/80" : "text-stone-500"
                      }`}
                    >
                      {tier.period}
                    </span>
                  )}
                </p>
                {launchUsd != null && (
                  <p
                    className={`mt-1 text-xs font-medium ${
                      tier.featured ? "text-brand-100" : "text-brand-700"
                    }`}
                  >
                    Launch price:{" "}
                    {fmtPrice(
                      launchTier === "PRO" ? LAUNCH_OFFER.pro.off : LAUNCH_OFFER.business.off,
                    )}{" "}
                    off, locked in for good. Sign up by {LAUNCH_OFFER.deadlineLabel}.
                  </p>
                )}
                <ul className="mt-5 flex flex-col gap-2.5 text-sm">
                  {tier.features.map((f) => (
                    <li key={f} className="flex gap-2.5">
                      <Check
                        size={16}
                        weight="bold"
                        aria-hidden
                        className={`mt-0.5 shrink-0 ${tier.featured ? "text-brand-100" : "text-brand-600"}`}
                      />
                      <span className={tier.featured ? "text-brand-50/95" : "text-stone-600"}>
                        {f}
                      </span>
                    </li>
                  ))}
                </ul>
                {PAYMENTS_PAUSED && tier.paid ? (
                  <div className="mt-auto pt-7">
                    <PaidPlanCta label={tier.cta} featured={tier.featured} />
                  </div>
                ) : (
                  <Link href={tier.href ?? "/signup"} className="mt-auto pt-7">
                    <span
                      className={`block rounded-lg px-4 py-2.5 text-center text-sm font-medium transition active:scale-[0.98] ${
                        tier.featured
                          ? "bg-white text-brand-800 hover:bg-brand-50"
                          : "bg-stone-900 text-white hover:bg-stone-700"
                      }`}
                    >
                      {tier.cta}
                    </span>
                  </Link>
                )}
                {tier.note && (
                  <p
                    className={`mt-2 text-center text-xs ${tier.featured ? "text-brand-100" : "text-stone-400"}`}
                  >
                    {tier.note}
                  </p>
                )}
              </div>
            );
          })}
        </div>

        <p className="mt-5 text-center text-xs text-stone-400">
          All billing runs through Stripe. We never see or store your card. Cancel any time from the
          billing page; your data stays exportable.
        </p>

        {/* Self-hosted band */}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-5 rounded-xl border border-dashed border-stone-300 bg-white px-6 py-5">
          <div>
            <h2 className="font-display font-bold">Self-hosted</h2>
            <p className="mt-1 max-w-xl text-sm leading-relaxed text-stone-600">
              Free forever. Everything above, unlimited, with your own API keys and your own
              hardware. One Docker Compose file, one command. And &quot;hardware&quot; can be the
              unused PC in your office closet: the software costs nothing, so a machine you already
              own is a zero-dollar server.
            </p>
          </div>
          <a
            href="https://github.com/restax/freehold/blob/main/docs/SELF-HOSTING.md"
            className="rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 shadow-xs transition hover:border-stone-400 hover:bg-stone-50 active:scale-[0.98]"
          >
            Self-hosting guide
          </a>
        </div>
      </section>

      {/* IT providers and agencies */}
      <section className="border-t border-stone-200/70 bg-white">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:gap-16 lg:py-20">
          <div>
            <h2 className="font-display text-3xl font-bold tracking-tight md:text-4xl">
              IT providers and agencies
            </h2>
            <p className="mt-4 max-w-md leading-relaxed text-stone-600">
              We're building a free partner program for IT providers who manage Freehold for the
              brokerages they serve: fleet provisioning, consolidated billing, volume discounts.
              It's in development. The first cohort of partners is shaping it with us.{" "}
              <a
                href="mailto:partners@freeholdtc.dev"
                className="font-medium text-brand-700 hover:text-brand-600"
              >
                partners@freeholdtc.dev
              </a>
            </p>
          </div>
          <div className="flex flex-col gap-4">
            <p className="rounded-xl bg-stone-100/70 px-5 py-4 text-sm leading-relaxed text-stone-600">
              <strong className="font-medium text-stone-900">Works today:</strong> self-host
              Freehold for any number of clients, free: every feature, no partner account needed.
              The full API and signed webhooks are live for your own tooling.
            </p>
            <p className="rounded-xl bg-stone-100/70 px-5 py-4 text-sm leading-relaxed text-stone-600">
              <strong className="font-medium text-stone-900">In development:</strong> one dashboard
              to provision, suspend, and monitor every client instance, with fleet-scoped API keys
              and one consolidated invoice.
            </p>
            <p className="rounded-xl bg-stone-100/70 px-5 py-4 text-sm leading-relaxed text-stone-600">
              <strong className="font-medium text-stone-900">Your hosting or ours.</strong> Run
              clients on Freehold Cloud, or self-host for them and use us only for what you want.
            </p>
          </div>
        </div>
      </section>

      {/* Services */}
      <section className="border-t border-stone-200/70 bg-stone-100/50">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <h2 className="font-display text-2xl font-bold tracking-tight">Services</h2>
          <div className="mt-6 grid gap-8 md:grid-cols-2">
            <p className="text-sm leading-relaxed text-stone-600">
              <strong className="font-medium text-stone-900">Setup service.</strong> We install and
              configure a self-hosted Freehold on your server for a one-time fee, then hand you the
              keys.
            </p>
            <p className="text-sm leading-relaxed text-stone-600">
              <strong className="font-medium text-stone-900">Migration service.</strong> White-glove
              import of your full book of business from whichever legacy platform you're leaving.
              Quoted per migration.
            </p>
          </div>
        </div>
      </section>

      {/* The screenshot area: extraction review card */}
      <section className="border-t border-stone-200/70 bg-[linear-gradient(165deg,#d7f8e4_0%,#ecfdf3_45%,#fafaf9_100%)]">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:gap-16 lg:py-20">
          <div>
            <h2 className="font-display text-3xl font-bold tracking-tight md:text-4xl">
              Every plan includes the AI that reads your contracts.
            </h2>
            <p className="mt-3 max-w-md leading-relaxed text-stone-600">
              Upload the purchase agreement and review every extracted date and figure with its page
              citation before it touches the file. On Cloud, no API keys and no separate AI bill.
            </p>
            <Link
              href="/signup"
              className="mt-6 inline-block rounded-lg bg-brand-600 px-5 py-2.5 font-medium text-white shadow-xs transition hover:bg-brand-700 active:scale-[0.98]"
            >
              Start free
            </Link>
          </div>
          <div className="justify-self-center lg:justify-self-end">
            <ExtractionReviewCard />
          </div>
        </div>
      </section>

      <MarketingFooter />
    </main>
  );
}

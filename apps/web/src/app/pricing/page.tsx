import { Check } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { ExtractionReviewCard, MarketingFooter, MarketingNav } from "@/components/marketing";

export const metadata = {
  title: "Pricing | Freehold",
  description:
    "Simple pricing with one honest free tier. Cloud from $0, Pro $29 per user, self-hosting free forever.",
};

const TIERS: Array<{
  name: string;
  audience: string;
  price: string;
  period: string;
  features: string[];
  cta: string;
  featured?: boolean;
}> = [
  {
    name: "Cloud Free",
    audience: "For a solo TC getting started.",
    price: "$0",
    period: "forever",
    features: [
      "2 users",
      "10 active transactions a month",
      "AI extraction trial credits",
      "Client portals and e-sign",
      "Data always readable and exportable",
    ],
    cta: "Start free",
  },
  {
    name: "Cloud Pro",
    audience: "For working TCs and small teams.",
    price: "$29",
    period: "per user / month",
    features: [
      "Unlimited transactions and custom fields",
      "AI contract extraction, fair use included",
      "Merge-field document templates",
      "Credential vault with reveal audit",
      "Branded client portals, per-client e-sign",
    ],
    cta: "Start with Pro",
    featured: true,
  },
  {
    name: "Cloud Business",
    audience: "For brokerages and title companies.",
    price: "$59",
    period: "per user / month",
    features: [
      "Everything in Pro",
      "Priority, real-estate-focused support",
      "White-glove onboarding",
      "First access to reporting and invoicing",
    ],
    cta: "Start with Business",
  },
];

export default function PricingPage() {
  return (
    <main className="bg-stone-50 text-stone-900">
      <MarketingNav />

      <section className="mx-auto max-w-6xl px-4 pb-16 pt-12 sm:px-6 lg:pb-24 lg:pt-16">
        <h1 className="font-display max-w-2xl text-4xl font-extrabold leading-[1.1] tracking-tight md:text-5xl">
          Simple pricing. One honest free tier.
        </h1>
        <p className="mt-5 max-w-xl leading-relaxed text-stone-600">
          Legacy TC platforms run $99 or more a month. Freehold starts free, and hitting a limit
          never locks your data: existing transactions stay readable and exportable, only creating
          new ones asks you to upgrade.
        </p>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-stone-500">
          One more difference: we pay no affiliate commissions. Other platforms hand recommenders
          20% of your subscription, forever. Every dollar of a Freehold plan goes into the product,
          and every recommendation you've read of us was unpaid.
        </p>

        {/* Tier cards */}
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {TIERS.map((tier) => (
            <div
              key={tier.name}
              className={`flex flex-col rounded-2xl p-6 ${
                tier.featured ? "bg-brand-700 text-white" : "border border-stone-200/70 bg-white"
              }`}
            >
              <h2 className="font-display font-bold">{tier.name}</h2>
              <p
                className={`mt-1 text-sm ${tier.featured ? "text-brand-50/90" : "text-stone-500"}`}
              >
                {tier.audience}
              </p>
              <p className="font-display mt-5 text-4xl font-extrabold tabular-nums">
                {tier.price}
                <span
                  className={`ml-1.5 font-sans text-sm font-normal ${
                    tier.featured ? "text-brand-50/80" : "text-stone-500"
                  }`}
                >
                  {tier.period}
                </span>
              </p>
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
              <Link href="/signup" className="mt-auto pt-7">
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
            </div>
          ))}
        </div>

        {/* Self-hosted band */}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-5 rounded-2xl border border-dashed border-stone-300 bg-white px-6 py-5">
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
              A free partner account lets you provision and manage any number of Freehold instances
              for the brokerages you serve. Each instance is billed at standard plan rates on a
              single consolidated invoice, with volume discounts as your fleet grows.
            </p>
          </div>
          <div className="flex flex-col gap-4">
            <p className="rounded-xl bg-stone-100/70 px-5 py-4 text-sm leading-relaxed text-stone-600">
              <strong className="font-medium text-stone-900">One dashboard, many instances.</strong>{" "}
              Provision, suspend, and monitor every client instance from one place.
            </p>
            <p className="rounded-xl bg-stone-100/70 px-5 py-4 text-sm leading-relaxed text-stone-600">
              <strong className="font-medium text-stone-900">API keys for automation.</strong> Scope
              keys to one instance or your whole fleet for provisioning and monitoring.
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
              className="mt-6 inline-block rounded-full bg-brand-600 px-5 py-2.5 font-medium text-white shadow-xs transition hover:bg-brand-700 active:scale-[0.98]"
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

import { ArrowLeft, ArrowRight, Check, Scales } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { MarketingFooter, MarketingNav } from "@/components/marketing";
import { TC_PAY_RULES_EFFECTIVE } from "@/lib/tc-pay-rules";
import { PayRulesExplorer } from "./pay-rules-explorer";

export const metadata = {
  alternates: { canonical: "/free-tools/tc-pay-rules" },
  openGraph: {
    title: "State Rules for Paying Unlicensed Transaction Coordinators | Freehold",
    description:
      "A state-by-state list of the rules on paying an unlicensed assistant or transaction coordinator. General information, not legal advice.",
    url: "https://freeholdtc.dev/free-tools/tc-pay-rules",
    siteName: "Freehold",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "State Rules for Paying Unlicensed Transaction Coordinators | Freehold",
    description:
      "A state-by-state list of the rules on paying an unlicensed assistant or transaction coordinator. General information, not legal advice.",
  },
  title: "State Rules for Paying Unlicensed Transaction Coordinators | Freehold",
  description:
    "A list of states that have rules or guidance on how an unlicensed assistant or transaction coordinator can be paid. This is general information and not legal advice.",
};

const INCLUDED = [
  "Client portals and e-sign, on the free plan",
  "Two active transactions at a time, 5 client portal accounts",
  "Your data stays readable and exportable",
  "No credit card to start",
];

export default function TcPayRulesPage() {
  return (
    <main id="tc-pay-rules-root" className="bg-stone-50 text-stone-900">
      <MarketingNav />

      <section className="border-b border-stone-200/70 bg-white">
        <div className="mx-auto max-w-6xl px-4 pb-10 pt-8 sm:px-6 lg:pt-10">
          <Link
            href="/free-tools"
            className="inline-flex items-center gap-2 text-sm font-medium text-brand-700 hover:text-brand-800"
          >
            <ArrowLeft size={14} weight="bold" aria-hidden />
            Back to all free offerings
          </Link>

          <div
            role="note"
            className="mt-5 flex gap-3 rounded-lg border border-amber-300/70 bg-amber-50 px-4 py-3"
          >
            <Scales
              size={20}
              weight="bold"
              aria-hidden
              className="mt-0.5 shrink-0 text-amber-700"
            />
            <p className="text-sm leading-relaxed text-amber-950">
              <strong className="font-semibold">This page is not legal advice.</strong> It is only
              general information. Before acting, check the laws of your state and talk with your
              own legal counsel.
            </p>
          </div>

          <p className="mt-8 text-xs font-semibold uppercase tracking-wide text-brand-700">
            Unlicensed TCs and assistants · Effective as of {TC_PAY_RULES_EFFECTIVE}
          </p>
          <h1 className="font-display mt-2 max-w-3xl text-3xl font-bold leading-[1.1] tracking-tight md:text-4xl">
            State Rules for Paying Unlicensed Transaction Coordinators
          </h1>
          <p className="mt-4 max-w-2xl leading-relaxed text-stone-600">
            Below is a list of states that have rules or guidance on how an unlicensed assistant or
            transaction coordinator can be paid, including whether they can be paid only when a
            transaction closes. Select a state or a category to filter the list. Limits on what an
            unlicensed person can do apply in every state, however they are paid.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <PayRulesExplorer />

        <div className="mt-10 grid max-w-3xl gap-3 text-sm leading-relaxed text-stone-600">
          <p>
            <strong className="text-stone-900">No pay based on sales.</strong> These states do not
            allow an assistant to be paid a percentage of commission, or any amount based on
            listings or sales. A flat fee paid only at closing is not a percentage, but a regulator
            could still read the rule to cover it. Treat these states as a gray area that leans
            toward no.
          </p>
          <p>
            <strong className="text-stone-900">No specific pay rule.</strong> We did not find a rule
            on how to pay an unlicensed assistant in these states. Most still do not allow paying an
            unlicensed person for work that needs a license, so a per-closing fee is safest when the
            assistant keeps to administrative tasks.
          </p>
          <p>
            <strong className="text-stone-900">Last reviewed.</strong> Many rows come from the NAR
            state table, which was last reviewed in April 2020. Rows dated 2023 or later were
            checked against newer state material. This page is effective as of{" "}
            {TC_PAY_RULES_EFFECTIVE} and is general information only, not legal advice.
          </p>
        </div>
      </section>

      <section className="border-t border-stone-200/70 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <div className="grid gap-8 rounded-xl border border-brand-600/15 bg-brand-50/60 px-6 py-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">
                Starting a TC business
              </p>
              <h2 className="font-display mt-2 text-2xl font-bold tracking-tight md:text-3xl">
                The full suite, on the free plan
              </h2>
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-stone-600">
                Most software makes a new coordinator pay to unlock the tools that make a business
                look professional. Freehold does not. Every offering is on the free plan, sized for
                a solo coordinator landing the first clients. Upgrade only when your volume says it
                is time.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  href="/"
                  className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white shadow-xs transition hover:bg-brand-700 active:scale-[0.98]"
                >
                  See what Freehold does
                  <ArrowRight size={14} weight="bold" aria-hidden />
                </Link>
                <Link
                  href="/free-tools"
                  className="rounded-lg border border-stone-300 bg-white px-5 py-2.5 text-sm font-medium text-stone-700 transition hover:border-stone-400"
                >
                  More free offerings
                </Link>
              </div>
            </div>
            <ul className="flex flex-col gap-3">
              {INCLUDED.map((item) => (
                <li key={item} className="flex gap-3">
                  <Check
                    size={18}
                    weight="bold"
                    aria-hidden
                    className="mt-0.5 shrink-0 text-brand-600"
                  />
                  <span className="text-sm leading-relaxed text-stone-700">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <MarketingFooter />
    </main>
  );
}

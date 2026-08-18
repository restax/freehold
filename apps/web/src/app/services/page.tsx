import Link from "next/link";
import { MarketingFooter, MarketingNav } from "@/components/marketing";

export const metadata = {
  alternates: { canonical: "/services" },
  title: "Setup & IT services | Freehold",
  description:
    "We install, migrate, and configure Freehold for you: self-hosted setup, DocuSign and e-signature connections, data migration from legacy TC platforms, email and domains.",
};

const OFFERINGS: Array<[title: string, mono: string, body: string]> = [
  [
    "Self-hosted install",
    "SH",
    "Your own Freehold on your own server or cloud account. We provision it, secure it (TLS, backups, updates), and hand you the keys. You own the data and the box.",
  ],
  [
    "DocuSign connection",
    "DS",
    "Prefer DocuSign over the bundled open-source e-signing? We set up the developer account, credentials, and connection on your self-hosted install so envelopes flow from day one.",
  ],
  [
    "Data migration",
    "→",
    "Transactions, contacts, and documents out of your legacy TC platform or spreadsheets and into Freehold: mapped, dry-run previewed, and verified together before cutover.",
  ],
  [
    "Email & domain setup",
    "@",
    "Workspace sending addresses, reply capture, DNS records, and calendar feeds configured on your own domain, tested end to end.",
  ],
  [
    "Training & onboarding",
    "Tr",
    "A working session with your team on your real deals: checklists, cascading dates, portals, and the daily routine, not a canned demo.",
  ],
];

export default function ServicesPage() {
  return (
    <main className="bg-stone-50 text-stone-900">
      <MarketingNav />

      <section className="mx-auto max-w-6xl px-4 pb-20 pt-12 sm:px-6 lg:pt-16">
        <h1 className="font-display max-w-2xl text-3xl font-bold leading-[1.1] tracking-tight md:text-4xl">
          Don't want to touch servers? We'll set it up.
        </h1>
        <p className="mt-5 max-w-xl leading-relaxed text-stone-600">
          Freehold is source-available: anyone can self-host it free for their own organization,
          forever. If you'd rather spend that time on closings, our team does the technical work for
          a flat fee, quoted up front. No subscriptions, no surprises.
        </p>

        <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {OFFERINGS.map(([title, mono, body]) => (
            <div
              key={title}
              className="flex gap-4 rounded-xl border border-stone-200/70 bg-white p-5"
            >
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-stone-100 font-display text-base font-bold text-stone-700">
                {mono}
              </span>
              <div>
                <h3 className="font-display font-bold">{title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-stone-600">{body}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-12 rounded-xl border border-stone-200/70 bg-white p-6 sm:p-8">
          <h2 className="font-display text-2xl font-bold tracking-tight">
            Tell us what you're moving from
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-stone-600">
            One email is enough to get a quote: what platform you're on today, roughly how many
            transactions a year, and whether you want Freehold Cloud or your own server. We reply
            with a fixed price and a timeline.
          </p>
          <a
            href="mailto:hello@freeholdtc.dev?subject=Setup%20%26%20IT%20services"
            className="mt-5 inline-block rounded-xl bg-brand-700 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-600"
          >
            hello@freeholdtc.dev →
          </a>
          <p className="mt-4 text-xs text-stone-400">
            Rather do it yourself? The{" "}
            <a
              href="https://github.com/restax/freehold/blob/main/docs/SELF-HOSTING.md"
              className="underline hover:text-stone-600"
            >
              self-hosting guide
            </a>{" "}
            walks through everything, and{" "}
            <Link href="/pricing" className="underline hover:text-stone-600">
              Freehold Cloud
            </Link>{" "}
            needs no setup at all.
          </p>
        </div>
      </section>

      <MarketingFooter />
    </main>
  );
}

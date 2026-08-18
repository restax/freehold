import Link from "next/link";
import { MarketingFooter, MarketingNav } from "@/components/marketing";

export const metadata = {
  alternates: { canonical: "/docs/followupboss" },
  title: "Follow Up Boss | Freehold docs",
  description:
    "Connect Follow Up Boss to Freehold with your API key: website leads flow into your FUB automations, and your people import into Freehold contacts.",
};

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-4 border-b border-stone-200/70 py-5 last:border-0">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-50 font-display text-sm font-bold text-brand-800">
        {n}
      </span>
      <div>
        <h3 className="font-medium">{title}</h3>
        <div className="mt-1 text-sm leading-relaxed text-stone-600">{children}</div>
      </div>
    </li>
  );
}

export default function FubDocsPage() {
  return (
    <main className="bg-stone-50 text-stone-900">
      <MarketingNav />
      <section className="mx-auto max-w-3xl px-4 pb-20 pt-12 sm:px-6">
        <h1 className="font-display text-4xl font-bold leading-[1.1] tracking-tight">
          Freehold + Follow Up Boss
        </h1>
        <p className="mt-4 leading-relaxed text-stone-600">
          Many of the agents you coordinate for live in Follow Up Boss. This connection keeps both
          systems fed without double entry, using your own FUB API key, no approvals, nothing to
          install.
        </p>

        <div className="mt-8 rounded-xl border border-stone-200/70 bg-white p-6">
          <h2 className="font-display text-xl font-bold tracking-tight">What it does</h2>
          <p className="mt-2 text-sm leading-relaxed text-stone-600">
            <strong>Leads out:</strong> when someone registers on your Freehold website, the lead is
            sent to Follow Up Boss through its events API, so your FUB action plans, assignment
            rules, and automations fire exactly as they do for any other lead source.
            <br />
            <strong>People in:</strong> one click imports your FUB people into Freehold contacts
            (tagged "Follow Up Boss"). Imports match on email and never duplicate or overwrite.
            Re-run it any time.
          </p>
        </div>

        <h2 className="font-display mt-12 text-2xl font-bold tracking-tight">Setup</h2>
        <ol className="mt-2">
          <Step n={1} title="Get your API key from Follow Up Boss">
            In Follow Up Boss: <span className="font-medium">Admin → API</span> → create an API key
            and copy it. Any paid FUB plan includes API access.
          </Step>
          <Step n={2} title="Connect it in Freehold">
            In Freehold: <span className="font-medium">Integrations → Follow Up Boss</span>, paste
            the key, and hit "Verify &amp; connect". We test the key against your FUB account before
            saving anything; it's stored encrypted and never shown again.
          </Step>
          <Step n={3} title="Import your people (optional)">
            Click "Import contacts now" on the same card. People with an email address land in your
            Contacts under the "Follow Up Boss" category; existing contacts are left alone.
          </Step>
          <Step n={4} title="Turn on your website">
            If your{" "}
            <Link href="/features" className="text-brand-700 underline hover:text-brand-600">
              tenant website
            </Link>{" "}
            is published with registration enabled, every new lead now lands in both places:
            Freehold (contact + same-day follow-up task) and Follow Up Boss (through your
            automations).
          </Step>
        </ol>

        <p className="mt-8 text-xs text-stone-400">
          Want deeper sync: transaction milestones as FUB notes, stage changes both directions? Tell
          us at{" "}
          <a href="mailto:hello@freeholdtc.dev" className="underline">
            hello@freeholdtc.dev
          </a>
          . Requests usually ship in days. Deeper automation is also available today through{" "}
          <Link href="/docs/zapier" className="text-brand-700 underline hover:text-brand-600">
            Zapier
          </Link>
          , which has a full Follow Up Boss app.
        </p>
      </section>
      <MarketingFooter />
    </main>
  );
}

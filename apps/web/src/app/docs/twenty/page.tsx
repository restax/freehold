import Link from "next/link";
import { MarketingFooter, MarketingNav } from "@/components/marketing";

export const metadata = {
  alternates: { canonical: "/docs/twenty" },
  title: "Twenty CRM | Freehold docs",
  description:
    "Connect Twenty, the open-source CRM, to Freehold: website leads land in Twenty as people, and your Twenty people import into Freehold contacts.",
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

export default function TwentyDocsPage() {
  return (
    <main className="bg-stone-50 text-stone-900">
      <MarketingNav />
      <section className="mx-auto max-w-3xl px-4 pb-20 pt-12 sm:px-6">
        <h1 className="font-display text-4xl font-bold leading-[1.1] tracking-tight">
          Freehold + Twenty CRM
        </h1>
        <p className="mt-4 leading-relaxed text-stone-600">
          Twenty is the open-source CRM, a natural neighbor for a source-available TC platform. If
          your team runs its sales pipeline there, this connection keeps both systems fed with no
          double entry, using a plain API key. No OAuth, no approvals, works with Twenty's cloud or
          your own self-hosted instance.
        </p>

        <div className="mt-8 rounded-xl border border-stone-200/70 bg-white p-6">
          <h2 className="font-display text-xl font-bold tracking-tight">What it does</h2>
          <p className="mt-2 text-sm leading-relaxed text-stone-600">
            <strong>Leads out:</strong> when someone registers on your Freehold website, they're
            created as a person in Twenty (name, email, phone), ready for your pipeline.
            <br />
            <strong>People in:</strong> one click imports your Twenty people into Freehold contacts
            (tagged "Twenty CRM"). Imports match on email and never duplicate or overwrite. Re-run
            any time.
          </p>
        </div>

        <h2 className="font-display mt-12 text-2xl font-bold tracking-tight">Setup</h2>
        <ol className="mt-2">
          <Step n={1} title="Create an API key in Twenty">
            In Twenty: <span className="font-medium">Settings → API &amp; Webhooks</span> → create
            an API key and copy it.
          </Step>
          <Step n={2} title="Connect it in Freehold">
            In Freehold: <span className="font-medium">Integrations → Twenty CRM</span>. Enter your
            Twenty URL (<code className="font-mono text-xs">https://api.twenty.com</code> for
            Twenty's cloud, or your self-hosted address) and the API key. We verify the connection
            against your instance before saving; the key is stored encrypted.
          </Step>
          <Step n={3} title="Import your people (optional)">
            Click "Import contacts now" on the card. People with an email land in Contacts under the
            "Twenty CRM" category; existing contacts are left alone.
          </Step>
          <Step n={4} title="Turn on your website">
            With your{" "}
            <Link href="/features" className="text-brand-700 underline hover:text-brand-600">
              tenant website
            </Link>{" "}
            published and registration enabled, every lead lands in both places: Freehold (contact +
            same-day follow-up task) and Twenty (as a new person).
          </Step>
        </ol>

        <p className="mt-8 text-xs text-stone-400">
          Want deeper sync: deals, notes, stage changes both directions? Tell us at{" "}
          <a href="mailto:hello@freeholdtc.dev" className="underline">
            hello@freeholdtc.dev
          </a>
          . Requests usually ship in days.{" "}
          <Link href="/docs/zapier" className="text-brand-700 underline hover:text-brand-600">
            Zapier
          </Link>{" "}
          is another path for custom automation.
        </p>
      </section>
      <MarketingFooter />
    </main>
  );
}

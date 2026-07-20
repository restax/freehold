import Link from "next/link";
import { MarketingFooter, MarketingNav } from "@/components/marketing";

export const metadata = {
  title: "Integrations | Freehold",
  description:
    "Everything Freehold connects to: e-signature, email, CRMs, legacy TC platforms, payments, and automation. Live integrations and the ones on the way.",
};

type Integration = [name: string, mono: string, description: string];

const LIVE: Integration[] = [
  [
    "Email & reply capture",
    "@",
    "Send transactional email from your workspace's own address — and when anyone replies, it lands right back on the transaction, threaded. No mailbox setup, ever.",
  ],
  [
    "Documenso",
    "Do",
    "Open-source e-signature, bundled with Freehold — no vendor contract, no per-envelope tax. Send documents for signature without leaving the file.",
  ],
  [
    "Claude AI",
    "AI",
    "Reads contracts with page-cited extraction, powers the site assistant, and ships as a Claude skill so you can ask about your own deals from Claude.",
  ],
  [
    "S3-compatible storage",
    "S3",
    "Keep documents on any S3-compatible service you choose, or the bundled default when self-hosting.",
  ],
  [
    "Calendar feeds (ICS)",
    "Ca",
    "Every client and agent portal has a subscribe-once calendar feed — deadlines land in Google, Outlook, or Apple Calendar and stay current.",
  ],
  [
    "Freehold API",
    "{}",
    "REST API with signed webhooks: read and write transactions, contacts, tasks, clients, and your account — plus a ready-made Claude skill.",
  ],
  [
    "Follow Up Boss",
    "FB",
    "Working today: connect with your API key — website leads flow straight into your Follow Up Boss automations, and your people import into Freehold contacts.",
  ],
  [
    "Twenty CRM",
    "Tw",
    "Working today: connect your Twenty instance with an API key — website leads land in Twenty as people, and your people import into Freehold contacts.",
  ],
  [
    "Zapier",
    "Z",
    "Working today: instant triggers (new transaction, document uploaded, envelope completed, website leads) and actions into 7,000+ apps — including DocuSign and Dotloop through your own accounts.",
  ],
  [
    "Stripe",
    "St",
    "Powers Freehold Cloud subscriptions — that's the whole job. Client invoicing never touches a payment processor: it's a document and a follow-up task, not a charge.",
  ],
  [
    "ERPNext",
    "Er",
    "Working today: connect your own ERPNext (Frappe) instance and Freehold creates the Sales Invoice there instead of just in Freehold — your ERP stays the ledger, and paid status mirrors back automatically.",
  ],
  [
    "FindTCPros directory",
    "Fp",
    "Working today: the coordinator directory pulls in FindTCPros's public listings alongside Freehold-enabled workspaces, so one search covers both — filtered by state, specialty, and software.",
  ],
];

const COMING: Integration[] = [
  [
    "SkySlope",
    "Sk",
    "Bring sales and listings across with contacts and documents, with multiple profiles supported.",
  ],
  [
    "Brokermint",
    "Bm",
    "Import and export transaction details, contacts, and documents from Brokermint accounts.",
  ],
  [
    "JotForm",
    "JF",
    "Turn a submitted intake form into a new transaction with its details, contacts, and documents.",
  ],
  [
    "ShowingTime and Supra",
    "Sh",
    "Auto-import showings and feedback so sellers see activity without you retyping it.",
  ],
  [
    "Mailchimp and SendGrid",
    "M",
    "Send bulk campaigns to your database through the email tools you already use.",
  ],
];

function IntegrationCard({ item }: { item: Integration }) {
  const [name, mono, description] = item;
  return (
    <div className="flex gap-4 rounded-2xl border border-stone-200/70 bg-white p-5">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-stone-100 font-display text-base font-bold text-stone-700">
        {mono}
      </span>
      <div>
        <h3 className="font-display font-bold">{name}</h3>
        <p className="mt-1 text-sm leading-relaxed text-stone-600">{description}</p>
      </div>
    </div>
  );
}

export default function IntegrationsPage() {
  return (
    <main className="bg-stone-50 text-stone-900">
      <MarketingNav />

      <section className="mx-auto max-w-6xl px-4 pb-20 pt-12 sm:px-6 lg:pt-16">
        <h1 className="font-display max-w-2xl text-4xl font-extrabold leading-[1.1] tracking-tight md:text-5xl">
          Connected to the tools you already use.
        </h1>
        <p className="mt-5 max-w-xl leading-relaxed text-stone-600">
          Freehold is the system of record; everything else plugs in. Here's what's connected today
          and what's on the way, in the order working TCs ask for it.
        </p>

        <h2 className="font-display mt-12 text-2xl font-bold tracking-tight">Working today</h2>
        <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {LIVE.map((item) => (
            <IntegrationCard key={item[0]} item={item} />
          ))}
        </div>

        <h2 className="font-display mt-12 text-2xl font-bold tracking-tight">On the way</h2>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-stone-600">
          Every integration below is committed. The order they ship in is decided by the people who
          need them, so if one of these is the reason you can't switch yet, say so and it moves up.
        </p>
        <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {COMING.map((item) => (
            <IntegrationCard key={item[0]} item={item} />
          ))}
        </div>

        <div className="mt-14 rounded-2xl border border-brand-600/15 bg-brand-50/60 px-6 py-5">
          <p className="font-display font-bold">Need one of these first?</p>
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-stone-600">
            Tell us which integration is blocking your switch and we'll prioritize it. Email{" "}
            <a
              href="mailto:hello@freeholdtc.dev"
              className="font-medium text-brand-700 hover:text-brand-600"
            >
              hello@freeholdtc.dev
            </a>{" "}
            or ask on{" "}
            <a
              href="https://github.com/restax/freehold"
              className="font-medium text-brand-700 hover:text-brand-600"
            >
              GitHub
            </a>
            . In the meantime, our migration service moves your full book of business from the
            legacy platforms by hand.
          </p>
        </div>

        <div className="mt-10">
          <Link
            href="/signup"
            className="rounded-full bg-brand-600 px-5 py-2.5 font-medium text-white shadow-xs transition hover:bg-brand-700 active:scale-[0.98]"
          >
            Start free
          </Link>
        </div>
      </section>

      <MarketingFooter />
    </main>
  );
}

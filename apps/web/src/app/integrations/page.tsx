import { prisma } from "@freehold/db";
import Link from "next/link";
import { MarketingFooter, MarketingNav } from "@/components/marketing";

export const metadata = {
  title: "Integrations | Freehold",
  description:
    "Everything Freehold connects to: e-signature, email, CRMs, legacy TC platforms, payments, and automation. Live integrations and the ones on the way.",
};

// Reads operator-uploaded logos from the DB on each request. Without this,
// a Vercel build can try to prerender the page and die on Prisma init (seen
// 2026-08-03) whenever build-time DB access hiccups.
export const dynamic = "force-dynamic";

// The optional 4th element is the key from lib/integration-catalog.ts, for
// the entries that also have a card on /dashboard/integrations — an
// operator-uploaded logo there shows here too. Entries with no catalog
// counterpart (Claude AI, Deepgram, the vendors this page lists but the
// dashboard doesn't) simply have nothing to look up, and keep their letters.
type Integration = [name: string, mono: string, description: string, key?: string];

const LIVE: Integration[] = [
  [
    "Email & reply capture",
    "@",
    "Send transactional email from your workspace's own address, and when anyone replies, it lands right back on the transaction, threaded. No mailbox setup, ever.",
    "email",
  ],
  [
    "OpenSign e-signatures",
    "OS",
    "Built into every plan: Freehold runs its own OpenSign instance, so there's no separate e-signature account to create, no vendor contract, and no per-envelope fee. The first document you send provisions your workspace automatically. Prefer your own Documenso or DocuSign account instead? Connect one from Settings any time.",
    "opensign",
  ],
  [
    "Claude AI & the Claude connector",
    "AI",
    "Reads contracts with page-cited extraction, powers the site assistant, and answers your spoken questions in voice search. Connect Freehold to Claude Desktop or Claude Code as an MCP connector and ask about your pipeline, deadlines, and contacts. With write access turned on, it can also create tasks, log notes, and update transaction status straight from Claude.",
  ],
  [
    "ElevenLabs & LiveKit",
    "Vo",
    "Voice search speaks its answers with ElevenLabs over a LiveKit realtime session: natural back-and-forth, interruptible, on every dashboard page and every client portal.",
  ],
  [
    "Deepgram",
    "Dg",
    "Speech recognition behind both voice search and the Dictate button: streaming transcription with punctuation, so talking is as precise as typing.",
  ],
  [
    "S3-compatible storage",
    "S3",
    "Keep documents on any S3-compatible service you choose, or the bundled default when self-hosting.",
    "storage",
  ],
  [
    "Calendar feeds (ICS)",
    "Ca",
    "Every client and agent portal, and every person on your team, has a subscribe-once calendar feed: deadlines land in Google, Outlook, or Apple Calendar and stay current.",
    "calendar",
  ],
  [
    "Freehold API",
    "{}",
    "REST API with signed webhooks: read and write transactions, contacts, tasks, clients, and your account, plus a ready-made Claude skill.",
    "api",
  ],
  [
    "Follow Up Boss",
    "FB",
    "Working today: connect with your API key. Website leads flow straight into your Follow Up Boss automations, and your people import into Freehold contacts.",
    "fub",
  ],
  [
    "Twenty CRM",
    "Tw",
    "Working today: connect your Twenty instance with an API key. Website leads land in Twenty as people, and your people import into Freehold contacts.",
    "twenty",
  ],
  [
    "Zapier",
    "Z",
    "Working today: instant triggers (new transaction, document uploaded, envelope completed, website leads) and actions into 7,000+ apps, including DocuSign and Dotloop through your own accounts.",
    "zapier",
  ],
  [
    "Stripe",
    "St",
    "Powers Freehold Cloud subscriptions. That's the whole job. Client invoicing never touches a payment processor: it's a document and a follow-up task, not a charge.",
    "stripe",
  ],
  [
    "ERPNext",
    "Er",
    "Working today: connect your own ERPNext (Frappe) instance and Freehold creates the Sales Invoice there instead of just in Freehold. Your ERP stays the ledger, and paid status mirrors back automatically.",
    "erpnext",
  ],
  [
    "FindTCPros directory",
    "Fp",
    "Working today: the coordinator directory pulls in FindTCPros's public listings alongside Freehold-enabled workspaces, so one search covers both, filtered by state, specialty, and software.",
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

function IntegrationCard({ item, logo }: { item: Integration; logo?: string | null }) {
  const [name, mono, description] = item;
  return (
    <div className="flex gap-4 rounded-xl border border-stone-200/70 bg-white p-5">
      {logo ? (
        // biome-ignore lint/performance/noImgElement: an operator-uploaded data URL, not a bundled asset next/image can size.
        <img
          src={logo}
          alt=""
          className="h-11 w-11 shrink-0 rounded-xl border border-stone-200 object-contain p-1"
        />
      ) : (
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-stone-100 font-display text-base font-bold text-stone-700">
          {mono}
        </span>
      )}
      <div>
        <h3 className="font-display font-bold">{name}</h3>
        <p className="mt-1 text-sm leading-relaxed text-stone-600">{description}</p>
      </div>
    </div>
  );
}

export default async function IntegrationsPage() {
  // Same operator-uploaded logos as /dashboard/integrations — see
  // lib/integration-catalog.ts for how the two pages share keys. Entries here
  // with no dashboard counterpart (Claude AI, Deepgram, the vendors this page
  // lists that the dashboard doesn't) have no key and just keep their letters.
  const branding = new Map(
    (await prisma.integrationBranding.findMany()).map((b) => [b.key, b.logo]),
  );

  return (
    <main className="bg-stone-50 text-stone-900">
      <MarketingNav />

      <section className="mx-auto max-w-6xl px-4 pb-20 pt-12 sm:px-6 lg:pt-16">
        <h1 className="font-display max-w-2xl text-3xl font-bold leading-[1.1] tracking-tight md:text-4xl">
          Connected to the tools you already use.
        </h1>
        <p className="mt-5 max-w-xl leading-relaxed text-stone-600">
          Freehold is the system of record; everything else plugs in. Here's what's connected today
          and what's on the way, in the order working TCs ask for it.
        </p>

        <h2 className="font-display mt-12 text-2xl font-bold tracking-tight">Working today</h2>
        <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {LIVE.map((item) => (
            <IntegrationCard
              key={item[0]}
              item={item}
              logo={item[3] ? branding.get(item[3]) : null}
            />
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

        <div className="mt-14 rounded-xl border border-brand-600/15 bg-brand-50/60 px-6 py-5">
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
            className="rounded-lg bg-brand-600 px-5 py-2.5 font-medium text-white shadow-xs transition hover:bg-brand-700 active:scale-[0.98]"
          >
            Start free
          </Link>
        </div>
      </section>

      <MarketingFooter />
    </main>
  );
}

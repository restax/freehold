import {
  AddressBook,
  BuildingOffice,
  ChartLineUp,
  FileText,
  ListChecks,
  LockKey,
  Signature,
  UsersThree,
} from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Badge } from "@/components/badges";
import { getSession } from "@/lib/session";

export const metadata = {
  title: "Freehold: the most complete TC system in the world",
  description:
    "Every deal, every deadline, one place. AI reads the contract and builds the file. Open source, free to self-host, easy on Freehold Cloud.",
};

const CTA_PRIMARY = "Start free";

/*
 * Marketing landing page. The extraction preview renders the app's real
 * badge components with values from a real verified extraction of the
 * bundled sample contract; nothing here is a faked screenshot.
 */

function ExtractionReviewCard() {
  const rows: Array<[string, string, string, "HIGH" | "MEDIUM"]> = [
    ["Purchase price", "$385,000", "cited p. 1, §2(a)", "HIGH"],
    ["Effective date", "Jul 15, 2026", "cited p. 1, §1", "HIGH"],
    ["Inspection deadline", "Jul 25, 2026", "cited p. 3, §7(b)", "MEDIUM"],
    ["Financing deadline", "Aug 4, 2026", "cited p. 5, §8(a)", "HIGH"],
    ["Closing date", "Aug 14, 2026", "cited p. 9, §14", "HIGH"],
  ];
  const tone = { HIGH: "success", MEDIUM: "progress" } as const;
  return (
    <div className="w-full max-w-md rounded-xl border border-stone-200/70 bg-white p-5 shadow-[0_1px_2px_rgb(41_37_36/0.06),0_12px_32px_rgb(41_37_36/0.1)]">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium">Review extraction</p>
        <span className="font-mono text-xs text-stone-400">purchase-contract.pdf</span>
      </div>
      <ul className="mt-3 flex flex-col">
        {rows.map(([label, value, cite, conf]) => (
          <li
            key={label}
            className="flex flex-wrap items-center gap-x-3 gap-y-0.5 border-b border-stone-100 py-2 last:border-0"
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium leading-tight">{label}</p>
              <p className="text-xs text-stone-400">{cite}</p>
            </div>
            <span className="text-sm tabular-nums">{value}</span>
            <Badge tone={tone[conf]}>{conf.toLowerCase()}</Badge>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex items-center justify-between gap-3 border-t border-stone-100 pt-3">
        <span className="text-xs text-stone-500">4 confirmed, 1 flagged for review</span>
        <span className="rounded-lg bg-brand-700 px-3 py-1.5 text-xs font-medium text-white">
          Apply to transaction
        </span>
      </div>
    </div>
  );
}

const BENTO = [
  {
    icon: AddressBook,
    title: "CRM built in",
    body: "Contacts, clients, and every party on the deal. Agents, lenders, and title stay living records, not lines in a spreadsheet.",
    cls: "border border-stone-200/70 bg-white",
  },
  {
    icon: UsersThree,
    title: "Branded client portals",
    body: "Link-based portals where agents and sellers see checklist progress, parties, and documents. You choose what to share, revocable any time.",
    cls: "border border-brand-600/20 bg-brand-50/70",
  },
  {
    icon: LockKey,
    title: "Credential vault",
    body: "MLS and lender logins stored envelope-encrypted, revealed on click, with every reveal written to the vault's audit log.",
    cls: "border border-stone-200/70 bg-white",
  },
  {
    icon: FileText,
    title: "Documents and merge templates",
    body: "Store every document on the file, and generate new ones from merge-field templates. Transaction data flows straight into a finished PDF.",
    cls: "border border-stone-200/70 bg-white sm:col-span-2",
  },
  {
    icon: Signature,
    title: "E-sign, your client's way",
    body: "Documenso built in, DocuSign supported, manual signing when you need it. Chosen per client behind one envelope interface.",
    cls: "border border-stone-200/70 bg-white",
  },
  {
    icon: ChartLineUp,
    title: "Pipeline dashboards",
    body: "See every open file, its stage, and what's due next at a glance. Nothing hides in an inbox.",
    cls: "border border-stone-200/70 bg-white",
  },
  {
    icon: BuildingOffice,
    title: "Built for teams",
    body: "Owners, admins, TCs, and assistants with role-based permissions. Invite by link. Destructive actions stay gated to the people you trust.",
    cls: "border border-stone-200/70 bg-white sm:col-span-2",
  },
];

const FAQ: Array<[string, string]> = [
  [
    "How can all of this be free?",
    "Freehold is an open-source project: the full product's code is public under the Apache-2.0 license, so self-hosting it costs nothing and always will. Freehold Cloud, the hosted version, has a real free tier (2 users, 10 active transactions) funded by the paid plans of teams that grow. We make money when you upgrade because you want to, not because your data is trapped.",
  ],
  [
    "What happens when I hit the free limits?",
    "Nothing scary. Everything you've entered stays readable and exportable forever. You just can't create an 11th active transaction until you close one out, upgrade, or move to your own server. Upgrading is a choice, never a ransom.",
  ],
  [
    "Do I need to be technical?",
    "No. Freehold Cloud is a website: sign up, upload a contract, work. Servers, backups, updates, and the AI are our job. Self-hosting is the option for brokerages with IT staff, and you can ignore it entirely.",
  ],
  [
    "Can I trust the AI with contracts?",
    "The AI never gets the last word. Every extracted value shows the page and clause it came from, low-confidence values arrive unchecked, and nothing touches your file until you approve it. Your documents are never used to train AI models.",
  ],
  [
    "Where does my data live, and can I leave?",
    "On Cloud, in Freehold's database, exportable by you at any time with no contracts. Self-hosted, it never leaves your own server. Either way the software is open source, so leaving is always real, which keeps us honest.",
  ],
  [
    "What does switching from my current system look like?",
    "Most TCs run their in-flight files to closing in the old system and open new files in Freehold, so nothing gets disrupted mid-deal. Start with one file; the first ten are free. Importers for the big legacy platforms are on our roadmap.",
  ],
];

export default async function LandingPage() {
  const session = await getSession();
  if (session) redirect("/dashboard");

  return (
    <main className="bg-stone-50 text-stone-900">
      {/* Nav */}
      <header className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <span className="font-serif text-xl font-semibold tracking-tight text-brand-700">
          Freehold
        </span>
        <nav className="flex items-center gap-5 text-sm">
          <a
            href="#features"
            className="hidden text-stone-600 transition-colors hover:text-stone-900 sm:block"
          >
            Features
          </a>
          <a
            href="#pricing"
            className="hidden text-stone-600 transition-colors hover:text-stone-900 sm:block"
          >
            Pricing
          </a>
          <Link
            href="/compare"
            className="hidden text-stone-600 transition-colors hover:text-stone-900 md:block"
          >
            Open source
          </Link>
          <Link href="/login" className="text-stone-600 transition-colors hover:text-stone-900">
            Log in
          </Link>
          <Link
            href="/signup"
            className="rounded-lg bg-brand-700 px-3.5 py-1.5 font-medium text-white shadow-xs transition hover:bg-brand-600 active:scale-[0.98]"
          >
            {CTA_PRIMARY}
          </Link>
        </nav>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="absolute inset-0 bg-[radial-gradient(60%_50%_at_25%_20%,#ecf7f2_0%,transparent_70%)]"
        />
        <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 pb-12 pt-14 sm:px-6 lg:grid-cols-[6fr_5fr] lg:gap-14 lg:pb-16 lg:pt-20">
          <div>
            <h1 className="max-w-xl text-4xl font-semibold tracking-tight md:text-5xl">
              Every deal, every deadline, one place.
            </h1>
            <p className="mt-4 max-w-lg text-lg leading-relaxed text-stone-600">
              The most complete TC system in the world. AI reads the contract and builds the file.
              Open source, free to self-host, effortless on Cloud.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link
                href="/signup"
                className="rounded-lg bg-brand-700 px-5 py-2.5 font-medium text-white shadow-xs transition hover:bg-brand-600 active:scale-[0.98]"
              >
                {CTA_PRIMARY}
              </Link>
              <Link
                href="/compare"
                className="rounded-lg border border-stone-300 bg-white px-5 py-2.5 font-medium text-stone-700 shadow-xs transition hover:border-stone-400 hover:bg-stone-50 active:scale-[0.98]"
              >
                Self-host it
              </Link>
            </div>
          </div>
          <div className="justify-self-center lg:justify-self-end">
            <ExtractionReviewCard />
          </div>
        </div>
        <div className="relative border-t border-stone-200/70 bg-white/60">
          <div className="mx-auto grid max-w-6xl gap-4 px-4 py-5 text-sm text-stone-600 sm:grid-cols-3 sm:px-6">
            <p>No data entry. AI reads the contract and builds the file, every field page-cited.</p>
            <p>Apache-2.0 licensed. The whole product, not a crippled core.</p>
            <p>Every credential reveal lands in the vault's audit log.</p>
          </div>
        </div>
      </section>

      {/* AI contract extraction */}
      <section id="extraction" className="border-b border-stone-200/70 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-24">
          <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
            No data entry. None.
          </h2>
          <p className="mt-3 max-w-2xl leading-relaxed text-stone-600">
            Upload a purchase contract and the AI extracts the parties, price, deposits, and every
            deadline-bearing date. It even computes the relative ones, like &quot;ten days from the
            Effective Date,&quot; onto the calendar. Every field carries a page citation and a
            confidence level, and nothing enters the record until a human confirms it.
          </p>
          <div className="mt-10 grid gap-8 md:grid-cols-3">
            <div className="border-l-2 border-brand-600/50 pl-4">
              <h3 className="font-medium">Upload</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-stone-600">
                Drop in the signed PDF. That's the last time you type anything the contract already
                says.
              </p>
            </div>
            <div className="border-l-2 border-brand-600/50 pl-4">
              <h3 className="font-medium">Review with citations</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-stone-600">
                Each extracted field shows the exact page and clause it came from. Low-confidence
                fields are flagged, never silently filled.
              </p>
            </div>
            <div className="border-l-2 border-brand-600/50 pl-4">
              <h3 className="font-medium">Apply to the file</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-stone-600">
                Confirmed dates populate the transaction and create every dated deadline task in
                your action plan. The system does the chasing from there.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Feature bento */}
      <section id="features" className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-24">
        <h2 className="max-w-2xl text-3xl font-semibold tracking-tight md:text-4xl">
          <span className="bg-brand-100 box-decoration-clone px-1">
            Everything a transaction coordinator runs in a day.
          </span>
        </h2>
        <p className="mt-4 max-w-xl leading-relaxed text-stone-600">
          Tasks, contacts, documents, signatures, and dates in one system, not scattered across
          spreadsheets, inboxes, and PDFs.
        </p>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-xl bg-brand-700 p-6 text-white sm:col-span-2">
            <ListChecks size={26} weight="regular" aria-hidden className="text-brand-100" />
            <h3 className="mt-3 font-medium">Transactions and action plans</h3>
            <p className="mt-1.5 max-w-lg text-sm leading-relaxed text-brand-50/90">
              Unlimited transactions with custom fields, documents, and parties. Apply a checklist
              template and every deadline task is dated from the contract automatically. Set it
              once, run it on every file.
            </p>
          </div>
          <div className="flex flex-col justify-center rounded-xl border border-brand-600/15 bg-gradient-to-br from-brand-50 to-white p-6">
            <p className="text-xs font-medium uppercase tracking-widest text-brand-700">
              Acme Realty Group
            </p>
            <p className="mt-1 font-serif text-lg font-semibold tracking-tight">412 Maple Avenue</p>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-stone-200/70">
              <div className="h-full w-[40%] rounded-full bg-brand-600" />
            </div>
            <p className="mt-1 text-xs tabular-nums text-stone-500">4 of 10 steps done</p>
            <ul className="mt-2 flex flex-col text-sm text-stone-600">
              <li className="border-b border-stone-200/60 py-1 text-stone-400 line-through">
                Earnest money deposited
              </li>
              <li className="border-b border-stone-200/60 py-1">Home inspection</li>
              <li className="py-1">Clear to close</li>
            </ul>
          </div>
          {BENTO.map(({ icon: Icon, title, body, cls }) => (
            <div key={title} className={`rounded-xl p-6 ${cls}`}>
              <Icon size={26} weight="regular" aria-hidden className="text-brand-700" />
              <h3 className="mt-3 font-medium">{title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-stone-600">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Keep the workflow. Drop the invoice. */}
      <section className="border-y border-stone-200/70 bg-white">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:py-24">
          <div className="flex items-center justify-center rounded-xl border border-stone-200/70 bg-[radial-gradient(70%_70%_at_30%_20%,#ecf7f2_0%,#f5f5f4_100%)] p-8">
            <div className="w-full max-w-sm rounded-xl border border-stone-200/70 bg-white p-5 shadow-[0_1px_2px_rgb(41_37_36/0.06),0_12px_32px_rgb(41_37_36/0.1)]">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium">412 Maple Avenue</p>
                  <p className="text-sm text-stone-500">Buy side · $385,000</p>
                </div>
                <Badge tone="progress">Under contract</Badge>
              </div>
              <ul className="mt-4 flex flex-col text-sm">
                {[
                  ["Jul 20", "Earnest money deposit due"],
                  ["Jul 25", "Inspection notice deadline"],
                  ["Aug 4", "Financing contingency deadline"],
                  ["Aug 14", "Closing"],
                ].map(([date, title]) => (
                  <li
                    key={title}
                    className="flex items-center gap-3 border-b border-stone-100 py-1.5 last:border-0"
                  >
                    <span className="h-4 w-4 shrink-0 rounded border border-stone-300" />
                    <span className="w-12 shrink-0 whitespace-nowrap tabular-nums text-stone-500">
                      {date}
                    </span>
                    <span>{title}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div>
            <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
              Keep the workflow. Drop the invoice.
            </h2>
            <p className="mt-3 max-w-md leading-relaxed text-stone-600">
              Legacy TC platforms run $99 or more a month and make leaving painful. Freehold starts
              free, and your data stays readable and exportable forever, on any plan.
            </p>
            <dl className="mt-7 grid grid-cols-3 gap-4">
              <div>
                <dt className="sr-only">Self-hosted price</dt>
                <dd className="font-serif text-4xl font-semibold tabular-nums text-brand-700">
                  $0
                </dd>
                <p className="mt-1 text-xs leading-snug text-stone-500">Self-hosted, forever</p>
              </div>
              <div>
                <dt className="sr-only">Cloud Pro price</dt>
                <dd className="font-serif text-4xl font-semibold tabular-nums text-brand-700">
                  $29
                </dd>
                <p className="mt-1 text-xs leading-snug text-stone-500">
                  Cloud Pro, per user monthly
                </p>
              </div>
              <div>
                <dt className="sr-only">Free transactions</dt>
                <dd className="font-serif text-4xl font-semibold tabular-nums text-brand-700">
                  10
                </dd>
                <p className="mt-1 text-xs leading-snug text-stone-500">
                  Free transactions a month on Cloud
                </p>
              </div>
            </dl>
            <a
              href="#pricing"
              className="mt-7 inline-block font-medium text-brand-700 underline decoration-brand-600/40 underline-offset-4 transition-colors hover:text-brand-600"
            >
              View pricing
            </a>
          </div>
        </div>
      </section>

      {/* Built for the people who run closings (dark color-block section) */}
      <section className="relative overflow-hidden bg-stone-900">
        <div
          aria-hidden
          className="absolute inset-0 bg-[radial-gradient(70%_100%_at_80%_0%,#094536_0%,transparent_60%)]"
        />
        <div className="relative mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-28">
          <h2 className="max-w-md text-3xl font-semibold tracking-tight text-white md:text-4xl">
            Built for the people who run closings.
          </h2>
          <div className="mt-8 flex max-w-xl flex-col divide-y divide-white/15">
            <div className="py-4">
              <h3 className="font-medium text-white">Transaction coordinators</h3>
              <p className="mt-1 text-sm leading-relaxed text-stone-200">
                Structured checklists, computed deadlines, and organized documents. Nothing slips,
                even at volume.
              </p>
            </div>
            <div className="py-4">
              <h3 className="font-medium text-white">Agents and teams</h3>
              <p className="mt-1 text-sm leading-relaxed text-stone-200">
                Your TC shares a portal link and you always know exactly where the deal stands.
              </p>
            </div>
            <div className="py-4">
              <h3 className="font-medium text-white">Brokerages and title companies</h3>
              <p className="mt-1 text-sm leading-relaxed text-stone-200">
                One structured back office, and your data is never held hostage.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Why TCs and brokerages switch */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-24">
        <h2 className="max-w-md text-3xl font-semibold tracking-tight md:text-4xl">
          Why TCs and brokerages switch
        </h2>
        <div className="mt-10 grid gap-x-12 gap-y-8 md:grid-cols-2">
          <div className="border-l-2 border-stone-200 pl-5">
            <h3 className="font-medium">AI that shows its work</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-stone-600">
              Extraction cites the page and clause for every field. A confirmation screen puts field
              and source side by side before anything is saved. Low confidence is flagged, never
              silently filled.
            </p>
          </div>
          <div className="border-l-2 border-stone-200 pl-5">
            <h3 className="font-medium">Open source is the exit clause</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-stone-600">
              The entire product is Apache-2.0. Leave Cloud any time and run the same software on
              your own server, with your own data. No caps, no license keys.
            </p>
          </div>
          <div className="border-l-2 border-stone-200 pl-5">
            <h3 className="font-medium">The system does the chasing</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-stone-600">
              Apply an action plan and every deadline becomes a dated, assigned task. You stop
              keeping the calendar in your head. The file keeps it for you.
            </p>
          </div>
          <div className="border-l-2 border-stone-200 pl-5">
            <h3 className="font-medium">Isolation you can prove</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-stone-600">
              Every workspace's data is walled off with Postgres row-level security, enforced by the
              database itself, not just the application code. Credentials are envelope-encrypted,
              never stored in plaintext.
            </p>
          </div>
        </div>
      </section>

      {/* Freehold Cloud sell */}
      <section className="border-t border-brand-600/15 bg-brand-50/50">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-24">
          <div className="max-w-2xl">
            <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
              Freehold Cloud handles the parts you never wanted to think about
            </h2>
            <p className="mt-3 max-w-xl leading-relaxed text-stone-600">
              Sign up, upload your first contract, and you're working. Everything below is our job,
              not yours.
            </p>
          </div>
          <div className="mt-10 grid gap-x-10 gap-y-8 sm:grid-cols-2">
            <div>
              <h3 className="font-medium">Working in minutes, not weekends</h3>
              <p className="mt-1.5 max-w-md text-sm leading-relaxed text-stone-600">
                No server, no setup, no IT person. Open a browser, sign up, and your first file is
                organized before lunch. Switching systems takes an afternoon, not a month.
              </p>
            </div>
            <div>
              <h3 className="font-medium">AI included, no surprise bills</h3>
              <p className="mt-1.5 max-w-md text-sm leading-relaxed text-stone-600">
                Contract reading is part of every plan, even Free. No API keys to buy, no usage
                meters to watch, no separate AI subscription. One price covers it.
              </p>
            </div>
            <div>
              <h3 className="font-medium">Updates and backups, automatic</h3>
              <p className="mt-1.5 max-w-md text-sm leading-relaxed text-stone-600">
                New features and AI improvements land on Cloud first, without you lifting a finger.
                Backups, security patches, and uptime are handled while you sleep.
              </p>
            </div>
            <div>
              <h3 className="font-medium">Never locked in</h3>
              <p className="mt-1.5 max-w-md text-sm leading-relaxed text-stone-600">
                Your data exports any time and there are no contracts. Because Freehold is open
                source, the escape hatch is real. We keep you by being good, not by holding your
                files.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="border-t border-stone-200/70 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-24">
          <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
            Keep more of every file fee
          </h2>
          <p className="mt-2 max-w-lg leading-relaxed text-stone-600">
            No per-file fees, no setup fees, no contracts. Start free and pay only when your
            business grows.
          </p>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <div className="flex flex-col rounded-xl border border-stone-200/70 bg-stone-50 p-6">
              <h3 className="font-medium">Free</h3>
              <p className="mt-1 font-serif text-4xl font-semibold tabular-nums">
                $0<span className="font-sans text-sm font-normal text-stone-500">/mo</span>
              </p>
              <ul className="mt-4 flex flex-col gap-1.5 text-sm text-stone-600">
                <li>10 active transactions</li>
                <li>2 team members</li>
                <li>AI contract reading included</li>
                <li>Portals, vault, e-sign, everything</li>
              </ul>
              <Link href="/signup" className="mt-auto pt-6">
                <span className="block rounded-lg border border-stone-300 bg-white px-4 py-2 text-center text-sm font-medium text-stone-700 shadow-xs transition hover:border-stone-400 hover:bg-stone-50 active:scale-[0.98]">
                  {CTA_PRIMARY}
                </span>
              </Link>
            </div>
            <div className="flex flex-col rounded-xl border border-brand-600/30 bg-white p-6 ring-1 ring-brand-600/15">
              <div className="flex items-baseline justify-between">
                <h3 className="font-medium">Pro</h3>
                <span className="text-xs font-medium uppercase tracking-wide text-brand-700">
                  Most popular
                </span>
              </div>
              <p className="mt-1 font-serif text-4xl font-semibold tabular-nums">
                $29<span className="font-sans text-sm font-normal text-stone-500">/user/mo</span>
              </p>
              <ul className="mt-4 flex flex-col gap-1.5 text-sm text-stone-600">
                <li>Unlimited transactions</li>
                <li>Seats you choose, change any time</li>
                <li>All integrations</li>
                <li>Cancel whenever, data exports free</li>
              </ul>
              <Link href="/signup" className="mt-auto pt-6">
                <span className="block rounded-lg bg-brand-700 px-4 py-2 text-center text-sm font-medium text-white shadow-xs transition hover:bg-brand-600 active:scale-[0.98]">
                  {CTA_PRIMARY}
                </span>
              </Link>
            </div>
            <div className="flex flex-col rounded-xl border border-stone-200/70 bg-stone-50 p-6">
              <h3 className="font-medium">Business</h3>
              <p className="mt-1 font-serif text-4xl font-semibold tabular-nums">
                $59<span className="font-sans text-sm font-normal text-stone-500">/user/mo</span>
              </p>
              <ul className="mt-4 flex flex-col gap-1.5 text-sm text-stone-600">
                <li>Everything in Pro</li>
                <li>Priority support</li>
                <li>Client sub-billing (coming)</li>
              </ul>
              <Link href="/signup" className="mt-auto pt-6">
                <span className="block rounded-lg border border-stone-300 bg-white px-4 py-2 text-center text-sm font-medium text-stone-700 shadow-xs transition hover:border-stone-400 hover:bg-stone-50 active:scale-[0.98]">
                  {CTA_PRIMARY}
                </span>
              </Link>
            </div>
          </div>
          <p className="mt-6 max-w-2xl text-sm leading-relaxed text-stone-500">
            Brokerage with an IT department? Freehold is open source and running it on your own
            server is free with no limits. For everyone else, Cloud is the easy button.{" "}
            <Link href="/compare" className="font-medium text-brand-700 hover:text-brand-600">
              See the honest comparison
            </Link>
            .
          </p>
        </div>
      </section>

      {/* For IT providers */}
      <section id="partners" className="border-t border-stone-200/70 bg-stone-50">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:py-24">
          <div>
            <p className="text-sm font-medium text-brand-700">For IT providers</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">
              Run Freehold for every brokerage you serve.
            </h2>
            <p className="mt-3 max-w-md leading-relaxed text-stone-600">
              Because Freehold is open source, you can host an isolated instance for each of your
              brokerage clients today, on your infrastructure, under your brand. A partner dashboard
              that manages fleets of instances, with per-client plans on one bill, is in
              development.
            </p>
            <a
              href="mailto:partners@freeholdtc.dev"
              className="mt-6 inline-block rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 shadow-xs transition hover:border-stone-400 hover:bg-stone-50 active:scale-[0.98]"
            >
              Get partner early access
            </a>
          </div>
          <div className="flex flex-col gap-4">
            <div className="rounded-xl border border-stone-200/70 bg-white p-5">
              <h3 className="text-sm font-medium">Isolated instances</h3>
              <p className="mt-1 text-sm leading-relaxed text-stone-600">
                Each client runs its own Freehold with fully separated data.
              </p>
            </div>
            <div className="rounded-xl border border-stone-200/70 bg-white p-5">
              <h3 className="text-sm font-medium">One command to stand up</h3>
              <p className="mt-1 text-sm leading-relaxed text-stone-600">
                Docker Compose brings up the database, storage, and app on any machine you manage.
              </p>
            </div>
            <div className="rounded-xl border border-stone-200/70 bg-white p-5">
              <h3 className="text-sm font-medium">Fleet tools in development</h3>
              <p className="mt-1 text-sm leading-relaxed text-stone-600">
                Provisioning, monitoring, and mixed per-client plans under one partner account are
                on the roadmap.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="border-t border-stone-200/70 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-24">
          <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">Fair questions</h2>
          <div className="mt-10 grid gap-x-12 gap-y-8 md:grid-cols-2">
            {FAQ.map(([q, a]) => (
              <div key={q}>
                <h3 className="font-medium">{q}</h3>
                <p className="mt-1.5 max-w-prose text-sm leading-relaxed text-stone-600">{a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Green CTA banner */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-20">
        <div className="rounded-3xl bg-[radial-gradient(80%_120%_at_50%_0%,#0f6b4f_0%,#094536_100%)] px-6 py-16 text-center sm:px-12">
          <h2 className="mx-auto max-w-2xl font-serif text-3xl font-semibold tracking-tight text-white md:text-4xl">
            Free for 2 users and 10 transactions a month. No card required.
          </h2>
          <p className="mx-auto mt-4 max-w-xl leading-relaxed text-brand-50/90">
            Hit a limit and your data stays readable and exportable forever. Upgrading is a choice,
            never a ransom.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/signup"
              className="rounded-lg bg-white px-5 py-2.5 font-medium text-brand-800 shadow-xs transition hover:bg-brand-50 active:scale-[0.98]"
            >
              {CTA_PRIMARY}
            </Link>
            <a
              href="#pricing"
              className="rounded-lg border border-white/30 px-5 py-2.5 font-medium text-white transition hover:border-white/60 hover:bg-white/10 active:scale-[0.98]"
            >
              View pricing
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-stone-200/70 bg-white">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[2fr_1fr_1fr_1fr]">
          <div>
            <span className="font-serif text-lg font-semibold text-brand-700">Freehold</span>
            <p className="mt-2 max-w-xs text-sm leading-relaxed text-stone-500">
              The open-source, all-in-one platform for real estate transaction management and CRM.
            </p>
          </div>
          <nav aria-label="Product">
            <h3 className="text-sm font-medium">Product</h3>
            <ul className="mt-3 flex flex-col gap-2 text-sm text-stone-500">
              <li>
                <a href="#features" className="transition-colors hover:text-stone-900">
                  Features
                </a>
              </li>
              <li>
                <a href="#extraction" className="transition-colors hover:text-stone-900">
                  Contract extraction
                </a>
              </li>
              <li>
                <a href="#pricing" className="transition-colors hover:text-stone-900">
                  Pricing
                </a>
              </li>
            </ul>
          </nav>
          <nav aria-label="Open source">
            <h3 className="text-sm font-medium">Open source</h3>
            <ul className="mt-3 flex flex-col gap-2 text-sm text-stone-500">
              <li>
                <a
                  href="https://github.com/restax/freehold"
                  className="transition-colors hover:text-stone-900"
                >
                  Self-hosting
                </a>
              </li>
              <li>
                <Link href="/compare" className="transition-colors hover:text-stone-900">
                  Cloud vs self-host
                </Link>
              </li>
              <li>
                <a
                  href="https://github.com/restax/freehold/blob/main/LICENSE"
                  className="transition-colors hover:text-stone-900"
                >
                  License
                </a>
              </li>
            </ul>
          </nav>
          <nav aria-label="For partners">
            <h3 className="text-sm font-medium">For partners</h3>
            <ul className="mt-3 flex flex-col gap-2 text-sm text-stone-500">
              <li>
                <a href="#partners" className="transition-colors hover:text-stone-900">
                  IT providers
                </a>
              </li>
              <li>
                <Link href="/signup" className="transition-colors hover:text-stone-900">
                  Create an account
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="transition-colors hover:text-stone-900">
                  Privacy
                </Link>
              </li>
              <li>
                <Link href="/terms" className="transition-colors hover:text-stone-900">
                  Terms
                </Link>
              </li>
            </ul>
          </nav>
        </div>
        <div className="border-t border-stone-100">
          <p className="mx-auto max-w-6xl px-4 py-5 text-center text-sm text-stone-400 sm:px-6">
            Freehold is open source under Apache-2.0. Self-hosting is free forever.
          </p>
        </div>
      </footer>
    </main>
  );
}

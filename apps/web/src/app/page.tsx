import {
  AddressBook,
  BuildingOffice,
  ChartLineUp,
  EnvelopeSimple,
  FileText,
  GitBranch,
  ListChecks,
  LockKey,
  ShieldCheck,
  Signature,
  Sparkle,
  UsersThree,
} from "@phosphor-icons/react/dist/ssr";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  CloudWordmark,
  ExtractionReviewCard,
  MarketingFooter,
  MarketingNav,
} from "@/components/marketing";
import { VoiceDemo } from "@/components/voice-demo";
import { getSession } from "@/lib/session";
import brokerageDusk from "../../public/marketing/brokerage-dusk.jpg";
import closingKeys from "../../public/marketing/closing-keys.jpg";
import movingDay from "../../public/marketing/moving-day.jpg";
import tcAtWork from "../../public/marketing/tc-at-work.jpg";

export const metadata = {
  title: "Freehold: the most complete TC system in the world",
  description:
    "Every deal, every deadline, one place. AI reads the contract and builds the file. Free to self-host, easy on Freehold Cloud.",
};

const CTA_PRIMARY = "Start free";

/*
 * Marketing landing page. The extraction preview mirrors the product's
 * review screen with illustrative sample values; it is a styled mock of
 * our own UI, not a screenshot of anyone else's.
 */

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
    body: "Open-source Documenso built in, manual signing when you need it, and an adapter layer ready for other providers. Chosen per client behind one envelope interface.",
    cls: "border border-stone-200/70 bg-white",
  },
  {
    icon: ChartLineUp,
    title: "Pipeline dashboards",
    body: "See every open file, its stage, and what's due next at a glance. Nothing hides in an inbox.",
    cls: "border border-stone-200/70 bg-white",
  },
  {
    icon: EnvelopeSimple,
    title: "Email that runs itself",
    body: "Branded emails from your own address, replies threading back onto the file. Templates tied to tasks, automated intro and closing notes, quiet hours, voice dictation.",
    cls: "border border-stone-200/70 bg-white",
  },
  {
    icon: BuildingOffice,
    title: "Built for teams",
    body: "Owners, admins, TCs, and assistants with role-based permissions. Invite by link. Destructive actions stay gated to the people you trust.",
    cls: "border border-stone-200/70 bg-white",
  },
];

const FAQ: Array<[string, string]> = [
  [
    "How can all of this be free?",
    "Freehold is source-available: the full product's code is public, and self-hosting it for your own organization costs nothing and always will. The license (Elastic License 2.0) forbids one thing — offering Freehold to others as a hosted service or under another brand. Freehold Cloud, the hosted version, has a real free tier (2 users, 5 active transactions) funded by the paid plans of teams that grow. We make money when you upgrade because you want to, not because your data is trapped.",
  ],
  [
    "What happens when I hit the free limits?",
    "Nothing scary. Everything you've entered stays readable and exportable forever. You just can't create a 6th active transaction until you close one out, upgrade, or move to your own server. Upgrading is a choice, never a ransom.",
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
    "On Cloud, in Freehold's database, exportable by you at any time with no contracts. Self-hosted, it never leaves your own server. Either way the full code is public and free to self-host, so leaving is always real, which keeps us honest.",
  ],
  [
    "What does switching from my current system look like?",
    "Most TCs run their in-flight files to closing in the old system and open new files in Freehold, so nothing gets disrupted mid-deal. Start with one file; the first ten are free. Importers for the big legacy platforms are on our roadmap.",
  ],
  [
    "Do you pay people to recommend Freehold?",
    "No, and we never will. Some TC platforms pay 20% recurring commissions to affiliates, which buys a lot of glowing recommendations in Facebook groups and never gets disclosed to you. That doesn't seem fair. Nobody earns a dime recommending Freehold, so when a TC vouches for us, the software earned it.",
  ],
];

export default async function LandingPage() {
  const session = await getSession();
  if (session) redirect("/dashboard");

  return (
    <main className="bg-stone-50 text-stone-900">
      <MarketingNav />

      {/* Hero */}
      <section className="relative overflow-hidden bg-[linear-gradient(165deg,#d7f8e4_0%,#ecfdf3_45%,#fafaf9_100%)]">
        <div
          aria-hidden
          className="absolute inset-0 bg-[radial-gradient(55%_60%_at_20%_10%,#c5f4d8_0%,transparent_70%)]"
        />
        <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 pb-16 pt-14 sm:px-6 lg:grid-cols-[6fr_6fr] lg:gap-14 lg:pb-24 lg:pt-24">
          <div>
            <h1 className="font-display max-w-xl text-5xl font-extrabold leading-[1.08] tracking-tight md:text-6xl">
              Every deal,
              <br />
              every deadline,
              <br />
              <span className="text-brand-600">one place.</span>
            </h1>
            <p className="mt-5 max-w-lg text-lg leading-relaxed text-stone-600">
              The most complete TC platform. AI reads the contract and builds the file. Source open,
              free to self-host.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link
                href="/signup"
                className="rounded-lg bg-brand-600 px-5 py-2.5 font-medium text-white shadow-xs transition hover:bg-brand-700 active:scale-[0.98]"
              >
                {CTA_PRIMARY}
              </Link>
              <Link
                href="/compare"
                className="rounded-lg border border-stone-300 bg-white px-5 py-2.5 font-medium text-stone-700 shadow-xs transition hover:border-stone-400 hover:bg-stone-50 active:scale-[0.98]"
              >
                Self-host it
              </Link>
              <a
                href="/demo"
                className="px-1 py-2.5 font-medium text-brand-700 transition hover:text-brand-600"
              >
                Explore the live demo &rarr;
              </a>
            </div>
          </div>
          <div className="justify-self-center lg:justify-self-end">
            <ExtractionReviewCard />
          </div>
        </div>
      </section>

      {/* Value strip */}
      <div className="border-y border-stone-200/70 bg-white">
        <div className="mx-auto grid max-w-6xl gap-5 px-4 py-6 text-sm text-stone-600 sm:grid-cols-3 sm:px-6">
          <p className="flex gap-3">
            <Sparkle size={20} aria-hidden className="mt-0.5 shrink-0 text-brand-600" />
            <span>
              No data entry. AI reads the contract and builds the file, every field page-cited.
            </span>
          </p>
          <p className="flex gap-3">
            <GitBranch size={20} aria-hidden className="mt-0.5 shrink-0 text-brand-600" />
            <span>The whole product's code is public, not a crippled core.</span>
          </p>
          <p className="flex gap-3">
            <ShieldCheck size={20} aria-hidden className="mt-0.5 shrink-0 text-brand-600" />
            <span>Every date, document, and credential reveal lands in the audit log.</span>
          </p>
        </div>
      </div>

      {/* Voice demo — hear the product rather than read about it */}
      <section className="border-b border-stone-200/70 bg-stone-50">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:gap-16">
          <div>
            <p className="text-sm font-medium text-brand-600">Try it right now</p>
            <h2 className="font-display mt-2 text-4xl font-extrabold tracking-tight md:text-5xl">
              Don't read the pitch. Ask it.
            </h2>
            <p className="mt-4 max-w-md leading-relaxed text-stone-600">
              Freehold has voice search built in — coordinators ask &ldquo;what's closing this
              week&rdquo; and hear the answer from their own files. This is that same voice, pointed
              at Freehold itself. Ask it anything, including what it can't do.
            </p>
          </div>
          <VoiceDemo />
        </div>
      </section>

      {/* AI contract extraction */}
      <section id="extraction" className="border-b border-stone-200/70 bg-white">
        <div className="mx-auto grid max-w-6xl gap-12 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:gap-16 lg:py-24">
          <div>
            <p className="text-sm font-medium text-brand-600">AI contract extraction</p>
            <h2 className="font-display mt-2 text-4xl font-extrabold tracking-tight md:text-5xl">
              No data entry. None.
            </h2>
            <p className="mt-4 max-w-xl leading-relaxed text-stone-600">
              Upload a purchase contract and Claude extracts the parties, price, deposits, and every
              deadline-bearing date. It even computes the relative ones, like &quot;ten days from
              the Effective Date,&quot; onto the calendar. Every field carries a page citation and a
              confidence level. Nothing enters the record until a human confirms it.
            </p>
          </div>
          <div className="flex flex-col gap-8">
            <div className="border-l-[3px] border-brand-600 pl-5">
              <h3 className="font-display text-lg font-bold">Upload</h3>
              <p className="mt-1.5 leading-relaxed text-stone-600">
                Drop in the signed PDF. That's the last time you type anything the contract already
                says.
              </p>
            </div>
            <div className="border-l-[3px] border-brand-600 pl-5">
              <h3 className="font-display text-lg font-bold">Review with citations</h3>
              <p className="mt-1.5 leading-relaxed text-stone-600">
                Each extracted field shows the exact page and clause it came from. Low-confidence
                fields are flagged, never silently filled.
              </p>
            </div>
            <div className="border-l-[3px] border-brand-600 pl-5">
              <h3 className="font-display text-lg font-bold">Apply to the file</h3>
              <p className="mt-1.5 leading-relaxed text-stone-600">
                Confirmed dates populate the transaction and create every dated deadline task in
                your action plan. The system does the chasing from there.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Feature bento */}
      <section id="features" className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-24">
        <h2 className="font-display max-w-2xl text-3xl font-extrabold leading-[1.15] tracking-tight md:text-4xl lg:text-5xl">
          Everything a transaction coordinator runs in a day.
        </h2>
        <p className="mt-4 max-w-xl leading-relaxed text-stone-600">
          Tasks, contacts, documents, signatures, and dates in one system, not scattered across
          spreadsheets, inboxes, and PDFs.
        </p>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-xl bg-brand-700 p-6 text-white sm:col-span-2">
            <ListChecks size={26} weight="regular" aria-hidden className="text-white/85" />
            <h3 className="mt-3 font-semibold">Transactions and action plans</h3>
            <p className="mt-1.5 max-w-lg text-sm leading-relaxed text-white/90">
              Unlimited transactions with custom fields, documents, and parties. Apply a checklist
              template and every deadline task is dated from the contract automatically. Set it
              once, run it on every file.
            </p>
          </div>
          <div className="relative min-h-44 overflow-hidden rounded-xl border border-stone-200/70">
            <Image
              src={closingKeys}
              alt="House keys resting on a signed closing document"
              fill
              sizes="(min-width: 1024px) 33vw, 100vw"
              className="object-cover"
            />
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
          <div className="relative aspect-[4/3] overflow-hidden rounded-xl border border-stone-200/70">
            <Image
              src={movingDay}
              alt="Moving boxes on the doorstep of a home with a green front door"
              fill
              sizes="(min-width: 1024px) 50vw, 100vw"
              className="object-cover"
            />
          </div>
          <div>
            <h2 className="font-display text-3xl font-bold tracking-tight md:text-4xl">
              Keep the workflow.
              <br />
              Drop the invoice.
            </h2>
            <p className="mt-3 max-w-md leading-relaxed text-stone-600">
              Legacy TC platforms run $99 or more a month and make leaving painful. Freehold starts
              free, and your data stays readable and exportable forever, on any plan.
            </p>
            <dl className="mt-7 grid grid-cols-3 gap-4">
              <div>
                <dt className="sr-only">Self-hosted price</dt>
                <dd className="font-display text-4xl font-bold tabular-nums text-brand-700">$0</dd>
                <p className="mt-1 text-xs leading-snug text-stone-500">Self-hosted, forever</p>
              </div>
              <div>
                <dt className="sr-only">Cloud Pro price</dt>
                <dd className="font-display text-4xl font-bold tabular-nums text-brand-700">$40</dd>
                <p className="mt-1 text-xs leading-snug text-stone-500">
                  Cloud Pro monthly, 2 users included
                </p>
              </div>
              <div>
                <dt className="sr-only">Free active transactions</dt>
                <dd className="font-display text-4xl font-bold tabular-nums text-brand-700">5</dd>
                <p className="mt-1 text-xs leading-snug text-stone-500">
                  Active transactions free on Cloud
                </p>
              </div>
            </dl>
            <a
              href="/pricing"
              className="mt-7 inline-block font-medium text-brand-700 underline decoration-brand-600/40 underline-offset-4 transition-colors hover:text-brand-600"
            >
              View pricing
            </a>
          </div>
        </div>
      </section>

      {/* Built for the people who run closings (dark photo section) */}
      <section className="relative overflow-hidden">
        <Image
          src={tcAtWork}
          alt="A transaction coordinator reviewing paperwork at a desk"
          fill
          sizes="100vw"
          className="object-cover"
        />
        <div aria-hidden className="absolute inset-0 bg-stone-900/60" />
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-r from-stone-900/80 via-stone-900/50 to-transparent"
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
        <h2 className="max-w-md font-display text-3xl font-bold tracking-tight md:text-4xl">
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
            <h3 className="font-medium">The code is the exit clause</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-stone-600">
              The entire product's code is public and free to self-host. Leave Cloud any time and
              run the same software on your own server, with your own data. No caps, no license
              keys.
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
              database itself, not just the application code. Documents and credentials are
              envelope-encrypted at the application layer — even direct database access yields
              ciphertext.
            </p>
          </div>
        </div>
      </section>

      {/* Your data stays yours */}
      <section className="border-y border-stone-200/70 bg-stone-50/70">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-24">
          <h2 className="max-w-xl font-display text-3xl font-bold tracking-tight md:text-4xl">
            Your data stays yours
          </h2>
          <p className="mt-3 max-w-2xl text-lg leading-relaxed text-stone-600">
            Real business data deserves real guardrails — and a way out that never depends on us.
          </p>
          <div className="mt-10 grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <h3 className="font-medium">Tied to your login</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-stone-600">
                Your workspace is reachable only through your authenticated account, with optional
                two-factor. One workspace can never see another's data — Postgres row-level security
                enforces it in the database itself.
              </p>
            </div>
            <div>
              <h3 className="font-medium">Encrypted, and never sold</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-stone-600">
                Documents and credentials are envelope-encrypted at rest. We use your data to run
                the service and nothing else — it's never sold or shared, and your documents are
                never used to train AI models.
              </p>
            </div>
            <div>
              <h3 className="font-medium">Your storage, your control</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-stone-600">
                Keep every document in a cloud bucket you own — S3, R2, Backblaze, Wasabi, or MinIO.
                Freehold reads and writes it, but the files live in your infrastructure, not ours.
              </p>
            </div>
            <div>
              <h3 className="font-medium">Yours to take, any time</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-stone-600">
                Download everything — records and documents — in one archive whenever you want, or
                get an automatic nightly copy delivered to your own storage. Every morning, a
                briefing of your active deals lands in your inbox — readable offline.
              </p>
            </div>
          </div>
          <p className="mt-10 max-w-3xl text-base leading-relaxed text-stone-500">
            Think of it as insurance you hope never to need. We plan for the worst case the way
            anyone sensible does — the open code, your own exports, and a briefing in your inbox
            each morning mean your business keeps running even if your connection drops, your
            storage fails, or Freehold itself goes away.
          </p>
        </div>
      </section>

      {/* Rotating hero: cheese (built to last) crossfades with then-vs-now (honest pricing) */}
      <section className="hero-crossfade relative min-h-[420px] overflow-hidden lg:min-h-[520px]">
        <div className="hero-slide absolute inset-0">
          <Image
            src="/marketing/parmesan.jpg"
            alt="Rows of Parmesan wheels aging on wooden shelves in a maturing room"
            fill
            sizes="100vw"
            className="object-cover"
          />
          <div
            aria-hidden
            className="absolute inset-0 bg-gradient-to-t from-stone-950/85 via-stone-950/30 to-transparent"
          />
          {/* Second scrim from the left: the headline sits over the busy half
              of these photos, and the vertical gradient alone isn't enough to
              keep white text legible against neon and clutter. */}
          <div
            aria-hidden
            className="absolute inset-0 bg-gradient-to-r from-stone-950/70 via-stone-950/20 to-transparent"
          />
          <div className="relative mx-auto flex min-h-[420px] max-w-6xl flex-col justify-end px-4 pb-14 pt-24 sm:px-6 lg:min-h-[520px] lg:pb-16">
            <h2 className="max-w-xl text-4xl font-semibold tracking-tight text-white md:text-5xl">
              Age cheese, <em className="italic">not</em> your software.
            </h2>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-stone-200">
              Most TC platforms were built a generation ago. Freehold ships every week — and you can
              read the code.
            </p>
            <p className="mt-5">
              <Link
                href="/features"
                className="text-sm font-medium text-white underline underline-offset-4 hover:text-brand-200"
              >
                See what's already shipped →
              </Link>
            </p>
          </div>
        </div>
        <div className="hero-slide absolute inset-0">
          <Image
            src="/marketing/then-vs-now.jpg"
            alt="Split image: a sprawling, empty tech office at dusk beside rows of glowing server racks on the left, one person working alone at a small desk in an apartment on the right"
            fill
            sizes="100vw"
            className="object-cover"
          />
          <div
            aria-hidden
            className="absolute inset-0 bg-gradient-to-t from-stone-950/85 via-stone-950/30 to-transparent"
          />
          {/* Second scrim from the left: the headline sits over the busy half
              of these photos, and the vertical gradient alone isn't enough to
              keep white text legible against neon and clutter. */}
          <div
            aria-hidden
            className="absolute inset-0 bg-gradient-to-r from-stone-950/70 via-stone-950/20 to-transparent"
          />
          <div className="relative mx-auto flex min-h-[420px] max-w-6xl flex-col justify-end px-4 pb-14 pt-24 sm:px-6 lg:min-h-[520px] lg:pb-16">
            <h2 className="max-w-xl text-4xl font-semibold tracking-tight text-white md:text-5xl">
              2006: a floor of engineers. <em className="italic">2026:</em> one guy and an API.
            </h2>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-stone-200">
              Software got cheaper to build. Most subscriptions never got cheaper to buy — ours
              does.
            </p>
            <p className="mt-5">
              <Link
                href="/pricing"
                className="text-sm font-medium text-white underline underline-offset-4 hover:text-brand-200"
              >
                See pricing →
              </Link>
            </p>
          </div>
        </div>
      </section>

      {/* Freehold Cloud sell */}
      <section className="border-t border-brand-600/15 bg-brand-50/50">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-24">
          <div className="max-w-2xl">
            <div className="mb-4">
              <CloudWordmark size="md" />
            </div>
            <h2 className="font-display text-3xl font-bold tracking-tight md:text-4xl">
              The parts you never wanted to think about, handled
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
                Your data exports any time and there are no contracts. Because Freehold is free to
                self-host, the escape hatch is real. We keep you by being good, not by holding your
                files.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* For IT providers */}
      <section id="partners" className="border-t border-stone-200/70 bg-stone-50">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:py-24">
          <div>
            <p className="text-sm font-medium text-brand-700">For IT providers</p>
            <h2 className="mt-2 font-display text-3xl font-bold tracking-tight md:text-4xl">
              Run Freehold for every brokerage you serve.
            </h2>
            <p className="mt-3 max-w-md leading-relaxed text-stone-600">
              Because Freehold is free to self-host, you can host an isolated instance for each of
              your brokerage clients today, on your infrastructure, under your brand. A partner
              dashboard that manages fleets of instances, with per-client plans on one bill, is in
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
            <div className="relative aspect-[21/9] overflow-hidden rounded-xl border border-stone-200/70">
              <Image
                src={brokerageDusk}
                alt="A brokerage office interior at dusk"
                fill
                sizes="(min-width: 1024px) 50vw, 100vw"
                className="object-cover"
              />
            </div>
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
          <h2 className="font-display text-3xl font-bold tracking-tight md:text-4xl">
            Fair questions
          </h2>
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
        <div className="rounded-3xl bg-[radial-gradient(80%_120%_at_50%_0%,#0b7a49_0%,#054f30_100%)] px-6 py-16 text-center sm:px-12">
          <h2 className="font-display mx-auto max-w-2xl text-3xl font-bold tracking-tight text-white md:text-4xl">
            Free for 2 users and 5 active transactions — no credit card required.
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
              href="/pricing"
              className="rounded-lg border border-white/30 px-5 py-2.5 font-medium text-white transition hover:border-white/60 hover:bg-white/10 active:scale-[0.98]"
            >
              View pricing
            </a>
            <a
              href="/demo"
              className="rounded-lg border border-white/30 px-5 py-2.5 font-medium text-white transition hover:border-white/60 hover:bg-white/10 active:scale-[0.98]"
            >
              Explore the live demo
            </a>
          </div>
        </div>
      </section>

      <MarketingFooter />
    </main>
  );
}

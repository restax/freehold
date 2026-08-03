import {
  AddressBook,
  ChartLineUp,
  CheckCircle,
  EnvelopeSimple,
  FilePdf,
  Headset,
  ListChecks,
  MagnifyingGlass,
  PaintBrush,
  Phone,
  Sparkle,
  Storefront,
  UploadSimple,
  UsersThree,
} from "@phosphor-icons/react/dist/ssr";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LaunchBanner } from "@/components/launch-banner";
import {
  CloudWordmark,
  ExtractionReviewCard,
  MarketingFooter,
  MarketingNav,
} from "@/components/marketing";
import { ScreenshotFigure } from "@/components/screenshot-figure";
import { VoiceDemo } from "@/components/voice-demo";
import { getSession } from "@/lib/session";
import brokerageDusk from "../../public/marketing/brokerage-dusk.jpg";
import closingKeys from "../../public/marketing/closing-keys.jpg";
import movingDay from "../../public/marketing/moving-day.jpg";
import screenDashboard from "../../public/marketing/screens/dashboard-day.png";
import shotAgentPortal from "../../public/marketing/shots/shot-agent-portal.png";
import shotContacts from "../../public/marketing/shots/shot-contacts.png";
import shotIntakeForm from "../../public/marketing/shots/shot-intake-form.png";
import shotThemes from "../../public/marketing/shots/shot-themes.png";
import shotTransactions from "../../public/marketing/shots/shot-transactions.png";
import shotVoice from "../../public/marketing/shots/shot-voice.png";
import tcAtWork from "../../public/marketing/tc-at-work.jpg";

export const metadata = {
  title: "Transaction Coordination & Management Software | Freehold",
  description:
    "The TC platform clients love: AI contract reading, client portals, built-in e-signature. Cloud hosted or self-host free forever. Start free, no credit card.",
};

const CTA_PRIMARY = "Start free";

/*
 * Marketing landing page. The extraction preview and the order email are
 * styled mocks of our own product with illustrative sample values; the
 * screenshots are real captures of the product running sample data.
 */

const VALUE_STRIP = [
  {
    icon: UsersThree,
    text: "Client portals with your name on them, always current",
  },
  {
    icon: Sparkle,
    text: "AI built in everywhere it helps, in one monthly price",
  },
  {
    icon: Headset,
    text: "30 days of hands-on onboarding at no charge",
  },
];

const EXTRACTION_STEPS = [
  {
    icon: UploadSimple,
    title: "Upload the contract",
    body: "Drop in the signed PDF. That is the last time you type anything the contract already says.",
  },
  {
    icon: MagnifyingGlass,
    title: "Check its work",
    body: "Every date, name, and number it found shows you the exact page it came from. Anything it wasn't sure about is clearly marked.",
  },
  {
    icon: CheckCircle,
    title: "Approve, and the file builds itself",
    body: "The dates land on the calendar, the deadlines become tasks, and the reminders are set. You review; it does the typing.",
  },
];

const BENTO = [
  {
    icon: UsersThree,
    title: "Client portals",
    body: "Send one link and your client or their agent always knows exactly where the deal stands. No login for them to forget, and you choose what they see.",
    cls: "border border-brand-600/20 bg-brand-50/70",
  },
  {
    icon: EnvelopeSimple,
    title: "Email that files itself",
    body: "Write to agents and clients right from the deal. When they reply, the reply lands on that deal too, not buried in your inbox.",
    cls: "border border-stone-200/70 bg-white",
  },
  {
    icon: FilePdf,
    title: "Work with PDFs right here",
    body: "Split a big scan into its documents, combine files into a closing package, and email any of them out in a few clicks.",
    cls: "border border-stone-200/70 bg-white",
  },
  {
    icon: AddressBook,
    title: "Everyone in one place",
    body: "Clients, agents, lenders, and title stay living records. Their numbers, emails, and history are always one tap away.",
    cls: "border border-stone-200/70 bg-white sm:col-span-2",
  },
  {
    icon: Storefront,
    title: "Order services from the file",
    body: "Place an order with the title company, attorney, or photographer without retyping the deal. The details fill themselves in.",
    cls: "border border-stone-200/70 bg-white",
  },
  {
    icon: ChartLineUp,
    title: "See everything at a glance",
    body: "Every open file, its stage, and what is due next on one screen. Nothing hides in an inbox or a spreadsheet.",
    cls: "border border-stone-200/70 bg-white",
  },
  {
    icon: PaintBrush,
    title: "Your brand everywhere",
    body: "Pick your colours once and your dashboard, your emails, and your client portals all match. It looks like yours, because it is.",
    cls: "border border-stone-200/70 bg-white",
  },
  {
    icon: Phone,
    title: "Help from a real person",
    body: "A real phone number and live chat. No voicemail, no ticket queue. You call, a person answers.",
    cls: "border border-stone-200/70 bg-white",
  },
];

const FAQ: Array<[string, string]> = [
  [
    "What does it cost?",
    "Every signup starts on Pro free for 14 days, no credit card: the full product, AI included. After that it settles onto Free (1 user, 2 active closings) unless you add a card, and Cloud Pro is $50 a month from there. There are no contracts and nothing to cancel by phone.",
  ],
  [
    "Do I need to be technical?",
    "No. Freehold is a website: sign up, upload a contract, work. Servers, backups, updates, and the AI are our job, not yours.",
  ],
  [
    "What does switching look like?",
    "Gentler than you'd think. Most TCs run their in-flight closings to the finish line in the old system and open new ones in Freehold, so nothing gets disrupted mid-deal. Your first 30 days include hands-on onboarding at no charge, and we help with the move.",
  ],
  [
    "Can I trust the AI with contracts?",
    "The AI never gets the last word. Everything it reads out of a contract shows you the page it came from, and nothing is saved to your file until you approve it. Your documents are never used to train AI models.",
  ],
  [
    "What if I ever want to leave?",
    "You download everything, records and documents, in one file, any time, on any plan. We keep customers by being good, not by making leaving hard.",
  ],
  [
    "What support do I get?",
    "A real phone number and live chat, answered by a person. No voicemail. And every new account gets 30 days of onboarding help included.",
  ],
];

/* Structured data for search engines, built from the same copy the page
   renders so it can never drift from what a visitor actually reads. */
const JSON_LD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "SoftwareApplication",
      name: "Freehold",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      url: "https://freeholdtc.dev",
      description:
        "Transaction coordination and management software for real estate TCs: AI contract reading, client portals, built-in e-signature, and CRM. Cloud hosted or self-hosted.",
      offers: [
        { "@type": "Offer", price: "0", priceCurrency: "USD", name: "Free" },
        { "@type": "Offer", price: "50", priceCurrency: "USD", name: "Cloud Pro, monthly" },
        { "@type": "Offer", price: "80", priceCurrency: "USD", name: "Cloud Business, monthly" },
      ],
    },
    {
      "@type": "Organization",
      name: "Freehold",
      url: "https://freeholdtc.dev",
      email: "hello@freeholdtc.dev",
    },
    {
      "@type": "FAQPage",
      mainEntity: FAQ.map(([question, answer]) => ({
        "@type": "Question",
        name: question,
        acceptedAnswer: { "@type": "Answer", text: answer },
      })),
    },
  ],
};

/**
 * A sample of the order email Freehold writes when you order a service from
 * the file. Illustrative values; styled like the product's own email preview.
 */
function OrderEmailCard() {
  return (
    <div className="overflow-hidden rounded-xl border border-stone-200/70 bg-white shadow-[0_12px_32px_-16px_rgba(28,25,23,0.25)]">
      <div className="border-b border-stone-100 bg-stone-50 px-4 py-2.5">
        <p className="text-xs font-medium uppercase tracking-wide text-stone-400">
          Sample order email
        </p>
      </div>
      <div className="flex flex-col gap-1.5 border-b border-stone-100 px-4 py-3 text-sm">
        <p>
          <span className="text-stone-400">To:</span>{" "}
          <span className="text-stone-700">orders@firsttitle.example</span>
        </p>
        <p>
          <span className="text-stone-400">Subject:</span>{" "}
          <span className="font-medium text-stone-800">Title order: 412 Maple Avenue</span>
        </p>
      </div>
      <div className="px-4 py-4 text-sm leading-relaxed text-stone-700">
        <p>Hi Alexis,</p>
        <p className="mt-2">
          Please open title on 412 Maple Avenue, Springfield. Contract price $385,000, closing
          September 12. Buyer is Jordan Bell, seller is the Caputo estate. The signed contract is
          attached.
        </p>
        <p className="mt-2">Thank you!</p>
        <p className="mt-2 text-stone-500">
          Dana
          <br />
          Maplewood Transactions
        </p>
        <p className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-stone-200 bg-stone-50 px-2.5 py-1.5 text-xs text-stone-600">
          <FilePdf size={14} aria-hidden className="text-brand-700" />
          Purchase contract.pdf
        </p>
      </div>
    </div>
  );
}

export default async function LandingPage() {
  const session = await getSession();
  if (session) redirect("/dashboard");

  return (
    <main className="bg-stone-50 text-stone-900">
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: static JSON.stringify of our own constants, no user input
        dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
      />
      <LaunchBanner />
      <MarketingNav />

      {/* Hero: headline left, the real product right. */}
      <section className="border-b border-stone-200/70 bg-white">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 pb-14 pt-12 sm:px-6 lg:grid-cols-[5fr_6fr] lg:gap-12 lg:pb-20 lg:pt-16">
          <div>
            <h1 className="font-display max-w-xl text-4xl font-bold leading-[1.1] tracking-tight md:text-5xl">
              Be the TC your clients rave about.
            </h1>
            <p className="mt-5 max-w-lg text-lg leading-relaxed text-stone-600">
              Every closing on track, every client in the loop, and the typing done for you. Free to
              start.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link
                href="/signup"
                className="rounded-lg bg-brand-600 px-5 py-2.5 font-medium text-white shadow-xs transition hover:bg-brand-700 active:scale-[0.98]"
              >
                {CTA_PRIMARY}
              </Link>
              <a
                href="/demo"
                className="rounded-lg border border-stone-300 bg-white px-5 py-2.5 font-medium text-stone-700 shadow-xs transition hover:border-stone-400 hover:bg-stone-50 active:scale-[0.98]"
              >
                Try the live demo, no sign-up
              </a>
            </div>
          </div>
          <Image
            src={screenDashboard}
            priority
            alt="The Freehold dashboard: today's tasks first, this week's closings grouped by day, and pipeline counts"
            className="w-full rounded-xl border border-stone-200 shadow-[0_12px_32px_-16px_rgba(28,25,23,0.25)]"
          />
        </div>
      </section>

      {/* Trust strip */}
      <div className="border-b border-stone-200/70 bg-stone-50">
        <div className="mx-auto flex max-w-6xl flex-col gap-2.5 px-4 py-4 sm:px-6 md:flex-row md:items-center md:justify-between md:gap-8">
          {VALUE_STRIP.map(({ icon: Icon, text }) => (
            <p key={text} className="flex items-center gap-2.5 text-sm text-stone-600">
              <Icon size={18} weight="regular" aria-hidden className="shrink-0 text-brand-700" />
              {text}
            </p>
          ))}
        </div>
      </div>

      {/* Voice demo */}
      <section className="border-b border-stone-200/70 bg-white">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:gap-16">
          <div>
            <p className="text-sm font-medium text-brand-700">Try it right now</p>
            <h2 className="font-display mt-2 text-3xl font-bold tracking-tight md:text-4xl">
              Just ask for what you need.
            </h2>
            <p className="mt-4 max-w-md leading-relaxed text-stone-600">
              Coordinators ask Freehold things like &ldquo;what&rsquo;s closing this week?&rdquo;
              out loud and hear the answer from their own files. This is that same voice, pointed at
              Freehold itself. Ask it anything about the product.
            </p>
          </div>
          <VoiceDemo />
        </div>
      </section>

      {/* AI contract extraction: the interactive review card moved here from
          the hero, where a component demo belongs next to its explanation. */}
      <section id="extraction" className="border-b border-stone-200/70 bg-stone-50">
        <div className="mx-auto grid max-w-6xl gap-12 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:gap-16 lg:py-24">
          <div>
            <p className="text-sm font-medium text-brand-700">AI contract reading</p>
            <h2 className="font-display mt-2 text-3xl font-bold tracking-tight md:text-4xl">
              Upload the contract. The file builds itself.
            </h2>
            <p className="mt-4 max-w-xl leading-relaxed text-stone-600">
              Freehold reads the contract with Claude, cutting-edge AI, and pulls out the people,
              the price, and every deadline, even the tricky ones like &quot;ten days from the
              Effective Date.&quot; It is included on every paid plan at no extra charge, along with
              every other place AI helps in Freehold. One monthly price covers all of it.
            </p>
            <div className="mt-9 flex flex-col">
              {EXTRACTION_STEPS.map(({ icon: Icon, title, body }, i) => (
                <div key={title} className="relative flex gap-5 pb-8 last:pb-0">
                  {i < EXTRACTION_STEPS.length - 1 && (
                    <span
                      aria-hidden
                      className="absolute left-[19px] top-10 h-[calc(100%-1.5rem)] w-px bg-stone-200"
                    />
                  )}
                  <span className="relative z-10 grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-600 text-white">
                    <Icon size={18} weight="bold" aria-hidden />
                  </span>
                  <div className="pt-1.5">
                    <h3 className="font-display text-lg font-bold">{title}</h3>
                    <p className="mt-1.5 leading-relaxed text-stone-600">{body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="justify-self-center lg:justify-self-end">
            <ExtractionReviewCard />
          </div>
        </div>
      </section>

      {/* Feature bento */}
      <section id="features" className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-24">
        <h2 className="font-display max-w-2xl text-3xl font-bold leading-[1.15] tracking-tight md:text-4xl">
          Everything you run in a day, in one place.
        </h2>
        <p className="mt-4 max-w-xl leading-relaxed text-stone-600">
          Closings, clients, documents, and emails together, so you stop juggling spreadsheets,
          inboxes, and sticky notes.
        </p>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-xl bg-brand-700 p-6 text-white sm:col-span-2">
            <ListChecks size={26} weight="regular" aria-hidden className="text-white/85" />
            <h3 className="mt-3 font-semibold">Templates for everything, all included</h3>
            <p className="mt-1.5 max-w-lg text-sm leading-relaxed text-white/90">
              Checklists, email templates, intake forms, and document templates that fill themselves
              in from the deal. Set them up once, or start from the library we include, and every
              new closing starts itself.
            </p>
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

      {/* A look inside: real screenshots */}
      <section className="border-y border-stone-200/70 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-24">
          <h2 className="font-display max-w-xl text-3xl font-bold tracking-tight md:text-4xl">
            A look inside
          </h2>
          <p className="mt-3 max-w-xl leading-relaxed text-stone-600">
            Real screens from the product, close up. Click any of them to see the full view.
          </p>
          <div className="mt-10 grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            <ScreenshotFigure
              src={shotTransactions}
              crop
              alt="The transactions list showing each closing, its stage, and its dates"
              caption="Every closing, its stage, and its dates on one screen."
            />
            <ScreenshotFigure
              src={shotContacts}
              crop
              alt="The contacts list with names, phone numbers, and emails"
              caption="Everyone on your deals, one tap away."
            />
            <ScreenshotFigure
              src={shotVoice}
              crop
              position="center top"
              alt="The voice search window answering a question about the week's closings"
              caption="Ask out loud. It answers from your files."
            />
            <ScreenshotFigure
              src={shotAgentPortal}
              crop
              position="center top"
              alt="The portal an agent sees: the property, its status, and the task checklist"
              caption="What an agent sees from the link you send. Clients get their own view."
            />
            <ScreenshotFigure
              src={shotIntakeForm}
              crop
              position="center top"
              alt="A new listing intake form with address, price, and client questions"
              caption="Agents send you new business through your own intake form."
            />
            <ScreenshotFigure
              src={shotThemes}
              crop
              alt="The appearance settings with eight colour themes to pick from"
              caption="Pick your colour once. Your dashboard, emails, and portals all match."
            />
          </div>
        </div>
      </section>

      {/* Straight to the price */}
      <section className="border-b border-stone-200/70 bg-stone-50">
        <div className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6 lg:py-24">
          <div>
            <h2 className="font-display text-3xl font-bold tracking-tight md:text-4xl">
              The price, plainly.
            </h2>
            <p className="mx-auto mt-3 max-w-md leading-relaxed text-stone-600">
              Start on Pro, free for 14 days, no credit card. After that, Cloud Pro is $50 a month.
              That is the whole price: the AI, the portals, the templates, and support are all in
              it.
            </p>
            <dl className="mx-auto mt-7 grid max-w-xl grid-cols-3 gap-4">
              <div>
                <dt className="sr-only">Trial length</dt>
                <dd className="font-display text-4xl font-bold tabular-nums text-brand-700">14</dd>
                <p className="mt-1 text-xs leading-snug text-stone-500">
                  Days of full Pro, no credit card
                </p>
              </div>
              <div>
                <dt className="sr-only">Cloud Pro price</dt>
                <dd className="font-display text-4xl font-bold tabular-nums text-brand-700">$50</dd>
                <p className="mt-1 text-xs leading-snug text-stone-500">
                  Cloud Pro monthly, AI included
                </p>
              </div>
              <div>
                <dt className="sr-only">Days of included onboarding</dt>
                <dd className="font-display text-4xl font-bold tabular-nums text-brand-700">30</dd>
                <p className="mt-1 text-xs leading-snug text-stone-500">
                  Days of onboarding help, included
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

      {/* Communication, over the closing-day photo. Dark here is a photo
          scrim for legibility, not a theme change. */}
      <section className="relative overflow-hidden">
        <Image
          src={closingKeys}
          alt="A couple holding the keys to their new home on closing day"
          fill
          sizes="100vw"
          className="object-cover"
        />
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-r from-stone-950/85 via-stone-950/55 to-stone-950/25"
        />
        <div className="relative mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-28">
          <h2 className="max-w-md text-3xl font-semibold tracking-tight text-white md:text-4xl">
            The best-informed people in the deal are yours.
          </h2>
          <div className="mt-8 flex max-w-xl flex-col divide-y divide-white/15">
            <div className="py-4">
              <h3 className="font-medium text-white">Your clients</h3>
              <p className="mt-1 text-sm leading-relaxed text-stone-200">
                They see their closing move forward on their portal and get the right email at the
                right moment. Cared for between the milestones, not just at them.
              </p>
            </div>
            <div className="py-4">
              <h3 className="font-medium text-white">The agents</h3>
              <p className="mt-1 text-sm leading-relaxed text-stone-200">
                One link and they always know where the deal stands. The &quot;any update?&quot;
                calls stop, because the answer is already in their hands.
              </p>
            </div>
            <div className="py-4">
              <h3 className="font-medium text-white">You</h3>
              <p className="mt-1 text-sm leading-relaxed text-stone-200">
                Every email you send goes out from the file and every reply comes back to it. You
                look on top of everything, because you are.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Vendor orders + sample email */}
      <section className="border-b border-stone-200/70 bg-white">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:gap-16 lg:py-24">
          <div>
            <h2 className="font-display text-3xl font-bold tracking-tight md:text-4xl">
              Order title, photos, or an attorney without retyping a thing.
            </h2>
            <p className="mt-3 max-w-md leading-relaxed text-stone-600">
              Pick who you are ordering from and Freehold writes the email from the deal itself: the
              address, the price, the dates, the people, and the right documents attached. You read
              it, maybe tweak a line, and send.
            </p>
            <p className="mt-3 max-w-md leading-relaxed text-stone-600">
              When the reply comes back, it lands on the file, where the whole story of the deal
              lives.
            </p>
          </div>
          <OrderEmailCard />
        </div>
      </section>

      {/* Rotating hero: cheese crossfades with then-vs-now. Keep the jokes. */}
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
          <div
            aria-hidden
            className="absolute inset-0 bg-gradient-to-r from-stone-950/70 via-stone-950/20 to-transparent"
          />
          <div className="relative mx-auto flex min-h-[420px] max-w-6xl flex-col justify-end px-4 pb-14 pt-24 sm:px-6 lg:min-h-[520px] lg:pb-16">
            <h2 className="max-w-xl text-4xl font-semibold tracking-tight text-white md:text-5xl">
              Age cheese, <em className="italic">not</em> your software.
            </h2>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-stone-200">
              Most TC platforms were built a generation ago, and it shows. Freehold gets better
              every single week.
            </p>
            <p className="mt-5">
              <Link
                href="/features"
                className="text-sm font-medium text-white underline underline-offset-4 hover:text-brand-200"
              >
                See what&apos;s already shipped →
              </Link>
            </p>
          </div>
        </div>
        <div className="hero-slide absolute inset-0">
          <Image
            src="/marketing/then-vs-now.jpg"
            alt="Split image: a sprawling tech office at dusk beside one person working alone at a small desk in an apartment"
            fill
            sizes="100vw"
            className="object-cover"
          />
          <div
            aria-hidden
            className="absolute inset-0 bg-gradient-to-t from-stone-950/85 via-stone-950/30 to-transparent"
          />
          <div
            aria-hidden
            className="absolute inset-0 bg-gradient-to-r from-stone-950/70 via-stone-950/20 to-transparent"
          />
          <div className="relative mx-auto flex min-h-[420px] max-w-6xl flex-col justify-end px-4 pb-14 pt-24 sm:px-6 lg:min-h-[520px] lg:pb-16">
            <h2 className="max-w-xl text-4xl font-semibold tracking-tight text-white md:text-5xl">
              2006: a floor of engineers. <em className="italic">2026:</em> one guy and an API.
            </h2>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-stone-200">
              Software got cheaper to build. Most subscriptions never got cheaper to buy. Ours did.
            </p>
            <p className="mt-5">
              <Link
                href="/pricing"
                className="text-sm font-medium text-white underline underline-offset-4 hover:text-brand-200"
              >
                View pricing →
              </Link>
            </p>
          </div>
        </div>
      </section>

      {/* We look after you */}
      <section className="border-t border-brand-600/15 bg-brand-50/50">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-24">
          <div className="max-w-2xl">
            <div className="mb-4">
              <CloudWordmark size="md" />
            </div>
            <h2 className="font-display text-3xl font-bold tracking-tight md:text-4xl">
              We look after you, so you can look after them.
            </h2>
            <p className="mt-3 max-w-xl leading-relaxed text-stone-600">
              Sign up, upload your first contract, and you are working. Everything below comes with
              the account.
            </p>
          </div>
          <div className="relative mt-8 h-52 overflow-hidden rounded-xl border border-stone-200/70 sm:h-64">
            <Image
              src={tcAtWork}
              alt="A transaction coordinator working at her desk with a coffee, calm and in control"
              fill
              sizes="(min-width: 1152px) 1152px, 100vw"
              className="object-cover"
            />
          </div>
          <div className="mt-10 grid gap-x-10 gap-y-8 sm:grid-cols-2">
            <div>
              <h3 className="font-medium">A real person answers</h3>
              <p className="mt-1.5 max-w-md text-sm leading-relaxed text-stone-600">
                Support is a real phone number and live chat. No voicemail, no ticket numbers. You
                call for help, a person picks up.
              </p>
            </div>
            <div>
              <h3 className="font-medium">30 days of onboarding, free</h3>
              <p className="mt-1.5 max-w-md text-sm leading-relaxed text-stone-600">
                We help you set up your templates, your portals, and your first files, and we help
                you move off whatever system you are leaving. Included with every new account.
              </p>
            </div>
            <div>
              <h3 className="font-medium">AI included, no surprise bills</h3>
              <p className="mt-1.5 max-w-md text-sm leading-relaxed text-stone-600">
                Contract reading, voice search, and every other place AI helps are part of the one
                monthly price. Nothing extra to buy, no usage meter to watch.
              </p>
            </div>
            <div>
              <h3 className="font-medium">A free listing on FindTCPros.com</h3>
              <p className="mt-1.5 max-w-md text-sm leading-relaxed text-stone-600">
                Every paid account includes a free listing on FindTCPros.com, where agents go
                looking for a transaction coordinator. A little more business, on us.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* For IT providers: the one place the self-hosting story lives */}
      <section id="partners" className="border-t border-stone-200/70 bg-stone-50">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:py-24">
          <div>
            <p className="text-sm font-medium text-brand-700">For IT providers</p>
            <h2 className="mt-2 font-display text-3xl font-bold tracking-tight md:text-4xl">
              Run Freehold for every brokerage you serve.
            </h2>
            <p className="mt-3 max-w-md leading-relaxed text-stone-600">
              The entire product&apos;s code is public, and hosting Freehold on your own servers is
              free, forever. That means an IT team can run a private, isolated copy for each
              brokerage it serves, under its own brand, and any customer can take their data and run
              the same software themselves. If you are not an IT person, you never need to think
              about any of this: it is simply why nobody&apos;s data is ever stuck here.
            </p>
            <a
              href="mailto:partners@freeholdtc.dev"
              className="mt-6 inline-block rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 shadow-xs transition hover:border-stone-400 hover:bg-stone-50 active:scale-[0.98]"
            >
              Get partner early access
            </a>
          </div>
          <div>
            <div className="relative h-48 overflow-hidden rounded-xl border border-stone-200/70 sm:h-56">
              <Image
                src={brokerageDusk}
                alt="A brokerage office at dusk with its lights still on"
                fill
                sizes="(min-width: 1024px) 560px, 100vw"
                className="object-cover"
              />
            </div>
            <div className="mt-4 flex flex-col divide-y divide-stone-200/70">
              <div className="py-3">
                <h3 className="text-sm font-medium">Isolated instances</h3>
                <p className="mt-1 text-sm leading-relaxed text-stone-600">
                  Each client runs its own Freehold with fully separated data.
                </p>
              </div>
              <div className="py-3">
                <h3 className="text-sm font-medium">One command to stand up</h3>
                <p className="mt-1 text-sm leading-relaxed text-stone-600">
                  Docker Compose brings up the database, storage, and app on any machine you manage.
                </p>
              </div>
              <div className="py-3">
                <h3 className="text-sm font-medium">Fleet tools in development</h3>
                <p className="mt-1 text-sm leading-relaxed text-stone-600">
                  Provisioning, monitoring, and mixed per-client plans under one partner account are
                  on the roadmap.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trust and security */}
      <section className="border-t border-stone-200/70 bg-white">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[5fr_7fr] lg:gap-14 lg:py-24">
          <div className="relative order-last h-56 overflow-hidden rounded-xl border border-stone-200/70 lg:order-first lg:h-full lg:min-h-80">
            <Image
              src={movingDay}
              alt="A family carrying boxes into their new home on moving day"
              fill
              sizes="(min-width: 1024px) 460px, 100vw"
              className="object-cover"
            />
          </div>
          <div>
            <h2 className="max-w-xl font-display text-3xl font-bold tracking-tight md:text-4xl">
              Your files are safe, and they are yours
            </h2>
            <div className="mt-8 flex flex-col gap-7">
              <div>
                <h3 className="font-medium">Locked up properly</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-stone-600">
                  Documents and saved logins are protected with cutting-edge database encryption,
                  and your workspace is reachable only through your own sign-in, with two-factor if
                  you want it.
                </p>
              </div>
              <div>
                <h3 className="font-medium">Private, full stop</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-stone-600">
                  Your data is used to run your account and for nothing else. It is never sold,
                  never shared, and your documents are never used to train AI models.
                </p>
              </div>
              <div>
                <h3 className="font-medium">Yours to take, any time</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-stone-600">
                  Download everything, records and documents, in one file whenever you like, on any
                  plan. No waiting period, no phone call, no fee.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="border-t border-stone-200/70 bg-stone-50/70">
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

      {/* CTA band: flat brand surface, full bleed. */}
      <section className="bg-brand-800">
        <div className="mx-auto max-w-6xl px-4 py-16 text-center sm:px-6 lg:py-20">
          <h2 className="font-display mx-auto max-w-2xl text-3xl font-bold tracking-tight text-white md:text-4xl">
            Full Pro, free for 14 days. No credit card.
          </h2>
          <p className="mx-auto mt-4 max-w-xl leading-relaxed text-brand-100">
            Start with one file and see how it feels. Your first 30 days include onboarding help
            from a real person.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/signup"
              className="rounded-lg bg-white px-5 py-2.5 font-medium text-brand-800 shadow-xs transition hover:bg-brand-50 active:scale-[0.98]"
            >
              {CTA_PRIMARY}
            </Link>
            <a
              href="/demo"
              className="rounded-lg border border-white/30 px-5 py-2.5 font-medium text-white transition hover:border-white/60 hover:bg-white/10 active:scale-[0.98]"
            >
              Try the live demo, no sign-up
            </a>
          </div>
        </div>
      </section>

      <MarketingFooter />
    </main>
  );
}

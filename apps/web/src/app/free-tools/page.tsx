import type { Icon } from "@phosphor-icons/react";
import {
  CalendarCheck,
  Check,
  DownloadSimple,
  ListChecks,
  MapPin,
  Star,
} from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { MarketingFooter, MarketingNav } from "@/components/marketing";

export const metadata = {
  alternates: { canonical: "/free-tools" },
  title: "Free tools for new transaction coordinators | Freehold",
  description:
    "Four free, downloadable spreadsheets for the first months of a TC business: a plan for zero clients, a plan for your first one or two, a simple task list, and a weekend hand-off checklist. Plus the single move that gets you found locally.",
};

type XlsxTool = {
  file: string;
  label: string;
  title: string;
  who: string;
  contents: string[];
  icon: Icon;
};

const TOOLS: XlsxTool[] = [
  {
    file: "/tools/first-month-plan-no-clients.xlsx",
    label: "Tool 1",
    title: "First month plan: zero clients",
    who: "You haven't signed anyone yet. This is the day-by-day plan for finding your first agent.",
    contents: [
      "4 weeks, one tab each, one task per day",
      "Week 1: a findable local presence and your pitch",
      "Week 2-3: outreach, follow-up, first proof points",
      "Week 4: turn one yes into a repeatable rhythm",
    ],
    icon: ListChecks,
  },
  {
    file: "/tools/first-month-plan-with-clients.xlsx",
    label: "Tool 2",
    title: "First month plan: 1 or 2 clients",
    who: "You have your first file or two. The job now is follow-up, not more outreach.",
    contents: [
      "A cadence for touching every open file on a schedule",
      "Scripts for asking directly for the next file",
      "A weekly capacity check: are you ready for a third client",
      "Built around the fact one dropped ball costs more than ten wins",
    ],
    icon: CalendarCheck,
  },
  {
    file: "/tools/simple-task-list.xlsx",
    label: "Tool 3",
    title: "Simple task list",
    who: "One flat list. No categories to set up, no system to learn before you can use it.",
    contents: [
      "Task, related file, priority, due date, status, notes",
      "Status counts update themselves as you work",
      "A sample row shows the format, then it's blank",
      "Good for a single TC's whole week on one screen",
    ],
    icon: ListChecks,
  },
  {
    file: "/tools/weekend-checkin-list.xlsx",
    label: "Tool 4",
    title: "Friday & Monday check-in list",
    who: "The weekend is where most TC businesses lose an agent's trust. This closes that gap.",
    contents: [
      "Friday: open houses this weekend, and does the agent know how to reach you",
      "Friday: anything closing Monday that needs a document today",
      "Monday: what came in over the weekend, before you start new work",
      "A reset for your own away message and call forwarding",
    ],
    icon: CalendarCheck,
  },
];

export default function FreeToolsPage() {
  return (
    <main id="free-tools-root" className="bg-stone-50 text-stone-900">
      <MarketingNav />

      {/* Hero: the bonus tool, promoted to the lead. Hyper-local presence is
          framed as the highest-leverage single action, not one item in a
          list, so it gets the full-width treatment everything else lacks. */}
      <section className="border-b border-stone-200/70 bg-white">
        <div className="mx-auto max-w-6xl px-4 pb-14 pt-12 sm:px-6 lg:pt-16">
          <p className="inline-flex items-center gap-2 rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-brand-700">
            <Star size={14} weight="fill" aria-hidden />
            Start here — before the checklists
          </p>
          <div className="mt-6 grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
            <div>
              <h1 className="font-display max-w-xl text-3xl font-bold leading-[1.1] tracking-tight md:text-4xl">
                Being findable in one town beats being invisible everywhere.
              </h1>
              <p className="mt-5 max-w-lg leading-relaxed text-stone-600">
                A new TC's instinct is to build a website and post on social media for a wide
                audience. The move that actually gets a local agent to trust you with their file is
                smaller and slower: an office address and a Google Business Profile tied to the town
                you actually work in.
              </p>
              <p className="mt-4 max-w-lg leading-relaxed text-stone-600">
                Google's own guidance for ranking local results is built around three things it
                calls{" "}
                <abbr
                  title="Experience, Expertise, Authoritativeness, Trust"
                  className="no-underline"
                >
                  E-E-A-T
                </abbr>
                : relevance, distance, and prominence. A TC with a real local address, a claimed
                Google Business Profile, and a handful of local reviews reads as all three. A TC
                with a nationwide-sounding website and no address reads as none of them, no matter
                how good the work is.
              </p>
              <ul className="mt-6 flex flex-col gap-3">
                {[
                  "Claim a free Google Business Profile with a real address in your service area, even if it's a home office",
                  'List the specific towns or zip codes you serve, not just "the metro area"',
                  "Ask your first few clients for a short Google review naming the town they closed in",
                  "Use the same address and service-area wording everywhere: your site, your email signature, your flyers",
                ].map((item) => (
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
              <p className="mt-6 max-w-lg text-sm leading-relaxed text-stone-500">
                This is why it's first on this page and not tool five. Everything below helps you
                run the business once an agent finds you. This is what gets you found.
              </p>
            </div>

            <div className="overflow-hidden rounded-xl border border-brand-600/20 bg-white shadow-[0_1px_2px_rgb(41_37_36/0.04),0_16px_40px_rgb(41_37_36/0.08)]">
              <div className="border-b border-stone-200/80 bg-[var(--section-header)] px-4 py-2.5">
                <p className="text-sm font-semibold text-stone-800">How a search sees two TCs</p>
              </div>
              <div className="flex flex-col divide-y divide-stone-100">
                <div className="flex items-start gap-3 p-4">
                  <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-50 text-brand-700">
                    <MapPin size={18} weight="fill" aria-hidden />
                  </span>
                  <div>
                    <p className="text-sm font-medium">
                      "Transaction coordinator, Dayton OH" — claimed profile
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-stone-500">
                      Address in Dayton, service area listed, 6 reviews mentioning local closings.
                      Shows on the map, shows first.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-4">
                  <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-stone-100 text-stone-400">
                    <MapPin size={18} aria-hidden />
                  </span>
                  <div>
                    <p className="text-sm font-medium text-stone-500">
                      "Nationwide TC services" — no address, no profile
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-stone-500">
                      No map presence, no local reviews, nothing tying the business to a place. A
                      Dayton agent searching locally never sees it.
                    </p>
                  </div>
                </div>
              </div>
              <div className="border-t border-stone-100 bg-stone-50 px-4 py-3">
                <p className="text-xs leading-relaxed text-stone-500">
                  Same skill, same rates. The only difference is which one the map shows to the
                  agent looking for help this week.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* The four downloadable tools */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <h2 className="font-display max-w-xl text-2xl font-bold tracking-tight md:text-3xl">
          Four free spreadsheets for the earliest stage of a TC business
        </h2>
        <p className="mt-4 max-w-2xl leading-relaxed text-stone-600">
          No signup, no email gate. Each is a real Excel file (.xlsx) you can edit, print, or move
          into Google Sheets. Built for the stretch before a full-featured system like Freehold
          makes sense: your first weeks and your first one or two clients.
        </p>

        <div className="mt-10 grid gap-6 md:grid-cols-2">
          {TOOLS.map((tool) => {
            const Icon = tool.icon;
            return (
              <div
                key={tool.file}
                className="flex flex-col overflow-hidden rounded-xl border border-stone-200/70 bg-white shadow-[0_1px_2px_rgb(41_37_36/0.04),0_2px_10px_rgb(41_37_36/0.05)]"
              >
                <div className="flex items-start gap-3 border-b border-stone-100 bg-[var(--section-header)] px-5 py-4">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white text-brand-700">
                    <Icon size={18} weight="bold" aria-hidden />
                  </span>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-700">
                      {tool.label}
                    </p>
                    <h3 className="font-display text-lg font-bold tracking-tight">{tool.title}</h3>
                  </div>
                </div>
                <div className="flex flex-1 flex-col p-5">
                  <p className="text-sm leading-relaxed text-stone-600">{tool.who}</p>
                  <ul className="mt-4 flex flex-col gap-2">
                    {tool.contents.map((line) => (
                      <li key={line} className="flex gap-2.5 text-sm text-stone-600">
                        <Check
                          size={15}
                          weight="bold"
                          aria-hidden
                          className="mt-0.5 shrink-0 text-brand-600"
                        />
                        <span className="leading-relaxed">{line}</span>
                      </li>
                    ))}
                  </ul>
                  <a
                    href={tool.file}
                    download
                    className="mt-5 inline-flex w-fit items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-xs transition hover:bg-brand-700 active:scale-[0.98]"
                  >
                    <DownloadSimple size={16} weight="bold" aria-hidden />
                    Download .xlsx
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Bridge to the product, honest about the boundary between free tools
          and what needs software */}
      <section className="border-t border-stone-200/70 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <div className="rounded-xl border border-brand-600/15 bg-brand-50/60 px-6 py-6">
            <h2 className="font-display text-xl font-bold tracking-tight">
              When a spreadsheet stops being enough
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-stone-600">
              These four tools cover a TC with a handful of files and one inbox. Somewhere around
              your third or fourth active client, dates start living in more places than you can
              track by hand, and a missed follow-up costs more than the spreadsheet ever will.
              That's the point Freehold is built for: deadlines that compute themselves from the
              contract, a client portal so "what's my status" stops being a phone call, and email
              that comes back onto the file instead of your personal inbox.
            </p>
            <div className="mt-5 flex flex-wrap gap-4">
              <Link
                href="/signup"
                className="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white shadow-xs transition hover:bg-brand-700 active:scale-[0.98]"
              >
                Start free
              </Link>
              <Link
                href="/pricing"
                className="rounded-lg border border-stone-300 bg-white px-5 py-2.5 text-sm font-medium text-stone-700 transition hover:border-stone-400"
              >
                See pricing
              </Link>
            </div>
          </div>
        </div>
      </section>

      <MarketingFooter />
    </main>
  );
}

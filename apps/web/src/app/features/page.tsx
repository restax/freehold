import { Check } from "@phosphor-icons/react/dist/ssr";
import Image from "next/image";
import Link from "next/link";
import { MarketingFooter, MarketingNav } from "@/components/marketing";

export const metadata = {
  title: "Features | Freehold",
  description:
    "Every feature in Freehold, honestly labeled: what works today and what we build on request. No feature-page fiction.",
};

type Status = "today" | "request";

const GROUPS: Array<[string, Array<[string, string, Status]>]> = [
  [
    "Only in Freehold",
    [
      [
        "AI contract extraction",
        "Upload the purchase agreement and every date, dollar, and party is extracted with a page citation.",
        "today",
      ],
      [
        "Human-confirmed AI",
        "Nothing the AI reads touches your file until you approve it, field by field.",
        "today",
      ],
      [
        "Credential vault",
        "Client MLS and lender logins encrypted at rest, revealed on click, every reveal audited.",
        "today",
      ],
      [
        "Open source",
        "The entire product is Apache-2.0. Self-host free forever, or read every line we ship.",
        "today",
      ],
      [
        "No affiliate program",
        "Nobody is paid a commission to recommend Freehold, so every recommendation is a real one.",
        "today",
      ],
      [
        "Ask Claude about your deals",
        "A ready-made Claude skill queries your workspace through the API: closings this week, client portal activity, workspace stats.",
        "today",
      ],
      [
        "The contract is the source of truth",
        "Contract-governed dates never change silently: edits become a proposal with an amendment to-do, and the date moves only when you confirm the amendment is executed.",
        "today",
      ],
      [
        "Dual-person contact records",
        "One CRM entry holds a couple or a client and their assistant, so mailings and merges address both.",
        "today",
      ],
    ],
  ],
  [
    "Transaction management",
    [
      ["Unlimited transactions", "No per-file fees on any paid or self-hosted plan.", "today"],
      [
        "Document storage on every file",
        "Contracts, amendments, and disclosures live on the transaction.",
        "today",
      ],
      [
        "Task and action plans",
        "Simple or complex processes, applied to any file in one click.",
        "today",
      ],
      [
        "Deadlines that compute themselves",
        "Template tasks anchor to the contract and close dates and land dated.",
        "today",
      ],
      [
        "Cascading dates",
        "Confirm an amendment and every dependent deadline re-dates itself instantly — manually adjusted tasks stay where you put them.",
        "today",
      ],
      [
        "Task priorities that mean it",
        "Normal, High, Critical — your day sorts priority first, and an unresolved amendment auto-escalates to Critical two days out.",
        "today",
      ],
      [
        "Document templates with merge fields",
        "Letters and forms fill themselves from transaction data into a finished PDF.",
        "today",
      ],
      ["Custom fields", "Track any data point your market needs on any transaction.", "today"],
      [
        "Email templates with merge fields",
        "Compose emails from templates the way documents already work.",
        "request",
      ],
    ],
  ],
  [
    "CRM",
    [
      [
        "Categories, grades, and auto-prospecting",
        "Tag contacts, grade relationships A\u2013D, and Freehold queues who to touch and when.",
        "today",
      ],
      [
        "Touch date reminders",
        "Anniversaries and follow-ups so relationships don't go cold.",
        "today",
      ],
      [
        "Clients as first-class records",
        "The agents and brokerages you serve, with their own preferences.",
        "today",
      ],
      ["Advanced search", "Find anything across contacts and transactions in one box.", "request"],
      ["Targeted mass email", "Keep your database engaged with bulk campaigns.", "request"],
      [
        "Shared contact ownership",
        "Owner assignment with an admin switch restricting members to contacts they own.",
        "today",
      ],
    ],
  ],
  [
    "Dashboards",
    [
      ["Pipeline at a glance", "Every open file, its stage, and what's due next.", "today"],
      ["Status filters", "See exactly the slice of your pipeline you need.", "today"],
      ["Saved views", "Switch between custom-filtered perspectives instantly.", "request"],
      ["Column customization", "Choose the fields your dashboard shows.", "request"],
    ],
  ],
  [
    "Workflows",
    [
      [
        "Prebuilt and custom action plans",
        "Start from a working checklist or build your own.",
        "today",
      ],
      ["Shared team workflows", "Everyone works the same file with the same live state.", "today"],
      ["Task assignment by role", "New tasks route to the right person automatically.", "request"],
      [
        "Email templates attached to tasks",
        "A task fires with its message ready to send.",
        "request",
      ],
    ],
  ],
  [
    "Client & agent portals",
    [
      [
        "Branded portal subdomains",
        "Every workspace gets its own address \u2014 yourname.freeholdtc.dev \u2014 for client-facing pages.",
        "today",
      ],
      [
        "Buyer & seller portals",
        "A simple milestone timeline, the deal team, and documents \u2014 on a private, revocable link. No passwords.",
        "today",
      ],
      [
        "Managed agent portals",
        "Agents see every deal you run for them: pipeline, on-track projection, activity, closed history, files with one-click ZIP.",
        "today",
      ],
      [
        "Per-item visibility controls",
        "Two toggles beside every task and document decide exactly what agents and clients see.",
        "today",
      ],
      [
        "Calendar feeds",
        "Every portal has a subscribe-once calendar feed \u2014 dates sync to Google, Outlook, or Apple Calendar and stay current.",
        "today",
      ],
      [
        "Audit trail",
        "Deletions and portal access changes recorded with who and when, viewable by admins.",
        "today",
      ],
    ],
  ],
  [
    "Analytics and reporting",
    [
      ["Real-time pipeline visibility", "Live counts by stage, straight from your data.", "today"],
      ["Team performance breakdowns", "Metrics by person and team.", "request"],
      ["Built-in reports", "Internal and client-facing reporting.", "request"],
      ["Client-facing TC analytics", "Show your agent clients the work you do.", "request"],
    ],
  ],
  [
    "Teams",
    [
      [
        "Multi-user with real roles",
        "Owners and admins manage; members coordinate. Destructive actions stay gated.",
        "today",
      ],
      ["Link-based invitations", "Add a teammate by sending a link.", "today"],
      ["Fair seat pricing", "Add seats as you grow, change any time, no surprise jumps.", "today"],
      ["Per-task delegation", "Assign individual tasks to teammates.", "request"],
      ["Record ownership tracking", "See who created and owns every record.", "request"],
    ],
  ],
  [
    "Client portal",
    [
      [
        "Branded buyer, seller, and agent portals",
        "A clean read-only closing tracker carrying your agency's name.",
        "today",
      ],
      ["Selective sharing", "Choose per link what each person sees; revoke any time.", "today"],
      [
        "Checklist progress visibility",
        "Clients watch steps complete instead of calling you.",
        "today",
      ],
      [
        "Showing and feedback logging",
        "Record showings and share feedback with sellers.",
        "request",
      ],
      ["ShowingTime and Supra auto-import", "Showing data pulled in automatically.", "request"],
    ],
  ],
];

const SCREENS: Array<[string, string, string]> = [
  [
    "/marketing/screens/dashboard-day.png",
    "Freehold dashboard showing today's overdue and due tasks, a 7-day agenda, and pipeline counts",
    "Your day: overdue first, closings and deadlines grouped by day, pipeline at a glance.",
  ],
  [
    "/marketing/screens/transaction-workspace.png",
    "Transaction workspace with listing details, tabbed tasks, and key dates in three columns",
    "The transaction workspace: checklist, files, participants, payout \u2014 with per-portal visibility toggles on every row.",
  ],
  [
    "/marketing/screens/portal-agent.png",
    "Managed agent portal with pipeline stats, on-track projection, and upcoming dates",
    "What your agents see: their whole book with you, live \u2014 pipeline, next 30 days, closed history.",
  ],
  [
    "/marketing/screens/portal-client.png",
    "Buyer and seller portal with a milestone timeline and deal team",
    "What buyers and sellers see: a calm timeline, their team, their documents. No login, no clutter.",
  ],
];

export default function FeaturesPage() {
  return (
    <main className="bg-stone-50 text-stone-900">
      <MarketingNav />

      <section className="mx-auto max-w-6xl px-4 pb-20 pt-12 sm:px-6 lg:pt-16">
        <h1 className="font-display max-w-2xl text-4xl font-extrabold leading-[1.1] tracking-tight md:text-5xl">
          Every feature, honestly labeled.
        </h1>
        <p className="mt-5 max-w-xl leading-relaxed text-stone-600">
          Most feature pages are fiction. This one has two labels: things Freehold does today, and
          things we build when a working TC asks for them. Open source means the roadmap belongs to
          the people who use it.
        </p>
        <div className="mt-6 flex flex-wrap gap-4 text-sm">
          <span className="flex items-center gap-2">
            <Check size={16} weight="bold" aria-hidden className="text-brand-600" />
            <span className="text-stone-600">In Freehold today</span>
          </span>
          <span className="flex items-center gap-2">
            <span className="rounded-md bg-stone-200/80 px-2 py-0.5 text-xs font-medium text-stone-600">
              on request
            </span>
            <span className="text-stone-600">Ask, and it usually ships in days</span>
          </span>
        </div>

        {/* Real screens — actual product, demo-workspace data */}
        <div className="mt-14">
          <h2 className="font-display text-2xl font-bold tracking-tight">
            Real screenshots, not mockups
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-stone-600">
            Straight from the live demo workspace \u2014 what you see is what ships.{" "}
            <a href="/api/demo" className="font-medium text-brand-700 hover:text-brand-600">
              Click around it yourself \u2192
            </a>
          </p>
          <div className="mt-6 grid gap-5 md:grid-cols-2">
            {SCREENS.map(([src, alt, caption]) => (
              <figure
                key={src}
                className="overflow-hidden rounded-2xl border border-stone-200/70 bg-white shadow-[0_1px_2px_rgb(41_37_36/0.04),0_2px_8px_rgb(41_37_36/0.04)]"
              >
                <Image src={src} alt={alt} width={1360} height={860} className="w-full" />
                <figcaption className="border-t border-stone-100 px-4 py-2.5 text-xs text-stone-500">
                  {caption}
                </figcaption>
              </figure>
            ))}
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-12">
          {GROUPS.map(([group, items]) => (
            <div key={group}>
              <h2 className="font-display text-2xl font-bold tracking-tight">{group}</h2>
              <div className="mt-5 grid gap-x-8 gap-y-5 md:grid-cols-2 lg:grid-cols-3">
                {items.map(([name, desc, status]) => (
                  <div key={name} className="flex gap-3">
                    {status === "today" ? (
                      <Check
                        size={18}
                        weight="bold"
                        aria-hidden
                        className="mt-0.5 shrink-0 text-brand-600"
                      />
                    ) : (
                      <span className="mt-0.5 h-fit shrink-0 rounded-md bg-stone-200/80 px-1.5 py-0.5 text-[10px] font-medium leading-tight text-stone-600">
                        on request
                      </span>
                    )}
                    <div>
                      <h3 className="text-sm font-medium">{name}</h3>
                      <p className="mt-0.5 text-sm leading-relaxed text-stone-500">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-14 rounded-2xl border border-brand-600/15 bg-brand-50/60 px-6 py-6">
          <h2 className="font-display text-xl font-bold tracking-tight">
            &quot;On request&quot; means days, not weeks.
          </h2>
          <div className="mt-3 flex max-w-2xl flex-col gap-3 text-sm leading-relaxed text-stone-600">
            <p>
              Here's the math: if you need a feature to run your files, hundreds of other TCs almost
              certainly need the same thing. So a real request from a working TC goes straight to
              the top of the list, and most ship in days. Not weeks, not &quot;on the roadmap for
              next year.&quot; That speed is the whole advantage of a small, open-source team over a
              legacy vendor.
            </p>
            <p>
              And two things we'll always be straight with you about. First, we build what we
              believe makes Freehold better for TCs as a whole; if we don't think a request fits,
              you'll get a direct answer and our reasoning, never silence. Second, when something
              genuinely needs more than days, we'll tell you the honest timeline before you count on
              it.
            </p>
            <p>
              Tell us what your current system does that Freehold doesn't: email{" "}
              <a
                href="mailto:hello@freeholdtc.dev"
                className="font-medium text-brand-700 hover:text-brand-600"
              >
                hello@freeholdtc.dev
              </a>{" "}
              or open a request on{" "}
              <a
                href="https://github.com/restax/freehold"
                className="font-medium text-brand-700 hover:text-brand-600"
              >
                GitHub
              </a>
              .
            </p>
          </div>
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

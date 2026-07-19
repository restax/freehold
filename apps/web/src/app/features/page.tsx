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
        "The code is public",
        "Read every line we ship and self-host free for your own organization, forever. Nobody may resell Freehold or run it as a service for others — which keeps the project funded and your platform alive.",
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
        "Email that comes back",
        "Send from your workspace's address; replies thread straight onto the transaction. Your inbox stops being the system of record.",
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
      [
        "Task automation",
        "Apply a plan and every deadline becomes a dated, assigned task — and when the contract's dates change, open tasks cascade with them.",
        "today",
      ],
      [
        "Email automation",
        "Lifecycle emails send themselves: an intro when the file opens, congratulations at closing. Any task can auto-send its template when completed. Wording is editable per workspace, with per-client on/off switches.",
        "today",
      ],
      [
        "Scheduled sends and quiet hours",
        "Write now, deliver later: schedule any email for a future date, and set workspace quiet hours so automated emails never land at 2am — they wait for morning.",
        "today",
      ],
      ["Shared team workflows", "Everyone works the same file with the same live state.", "today"],
      ["Task assignment by role", "New tasks route to the right person automatically.", "request"],
      [
        "Email templates attached to tasks",
        "One click on any task opens a merge-filled email, with the right templates suggested for that task. A 14-template starter library covers contract-to-close, listing, and post-close — plus a formatting editor with live preview, merge-field picker, and a workspace signature and footer you set once.",
        "today",
      ],
      [
        "Voice-to-email dictation",
        "Talk instead of type: dictation powered by Deepgram's Nova model transcribes with excellent accuracy — punctuation and all — straight into your compose box. Paid plans; self-hosters bring their own key.",
        "today",
      ],
    ],
  ],
  [
    "Client & agent portals",
    [
      [
        "Your own website on your subdomain",
        "Every workspace gets its own address — yourname.freeholdtc.dev — with a publishable promotional page: your logo, services, contact info, and a new-client registration form that lands in your contacts as a lead with a same-day follow-up task. Most TC platforms don't give you a website at all. See the live example at freeholdtc.dev/example-site.",
        "today",
      ],
      [
        "Intake forms with document upload",
        "Buyer and seller intake forms live on the client portal: legal names, lender, attorney, HOA — plus uploads like pre-approvals and deeds. Submissions land on the transaction with a review task, and every workspace can rename its sides (sell side, sale side, list side) everywhere.",
        "today",
      ],
      [
        "Brand customization",
        "Your logo on your website and emails, your own subdomain, even your own wording for transaction sides (sell side, sale side, list side).",
        "today",
      ],
      [
        "Works on any phone",
        "Dashboard and portals are responsive web — clients tap a link and it just opens. Nothing to install, nothing to update.",
        "today",
      ],
      [
        "QR codes for your marketing",
        "One click generates print-quality QR codes for your site — business cards, yard signs, open-house flyers. A scan becomes a registered lead.",
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
    "Security",
    [
      [
        "Database-enforced isolation",
        "Every workspace is walled off with Postgres row-level security — enforced by the database itself, not just application code.",
        "today",
      ],
      [
        "Documents encrypted at rest",
        "Every uploaded document — contracts, intake files, disclosures — is envelope-encrypted at the application layer before it touches storage. Direct database access yields ciphertext.",
        "today",
      ],
      [
        "Encrypted credential vault",
        "Client logins are envelope-encrypted at rest and revealed only on click — never stored or displayed in plaintext.",
        "today",
      ],
      [
        "Offsite encrypted backups",
        "Nightly encrypted database backups stored independently of the primary host, with point-in-time restore on top.",
        "today",
      ],
      [
        "Full audit log",
        "Sensitive actions — deletions, portal access changes, credential reveals, sent emails, integration connections — are recorded with who did them, viewable in Settings.",
        "today",
      ],
      [
        "Signed, revocable links",
        "Portals ride single-purpose signed links you can deactivate instantly — the same link resumes if you reactivate. Webhooks are HMAC-signed.",
        "today",
      ],
      [
        "Nothing deletes in one click",
        "Every destructive action requires typing DELETE, enforced on the server.",
        "today",
      ],
      [
        "Two-factor authentication",
        "TOTP codes from any authenticator app, with one-time backup codes — enable it in Settings in under a minute.",
        "today",
      ],
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
          things we build when a working TC asks for them. Public code means the roadmap belongs to
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
              next year.&quot; That speed is the whole advantage of a small team building in the
              open over a legacy vendor.
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

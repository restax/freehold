import type { Icon } from "@phosphor-icons/react";
import {
  AddressBook,
  Buildings,
  CalendarBlank,
  Compass,
  DownloadSimple,
  EnvelopeSimple,
  GearSix,
  Globe,
  Handshake,
  House,
  Lifebuoy,
  ListDashes,
  LockKey,
  Microphone,
  Palette,
  PlugsConnected,
  Receipt,
  ShieldCheck,
  Sparkle,
  Star,
  Sun,
  Toolbox,
  UserCircle,
  UsersThree,
} from "@phosphor-icons/react/dist/ssr";
import type { ReactNode } from "react";
import { SectionCard } from "@/components/section-card";
import { requireTenant } from "@/lib/tenant";

export const dynamic = "force-dynamic";

interface ManualSection {
  id: string;
  title: string;
  icon: Icon;
  body: ReactNode;
}

interface ManualGroup {
  label: string;
  sections: ManualSection[];
}

const p = "text-sm leading-relaxed text-stone-700";
const ul = "list-disc pl-5 text-sm leading-relaxed text-stone-700";
const h3 = "mt-1 font-medium text-stone-900";

const GROUPS: ManualGroup[] = [
  {
    label: "Getting started",
    sections: [
      {
        id: "getting-started",
        title: "How Freehold is organized",
        icon: Sun,
        body: (
          <>
            <p className={p}>
              Everything you do lives inside a workspace, which is your brokerage, team, or TC
              business. Every person in it has a role: <strong>owner</strong> and{" "}
              <strong>admin</strong> can configure the workspace and see everything; a regular{" "}
              <strong>member</strong> handles day to day coordination but can't delete transactions,
              clients, templates, or plans; a <strong>guest</strong> (coverage staff covering a file
              for you) only ever sees the specific files they were assigned to.
            </p>
            <p className={p}>
              The left menu has two faces. The everyday menu (Today, Transactions, Calendar,
              Contacts, Clients, and the Library group) is what you use to run files. Click{" "}
              <strong>Admin</strong> at the top to switch to the setup menu, which is where billing,
              integrations, team management, and workspace settings live. Both menus are covered
              below, in the order they appear.
            </p>
            <p className={p}>
              This page documents what every setting, feature, and integration does. It doesn't
              replace judgment, and a few sections say so explicitly (state licensing rules,
              extracted contract values), Freehold shows you the information, you confirm it.
            </p>
          </>
        ),
      },
    ],
  },
  {
    label: "Work",
    sections: [
      {
        id: "today",
        title: "Today",
        icon: Sun,
        body: (
          <p className={p}>
            The dashboard home. Shows overdue items, what's due today, and what's coming up across
            every file, plus a "Needs attention" list of quiet files and files with a critical date
            close enough that a quiet day matters. "Today at a glance," the one AI-written paragraph
            at the top, is cached and rewritten in the background when it goes stale, opening the
            dashboard never waits on a model call, so a brand-new workspace sees a short placeholder
            once and the real thing on the next visit.
          </p>
        ),
      },
      {
        id: "transactions",
        title: "Transactions",
        icon: House,
        body: (
          <>
            <p className={p}>
              The list is a strict, column-pickable table of every active and closed file with
              status and key dates. Opening a file lands on a tab strip that mirrors the left rail:{" "}
              <strong>Tasks</strong> (the checklist), <strong>Attachments</strong> (every document
              on the file plus signature status, bulk-select, PDF split/combine, and folders),{" "}
              <strong>Emails</strong> (every message sent or received about this file, threaded),{" "}
              <strong>Notes</strong> (free text), and <strong>Details</strong> (property info, key
              dates you can edit inline with a date picker, and side wording).
            </p>
            <p className={p}>
              Secondary tabs cover Participants, Vendors, Team, Compliance, Billing (hidden if you
              don't have billing access), Payout, and Portals. A guest only ever reaches a
              transaction they were explicitly assigned to.
            </p>
          </>
        ),
      },
      {
        id: "calendar",
        title: "Calendar",
        icon: CalendarBlank,
        body: (
          <p className={p}>
            A month grid combining every open task (by due date, colored by priority) and every
            upcoming closing. A scope toggle switches between everyone's items and just yours (a
            guest is locked to "mine"). Every person also gets their own subscribe-once calendar
            feed link, for Google, Outlook, or Apple Calendar, with a regeneratable token if it ever
            needs to be revoked.
          </p>
        ),
      },
      {
        id: "contacts",
        title: "Contacts",
        icon: AddressBook,
        body: (
          <p className={p}>
            Every agent, lender, title company, vendor, and everyone else you work with, in one
            filterable, column-pickable table with saved views and a voice-search box. If a
            workspace turns on "restrict to owned contacts" in Settings, a member only sees contacts
            they own; owners and admins always see everything regardless.
          </p>
        ),
      },
      {
        id: "clients",
        title: "Clients",
        icon: Buildings,
        body: (
          <p className={p}>
            The brokerages, teams, individual agents, and companies you coordinate for and invoice,
            different from Contacts, which is everyone else on a file. Creating one starts by asking
            what kind of client it is, then asks only the questions that matter for that type. Each
            client can override the workspace's e-sign provider and billing defaults on their own
            profile.
          </p>
        ),
      },
    ],
  },
  {
    label: "Library",
    sections: [
      {
        id: "templates",
        title: "Templates",
        icon: EnvelopeSimple,
        body: (
          <p className={p}>
            The starter library a new workspace begins with, and everything you build on top of it:
            task-plan templates (a checklist you apply to a new file), email templates (a
            folder-tree, two-pane compose UI, grouped by phase of the transaction), attachment
            checklists, key-date templates, and document templates. "Restore defaults" re-adds
            anything missing by name without touching a template you've already edited.
          </p>
        ),
      },
      {
        id: "compliance",
        title: "Compliance",
        icon: ShieldCheck,
        body: (
          <p className={p}>
            A review queue for files sent up for approval (oldest first, open one to approve or
            reject a document with a note), reusable document-requirement checklists, and a page to
            assign which checklist applies to which client. Every transaction for that client
            inherits it automatically, or compliance can be switched off for a client entirely.
          </p>
        ),
      },
      {
        id: "email-settings",
        title: "Email settings",
        icon: EnvelopeSimple,
        body: (
          <p className={p}>
            Signature blocks (reusable sign-offs you or your team attach to outgoing mail),
            automated emails (scheduled sends tied to a phase or key date), and the same template
            library described above, reached from the Library menu instead of the everyday one
            because it's setup work, not day-to-day coordination.
          </p>
        ),
      },
      {
        id: "forms",
        title: "Forms",
        icon: ListDashes,
        body: (
          <p className={p}>
            Intake forms you design and place wherever they're useful, your public website, a
            client's private portal, or both. "Submissions" (with a pending-count badge on the menu)
            is the review queue, where a submission becomes a Client or Transaction in one click
            instead of manual re-entry.
          </p>
        ),
      },
      {
        id: "vault",
        title: "Vault",
        icon: LockKey,
        body: (
          <p className={p}>
            Encrypted-at-rest logins your team needs, such as MLS, lender portals, or e-sign
            accounts. A credential is only ever revealed on click, and every reveal is written to an
            access log. Freehold never logs into anything automatically with a stored credential;
            store one only with your client's consent. The vault needs a self-hosted install's{" "}
            <code>VAULT_MASTER_KEY</code> set to work at all; Freehold Cloud has this configured
            already.
          </p>
        ),
      },
    ],
  },
  {
    label: "AI & voice",
    sections: [
      {
        id: "voice-search",
        title: "Voice search & dictation",
        icon: Microphone,
        body: (
          <p className={p}>
            Click "Voice search" under the Work group (or the mic icon) to have a live spoken
            conversation about your workspace's data, ask about a deadline, a client, or a file, out
            loud. Your browser only ever joins a private call; it never talks to the speech or AI
            providers directly and never sees an API key. Separately, the dictation button on any
            text field streams your speech into that field live as you talk.
          </p>
        ),
      },
      {
        id: "handbook",
        title: "Handbook",
        icon: Sparkle,
        body: (
          <p className={p}>
            Free-text notes with a grade you can leave on a client, contact, transaction, or team
            member, visible according to who's allowed to see them. Also powers "Today at a glance"
            on the dashboard and a pooled recap panel on each transaction. A workspace can turn
            Handbook off entirely (existing notes are kept, not deleted) or keep notes on while
            turning off just the AI-written recap. Availability depends on plan.
          </p>
        ),
      },
    ],
  },
  {
    label: "Admin: Money",
    sections: [
      {
        id: "invoices",
        title: "Invoices",
        icon: Receipt,
        body: (
          <p className={p}>
            Every invoice issued to a client, draft, sent, and paid, plus client credit tracking and
            staff pay requests (a flat amount or a percentage of file-fee revenue). Reachable by
            owners and admins always, and by anyone else a workspace explicitly grants view, manage,
            or full billing access on the Team page.
          </p>
        ),
      },
      {
        id: "billing",
        title: "Billing & plans",
        icon: Receipt,
        body: (
          <>
            <p className={p}>
              Freehold Cloud plans and what each includes: seats, active-transaction limits, and AI
              status (metered credits on Free, included and unmetered on paid tiers). The
              current-plan card links to Stripe's own billing portal for invoices, card updates, and
              cancellation. Self-hosted Freehold has no limits enforced and this page shows a plain
              notice instead.
            </p>
            <p className={p}>
              On the free metered plan, AI credits can be bought outright (one-time, never expire,
              each one permanently unlocks pro AI on one transaction) or redeemed with a coupon
              code. A separate code field unlocks a full complimentary plan with no card at all, for
              anyone Freehold has comped.
            </p>
          </>
        ),
      },
    ],
  },
  {
    label: "Admin: Network",
    sections: [
      {
        id: "reviews",
        title: "Reviews",
        icon: Star,
        body: (
          <p className={p}>
            Client reviews of your coordination business, requested automatically a few days after
            each file closes (the wording and timing live under Email templates). Shows a breakdown
            by coordinator and a feed of recent answers.
          </p>
        ),
      },
      {
        id: "directory",
        title: "Directory",
        icon: Compass,
        body: (
          <p className={p}>
            Manages your listing in the public coordinator directory, used for overflow work and
            finding coverage. Shows which of your operating states are covered and cross-references
            existing engagement requests so it can offer "already connected" instead of a duplicate
            one.
          </p>
        ),
      },
      {
        id: "vendors",
        title: "Vendors",
        icon: Toolbox,
        body: (
          <p className={p}>
            Inspectors, photographers, title companies, and other vendors you order from. Once a
            vendor is connected, ordering from them skips the usual email back-and-forth. Also where
            incoming connection requests and vendor search live.
          </p>
        ),
      },
      {
        id: "engagements",
        title: "Engagements",
        icon: Handshake,
        body: (
          <p className={p}>
            Coverage arrangements with other Freehold workspaces, coverage you've asked for and
            coverage you've agreed to provide. Whoever covers a file joins it as a guest and sees
            only that file. Find coverage through the Directory.
          </p>
        ),
      },
    ],
  },
  {
    label: "Admin: Workspace",
    sections: [
      {
        id: "team",
        title: "Team",
        icon: UsersThree,
        body: (
          <>
            <p className={p}>
              Add a teammate two ways: <strong>Invite</strong> sends a 7-day link they accept
              themselves; <strong>Add directly</strong> provisions the account immediately (refused
              if that email already has a Freehold account, so an admin can never silently take over
              someone else's login).
            </p>
            <p className={p}>
              Each member's row has independent controls: role (member/admin, an owner can't be
              changed here), compliance review tier, billing access, and Claude connector access. An
              expandable row holds their licenses (state, type, number, expiry, optional file
              upload) and their Handbook notes.
            </p>
          </>
        ),
      },
      {
        id: "website",
        title: "Website builder",
        icon: Globe,
        body: (
          <p className={p}>
            Every workspace gets a public site at its own subdomain, with editable page content,
            block layout, an optional custom domain, and a QR code generator. New registrations on
            the site land directly in Contacts as leads. A client's actual transaction data always
            stays behind separate, private portal links, never the public site.
          </p>
        ),
      },
      {
        id: "settings",
        title: "Settings",
        icon: GearSix,
        body: (
          <>
            <p className={p}>Every workspace-wide switch lives here, top to bottom:</p>
            <ul className={ul}>
              <li>
                <strong>Client billing defaults</strong>: billing rhythm, standard fee, deposit
                percentage, and a late-fee policy. Late fees are never applied automatically;
                Freehold only offers a one-click suggested line on an overdue invoice.
              </li>
              <li>
                <strong>Two-factor authentication</strong>: turn on 2FA for your own login.
              </li>
              <li>
                <strong>Operating states</strong>: which states you're licensed to work in, with
                Freehold's own reference notes per state (informational, not legal advice), and a
                choice between warning or blocking a file that has no licensed coordinator assigned.
              </li>
              <li>
                <strong>Holiday schedule</strong>: which US federal holidays are skipped by
                business-day math on key dates. All on by default.
              </li>
              <li>
                <strong>Coordinator directory</strong>: a status line and a link to actually manage
                the listing on the Directory page.
              </li>
              <li>
                <strong>Side wording</strong>: what "buy side" and "sell side" are called everywhere
                they appear, including client portals and intake forms.
              </li>
              <li>
                <strong>API keys</strong>: create and revoke keys for the Freehold REST API. A new
                key is shown once, then never again.
              </li>
              <li>
                <strong>Webhooks</strong>: HMAC-signed event endpoints (for example,{" "}
                <code>transaction.created</code>), verified via the <code>freehold-signature</code>{" "}
                header.
              </li>
              <li>
                <strong>Handbook</strong>: turn the Handbook on or off, and turn its AI daily recap
                on or off independently. Availability depends on plan.
              </li>
              <li>
                <strong>Contact visibility</strong>: restrict contacts to their owner, or leave the
                workspace open.
              </li>
              <li>
                <strong>Audit trail</strong>: the last 100 audit-log entries: what happened, who did
                it, when.
              </li>
              <li>
                <strong>System health</strong>: the running app version, worth including in any
                self-host support request.
              </li>
            </ul>
          </>
        ),
      },
      {
        id: "appearance",
        title: "Appearance",
        icon: Palette,
        body: (
          <p className={p}>
            Under Settings. One accent color drives the sidebar, buttons, links, and client portal;
            pick a named preset or a custom color, and text automatically darkens if it's too pale
            to read. Also sets the client-portal font, and separate colors for "High" and "Critical"
            task-priority tags, plus how strongly overdue/critical task rows are tinted in a list.
          </p>
        ),
      },
      {
        id: "integrations",
        title: "Integrations",
        icon: PlugsConnected,
        body: (
          <>
            <p className={p}>
              Every connector Freehold supports, grouped by category. Anything below marked "connect
              with a key" is verified before it's saved.
            </p>
            <p className={h3}>Communication</p>
            <ul className={ul}>
              <li>
                <strong>Email & reply capture</strong>: configured at the platform level; sends from
                your workspace's own address with automatic reply-threading back onto the right
                file. Connecting your own personal mailbox is done from your Profile page, not here.
              </li>
              <li>
                <strong>Calendar feeds</strong>: always included; every client and agent portal gets
                a subscribe-once feed.
              </li>
            </ul>
            <p className={h3}>E-signatures</p>
            <ul className={ul}>
              <li>
                <strong>OpenSign</strong>: included at no extra cost, nothing to connect; the first
                document you send auto-provisions your workspace's signing space.
              </li>
              <li>
                <strong>Documenso</strong>: connect your own account with a URL and API token, or
                use the platform's shared instance if one is configured.
              </li>
              <li>
                <strong>DocuSign</strong>: available on self-hosted installs with a paid setup
                service; not a self-serve connection.
              </li>
              <li>
                Whichever is active, manual signing (upload a signed copy yourself) always works
                regardless. Each client can also override the workspace default on their own
                profile.
              </li>
            </ul>
            <p className={h3}>CRM & leads</p>
            <ul className={ul}>
              <li>
                <strong>Follow Up Boss</strong> and <strong>Twenty CRM</strong>: connect with an API
                key from that product's own settings; website leads flow in automatically, and
                "Import contacts now" pulls existing people into Freehold Contacts.
              </li>
            </ul>
            <p className={h3}>Money</p>
            <ul className={ul}>
              <li>
                <strong>Client invoicing (Stripe)</strong>: configured at the platform level; hosted
                payment pages with paid-status syncing back automatically.
              </li>
              <li>
                <strong>ERPNext</strong>: connect with a URL, API key, and secret to issue client
                invoices as ERPNext Sales Invoices instead, with a manual "sync statuses" button,
                for a workspace that wants its ERP to stay the accounting record of truth.
              </li>
            </ul>
            <p className={h3}>Storage & data</p>
            <ul className={ul}>
              <li>
                <strong>Document storage</strong>: Freehold's own encrypted storage by default, or
                connect your own S3-compatible bucket (AWS S3, Cloudflare R2, Backblaze B2, Wasabi,
                MinIO). Disconnecting leaves files already there untouched, since Freehold never
                keeps a second copy once you've connected your own.
              </li>
              <li>
                <strong>CSV import</strong>: always included; import contacts or transactions with a
                dry-run preview before anything is written.
              </li>
            </ul>
            <p className={h3}>Developers & automation</p>
            <ul className={ul}>
              <li>
                <strong>Claude connector (MCP)</strong>: a workspace-level on/off switch; once on,
                each person connects their own Claude account and only ever sees what their own role
                already permits. Per-member access is set on the Team page.
              </li>
              <li>
                <strong>Freehold API</strong> and <strong>signed webhooks</strong>: the same keys
                and endpoints managed on the Settings page, described from the integration angle
                here.
              </li>
              <li>
                <strong>Zapier</strong>: no separate connection step; having any webhook set up is
                what wires it in. 7,000-plus apps via triggers (webhooks) and actions (the API).
              </li>
            </ul>
          </>
        ),
      },
      {
        id: "data",
        title: "Data",
        icon: DownloadSimple,
        body: (
          <p className={p}>
            Import a CSV of contacts or transactions with a dry-run preview, download your entire
            workspace (every record plus every document) as one archive at any time, and manage
            sample data, the practice clients and transactions a new workspace starts with,
            removable in one click once you're ready to add your own.
          </p>
        ),
      },
      {
        id: "support",
        title: "Support",
        icon: Lifebuoy,
        body: (
          <p className={p}>
            File a ticket and see replies from Freehold support, right from the app. Admins see
            every ticket in the workspace; everyone else sees only their own. Available to guests
            too, it's one of the few pages coverage staff can always reach.
          </p>
        ),
      },
    ],
  },
  {
    label: "Account",
    sections: [
      {
        id: "profile",
        title: "Profile",
        icon: UserCircle,
        body: (
          <p className={p}>
            Your photo, name, and phone number (shown on your outgoing email signature and available
            to templates), your own license records, and, if a pay arrangement applies to you,
            unbilled pay lines and past pay requests. Connect your personal mailbox here so outgoing
            mail shows your real address and lands in your own Sent folder instead of the
            workspace's shared sending address.
          </p>
        ),
      },
    ],
  },
  {
    label: "Roles & access",
    sections: [
      {
        id: "roles",
        title: "Who can see what",
        icon: ShieldCheck,
        body: (
          <>
            <p className={p}>
              <strong>Owner</strong> and <strong>admin</strong> reach everything on this page.{" "}
              <strong>Member</strong> gets the everyday menu (Today, Transactions, Calendar,
              Contacts, Clients, and the Library group) plus whatever a workspace has specifically
              granted them (billing access, compliance review, Claude connector).{" "}
              <strong>Guest</strong>: someone covering a file for you, only ever reaches Today,
              Transactions (just their assigned files), Calendar, and Support.
            </p>
            <p className={p}>
              Hiding a menu item is a convenience, not the actual security boundary: every page
              refuses a role that shouldn't be there on the server, regardless of what the sidebar
              shows.
            </p>
          </>
        ),
      },
    ],
  },
];

export default async function ManualPage() {
  await requireTenant({ allowGuest: true });

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[220px_1fr]">
      <aside className="hidden lg:block">
        <nav className="sticky top-20 flex max-h-[calc(100vh-6rem)] flex-col gap-4 overflow-y-auto pb-6 text-sm">
          {GROUPS.map((group) => (
            <div key={group.label}>
              <p className="mb-1 px-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-stone-400">
                {group.label}
              </p>
              <ul className="flex flex-col gap-0.5">
                {group.sections.map((s) => (
                  <li key={s.id}>
                    <a
                      href={`#${s.id}`}
                      className="block rounded-md px-2 py-1 text-stone-600 transition-colors hover:bg-stone-100 hover:text-stone-900"
                    >
                      {s.title}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </aside>

      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-xl font-semibold">User manual</h1>
          <p className="mt-1 text-sm text-stone-500">
            Every setting, feature, and integration in Freehold, in one place.
          </p>
        </div>

        {GROUPS.map((group) => (
          <div key={group.label} className="flex flex-col gap-4">
            {group.sections.map((s) => (
              <div key={s.id} id={s.id} className="scroll-mt-20">
                <SectionCard
                  title={s.title}
                  icon={<s.icon size={15} weight="fill" aria-hidden />}
                  bodyClassName="p-4 flex flex-col gap-2"
                >
                  {s.body}
                </SectionCard>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

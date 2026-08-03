/**
 * The guided tour of the live demo: what it visits, what it says, and what it
 * points at.
 *
 * This module is the single source of truth for three things that must never
 * drift apart: the on-screen caption, the spoken narration, and the audio file
 * that speech lives in. `scripts/generate-tour-audio.mjs` reads `narration`
 * from here and writes `public/tour/<id>.mp3`, so a stop's `id` is also its
 * filename and changing `narration` is what makes a clip regenerate.
 *
 * Kept free of React and of any import that reaches the database, so the tour
 * can be unit-tested as data and the generator script can import it directly.
 */

export interface TourChapter {
  id: string;
  /** Shown in the chapter menu and in the progress rail. */
  title: string;
  /** One line under the title in the menu, so skipping is an informed choice. */
  blurb: string;
}

export interface TourStop {
  /** Stable and unique: also the audio filename (`public/tour/<id>.mp3`). */
  id: string;
  chapter: TourChapter["id"];
  /**
   * Where this stop lives. Either a literal dashboard path, or the token
   * "@firstTransaction", which the engine resolves by reading the first row
   * on the transactions list. Sample data is reseeded, so its ids are not
   * stable enough to hardcode.
   */
  route: string;
  /**
   * What to spotlight, as `data-tour` anchor names in priority order. The
   * engine takes the first one that is actually on screen.
   *
   * A list rather than a single value because several of these anchors sit on
   * sections the product renders conditionally (a panel that needs an admin,
   * a card that needs a configured provider, an empty state that replaces a
   * table). A single anchor that happened to be absent used to leave the stop
   * with nothing lit and the whole screen dimmed, which is worse than useless:
   * every stop must light something, so every stop ends its list with an
   * anchor that is always present on that route.
   */
  anchors: string[];
  /** Caption heading. Short, because it sits above the spoken line. */
  title: string;
  /**
   * Spoken aloud and shown as the caption, so it has to read well both ways.
   * Written for the ear: short sentences, no jargon, no em-dashes.
   */
  narration: string;
}

export const TOUR_CHAPTERS: TourChapter[] = [
  { id: "day", title: "Your day", blurb: "What you see when you sit down in the morning." },
  {
    id: "file",
    title: "A closing, end to end",
    blurb: "Opening a file, the dates, the checklist, and the AI reading the contract.",
  },
  {
    id: "out",
    title: "Getting work out the door",
    blurb: "Email from the file, templates, and signatures without a second service.",
  },
  {
    id: "clients",
    title: "Clients and their people",
    blurb: "Portals, intake forms, and the people behind every deal.",
  },
  {
    id: "business",
    title: "Your business",
    blurb: "Your website, your invoices, your licences, your team.",
  },
  {
    id: "platform",
    title: "The platform",
    blurb: "Integrations, security, moving your data, and how support works.",
  },
];

export const TOUR_STOPS: TourStop[] = [
  // Chapter 1: Your day
  {
    id: "day-overview",
    chapter: "day",
    route: "/dashboard",
    anchors: ["day-glance", "day-today"],
    title: "Your day",
    narration:
      "This is the first thing you see each morning. Not a dashboard full of charts, but the actual work: what is late, what is due, and what closes this week.",
  },
  {
    id: "day-assigned",
    chapter: "day",
    route: "/dashboard",
    anchors: ["day-assigned", "day-today"],
    title: "Assigned to you",
    narration:
      "Anything overdue sits at the top, in red, before anything else can distract you. Nothing here needs a filter or a saved search to find.",
  },
  {
    id: "day-week",
    chapter: "day",
    route: "/dashboard",
    anchors: ["day-week", "day-today"],
    title: "The next seven days",
    narration:
      "Your week, grouped by day, with every closing and every deadline in date order. This is the view most coordinators leave open all day.",
  },
  {
    id: "day-voice",
    chapter: "day",
    route: "/dashboard",
    anchors: ["voice-widget"],
    title: "Just ask out loud",
    narration:
      "You can also just ask. Press this and say what is closing this week, or who the lender is on Maple, and it answers from your own files. It is on every page.",
  },

  // Chapter 2: A closing, end to end
  {
    id: "file-list",
    chapter: "file",
    route: "/dashboard/transactions",
    anchors: ["txn-table", "txn-filters"],
    title: "Every closing you are running",
    narration:
      "Here is every file you have open. Sort it, filter it, choose your own columns. On a paid plan there is no cap on how many closings you run.",
  },
  {
    id: "file-filters",
    chapter: "file",
    route: "/dashboard/transactions",
    anchors: ["txn-filters"],
    title: "Narrow it down",
    narration:
      "Filters sit beside the table rather than on top of it, so the list stays visible while you narrow it. Your filter choices live in the address, so you can bookmark a view.",
  },
  {
    id: "file-open",
    chapter: "file",
    route: "@firstTransaction",
    anchors: ["txn-header"],
    title: "Inside one closing",
    narration:
      "Let us open one. Everything about this closing is on a single page. The contract, the people, the dates, the documents, and every email that has gone out or come back.",
  },
  {
    id: "file-dates",
    chapter: "file",
    route: "@firstTransaction?tab=dates",
    anchors: ["txn-key-dates", "txn-header"],
    title: "Dates that hold themselves together",
    narration:
      "These dates come from the contract. Change one and every deadline that depends on it moves with it. A date the contract governs never changes quietly: it becomes an amendment for you to confirm first.",
  },
  {
    id: "file-tasks",
    chapter: "file",
    route: "@firstTransaction?tab=tasks",
    anchors: ["txn-tasks", "txn-header"],
    title: "The checklist",
    narration:
      "Your checklist, already dated from the contract. Apply a plan once and every deadline lands as a real task with a real date, assigned to a real person.",
  },
  {
    id: "file-docs",
    chapter: "file",
    route: "@firstTransaction?tab=documents",
    anchors: ["txn-documents", "txn-header"],
    title: "Documents",
    narration:
      "Every document on the file, including the ones you are still waiting for. You can split a big scan into separate documents, combine files into a closing package, and email any of them straight from here.",
  },
  {
    id: "file-extract",
    chapter: "file",
    route: "@firstTransaction?tab=documents",
    anchors: ["txn-documents", "txn-header"],
    title: "The AI reads the contract",
    narration:
      "This is the part that saves the most time. Upload the signed contract and the price, the parties, and every deadline are pulled out for you, each one showing the page it came from. Nothing is saved until you approve it.",
  },

  // Chapter 3: Getting work out the door
  {
    id: "out-compose",
    chapter: "out",
    route: "/dashboard/emails",
    anchors: ["email-templates", "email-signature"],
    title: "Email from the file",
    narration:
      "Email goes out from the workspace address, not your personal inbox. Pick a template and every name, date, and address fills itself in from the deal.",
  },
  {
    id: "out-threading",
    chapter: "out",
    route: "/dashboard/emails",
    anchors: ["email-signature", "email-templates"],
    title: "Replies come back to the file",
    narration:
      "Here is the part that changes your day. When someone replies, the reply lands back on the transaction, not buried in your inbox. Your inbox stops being the system of record.",
  },
  {
    id: "out-templates",
    chapter: "out",
    route: "/dashboard/templates",
    anchors: ["templates-tabs"],
    title: "Templates for everything",
    narration:
      "Task checklists, email templates, document lists, and key dates. A starter library is included, and every word of it is yours to edit.",
  },
  {
    id: "out-esign",
    chapter: "out",
    route: "/dashboard/integrations",
    anchors: ["integration-opensign", "integration-documenso"],
    title: "Signatures are included",
    narration:
      "E-signature is built in. There is no second subscription, no separate account to create, and no fee per envelope. Send a document for signature straight from the file. If you would rather use your own DocuSign, you can connect it.",
  },
  {
    id: "out-esign-track",
    chapter: "out",
    route: "/dashboard/integrations",
    anchors: ["integration-email"],
    title: "Mail that needs no setup",
    narration:
      "Sending and receiving is already wired up too. No mail server to configure, no plugin to install, nothing to connect on your first day.",
  },

  // Chapter 4: Clients and their people
  {
    id: "clients-list",
    chapter: "clients",
    route: "/dashboard/clients",
    anchors: ["clients-table", "clients-new"],
    title: "The agents you serve",
    narration:
      "These are your clients: the agents and brokerages who send you work. Each one keeps its own preferences, its own people, and its own portal.",
  },
  {
    id: "clients-portal",
    chapter: "clients",
    route: "/dashboard/clients",
    anchors: ["clients-table", "clients-new"],
    title: "Their own portal",
    narration:
      "Every client and every buyer or seller can get a portal with your name on it. They watch the closing move forward on a private link, with no password to forget, and you choose exactly what they see.",
  },
  {
    id: "clients-forms",
    chapter: "clients",
    route: "/dashboard/forms",
    anchors: ["forms-templates"],
    title: "Your own intake forms",
    narration:
      "Build your own intake forms by dragging the fields into place. No third party form service, no monthly fee for it, and answers land straight on the transaction with a task to review them.",
  },
  {
    id: "clients-contacts",
    chapter: "clients",
    route: "/dashboard/contacts",
    anchors: ["contacts-table"],
    title: "Everyone on your deals",
    narration:
      "Lenders, attorneys, inspectors, and title. One entry holds a couple, or a client and their assistant, so a letter addresses both of them properly.",
  },

  // Chapter 5: Your business
  {
    id: "biz-website",
    chapter: "business",
    route: "/dashboard/website",
    anchors: ["website-preview"],
    title: "A website, included",
    narration:
      "Every workspace gets its own website, free, on its own address. Build it by dragging sections around. Most platforms in this business do not give you a website at all.",
  },
  {
    id: "biz-domain",
    chapter: "business",
    route: "/dashboard/website",
    anchors: ["website-domain", "website-preview"],
    title: "Use your own domain",
    narration:
      "If you own a domain already, point it here and the site answers on it. You add one record at your registrar and we handle the certificate.",
  },
  {
    id: "biz-invoices",
    chapter: "business",
    route: "/dashboard/invoices",
    anchors: ["invoices-outstanding", "invoices-page"],
    title: "Billing your clients",
    narration:
      "Billing is permission controlled, so this demo seat sees the gate instead of the ledger. That is the feature: you choose who sees money. As owner you bill your agents for your own work, and an invoice is a document and a follow up, not a card charge.",
  },
  {
    id: "biz-licenses",
    chapter: "business",
    route: "/dashboard/profile",
    anchors: ["profile-licenses"],
    title: "Licence tracking",
    narration:
      "If your state licences transaction coordinators, keep the licence here with its expiry date and the document itself. You get an amber warning before it lapses, and a red one after.",
  },
  {
    id: "biz-team",
    chapter: "business",
    route: "/dashboard/team",
    anchors: ["team-members"],
    title: "Your team",
    narration:
      "Add a coordinator by sending a link. Owners and admins manage the workspace, members do the work, and destructive actions stay locked away from everyone else.",
  },

  // Chapter 6: The platform
  {
    id: "platform-integrations",
    chapter: "platform",
    route: "/dashboard/integrations",
    anchors: ["integration-zapier", "integration-email"],
    title: "What it connects to",
    narration:
      "Everything Freehold connects to lives on one page. Your CRM, your calendar, your accounting, and seven thousand more apps through Zapier.",
  },
  {
    id: "platform-claude",
    chapter: "platform",
    route: "/dashboard/integrations",
    anchors: ["integration-mcp"],
    title: "Ask Claude about your own deals",
    narration:
      "You can connect your workspace to Claude and ask it about your own files in plain English. On the security: you approve the connection yourself, your owner can switch it off for the whole workspace or one person, it is read only until you allow more, and you can revoke it at any moment.",
  },
  {
    id: "platform-import",
    chapter: "platform",
    route: "/dashboard/import",
    anchors: ["import-csv", "import-sample", "import-page"],
    title: "Bringing your book across",
    narration:
      "This demo seat is an ordinary team member, so the import is locked, which is exactly the point: only an owner or admin can bulk load data. In your own workspace, moving in is a spreadsheet away. Your whole contact book, matched on email so nothing duplicates.",
  },
  {
    id: "platform-export",
    chapter: "platform",
    route: "/dashboard/import",
    anchors: ["data-export", "import-sample", "import-page"],
    title: "Your data stays yours",
    narration:
      "Export is owner only for the same reason: your whole book in one file is not something every seat should be able to take. As owner you download everything, records and documents, any time, on any plan. Connect your own storage and a full copy lands there nightly.",
  },
  {
    id: "platform-support",
    chapter: "platform",
    route: "/dashboard/support",
    anchors: ["support-form"],
    title: "A real person answers",
    narration:
      "Support is a real phone number and live chat, answered by a person. No voicemail and no ticket queue. Every new account also gets thirty days of hands on help, including moving you off your old system, at no charge.",
  },
  {
    id: "platform-billing",
    chapter: "platform",
    route: "/dashboard/billing",
    anchors: ["billing-plan"],
    title: "What it costs",
    narration:
      "Every signup starts on the full product free for fourteen days, with no card. After that it is fifty dollars a month, everything included, cancel in two clicks. That is the end of the tour. Have a look around.",
  },
];

/** Stops in a chapter, in tour order. */
export function stopsInChapter(chapterId: string): TourStop[] {
  return TOUR_STOPS.filter((s) => s.chapter === chapterId);
}

/** Index of the first stop of a chapter, for the jump menu. */
export function chapterStartIndex(chapterId: string): number {
  return TOUR_STOPS.findIndex((s) => s.chapter === chapterId);
}

/** The route a stop needs, with the transaction token left for the engine. */
export const FIRST_TRANSACTION = "@firstTransaction";

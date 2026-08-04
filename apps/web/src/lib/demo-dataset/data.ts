import type { ClientType, TransactionStatus } from "@freehold/db";

/**
 * The operator demo dataset: a fictional but fully-populated transaction
 * coordination practice, used to record training videos.
 *
 * Every date in here is a **day offset from an anchor**, never a literal
 * date. That is the whole design: seeding resolves offsets against today, and
 * "re-date to today" (lib/demo-workspace.ts) shifts the stored rows by the
 * delta since Organization.demoSeededAt. A dataset written with literal dates
 * would go stale the moment it was recorded, which is exactly the problem this
 * exists to solve.
 *
 * Negative offsets are in the past, positive in the future.
 *
 * Every email address is on the @freeholdtc.dev catchall, deliberately — a
 * sample contact on a domain we do not own bounces, and a bounced sample
 * contact once drove the whole workspace's bounce rate up. The `demo.` prefix
 * keeps these from ever colliding with a real mailbox.
 */

export const DEMO_EMAIL_DOMAIN = "freeholdtc.dev";
const mail = (slug: string) => `demo.${slug}@${DEMO_EMAIL_DOMAIN}`;

/** Extra coordinators on the file, so the demo shows shared work. */
export interface DemoTeammate {
  key: string;
  name: string;
  email: string;
  role: "admin" | "member";
  title: string;
}

export const DEMO_TEAMMATES: DemoTeammate[] = [
  {
    key: "alex",
    name: "Alex Reyes",
    email: mail("alex.reyes"),
    role: "admin",
    title: "Senior transaction coordinator",
  },
  {
    key: "priya",
    name: "Priya Nair",
    email: mail("priya.nair"),
    role: "member",
    title: "Transaction coordinator",
  },
];

export interface DemoClientSpec {
  key: string;
  name: string;
  type: ClientType;
  email: string;
  phone: string;
  address?: string;
  notes?: string;
  /** Free-text notes shown on the client page, seeded as ClientNote rows. */
  comments?: Array<{ daysAgo: number; author: "owner" | "alex" | "priya"; body: string }>;
}

/**
 * Eight clients. The first three own all fifteen transactions (the request
 * was explicit about that); the rest exist so the client list looks like a
 * real book of business rather than exactly the files on screen.
 */
export const DEMO_CLIENTS: DemoClientSpec[] = [
  {
    key: "harbor",
    name: "Harbor & Vine Realty",
    type: "BROKERAGE",
    email: mail("harborvine"),
    phone: "(615) 555-0142",
    address: "1820 Division Street, Suite 300, Nashville, TN 37203",
    notes: "Highest volume client. Wants the weekly Monday summary, not daily.",
    comments: [
      {
        daysAgo: 6,
        author: "owner",
        body: "Renewed for another year at the same per-file rate. Brought up wanting listing coordination as an add-on, revisit in Q3.",
      },
      {
        daysAgo: 19,
        author: "alex",
        body: "Their new agent onboarding is loose. Ask for a heads-up before a new agent starts sending us files so we can set up the intake form first.",
      },
    ],
  },
  {
    key: "kestrel",
    name: "Kestrel Property Group",
    type: "TEAM",
    email: mail("kestrel"),
    phone: "(615) 555-0177",
    address: "44 Music Square East, Nashville, TN 37203",
    notes: "Team of six inside Corbin & Associates. Bills to the team, not the brokerage.",
    comments: [
      {
        daysAgo: 11,
        author: "priya",
        body: "Team lead prefers everything through the portal instead of email. Sending fewer status emails and pointing them at the link.",
      },
    ],
  },
  {
    key: "whitfield",
    name: "Dana Whitfield",
    type: "AGENT",
    email: mail("dana.whitfield"),
    phone: "(615) 555-0193",
    address: "990 Franklin Road, Brentwood, TN 37027",
    notes: "Solo agent, luxury inventory. Responds fastest by text.",
    comments: [
      {
        daysAgo: 3,
        author: "owner",
        body: "Asked whether we can handle her referral files in Williamson County too. Yes, same rate. Confirmed by email.",
      },
    ],
  },
  {
    key: "lakeshore",
    name: "Lakeshore Title Partners",
    type: "TITLE",
    email: mail("lakeshore.title"),
    phone: "(615) 555-0118",
    address: "310 Commerce Street, Nashville, TN 37201",
    notes: "Preferred title company for Harbor & Vine files.",
  },
  {
    key: "ridgeline",
    name: "Ridgeline Mortgage",
    type: "LENDER",
    email: mail("ridgeline"),
    phone: "(615) 555-0165",
    address: "77 Maryland Way, Brentwood, TN 37027",
  },
  {
    key: "corbin",
    name: "Corbin & Associates",
    type: "BROKERAGE",
    email: mail("corbin"),
    phone: "(615) 555-0129",
    address: "2100 West End Avenue, Nashville, TN 37203",
    notes: "Parent brokerage for the Kestrel team. Compliance reviews are strict.",
  },
  {
    key: "vega",
    name: "Marisol Vega",
    type: "AGENT",
    email: mail("marisol.vega"),
    phone: "(615) 555-0184",
    address: "18 Public Square, Franklin, TN 37064",
  },
  {
    key: "fairweather",
    name: "Fairweather Homes",
    type: "OTHER",
    email: mail("fairweather"),
    phone: "(615) 555-0151",
    address: "5 Springhouse Court, Hendersonville, TN 37075",
    notes: "Small builder. Two spec homes a year, sold direct.",
  },
];

export interface DemoContactSpec {
  key: string;
  name: string;
  category: string;
  email: string;
  phone: string;
  company?: string;
  jobTitle?: string;
  rating?: number;
  grade?: string;
  leadType?: "BUYER" | "SELLER" | "NONE";
  notes?: string;
  comments?: Array<{ daysAgo: number; author: "owner" | "alex" | "priya"; body: string }>;
}

/** Compact tuple form, expanded below — keeps 30-odd people readable. */
type ContactTuple = [
  key: string,
  name: string,
  category: string,
  phoneLast4: string,
  extra?: Partial<DemoContactSpec>,
];

const CONTACT_TUPLES: ContactTuple[] = [
  // --- Buyers -------------------------------------------------------------
  ["bell", "Jordan Bell", "Buyer", "0201", { leadType: "BUYER", grade: "A" }],
  ["okafor", "Amara Okafor", "Buyer", "0202", { leadType: "BUYER", grade: "A" }],
  ["lindqvist", "Erik Lindqvist", "Buyer", "0203", { leadType: "BUYER", grade: "B" }],
  ["moreau", "Camille Moreau", "Buyer", "0204", { leadType: "BUYER", grade: "A" }],
  ["tanaka", "Ren Tanaka", "Buyer", "0205", { leadType: "BUYER", grade: "B" }],
  ["delacroix", "Noel Delacroix", "Buyer", "0206", { leadType: "BUYER", grade: "C" }],
  ["abara", "Tunde Abara", "Buyer", "0207", { leadType: "BUYER", grade: "B" }],
  ["kowalski", "Iwona Kowalski", "Buyer", "0208", { leadType: "BUYER", grade: "A" }],
  ["ferreira", "Bruno Ferreira", "Buyer", "0209", { leadType: "BUYER", grade: "B" }],
  ["haddad", "Layla Haddad", "Buyer", "0210", { leadType: "BUYER", grade: "A" }],
  ["novak", "Petra Novak", "Buyer", "0211", { leadType: "BUYER", grade: "C" }],
  ["ibrahim", "Yusuf Ibrahim", "Buyer", "0212", { leadType: "BUYER", grade: "B" }],
  ["sandoval", "Rocio Sandoval", "Buyer", "0213", { leadType: "BUYER", grade: "A" }],
  ["whitlock", "Graham Whitlock", "Buyer", "0214", { leadType: "BUYER", grade: "B" }],
  ["arendt", "Sofie Arendt", "Buyer", "0215", { leadType: "BUYER", grade: "B" }],

  // --- Sellers ------------------------------------------------------------
  ["mcallister", "Bonnie McAllister", "Seller", "0301", { leadType: "SELLER", grade: "A" }],
  ["prescott", "Wendell Prescott", "Seller", "0302", { leadType: "SELLER", grade: "B" }],
  ["yamashita", "Keiko Yamashita", "Seller", "0303", { leadType: "SELLER", grade: "A" }],
  ["broussard", "Antoine Broussard", "Seller", "0304", { leadType: "SELLER", grade: "B" }],
  ["ravenel", "Margery Ravenel", "Seller", "0305", { leadType: "SELLER", grade: "A" }],
  ["oyelaran", "Femi Oyelaran", "Seller", "0306", { leadType: "SELLER", grade: "B" }],
  ["castellanos", "Pilar Castellanos", "Seller", "0307", { leadType: "SELLER", grade: "C" }],
  ["thornbury", "Hugh Thornbury", "Seller", "0308", { leadType: "SELLER", grade: "B" }],
  ["duplessis", "Solange Duplessis", "Seller", "0309", { leadType: "SELLER", grade: "A" }],
  ["vanderberg", "Klaas Vanderberg", "Seller", "0310", { leadType: "SELLER", grade: "B" }],

  // --- Agents and service providers --------------------------------------
  [
    "rivera",
    "Casey Rivera",
    "Agent",
    "0401",
    { company: "Harbor & Vine Realty", rating: 5, jobTitle: "Buyer's agent" },
  ],
  [
    "delgado",
    "Marco Delgado",
    "Agent",
    "0402",
    { company: "Kestrel Property Group", rating: 4, jobTitle: "Listing agent" },
  ],
  [
    "shaw",
    "Tessa Shaw",
    "Agent",
    "0403",
    { company: "Corbin & Associates", rating: 4, jobTitle: "Listing agent" },
  ],
  [
    "boone",
    "Curtis Boone",
    "Agent",
    "0404",
    { company: "Vireo Realty", rating: 3, jobTitle: "Buyer's agent" },
  ],
  [
    "lee",
    "Morgan Lee",
    "Lender",
    "0501",
    { company: "Ridgeline Mortgage", rating: 5, jobTitle: "Loan officer" },
  ],
  [
    "achebe",
    "Ngozi Achebe",
    "Lender",
    "0502",
    { company: "Cumberland Savings", rating: 4, jobTitle: "Loan officer" },
  ],
  [
    "chen",
    "Alexis Chen",
    "Title",
    "0601",
    { company: "Lakeshore Title Partners", rating: 5, jobTitle: "Closing coordinator" },
  ],
  [
    "brandt",
    "Sylvia Brandt",
    "Title",
    "0602",
    { company: "Volunteer Title Group", rating: 4, jobTitle: "Escrow officer" },
  ],
  [
    "guillory",
    "Dean Guillory",
    "Inspector",
    "0701",
    { company: "Ironwood Home Inspection", rating: 5 },
  ],
  ["park", "Hana Park", "Appraiser", "0801", { company: "Meridian Appraisal", rating: 4 }],
];

export const DEMO_CONTACTS: DemoContactSpec[] = CONTACT_TUPLES.map(
  ([key, name, category, last4, extra]) => ({
    key,
    name,
    category,
    email: mail(name.toLowerCase().replace(/[^a-z]+/g, ".")),
    phone: `(615) 555-${last4}`,
    ...extra,
  }),
);

/** Notes a coordinator actually keeps, attached to a handful of contacts. */
export const DEMO_CONTACT_COMMENTS: Record<
  string,
  Array<{ daysAgo: number; author: "owner" | "alex" | "priya"; body: string }>
> = {
  bell: [
    {
      daysAgo: 8,
      author: "priya",
      body: "Works nights, so calls before noon go to voicemail. Text first, then call after 2pm.",
    },
  ],
  guillory: [
    {
      daysAgo: 14,
      author: "alex",
      body: "Books up two weeks out in spring. Get the inspection scheduled the same day the contract is signed.",
    },
  ],
  lee: [
    {
      daysAgo: 22,
      author: "owner",
      body: "Reliable on clear-to-close timing. Sends the CD without being chased, which is more than most.",
    },
  ],
  mcallister: [
    {
      daysAgo: 5,
      author: "owner",
      body: "Selling the family home after 30 years. Wants a real phone call at each milestone, not just the portal.",
    },
  ],
};

export interface DemoTaskSpec {
  title: string;
  /** Days from the anchor. Negative is overdue. */
  dueOffset: number;
  done?: boolean;
  assignee?: "owner" | "alex" | "priya";
  milestone?: boolean;
  /** Shown on the task; the "comments" on an overdue item. */
  notes?: string;
}

export interface DemoEmailSpec {
  direction: "INBOUND" | "OUTBOUND";
  daysAgo: number;
  /** Contact key the mail is with. */
  contactKey: string;
  subject: string;
  body: string;
}

export interface DemoTransactionSpec {
  key: string;
  clientKey: "harbor" | "kestrel" | "whitfield";
  address: string;
  city: string;
  state: string;
  zip: string;
  price: number;
  status: TransactionStatus;
  side: "BUY_SIDE" | "SELL_SIDE";
  /** Null on a listing that has no contract yet. */
  contractOffset: number | null;
  closeOffset: number | null;
  buyerKey?: string;
  sellerKey?: string;
  buyerAgentKey?: string;
  sellerAgentKey?: string;
  lenderKey?: string;
  titleKey?: string;
  // --- listing-sheet detail, used by the generated MLS PDF ---
  mlsNumber: string;
  beds: number;
  baths: number;
  sqft: number;
  yearBuilt: number;
  lotAcres: number;
  remarks: string;
  tasks: DemoTaskSpec[];
  emails?: DemoEmailSpec[];
  /** Only on the three closed-and-billed files. */
  invoice?: { amount: number; paidDaysAgo: number | null; issuedDaysAgo: number };
  /** Skips contract PDF generation on listings with no executed contract. */
  hasContract: boolean;
}

/**
 * The standard mid-file checklist, offset from close. Reused across files.
 *
 * Anything already past its date is marked done, uniformly. That is both
 * realistic (a file closing on Friday has long since cleared its earnest
 * money) and load-bearing: leaving a past-dated task open here would add
 * unintended overdue rows, and the only overdue tasks in this dataset are the
 * two deliberate ones that carry explanatory notes.
 */
function standardTasks(closeOffset: number, owner: "owner" | "alex" | "priya"): DemoTaskSpec[] {
  const rows: Array<[title: string, deltaFromClose: number, milestone?: boolean]> = [
    ["Confirm earnest money deposited", -28],
    ["Schedule home inspection", -25],
    ["Inspection contingency deadline", -18],
    ["Appraisal ordered", -15],
    ["Title commitment received", -12],
    ["Clear to close from lender", -7],
    ["Schedule closing with title company", -5],
    ["Final walkthrough", -1],
    ["Closing day: confirm funding and recording", 0, true],
  ];
  return rows.map(([title, delta, milestone]) => {
    const dueOffset = closeOffset + delta;
    return { title, dueOffset, done: dueOffset < 0, assignee: owner, milestone };
  });
}

/**
 * Fifteen files. Three closed and billed, three live listings with no
 * contract yet, and nine mid-flight — which is roughly what a working desk
 * looks like on any given Tuesday.
 *
 * Exactly two tasks carry a negative dueOffset while still open (on `oakfield`
 * and `sycamore`), and both carry notes. demo-dataset/data.test.ts pins that
 * count so a later edit cannot quietly turn the demo into a wall of red.
 */
export const DEMO_TRANSACTIONS: DemoTransactionSpec[] = [
  // ---------- Closed and billed ----------
  {
    key: "cedarbrook",
    clientKey: "harbor",
    address: "412 Cedarbrook Lane",
    city: "Franklin",
    state: "TN",
    zip: "37064",
    price: 615000,
    status: "CLOSED",
    side: "BUY_SIDE",
    contractOffset: -58,
    closeOffset: -16,
    buyerKey: "bell",
    sellerKey: "mcallister",
    buyerAgentKey: "rivera",
    sellerAgentKey: "shaw",
    lenderKey: "lee",
    titleKey: "chen",
    mlsNumber: "2612441",
    beds: 4,
    baths: 3,
    sqft: 2840,
    yearBuilt: 2016,
    lotAcres: 0.31,
    remarks:
      "Craftsman on a quiet cul-de-sac. Chef's kitchen, screened porch, three-car garage. Walk to Liberty Elementary.",
    hasContract: true,
    invoice: { amount: 495, issuedDaysAgo: 15, paidDaysAgo: 8 },
    tasks: [
      { title: "Confirm earnest money deposited", dueOffset: -54, done: true },
      { title: "Inspection contingency deadline", dueOffset: -44, done: true },
      { title: "Clear to close from lender", dueOffset: -23, done: true, assignee: "alex" },
      { title: "Final walkthrough", dueOffset: -17, done: true },
      {
        title: "Closing day: confirm funding and recording",
        dueOffset: -16,
        done: true,
        milestone: true,
      },
      { title: "Send closing package to client", dueOffset: -14, done: true, assignee: "priya" },
    ],
    emails: [
      {
        direction: "OUTBOUND",
        daysAgo: 16,
        contactKey: "bell",
        subject: "You're closed! Congratulations on 412 Cedarbrook",
        body: "Jordan,\n\nFunding confirmed and the deed recorded this afternoon. The keys are with Casey.\n\nYour full closing package is in the portal, including the settlement statement and every signed document from the file. It stays there permanently, so no need to save copies anywhere else.\n\nCongratulations. It was a pleasure working your file.\n\nAcme Brokers Inc",
      },
      {
        direction: "INBOUND",
        daysAgo: 15,
        contactKey: "bell",
        subject: "Re: You're closed! Congratulations on 412 Cedarbrook",
        body: "Thank you so much. Honestly the smoothest part of this whole move was the paperwork, which I did not expect. I've already told two people at work about you.",
      },
    ],
  },
  {
    key: "juniper",
    clientKey: "kestrel",
    address: "88 Juniper Hollow Road",
    city: "Brentwood",
    state: "TN",
    zip: "37027",
    price: 892000,
    status: "CLOSED",
    side: "SELL_SIDE",
    contractOffset: -66,
    closeOffset: -24,
    buyerKey: "okafor",
    sellerKey: "prescott",
    buyerAgentKey: "boone",
    sellerAgentKey: "delgado",
    lenderKey: "achebe",
    titleKey: "brandt",
    mlsNumber: "2609887",
    beds: 5,
    baths: 4,
    sqft: 4120,
    yearBuilt: 2009,
    lotAcres: 0.68,
    remarks:
      "Traditional brick on a wooded lot. Primary on main, finished basement with wet bar, saltwater pool.",
    hasContract: true,
    invoice: { amount: 650, issuedDaysAgo: 23, paidDaysAgo: 12 },
    tasks: [
      { title: "Confirm earnest money deposited", dueOffset: -62, done: true },
      { title: "Repair amendment executed", dueOffset: -49, done: true, assignee: "alex" },
      { title: "Clear to close from lender", dueOffset: -31, done: true },
      {
        title: "Closing day: confirm funding and recording",
        dueOffset: -24,
        done: true,
        milestone: true,
      },
    ],
    emails: [
      {
        direction: "INBOUND",
        daysAgo: 26,
        contactKey: "brandt",
        subject: "Settlement statement for review - 88 Juniper Hollow",
        body: "Attached is the preliminary settlement statement for Thursday's closing. Please review the seller-side credits and let me know if anything looks off before we send to the parties.\n\nSylvia Brandt\nVolunteer Title Group",
      },
    ],
  },
  {
    key: "willowmere",
    clientKey: "whitfield",
    address: "27 Willowmere Court",
    city: "Nashville",
    state: "TN",
    zip: "37215",
    price: 1245000,
    status: "CLOSED",
    side: "SELL_SIDE",
    contractOffset: -71,
    closeOffset: -31,
    buyerKey: "lindqvist",
    sellerKey: "yamashita",
    buyerAgentKey: "rivera",
    sellerAgentKey: "delgado",
    lenderKey: "lee",
    titleKey: "chen",
    mlsNumber: "2605512",
    beds: 5,
    baths: 5,
    sqft: 5230,
    yearBuilt: 2019,
    lotAcres: 0.94,
    remarks:
      "Custom build in Green Hills. Vaulted great room, guest suite on main, covered outdoor kitchen overlooking the ravine.",
    hasContract: true,
    invoice: { amount: 850, issuedDaysAgo: 30, paidDaysAgo: 21 },
    tasks: [
      { title: "Confirm earnest money deposited", dueOffset: -67, done: true },
      {
        title: "Appraisal received, value supported",
        dueOffset: -52,
        done: true,
        assignee: "alex",
      },
      {
        title: "Closing day: confirm funding and recording",
        dueOffset: -31,
        done: true,
        milestone: true,
      },
      { title: "Request review from seller", dueOffset: -24, done: true, assignee: "priya" },
    ],
  },

  // ---------- Mid-flight ----------
  {
    key: "oakfield",
    clientKey: "harbor",
    address: "1509 Oakfield Drive",
    city: "Nashville",
    state: "TN",
    zip: "37206",
    price: 528000,
    status: "UNDER_CONTRACT",
    side: "BUY_SIDE",
    contractOffset: -21,
    closeOffset: 9,
    buyerKey: "moreau",
    sellerKey: "broussard",
    buyerAgentKey: "rivera",
    sellerAgentKey: "shaw",
    lenderKey: "lee",
    titleKey: "chen",
    mlsNumber: "2618034",
    beds: 3,
    baths: 2,
    sqft: 1940,
    yearBuilt: 1948,
    lotAcres: 0.22,
    remarks:
      "Renovated East Nashville bungalow. Original hardwoods, new roof and HVAC in 2023, detached studio out back.",
    hasContract: true,
    tasks: [
      { title: "Confirm earnest money deposited", dueOffset: -18, done: true },
      { title: "Schedule home inspection", dueOffset: -15, done: true, assignee: "priya" },
      {
        title: "Chase repair amendment signature from seller",
        dueOffset: -3,
        assignee: "priya",
        notes:
          "Sent twice, no response. Listing agent says the seller is travelling and will sign Monday. If nothing by Monday noon, escalate to Harbor & Vine directly. Closing is in nine days, so this cannot slip much further.",
      },
      { title: "Appraisal ordered", dueOffset: -6, done: true },
      { title: "Clear to close from lender", dueOffset: 2, assignee: "owner" },
      { title: "Schedule closing with title company", dueOffset: 4, assignee: "owner" },
      { title: "Final walkthrough", dueOffset: 8, assignee: "alex" },
      {
        title: "Closing day: confirm funding and recording",
        dueOffset: 9,
        milestone: true,
        assignee: "owner",
      },
    ],
    emails: [
      {
        direction: "OUTBOUND",
        daysAgo: 5,
        contactKey: "shaw",
        subject: "Repair amendment - 1509 Oakfield Drive",
        body: "Tessa,\n\nFollowing up on the repair amendment sent last Tuesday. We need the seller's signature to keep the lender on schedule for the closing date.\n\nCould you confirm when we can expect it back?\n\nThanks,\nAcme Brokers Inc",
      },
      {
        direction: "INBOUND",
        daysAgo: 4,
        contactKey: "shaw",
        subject: "Re: Repair amendment - 1509 Oakfield Drive",
        body: "Sorry for the delay. Seller is out of the country until the weekend but has seen it and agrees to the terms. I'll have it signed and back to you Monday morning at the latest.",
      },
      {
        direction: "INBOUND",
        daysAgo: 2,
        contactKey: "lee",
        subject: "Conditional approval issued - Moreau",
        body: "Conditional approval is out. Remaining conditions are the signed repair amendment and updated homeowners binder. Once those land we're clear to close.\n\nMorgan Lee\nRidgeline Mortgage",
      },
    ],
  },
  {
    key: "sycamore",
    clientKey: "kestrel",
    address: "733 Sycamore Ridge",
    city: "Mount Juliet",
    state: "TN",
    zip: "37122",
    price: 447500,
    status: "UNDER_CONTRACT",
    side: "BUY_SIDE",
    contractOffset: -17,
    closeOffset: 13,
    buyerKey: "tanaka",
    sellerKey: "ravenel",
    buyerAgentKey: "delgado",
    sellerAgentKey: "boone",
    lenderKey: "achebe",
    titleKey: "brandt",
    mlsNumber: "2619220",
    beds: 4,
    baths: 3,
    sqft: 2310,
    yearBuilt: 2004,
    lotAcres: 0.28,
    remarks:
      "Two-story in Providence. Open plan main, bonus room up, fenced backyard backing to green space.",
    hasContract: true,
    tasks: [
      { title: "Confirm earnest money deposited", dueOffset: -14, done: true },
      { title: "Schedule home inspection", dueOffset: -11, done: true },
      {
        title: "Order survey from Meridian",
        dueOffset: -2,
        assignee: "alex",
        notes:
          "Meridian is backed up about ten days. Called and asked to be squeezed in; they will confirm tomorrow. Title needs this before the commitment can be finalised, so if Meridian cannot do it, try Cumberland Surveying instead.",
      },
      { title: "Title commitment received", dueOffset: 1, assignee: "alex" },
      { title: "Clear to close from lender", dueOffset: 6, assignee: "owner" },
      { title: "Final walkthrough", dueOffset: 12, assignee: "priya" },
      {
        title: "Closing day: confirm funding and recording",
        dueOffset: 13,
        milestone: true,
        assignee: "owner",
      },
    ],
    emails: [
      {
        direction: "INBOUND",
        daysAgo: 3,
        contactKey: "guillory",
        subject: "Inspection report - 733 Sycamore Ridge",
        body: "Report is attached. Headline items: water heater is at end of life, one GFCI outlet in the garage is not tripping, and there is minor grading toward the foundation on the north side.\n\nNothing structural. Happy to walk the buyer through it if useful.\n\nDean Guillory\nIronwood Home Inspection",
      },
    ],
  },
  {
    key: "brambleton",
    clientKey: "harbor",
    address: "204 Brambleton Avenue",
    city: "Franklin",
    state: "TN",
    zip: "37069",
    price: 735000,
    status: "PENDING",
    side: "SELL_SIDE",
    contractOffset: -34,
    closeOffset: 4,
    buyerKey: "delacroix",
    sellerKey: "oyelaran",
    buyerAgentKey: "boone",
    sellerAgentKey: "rivera",
    lenderKey: "lee",
    titleKey: "chen",
    mlsNumber: "2615903",
    beds: 4,
    baths: 3,
    sqft: 3050,
    yearBuilt: 2012,
    lotAcres: 0.41,
    remarks:
      "Westhaven traditional with a front porch and alley-load garage. Community pool, trails, and dog park.",
    hasContract: true,
    tasks: standardTasks(4, "owner"),
    emails: [
      {
        direction: "OUTBOUND",
        daysAgo: 6,
        contactKey: "oyelaran",
        subject: "Closing scheduled for 204 Brambleton",
        body: "Femi,\n\nClosing is confirmed with Lakeshore Title. You'll receive the exact time and address from them directly, along with wiring instructions.\n\nA reminder that we will never email you wiring changes. If you receive anything that looks like updated wire instructions, call us before acting on it.\n\nAcme Brokers Inc",
      },
    ],
  },
  {
    key: "harrowgate",
    clientKey: "whitfield",
    address: "1180 Harrowgate Place",
    city: "Brentwood",
    state: "TN",
    zip: "37027",
    price: 1075000,
    status: "UNDER_CONTRACT",
    side: "SELL_SIDE",
    contractOffset: -12,
    closeOffset: 22,
    buyerKey: "abara",
    sellerKey: "castellanos",
    buyerAgentKey: "rivera",
    sellerAgentKey: "delgado",
    lenderKey: "achebe",
    titleKey: "brandt",
    mlsNumber: "2620117",
    beds: 5,
    baths: 4,
    sqft: 4480,
    yearBuilt: 2015,
    lotAcres: 0.72,
    remarks:
      "Stately transitional with a two-story foyer, main-level primary, and a screened porch with fireplace.",
    hasContract: true,
    tasks: standardTasks(22, "alex"),
  },
  {
    key: "marlowe",
    clientKey: "kestrel",
    address: "56 Marlowe Bend",
    city: "Hendersonville",
    state: "TN",
    zip: "37075",
    price: 389000,
    status: "UNDER_CONTRACT",
    side: "BUY_SIDE",
    contractOffset: -9,
    closeOffset: 27,
    buyerKey: "kowalski",
    sellerKey: "thornbury",
    buyerAgentKey: "delgado",
    sellerAgentKey: "shaw",
    lenderKey: "lee",
    titleKey: "chen",
    mlsNumber: "2620884",
    beds: 3,
    baths: 2,
    sqft: 1780,
    yearBuilt: 1998,
    lotAcres: 0.34,
    remarks: "Ranch near Old Hickory Lake. New windows, level lot, boat parking on the side pad.",
    hasContract: true,
    tasks: standardTasks(27, "priya"),
    emails: [
      {
        direction: "INBOUND",
        daysAgo: 7,
        contactKey: "kowalski",
        subject: "Question about the inspection timeline",
        body: "Hi, I want to make sure I understand the deadlines. When exactly do I need to decide about repairs, and what happens if the inspector finds something big?\n\nThanks,\nIwona",
      },
      {
        direction: "OUTBOUND",
        daysAgo: 7,
        contactKey: "kowalski",
        subject: "Re: Question about the inspection timeline",
        body: "Iwona,\n\nGood question. Your inspection contingency runs through the date on your key dates list in the portal. Before that date you can ask for repairs, ask for a credit, or walk away and keep your earnest money.\n\nIf the inspector finds something major, we'd talk through the options together before anything is submitted. Nothing goes to the seller without your say-so.\n\nAcme Brokers Inc",
      },
    ],
  },
  {
    key: "pennyroyal",
    clientKey: "harbor",
    address: "9 Pennyroyal Way",
    city: "Nashville",
    state: "TN",
    zip: "37211",
    price: 462000,
    status: "UNDER_CONTRACT",
    side: "BUY_SIDE",
    contractOffset: -6,
    closeOffset: 31,
    buyerKey: "ferreira",
    sellerKey: "duplessis",
    buyerAgentKey: "rivera",
    sellerAgentKey: "boone",
    lenderKey: "achebe",
    titleKey: "brandt",
    mlsNumber: "2621340",
    beds: 4,
    baths: 3,
    sqft: 2260,
    yearBuilt: 2021,
    lotAcres: 0.19,
    remarks:
      "Nearly new construction with builder warranty remaining. Smart thermostat, tankless water heater, EV-ready garage.",
    hasContract: true,
    tasks: standardTasks(31, "owner"),
  },
  {
    key: "ashcombe",
    clientKey: "whitfield",
    address: "615 Ashcombe Trace",
    city: "Franklin",
    state: "TN",
    zip: "37067",
    price: 968000,
    status: "UNDER_CONTRACT",
    side: "SELL_SIDE",
    contractOffset: -4,
    closeOffset: 36,
    buyerKey: "haddad",
    sellerKey: "vanderberg",
    buyerAgentKey: "boone",
    sellerAgentKey: "delgado",
    lenderKey: "lee",
    titleKey: "chen",
    mlsNumber: "2621766",
    beds: 5,
    baths: 4,
    sqft: 3870,
    yearBuilt: 2017,
    lotAcres: 0.55,
    remarks:
      "Hardscape patio with built-in grill, plantation shutters throughout, three-car side-entry garage.",
    hasContract: true,
    tasks: standardTasks(36, "alex"),
  },
  {
    key: "thistledown",
    clientKey: "kestrel",
    address: "342 Thistledown Lane",
    city: "Nolensville",
    state: "TN",
    zip: "37135",
    price: 574000,
    status: "UNDER_CONTRACT",
    side: "BUY_SIDE",
    contractOffset: -2,
    closeOffset: 41,
    buyerKey: "novak",
    sellerKey: "mcallister",
    buyerAgentKey: "delgado",
    sellerAgentKey: "shaw",
    lenderKey: "achebe",
    titleKey: "brandt",
    mlsNumber: "2622013",
    beds: 4,
    baths: 3,
    sqft: 2690,
    yearBuilt: 2013,
    lotAcres: 0.36,
    remarks:
      "Corner lot in Bent Creek. Screened porch, upstairs bonus, sidewalks to the elementary.",
    hasContract: true,
    tasks: standardTasks(41, "priya"),
  },
  {
    key: "kingsferry",
    clientKey: "harbor",
    address: "78 Kingsferry Road",
    city: "Gallatin",
    state: "TN",
    zip: "37066",
    price: 341000,
    status: "UNDER_CONTRACT",
    side: "BUY_SIDE",
    contractOffset: -1,
    closeOffset: 46,
    buyerKey: "ibrahim",
    sellerKey: "ravenel",
    buyerAgentKey: "rivera",
    sellerAgentKey: "boone",
    lenderKey: "lee",
    titleKey: "chen",
    mlsNumber: "2622198",
    beds: 3,
    baths: 2,
    sqft: 1620,
    yearBuilt: 1994,
    lotAcres: 0.29,
    remarks: "Well-kept split-level with a newer roof, fenced yard, and a workshop in the garage.",
    hasContract: true,
    tasks: standardTasks(46, "owner"),
  },

  // ---------- Live listings, no contract yet ----------
  {
    key: "belvedere",
    clientKey: "whitfield",
    address: "2200 Belvedere Heights",
    city: "Nashville",
    state: "TN",
    zip: "37215",
    price: 1390000,
    status: "ACTIVE",
    side: "SELL_SIDE",
    contractOffset: null,
    closeOffset: null,
    sellerKey: "yamashita",
    sellerAgentKey: "delgado",
    mlsNumber: "2622540",
    beds: 5,
    baths: 6,
    sqft: 5640,
    yearBuilt: 2020,
    lotAcres: 1.12,
    remarks:
      "Architect-designed contemporary with walls of glass, elevator to all three levels, and a heated pool.",
    hasContract: false,
    tasks: [
      { title: "Confirm photography delivered to MLS", dueOffset: 2, assignee: "priya" },
      { title: "Collect showing feedback for seller", dueOffset: 5, assignee: "priya" },
      { title: "Weekly marketing report to seller", dueOffset: 7, assignee: "alex" },
    ],
  },
  {
    key: "quarryside",
    clientKey: "harbor",
    address: "17 Quarryside Court",
    city: "Brentwood",
    state: "TN",
    zip: "37027",
    price: 825000,
    status: "ACTIVE",
    side: "SELL_SIDE",
    contractOffset: null,
    closeOffset: null,
    sellerKey: "prescott",
    sellerAgentKey: "rivera",
    mlsNumber: "2622611",
    beds: 4,
    baths: 4,
    sqft: 3410,
    yearBuilt: 2007,
    lotAcres: 0.63,
    remarks:
      "Updated kitchen with quartz and gas range, primary down, flat backyard ready for a pool.",
    hasContract: false,
    tasks: [
      { title: "Schedule open house for Sunday", dueOffset: 3, assignee: "priya" },
      { title: "Price reduction discussion with seller", dueOffset: 11, assignee: "owner" },
    ],
  },
  {
    key: "hollybourne",
    clientKey: "kestrel",
    address: "451 Hollybourne Street",
    city: "Nashville",
    state: "TN",
    zip: "37208",
    price: 599000,
    status: "COMING_SOON",
    side: "SELL_SIDE",
    contractOffset: null,
    closeOffset: null,
    sellerKey: "oyelaran",
    sellerAgentKey: "shaw",
    mlsNumber: "2622755",
    beds: 3,
    baths: 3,
    sqft: 2080,
    yearBuilt: 2022,
    lotAcres: 0.11,
    remarks:
      "New-build townhome in Germantown. Rooftop terrace with skyline views, two-car tandem garage.",
    hasContract: false,
    tasks: [
      { title: "Confirm staging install date", dueOffset: 1, assignee: "priya" },
      { title: "Go live on MLS", dueOffset: 6, milestone: true, assignee: "alex" },
      { title: "Send just-listed campaign", dueOffset: 8, assignee: "alex" },
    ],
  },
];

/** The three that carry an invoice; kept as a derived list so it cannot drift. */
export const DEMO_CLOSED_KEYS = DEMO_TRANSACTIONS.filter((t) => t.invoice).map((t) => t.key);

/** Every task in the dataset, flattened, for counting and tests. */
export function allDemoTasks(): Array<DemoTaskSpec & { transactionKey: string }> {
  return DEMO_TRANSACTIONS.flatMap((t) =>
    t.tasks.map((task) => ({ ...task, transactionKey: t.key })),
  );
}

/** Open tasks with a due date in the past — the "overdue" pile. */
export function overdueDemoTasks() {
  return allDemoTasks().filter((t) => !t.done && t.dueOffset < 0);
}

/** Open tasks due between today and `withinDays` out. */
export function upcomingDemoTasks(withinDays = 30) {
  return allDemoTasks().filter((t) => !t.done && t.dueOffset >= 0 && t.dueOffset <= withinDays);
}

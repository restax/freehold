/**
 * Freehold's starter task-template library — four transaction plans covering
 * the shape of the work most residential TCs run: getting a listing live,
 * and carrying a file from executed contract to funded closing on the buy
 * side, the sell side, or both at once.
 *
 * Each entry's `emailKey` (when set) points at a row in
 * `starter-email-templates.ts` by its `key`; `dependsOnKey` points at
 * another entry in the *same* plan by its own `key`, resolved to a real
 * `dependsOnId` at seed time. Every entry defaults to assignee "TC 1",
 * visible to both portals, on the calendar, and unrestricted by side unless
 * stated — matching how a coordinator would actually set these up by hand.
 */

export type StarterTaskKind = "TODO" | "EMAIL" | "CALL";
export type StarterAnchor =
  | "CONTRACT_DATE"
  | "CLOSE_DATE"
  | "LIST_DATE"
  | "TEMPLATE_START"
  | "DEPENDENCY";
export type StarterSide = "BUY_SIDE" | "SELL_SIDE" | "DUAL";

export interface StarterTaskEntry {
  key: string;
  title: string;
  kind: StarterTaskKind;
  anchor: StarterAnchor;
  offsetDays: number;
  dependsOnKey?: string;
  emailKey?: string;
  sides?: StarterSide[];
  milestone?: boolean;
  visibleToClient?: boolean;
}

export interface StarterTaskPlan {
  name: string;
  group: string;
  description: string;
  entries: StarterTaskEntry[];
}

const TASK_GROUP = "Transaction plans";

const NEW_LISTING: StarterTaskPlan = {
  name: "New Listing",
  group: TASK_GROUP,
  description: "Everything to do when a seller hires us to put a home on the market.",
  entries: [
    {
      key: "apply-templates",
      title: "Apply attachment & key-date templates",
      kind: "TODO",
      anchor: "TEMPLATE_START",
      offsetDays: 0,
    },
    {
      key: "agent-kickoff",
      title: "Send agent the listing kickoff email",
      kind: "EMAIL",
      anchor: "TEMPLATE_START",
      offsetDays: 0,
      emailKey: "seller_listing_kickoff",
      visibleToClient: false,
    },
    {
      key: "seller-welcome",
      title: "Send seller the listing welcome email",
      kind: "EMAIL",
      anchor: "TEMPLATE_START",
      offsetDays: 0,
      emailKey: "seller_listing_welcome",
      visibleToClient: false,
    },
    {
      key: "mls-entry",
      title: "Enter listing details in the MLS",
      kind: "TODO",
      anchor: "LIST_DATE",
      offsetDays: -5,
    },
    {
      key: "agent-signoff",
      title: "Get agent sign-off on the listing",
      kind: "TODO",
      anchor: "LIST_DATE",
      offsetDays: -3,
    },
    {
      key: "mls-active",
      title: "Flip MLS status to Active",
      kind: "TODO",
      anchor: "LIST_DATE",
      offsetDays: 0,
      milestone: true,
    },
    {
      key: "showing-instructions",
      title: "Load showing instructions into the showing service",
      kind: "TODO",
      anchor: "LIST_DATE",
      offsetDays: 0,
    },
    {
      key: "apply-uc-plan",
      title: "Apply the under-contract task template",
      kind: "TODO",
      anchor: "CONTRACT_DATE",
      offsetDays: 0,
    },
  ],
};

const UNDER_CONTRACT_BUYER: StarterTaskPlan = {
  name: "Under Contract — Buyer Side",
  group: TASK_GROUP,
  description: "Buyer-side workflow from executed contract to funded closing.",
  entries: [
    {
      key: "apply-templates",
      title: "Apply attachment & key-date templates",
      kind: "TODO",
      anchor: "CONTRACT_DATE",
      offsetDays: 0,
    },
    {
      key: "agent-kickoff",
      title: "Send agent the under-contract kickoff email",
      kind: "EMAIL",
      anchor: "CONTRACT_DATE",
      offsetDays: 0,
      emailKey: "either_agent_kickoff",
      visibleToClient: false,
    },
    {
      key: "buyer-welcome",
      title: "Send buyer the welcome email",
      kind: "EMAIL",
      anchor: "CONTRACT_DATE",
      offsetDays: 0,
      emailKey: "buyer_welcome",
    },
    {
      key: "other-intro",
      title: "Send intro to other agent, lender & closer",
      kind: "EMAIL",
      anchor: "CONTRACT_DATE",
      offsetDays: 0,
      emailKey: "buyer_other_intro",
      visibleToClient: false,
    },
    {
      key: "schedule-inspections",
      title: "Schedule inspections",
      kind: "CALL",
      anchor: "CONTRACT_DATE",
      offsetDays: 0,
    },
    {
      key: "buyer-checkin",
      title: "Buyer check-in",
      kind: "EMAIL",
      anchor: "CONTRACT_DATE",
      offsetDays: 7,
      emailKey: "buyer_checkin",
    },
    {
      key: "appraisal-ordered",
      title: "Confirm appraisal has been ordered",
      kind: "TODO",
      anchor: "CONTRACT_DATE",
      offsetDays: 10,
    },
    {
      key: "repair-amendment",
      title: "Receive fully signed repair amendment",
      kind: "TODO",
      anchor: "CONTRACT_DATE",
      offsetDays: 13,
    },
    {
      key: "other-agent-checkin",
      title: "Other agent check-in",
      kind: "EMAIL",
      anchor: "CLOSE_DATE",
      offsetDays: -15,
      emailKey: "either_other_agent_checkin",
      visibleToClient: false,
    },
    {
      key: "lender-closer-checkin",
      title: "Lender & closer check-in",
      kind: "EMAIL",
      anchor: "CLOSE_DATE",
      offsetDays: -15,
      emailKey: "either_lender_closer_checkin",
      visibleToClient: false,
    },
    {
      key: "agent-checkin",
      title: "Agent check-in",
      kind: "EMAIL",
      anchor: "CLOSE_DATE",
      offsetDays: -15,
      emailKey: "either_agent_checkin",
    },
    {
      key: "buyer-preparing",
      title: "Send buyer the preparing-to-close email",
      kind: "EMAIL",
      anchor: "CLOSE_DATE",
      offsetDays: -14,
      emailKey: "buyer_preparing",
    },
    {
      key: "ask-amendments",
      title: "Ask lender/closer for any amendments",
      kind: "EMAIL",
      anchor: "CLOSE_DATE",
      offsetDays: -10,
      emailKey: "either_send_documents",
    },
    {
      key: "appraisal-complete",
      title: "Confirm appraisal is complete",
      kind: "TODO",
      anchor: "CLOSE_DATE",
      offsetDays: -10,
    },
    {
      key: "title-commitment",
      title: "Receive title commitment",
      kind: "TODO",
      anchor: "CLOSE_DATE",
      offsetDays: -7,
    },
    {
      key: "schedule-walkthrough",
      title: "Schedule the final walk-through",
      kind: "TODO",
      anchor: "CLOSE_DATE",
      offsetDays: -7,
    },
    {
      key: "schedule-closing",
      title: "Schedule closing",
      kind: "TODO",
      anchor: "CLOSE_DATE",
      offsetDays: -7,
    },
    {
      key: "commission-agreement",
      title: "Send closer the commission agreement",
      kind: "EMAIL",
      anchor: "CLOSE_DATE",
      offsetDays: -7,
      emailKey: "either_send_documents",
      visibleToClient: false,
    },
    {
      key: "home-warranty",
      title: "Order the home warranty",
      kind: "TODO",
      anchor: "CLOSE_DATE",
      offsetDays: -5,
    },
    {
      key: "repair-receipts",
      title: "Receive repair receipts",
      kind: "TODO",
      anchor: "CLOSE_DATE",
      offsetDays: -3,
    },
    {
      key: "prelim-docs",
      title: "Receive preliminary closing documents",
      kind: "TODO",
      anchor: "CLOSE_DATE",
      offsetDays: -3,
    },
    {
      key: "final-docs",
      title: "Receive final signed closing documents",
      kind: "TODO",
      anchor: "CLOSE_DATE",
      offsetDays: 0,
    },
    {
      key: "update-status",
      title: "Update file status",
      kind: "TODO",
      anchor: "CLOSE_DATE",
      offsetDays: 0,
    },
    {
      key: "closed-funded",
      title: "Confirm transaction closed & funded",
      kind: "TODO",
      anchor: "CLOSE_DATE",
      offsetDays: 1,
      milestone: true,
    },
    {
      key: "buyer-thankyou",
      title: "Send buyer the thank-you email",
      kind: "EMAIL",
      anchor: "DEPENDENCY",
      offsetDays: 0,
      dependsOnKey: "closed-funded",
      emailKey: "buyer_thankyou",
    },
    {
      key: "other-agent-thankyou",
      title: "Send other agent the thank-you email",
      kind: "EMAIL",
      anchor: "DEPENDENCY",
      offsetDays: 0,
      dependsOnKey: "closed-funded",
      emailKey: "either_other_agent_thankyou",
      visibleToClient: false,
    },
    {
      key: "agent-thankyou-invoice",
      title: "Send agent thank-you & invoice",
      kind: "EMAIL",
      anchor: "CLOSE_DATE",
      offsetDays: 2,
      emailKey: "either_agent_thankyou_invoice",
      visibleToClient: false,
    },
    {
      key: "invoice-paid",
      title: "Confirm invoice paid",
      kind: "TODO",
      anchor: "DEPENDENCY",
      offsetDays: 7,
      dependsOnKey: "agent-thankyou-invoice",
    },
  ],
};

const UNDER_CONTRACT_SELLER: StarterTaskPlan = {
  name: "Under Contract — Seller Side",
  group: TASK_GROUP,
  description: "Seller-side workflow from executed contract to funded closing.",
  entries: [
    {
      key: "apply-templates",
      title: "Apply attachment & key-date templates",
      kind: "TODO",
      anchor: "CONTRACT_DATE",
      offsetDays: 0,
    },
    {
      key: "agent-kickoff",
      title: "Send agent the under-contract kickoff email",
      kind: "EMAIL",
      anchor: "CONTRACT_DATE",
      offsetDays: 0,
      emailKey: "either_agent_kickoff",
      visibleToClient: false,
    },
    {
      key: "seller-welcome",
      title: "Send seller the under-contract welcome email",
      kind: "EMAIL",
      anchor: "CONTRACT_DATE",
      offsetDays: 0,
      emailKey: "seller_uc_welcome",
    },
    {
      key: "other-intro",
      title: "Send intro to other agent & closer",
      kind: "EMAIL",
      anchor: "CONTRACT_DATE",
      offsetDays: 0,
      emailKey: "seller_other_intro",
      visibleToClient: false,
    },
    {
      key: "mls-under-contract",
      title: "Flip MLS status to Under Contract",
      kind: "TODO",
      anchor: "CONTRACT_DATE",
      offsetDays: 0,
    },
    {
      key: "emd-receipt",
      title: "Receive earnest-money receipt",
      kind: "TODO",
      anchor: "CONTRACT_DATE",
      offsetDays: 3,
    },
    {
      key: "seller-checkin",
      title: "Seller check-in",
      kind: "EMAIL",
      anchor: "CONTRACT_DATE",
      offsetDays: 7,
      emailKey: "seller_checkin",
    },
    {
      key: "disclosure",
      title: "Receive fully signed property disclosure",
      kind: "TODO",
      anchor: "CONTRACT_DATE",
      offsetDays: 8,
    },
    {
      key: "appraisal-ordered",
      title: "Confirm appraisal has been ordered",
      kind: "TODO",
      anchor: "CONTRACT_DATE",
      offsetDays: 10,
    },
    {
      key: "repair-request",
      title: "Receive repair request amendment",
      kind: "TODO",
      anchor: "CONTRACT_DATE",
      offsetDays: 13,
    },
    {
      key: "schedule-repairs",
      title: "Schedule repair appointments",
      kind: "CALL",
      anchor: "CONTRACT_DATE",
      offsetDays: 16,
    },
    {
      key: "other-agent-checkin",
      title: "Other agent & closer check-in",
      kind: "EMAIL",
      anchor: "CLOSE_DATE",
      offsetDays: -15,
      emailKey: "seller_other_checkin",
      visibleToClient: false,
    },
    {
      key: "agent-checkin",
      title: "Agent check-in",
      kind: "EMAIL",
      anchor: "CLOSE_DATE",
      offsetDays: -15,
      emailKey: "either_agent_checkin",
    },
    {
      key: "seller-preparing",
      title: "Send seller the preparing-to-close email",
      kind: "EMAIL",
      anchor: "CLOSE_DATE",
      offsetDays: -14,
      emailKey: "seller_preparing",
    },
    {
      key: "ask-amendments",
      title: "Ask closer for any amendments",
      kind: "EMAIL",
      anchor: "CLOSE_DATE",
      offsetDays: -10,
      emailKey: "either_send_documents",
    },
    {
      key: "schedule-closing",
      title: "Schedule closing",
      kind: "TODO",
      anchor: "CLOSE_DATE",
      offsetDays: -7,
    },
    {
      key: "commission-agreement",
      title: "Send closer the commission agreement",
      kind: "EMAIL",
      anchor: "CLOSE_DATE",
      offsetDays: -7,
      emailKey: "either_send_documents",
      visibleToClient: false,
    },
    {
      key: "repair-invoices",
      title: "Provide repair invoices",
      kind: "EMAIL",
      anchor: "CLOSE_DATE",
      offsetDays: -3,
      emailKey: "either_send_documents",
    },
    {
      key: "prelim-docs",
      title: "Receive preliminary closing documents",
      kind: "TODO",
      anchor: "CLOSE_DATE",
      offsetDays: -3,
    },
    {
      key: "final-docs",
      title: "Receive final signed closing documents",
      kind: "TODO",
      anchor: "CLOSE_DATE",
      offsetDays: 0,
    },
    {
      key: "mls-sold",
      title: "Flip MLS status to Sold",
      kind: "TODO",
      anchor: "CLOSE_DATE",
      offsetDays: 0,
    },
    {
      key: "update-status",
      title: "Update file status",
      kind: "TODO",
      anchor: "CLOSE_DATE",
      offsetDays: 0,
    },
    {
      key: "closed-funded",
      title: "Confirm transaction closed & funded",
      kind: "TODO",
      anchor: "CLOSE_DATE",
      offsetDays: 1,
      milestone: true,
    },
    {
      key: "seller-thankyou",
      title: "Send seller the thank-you email",
      kind: "EMAIL",
      anchor: "DEPENDENCY",
      offsetDays: 0,
      dependsOnKey: "closed-funded",
      emailKey: "seller_thankyou",
    },
    {
      key: "other-agent-thankyou",
      title: "Send other agent the thank-you email",
      kind: "EMAIL",
      anchor: "DEPENDENCY",
      offsetDays: 0,
      dependsOnKey: "closed-funded",
      emailKey: "either_other_agent_thankyou",
      visibleToClient: false,
    },
    {
      key: "agent-thankyou-invoice",
      title: "Send agent thank-you & invoice",
      kind: "EMAIL",
      anchor: "CLOSE_DATE",
      offsetDays: 2,
      emailKey: "either_agent_thankyou_invoice",
      visibleToClient: false,
    },
    {
      key: "invoice-paid",
      title: "Confirm invoice paid",
      kind: "TODO",
      anchor: "DEPENDENCY",
      offsetDays: 7,
      dependsOnKey: "agent-thankyou-invoice",
    },
  ],
};

const UNDER_CONTRACT_DUAL: StarterTaskPlan = {
  name: "Under Contract — Dual",
  group: TASK_GROUP,
  description:
    "Both sides of one file coordinated together — the shared workflow runs once; each side keeps its own welcome, check-in, and closing correspondence.",
  entries: [
    {
      key: "apply-templates",
      title: "Apply attachment & key-date templates",
      kind: "TODO",
      anchor: "CONTRACT_DATE",
      offsetDays: 0,
    },
    {
      key: "agent-kickoff",
      title: "Send agent the under-contract kickoff email",
      kind: "EMAIL",
      anchor: "CONTRACT_DATE",
      offsetDays: 0,
      emailKey: "either_agent_kickoff",
      visibleToClient: false,
    },
    {
      key: "buyer-welcome",
      title: "Send buyer the welcome email",
      kind: "EMAIL",
      anchor: "CONTRACT_DATE",
      offsetDays: 0,
      emailKey: "buyer_welcome",
      sides: ["BUY_SIDE", "DUAL"],
    },
    {
      key: "seller-welcome",
      title: "Send seller the welcome email",
      kind: "EMAIL",
      anchor: "CONTRACT_DATE",
      offsetDays: 0,
      emailKey: "seller_uc_welcome",
      sides: ["SELL_SIDE", "DUAL"],
    },
    {
      key: "closer-lender-intro",
      title: "Send intro to closer & lender",
      kind: "EMAIL",
      anchor: "CONTRACT_DATE",
      offsetDays: 0,
      emailKey: "dual_closer_lender_intro",
      visibleToClient: false,
    },
    {
      key: "schedule-inspections",
      title: "Schedule inspections",
      kind: "CALL",
      anchor: "CONTRACT_DATE",
      offsetDays: 0,
    },
    {
      key: "emd-receipt",
      title: "Receive earnest-money receipt",
      kind: "TODO",
      anchor: "CONTRACT_DATE",
      offsetDays: 3,
    },
    {
      key: "buyer-checkin",
      title: "Buyer check-in",
      kind: "EMAIL",
      anchor: "CONTRACT_DATE",
      offsetDays: 7,
      emailKey: "buyer_checkin",
      sides: ["BUY_SIDE", "DUAL"],
    },
    {
      key: "seller-checkin",
      title: "Seller check-in",
      kind: "EMAIL",
      anchor: "CONTRACT_DATE",
      offsetDays: 7,
      emailKey: "seller_checkin",
      sides: ["SELL_SIDE", "DUAL"],
    },
    {
      key: "disclosure",
      title: "Receive fully signed property disclosure",
      kind: "TODO",
      anchor: "CONTRACT_DATE",
      offsetDays: 8,
    },
    {
      key: "appraisal-ordered",
      title: "Confirm appraisal has been ordered",
      kind: "TODO",
      anchor: "CONTRACT_DATE",
      offsetDays: 10,
    },
    {
      key: "repair-amendment",
      title: "Receive fully signed repair amendment",
      kind: "TODO",
      anchor: "CONTRACT_DATE",
      offsetDays: 13,
    },
    {
      key: "agent-checkin",
      title: "Agent check-in",
      kind: "EMAIL",
      anchor: "CLOSE_DATE",
      offsetDays: -15,
      emailKey: "either_agent_checkin",
    },
    {
      key: "buyer-preparing",
      title: "Send buyer the preparing-to-close email",
      kind: "EMAIL",
      anchor: "CLOSE_DATE",
      offsetDays: -14,
      emailKey: "buyer_preparing",
      sides: ["BUY_SIDE", "DUAL"],
    },
    {
      key: "seller-preparing",
      title: "Send seller the preparing-to-close email",
      kind: "EMAIL",
      anchor: "CLOSE_DATE",
      offsetDays: -14,
      emailKey: "seller_preparing",
      sides: ["SELL_SIDE", "DUAL"],
    },
    {
      key: "appraisal-complete",
      title: "Confirm appraisal is complete",
      kind: "TODO",
      anchor: "CLOSE_DATE",
      offsetDays: -10,
    },
    {
      key: "title-commitment",
      title: "Receive title commitment",
      kind: "TODO",
      anchor: "CLOSE_DATE",
      offsetDays: -7,
    },
    {
      key: "schedule-walkthrough",
      title: "Schedule the final walk-through",
      kind: "TODO",
      anchor: "CLOSE_DATE",
      offsetDays: -7,
    },
    {
      key: "schedule-closing",
      title: "Schedule closing",
      kind: "TODO",
      anchor: "CLOSE_DATE",
      offsetDays: -7,
    },
    {
      key: "home-warranty",
      title: "Order the home warranty",
      kind: "TODO",
      anchor: "CLOSE_DATE",
      offsetDays: -5,
      sides: ["BUY_SIDE", "DUAL"],
    },
    {
      key: "repair-invoices",
      title: "Provide repair invoices",
      kind: "EMAIL",
      anchor: "CLOSE_DATE",
      offsetDays: -3,
      emailKey: "either_send_documents",
      sides: ["SELL_SIDE", "DUAL"],
    },
    {
      key: "prelim-docs",
      title: "Receive preliminary closing documents",
      kind: "TODO",
      anchor: "CLOSE_DATE",
      offsetDays: -3,
    },
    {
      key: "final-docs",
      title: "Receive final signed closing documents",
      kind: "TODO",
      anchor: "CLOSE_DATE",
      offsetDays: 0,
    },
    {
      key: "update-status",
      title: "Update file status",
      kind: "TODO",
      anchor: "CLOSE_DATE",
      offsetDays: 0,
    },
    {
      key: "closed-funded",
      title: "Confirm transaction closed & funded",
      kind: "TODO",
      anchor: "CLOSE_DATE",
      offsetDays: 1,
      milestone: true,
    },
    {
      key: "buyer-thankyou",
      title: "Send buyer the thank-you email",
      kind: "EMAIL",
      anchor: "DEPENDENCY",
      offsetDays: 0,
      dependsOnKey: "closed-funded",
      emailKey: "buyer_thankyou",
      sides: ["BUY_SIDE", "DUAL"],
    },
    {
      key: "seller-thankyou",
      title: "Send seller the thank-you email",
      kind: "EMAIL",
      anchor: "DEPENDENCY",
      offsetDays: 0,
      dependsOnKey: "closed-funded",
      emailKey: "seller_thankyou",
      sides: ["SELL_SIDE", "DUAL"],
    },
    {
      key: "agent-thankyou-invoice",
      title: "Send agent thank-you & invoice",
      kind: "EMAIL",
      anchor: "CLOSE_DATE",
      offsetDays: 2,
      emailKey: "either_agent_thankyou_invoice",
      visibleToClient: false,
    },
    {
      key: "invoice-paid",
      title: "Confirm invoice paid",
      kind: "TODO",
      anchor: "DEPENDENCY",
      offsetDays: 7,
      dependsOnKey: "agent-thankyou-invoice",
    },
  ],
};

export const STARTER_TASK_PLANS: StarterTaskPlan[] = [
  NEW_LISTING,
  UNDER_CONTRACT_BUYER,
  UNDER_CONTRACT_SELLER,
  UNDER_CONTRACT_DUAL,
];

export interface StarterAttachmentTemplate {
  name: string;
  group: string;
  description: string;
  items: string[];
}

export const STARTER_ATTACHMENT_TEMPLATES: StarterAttachmentTemplate[] = [
  {
    name: "New listing file",
    group: TASK_GROUP,
    description: "Documents to collect when a listing opens.",
    items: [
      "Listing agreement",
      "Seller's disclosure",
      "Property survey",
      "MLS sheet",
      "Photo contract/receipt",
      "HOA documents (if applicable)",
    ],
  },
  {
    name: "Under contract file",
    group: TASK_GROUP,
    description: "Documents every under-contract file carries.",
    items: [
      "Executed purchase agreement",
      "All amendments & addenda",
      "Earnest-money receipt",
      "Inspection report",
      "Repair amendment",
      "Appraisal",
      "Title commitment",
      "Commission agreement",
      "Closing disclosure/settlement statement",
      "Final signed closing package",
    ],
  },
];

export interface StarterDateTemplateItem {
  label: string;
  dateKey: string;
  anchor?: StarterAnchor;
  offsetDays?: number;
  calculator?: string;
}

export interface StarterDateTemplate {
  name: string;
  group: string;
  description: string;
  items: StarterDateTemplateItem[];
}

export const STARTER_DATE_TEMPLATES: StarterDateTemplate[] = [
  {
    name: "Contract dates",
    group: TASK_GROUP,
    description: "Applied when a file goes under contract — confirm or override every value.",
    items: [
      { label: "Effective (contract) date", dateKey: "contractDate" },
      {
        label: "Earnest money due",
        dateKey: "earnestMoneyDueDate",
        anchor: "CONTRACT_DATE",
        offsetDays: 3,
        calculator: "BUSINESS_DAYS",
      },
      {
        label: "Inspection deadline",
        dateKey: "inspectionDeadlineDate",
        anchor: "CONTRACT_DATE",
        offsetDays: 10,
        calculator: "BUSINESS_DAYS",
      },
      {
        label: "Mortgage commitment",
        dateKey: "mortgageCommitmentDate",
        anchor: "CONTRACT_DATE",
        offsetDays: 21,
        calculator: "CALENDAR_NEXT_BUSINESS_DAY",
      },
      { label: "Closing date", dateKey: "closeDate" },
    ],
  },
];

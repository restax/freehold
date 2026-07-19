/**
 * The starter email-template library. Seeded into new workspaces (and
 * backfilled into existing ones by migration) as removable samples. Every
 * template carries a category and task-match keywords so the right
 * templates surface when emailing from a task.
 */
export const EMAIL_CATEGORY_LABELS: Record<string, string> = {
  STATUS: "Status updates",
  INTRO: "Introductions",
  PORTAL: "Portals",
  MILESTONE: "Contract to close",
  LISTING: "Listing",
  POST_CLOSE: "Post-close",
  OTHER: "Other",
};

export interface LibraryTemplate {
  name: string;
  category: keyof typeof EMAIL_CATEGORY_LABELS;
  taskMatch: string | null;
  subject: string;
  body: string;
}

export const EMAIL_TEMPLATE_LIBRARY: LibraryTemplate[] = [
  {
    name: "Status update",
    category: "STATUS",
    taskMatch: "status,update",
    subject: "Update on {{property_address}}",
    body: `Hi {{client_name}},

A quick status update on **{{property_address}}**:

- Contract date: {{contract_date}}
- Closing date: {{close_date}}

Everything is on track. Reply to this email with any questions — it lands right on the file.

{{tc_name}}`,
  },
  {
    name: "Introductions — all parties",
    category: "INTRO",
    taskMatch: "introduction,intro",
    subject: "Introductions: {{property_address}}",
    body: `Hello all,

Introducing the team for **{{property_address}}**:

- Buyer's agent: {{buyer_agent_name}}
- Listing agent: {{listing_agent_name}}
- Lender: {{lender_name}}
- Title: {{title_company_name}}

I'm coordinating this file for {{tenant_name}} and will keep everyone on schedule toward the {{close_date}} closing. Reply-all works — replies land on the transaction record.

{{tc_name}}`,
  },
  {
    name: "Portal invitation",
    category: "PORTAL",
    taskMatch: "portal",
    subject: "Your transaction portal — {{property_address}}",
    body: `Hi {{client_name}},

Here's your private portal for **{{property_address}}** — every date, document, and milestone, always current:

[paste portal link here]

Bookmark it. When something changes, the portal already knows.

{{tc_name}}`,
  },
  {
    name: "Earnest money reminder",
    category: "MILESTONE",
    taskMatch: "earnest,emd,deposit",
    subject: "Earnest money deposit — {{property_address}}",
    body: `Hi {{buyer_name}},

A friendly reminder that the earnest money deposit for **{{property_address}}** is coming due. Your agent or the title company ({{title_company_name}}) can confirm the exact amount and wiring instructions.

**Important: always confirm wiring instructions by phone using a number you already trust. Never wire based on emailed instructions alone.**

Reply here once it's sent and we'll confirm receipt on our side.

{{tc_name}}`,
  },
  {
    name: "Inspection scheduled",
    category: "MILESTONE",
    taskMatch: "inspection",
    subject: "Inspection scheduled — {{property_address}}",
    body: `Hi {{buyer_name}},

Your inspection for **{{property_address}}** is scheduled. A few reminders:

- Plan for 2–3 hours on site
- Bring questions — the inspector will walk you through findings
- The written report follows within 24–48 hours

We'll review the report together as soon as it lands.

{{tc_name}}`,
  },
  {
    name: "Inspection report received",
    category: "MILESTONE",
    taskMatch: "inspection,contingency,resolution",
    subject: "Inspection report — {{property_address}}",
    body: `Hi {{client_name}},

The inspection report for **{{property_address}}** is in and shared to your portal. Next step: review it with your agent and decide on any repair requests before the contingency deadline.

Nothing in a report is a surprise if we talk it through — reply here or call any time.

{{tc_name}}`,
  },
  {
    name: "Appraisal ordered",
    category: "MILESTONE",
    taskMatch: "appraisal",
    subject: "Appraisal ordered — {{property_address}}",
    body: `Hi {{client_name}},

The appraisal for **{{property_address}}** has been ordered by {{lender_name}}. Typical turnaround is about a week; the property just needs to be accessible.

We'll let you know the moment the report comes back.

{{tc_name}}`,
  },
  {
    name: "Loan approval / clear to close",
    category: "MILESTONE",
    taskMatch: "loan,financing,clear to close,commitment,approval",
    subject: "Great news — clear to close on {{property_address}}",
    body: `Hi {{buyer_name}},

**{{lender_name}} has issued the clear to close** for {{property_address}} — the financing hurdle is behind you.

From here: final walkthrough, then closing on {{close_date}}. We'll confirm times shortly.

{{tc_name}}`,
  },
  {
    name: "Title & escrow opened",
    category: "MILESTONE",
    taskMatch: "title,escrow,commitment",
    subject: "Title opened — {{property_address}}",
    body: `Hello all,

Title and escrow for **{{property_address}}** are open with {{title_company_name}}. The title commitment will circulate once issued; flag any questions on it early.

{{tc_name}}
{{tenant_name}}`,
  },
  {
    name: "Final walkthrough & closing details",
    category: "MILESTONE",
    taskMatch: "walkthrough,closing,funding",
    subject: "Closing details — {{property_address}}",
    body: `Hi {{client_name}},

We're almost there on **{{property_address}}**:

- Final walkthrough: typically the day before or morning of closing
- Closing date: {{close_date}}
- Bring government-issued ID; funds per {{title_company_name}}'s instructions

**Confirm any wiring instructions by phone with the title company before sending funds.**

{{tc_name}}`,
  },
  {
    name: "Listing live",
    category: "LISTING",
    taskMatch: "listing,mls,syndication,photography,sign",
    subject: "You're live — {{property_address}}",
    body: `Hi {{seller_name}},

**{{property_address}} is live on the MLS** and syndicating to the major sites. Photos, sign, and showings are all set.

We'll pass along showing feedback as it arrives so you always know how the market is responding.

{{tc_name}}`,
  },
  {
    name: "Showing feedback request",
    category: "LISTING",
    taskMatch: "showing,feedback",
    subject: "Feedback on your showing — {{property_address}}",
    body: `Hi,

Thanks for showing **{{property_address}}**. Two quick questions while it's fresh:

- How did your buyers respond?
- Any feedback on price or condition?

A one-line reply is perfect — it lands straight on our file and helps the sellers enormously.

{{tc_name}}
{{tenant_name}}`,
  },
  {
    name: "Closed — congratulations",
    category: "POST_CLOSE",
    taskMatch: "congratulations,records,post-close,closed",
    subject: "Congratulations — {{property_address}} is closed!",
    body: `Hi {{client_name}},

**{{property_address}} is officially closed.** Congratulations!

Your complete records package stays available in your portal. Keep it — you'll want it at tax time.

It was a pleasure working with you.

{{tc_name}}`,
  },
  {
    name: "Review / referral ask",
    category: "POST_CLOSE",
    taskMatch: "review,referral",
    subject: "A small favor?",
    body: `Hi {{client_name}},

Now that **{{property_address}}** has closed, one small ask: if the process felt smooth, a short review or a referral to anyone buying or selling means the world to a business like ours.

Either way — thank you for trusting us with it.

{{tc_name}}
{{tenant_name}}`,
  },
];

/** Split templates into (suggested for a task title, the rest). */
export function suggestForTask<T extends { taskMatch: string | null }>(
  templates: T[],
  taskTitle: string | undefined,
): { suggested: T[]; rest: T[] } {
  if (!taskTitle) return { suggested: [], rest: templates };
  const title = taskTitle.toLowerCase();
  const suggested: T[] = [];
  const rest: T[] = [];
  for (const t of templates) {
    const keywords = (t.taskMatch ?? "").split(",").map((k) => k.trim().toLowerCase());
    if (keywords.some((k) => k && title.includes(k))) suggested.push(t);
    else rest.push(t);
  }
  return { suggested, rest };
}

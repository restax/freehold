/**
 * The default email templates every workspace starts with, grouped by
 * transaction phase. Seeded on tenant creation (isSample: false, so "remove
 * sample data" leaves them) and re-addable from the Emails page. Each is
 * individually deletable.
 *
 * Bodies use the lite-markdown the branded renderer understands: **bold**,
 * _italic_, "# "/"## " headings, "- " bullets, and "!! " warning callouts.
 * Real merge codes (property_address, client_name, close_date, contract_date,
 * lender_name, title_company_name, …) fill automatically from the transaction;
 * anything transaction-specific that Freehold can't know — inspection dates,
 * links, years — is a [bracketed] blank the coordinator fills before sending.
 */

export interface DefaultEmailTemplate {
  name: string;
  category: string;
  subject: string;
  body: string;
  taskMatch?: string;
  attachMatch?: string;
}

/** Ordered phase categories, used to group and label the template library. */
export const EMAIL_PHASES: Array<{ key: string; label: string; blurb: string }> = [
  {
    key: "CONTRACT",
    label: "Contract & welcome",
    blurb: "Set the tone right after an accepted offer and introduce the workflow.",
  },
  {
    key: "DUE_DILIGENCE",
    label: "Due diligence & inspections",
    blurb: "Keep the risk-heavy inspection and contingency window on schedule.",
  },
  {
    key: "CLOSING",
    label: "Closing & settlement",
    blurb: "Logistics and security for the final stretch before funding.",
  },
  {
    key: "POST_CLOSE",
    label: "Post-closing",
    blurb: "Celebrate, ask for the review, and stay in touch for the long term.",
  },
  { key: "GENERAL", label: "General", blurb: "Everything else." },
];

/** A category string mapped to a known phase, or GENERAL for anything legacy. */
export function phaseOf(category: string): string {
  return EMAIL_PHASES.some((p) => p.key === category) ? category : "GENERAL";
}

export const DEFAULT_EMAIL_TEMPLATES: DefaultEmailTemplate[] = [
  // ── Phase 1: Contract & welcome ───────────────────────────────────────────
  {
    name: "Buyer welcome & roadmap",
    category: "CONTRACT",
    taskMatch: "welcome, intro, introduction, buyer",
    subject: "Welcome! Your transaction roadmap for {{property_address}}",
    body: `Hi {{client_name}},

**Congratulations on your accepted offer!** I'm coordinating the transaction for your purchase at **{{property_address}}**, and I'll be your point of contact from here to closing.

Over the next few weeks I'll keep everything on schedule with the lender, title company, and listing team. Here's what to watch for first:

- Your **earnest money deposit** — due per your contract terms
- Scheduling your **home inspection**
- Getting your **loan application** in with the lender

I'll send reminders ahead of every deadline so nothing sneaks up on you. If anything changes on your end, just reply to this email.`,
  },
  {
    name: "Seller welcome & prep",
    category: "CONTRACT",
    taskMatch: "welcome, intro, introduction, seller",
    subject: "Getting started: managing your sale of {{property_address}}",
    body: `Hi {{client_name}},

Welcome to the active phase of selling **{{property_address}}**. My job is to handle the administrative details from contract to closing so you can focus on your move.

A few things to keep in mind while we're under contract:

- Keep the property in **showing-ready condition** for the inspection and appraisal
- Watch for **inspection scheduling** requests over the next few days
- Let me know right away if any **schedule changes** come up on your side

I'll be in touch at each milestone. Reply here anytime with questions.`,
  },
  {
    name: "Escrow & lender introduction",
    category: "CONTRACT",
    taskMatch: "escrow, title, lender, introduction",
    subject: "Introductions: escrow & lender for {{property_address}}",
    body: `Hi {{client_name}},

This note connects you with the team handling the money side of your transaction at **{{property_address}}**:

- **Title / escrow:** {{title_company_name}}
- **Lender:** {{lender_name}}

Please make sure any requested financial documentation and your **earnest money funds** are delivered securely and on time, following the instructions in your contract.

!! If you're ever unsure whether a payment or document request is legitimate, **call me before sending anything.** It's always okay to double-check.`,
  },

  // ── Phase 2: Due diligence & inspections ──────────────────────────────────
  {
    name: "Inspection confirmed",
    category: "DUE_DILIGENCE",
    taskMatch: "inspection, schedule home inspection",
    attachMatch: "inspection",
    subject: "Confirmed: home inspection for {{property_address}}",
    body: `Hi {{client_name}},

Your home inspection for **{{property_address}}** is confirmed:

- **Date:** [inspection date]
- **Time:** [inspection time]
- **Inspector:** [inspector]

Plan to attend the summary walkthrough at the end of the inspection — it's the best time to ask the inspector questions directly. I'll follow up once the report is in so we can review anything worth addressing.`,
  },
  {
    name: "Appraisal ordered",
    category: "DUE_DILIGENCE",
    taskMatch: "appraisal, valuation",
    subject: "Appraisal ordered for {{property_address}}",
    body: `Hi {{client_name}},

The appraisal for **{{property_address}}** has been ordered through {{lender_name}} and is scheduled for **[appraisal date]**.

To keep things on schedule, please make sure:

- The property has **clear access** for the appraiser
- **Utilities are on** so every system can be evaluated

I'll let you know as soon as the appraised value comes back.`,
  },
  {
    name: "Contingency deadline reminder",
    category: "DUE_DILIGENCE",
    taskMatch: "contingency, deadline",
    subject: "Action needed: [contingency] deadline for {{property_address}}",
    body: `Hi {{client_name}},

A quick heads-up that your contractual **[contingency]** deadline for **{{property_address}}** is coming up:

- **Due:** [deadline date] at [deadline time]

Please review the related documents and confirm your sign-off, or reach out right away if you have questions before the deadline. Missing this date can affect your rights under the contract, so let's get it handled together.`,
  },

  // ── Phase 3: Closing & settlement ─────────────────────────────────────────
  {
    name: "Final walkthrough details",
    category: "CLOSING",
    taskMatch: "walkthrough, final walkthrough",
    subject: "Final walkthrough for {{property_address}}",
    body: `Hi {{client_name}},

We've scheduled your final walkthrough for **{{property_address}}**:

- **Date:** [walkthrough date]
- **Time:** [walkthrough time]

This is your chance to confirm any agreed-upon repairs are complete and the property is in the condition promised in the purchase agreement. If anything looks off, tell me during the walkthrough so we can address it before closing on **{{close_date}}**.`,
  },
  {
    name: "Utility transfer reminder",
    category: "CLOSING",
    taskMatch: "utility, utilities",
    subject: "Set up your utilities for {{property_address}}",
    body: `Hi {{client_name}},

Closing on **{{property_address}}** is set for **{{close_date}}** — time to line up utilities so there's no gap in service.

Please contact your local providers to transfer service into your name effective on the closing date:

- Electric / gas
- Water / sewer
- Internet / cable
- Trash / recycling

If you'd like, I can send the main providers for the [city] area — just reply and I'll pass the list along.`,
  },
  {
    name: "Closing details & wire security",
    category: "CLOSING",
    taskMatch: "closing, wire, settlement, clear to close",
    subject: "IMPORTANT: closing details & wire security for {{property_address}}",
    body: `Hi {{client_name}},

We're almost there! Here are the details for your closing on **{{property_address}}**:

- **Date:** {{close_date}}
- **Time:** [closing time]
- **Location:** {{title_company_name}}

!! **Wire fraud warning.** Criminals target real estate closings with fake wire instructions. **Always verify wire details by phone** using a number you've confirmed independently — never a number or link from an email — before sending any funds. When in doubt, call me first.

Please bring a government-issued photo ID, and reach out with any questions before the big day.`,
  },

  // ── Phase 4: Post-closing ─────────────────────────────────────────────────
  {
    name: "Congratulations & review request",
    category: "POST_CLOSE",
    taskMatch: "congratulations, review, closed, referral",
    subject: "Congratulations on {{property_address}}! 🎉",
    body: `Hi {{client_name}},

**Congratulations — you're officially closed on {{property_address}}!** It was a pleasure keeping everything on track, and I hope you're already settling in.

If you have a spare moment, a short review of your experience would mean a lot — and it helps other clients know what to expect:

- Leave a review: [review link]

And of course, keep my number handy for anything down the road.`,
  },
  {
    name: "Closing anniversary check-in",
    category: "POST_CLOSE",
    taskMatch: "anniversary, check-in",
    subject: "Happy home anniversary! 🏡",
    body: `Hi {{client_name}},

Can you believe it's already been **[number of years] years** since you closed on **{{property_address}}**? I hope the home has treated you well.

If you ever need a hand, I'm always happy to help with:

- Trusted **contractor recommendations**
- A current **market analysis** of your home's value
- Any real estate questions, big or small

Reach out anytime — congratulations again on your home!`,
  },
];

/**
 * Freehold's starter email library — the default set every new workspace
 * gets, grouped the way a coordinator actually reaches for them: who it's
 * going to, not what stage of the file it's for. Wording here is Freehold's
 * own; where a title matches something you'd see anywhere in the industry
 * ("under contract", "preparing to close"), that's just standard usage, not
 * a borrowed phrase.
 *
 * A few plausible templates aren't here yet on purpose — a mailing-address
 * letter and a commission-disbursement notice both need merge data (a
 * mailing address block, a commission breakdown) that nothing in the
 * product resolves yet. Better absent than present-but-broken.
 */

export interface StarterEmailTemplate {
  key: string;
  name: string;
  group: string;
  category: string;
  subject: string;
  body: string;
  toDefault?: string;
  ccDefault?: string;
  composeNote?: string;
  filePlaceholders?: string;
}

const AGENT_CC = "{{agent_email}}";

/**
 * The prospecting folder — outreach to agents who aren't a client yet, and
 * the past-client drip series. Nothing in it is about a specific file, so it
 * has no business in the "start from a template" picker on a transaction:
 * that list is long enough already without templates that don't apply.
 * Still fully visible and usable from the template library itself.
 */
export const PROSPECTING_TEMPLATE_GROUP = "Client outreach";

export const STARTER_EMAIL_TEMPLATES: StarterEmailTemplate[] = [
  // ---------------------------------------------------------------- Buyer side
  {
    key: "buyer_welcome",
    name: "Buyer · Under-contract welcome",
    group: "Buyer side",
    category: "CONTRACT",
    subject: "Under contract — {{property_address}}",
    toDefault: "{{buyer_emails}}",
    ccDefault: AGENT_CC,
    filePlaceholders: "Executed contract, Financing info sheet",
    composeNote: "Confirm the fee amounts before sending.",
    body: `{{buyer_first_name}},

Great news — your contract for **{{property_address}}** is fully signed!

I'm {{tc_first_name}}, the transaction coordinator working with {{agent_name}}. From here to closing, my job is keeping every deadline, document, and party on schedule — I'll be in touch with the other side, your lender, and the closing company throughout, and you'll hear from {{agent_first_name}} or me regularly.

First, the contract calls for:

**Earnest money:** {{earnest_money}}
**Option / due-diligence fee:** {{due_diligence_fee}}
**Due by:** {{earnest_money_due}}

**Closing company:**
{{closer_card}}

**Key dates to keep in view:**

{{key_dates}}

You also have a private portal — dates, documents, and contacts for everyone on the file, no password needed:

{{portal_link}}

Questions at any point? Just reply. {{agent_first_name}} and I are glad to help.

{{tc_first_name}}`,
  },
  {
    key: "buyer_other_intro",
    name: "Buyer · Other agent/lender/closer intro",
    group: "Buyer side",
    category: "CONTRACT",
    subject: "Under contract — {{property_address}} — {{last_names}}",
    toDefault: "{{title_company_email}};{{listing_agent_email}};{{lender_email}}",
    composeNote: "Trim the checklist to fit the deal and drop any items that don't apply.",
    body: `Hello all,

**{{client_name}}** is under contract on **{{property_full_address}}** — I'm {{tc_first_name}}, transaction coordinator for {{agent_name}}. To keep everything moving, please copy me on all correspondence for this file. If there's an assistant I should include, let me know.

The executed contract and current amendments are attached; anything new gets forwarded as it arrives.

**To get us started:**

- Please confirm receipt of the contract.
- Closer: please share the earnest-money receipt with both sides once received.
- Lender: please flag us when the appraisal is ordered.

**Dates & contacts on this file:**

{{key_dates}}

{{parties_list}}

Anything you need from us, just ask.

{{tc_first_name}}`,
  },
  {
    key: "buyer_checkin",
    name: "Buyer · Check-in",
    group: "Buyer side",
    category: "DUE_DILIGENCE",
    subject: "Checking in — {{property_address}}",
    toDefault: "{{buyer_emails}}",
    ccDefault: AGENT_CC,
    body: `{{buyer_first_name}},

A quick check-in from our side. Any questions about where things stand, or anything you'd like a hand with right now?

We're here whenever something comes up.

{{tc_first_name}}`,
  },
  {
    key: "buyer_preparing",
    name: "Buyer · Preparing to close",
    group: "Buyer side",
    category: "CLOSING",
    subject: "Preparing to close — {{property_address}}",
    toDefault: "{{buyer_emails}}",
    ccDefault: AGENT_CC,
    body: `{{buyer_first_name}},

Closing is getting close — a few reminders as you get ready:

- **Utilities:** arrange service in your name starting the day after closing (or the possession date, if there's a post-closing occupancy agreement).
- **Mail:** file a change of address with the postal service; it can be scheduled ahead of time online.
- **Insurance:** line up your new homeowner's coverage, effective the day after closing.
- **Movers & cleaning:** confirm anything you've booked for moving day.

Reach out any time as we approach the closing date — and it helps to keep a little flexibility in your plans in case of a last-minute shift.

{{tc_first_name}}`,
  },
  {
    key: "buyer_thankyou",
    name: "Buyer · Closed & thank you",
    group: "Buyer side",
    category: "POST_CLOSE",
    subject: "Closed & funded — {{property_address}}",
    toDefault: "{{buyer_emails}}",
    ccDefault: AGENT_CC,
    body: `{{buyer_first_name}},

It's official — the purchase has **closed and funded**. Congratulations on your new home!

Thank you for being so responsive throughout; it genuinely made the process smoother. If anything comes up after closing, we're still here.

Wishing you the best in the new place,
{{tc_first_name}}`,
  },

  // --------------------------------------------------------------- Seller side
  {
    key: "seller_listing_kickoff",
    name: "Seller · Agent listing kickoff",
    group: "Seller side",
    category: "CONTRACT",
    subject: "Your TC on {{property_address}} — {{last_names}}",
    toDefault: AGENT_CC,
    ccDefault: "",
    body: `{{agent_first_name}},

Thanks for bringing me in on this listing. I'll handle the coordination end to end — MLS input through status changes — and copy you on every email so nothing happens without your visibility. The goal is a stress-free file for you and your client.

Your agent portal (dates, tasks, and documents across your files, no password needed): {{agent_portal_link}}

How I work: office hours Monday–Friday, 8–5, replies within two business hours. After closing I'll send my invoice, due within 7 days.

**Contact:** {{tc_phone}} · {{tc_email}}

{{tc_first_name}}`,
  },
  {
    key: "seller_listing_welcome",
    name: "Seller · Listing welcome",
    group: "Seller side",
    category: "CONTRACT",
    subject: "Getting your listing live — {{property_address}}",
    toDefault: "{{seller_emails}}",
    ccDefault: AGENT_CC,
    filePlaceholders: "Blank seller's disclosure form",
    composeNote: "Adjust the needs list and add the open-house date before sending.",
    body: `{{seller_first_name}},

I'm {{tc_first_name}}, the transaction coordinator working with {{agent_name}} on your listing. Over the next few days we'll get your home ready to go live.

**What we need from you:**

- Property survey (if you have one)
- Seller's disclosure (blank form attached)

**How the timeline works:**

- The **pre-listing period** is when we gather details and build the listing — expect a few emails from us along the way.
- Your **list date** is {{list_date}}. From then on, agents can book showings, coordinated through {{agent_first_name}}.
- Once an offer is accepted, we move into the under-contract phase and walk you through every deadline from there.

Questions any time — that's what we're here for.

{{tc_first_name}}`,
  },
  {
    key: "seller_uc_welcome",
    name: "Seller · Under-contract welcome",
    group: "Seller side",
    category: "CONTRACT",
    subject: "Under contract — {{property_address}}",
    toDefault: "{{seller_emails}}",
    ccDefault: AGENT_CC,
    composeNote: "Double-check the key-dates section before sending.",
    body: `{{seller_first_name}},

Congratulations — you're under contract on {{property_address}}!

I'm {{tc_first_name}}, transaction coordinator for {{agent_name}}, and I'll be tracking every date and document from here to the closing table. Don't celebrate too hard yet, though — the next few weeks are the busy part.

**A few terms you'll hear as we go:**

- **Transaction coordinator:** me — working alongside your agent to keep the file moving. Questions go to either of us.
- **Closing company:** the neutral third party that pays off your existing mortgage, records the deed, and disburses your proceeds. Settlement has to land on a business day.
- **Inspections:** the buyer's inspections happen in the first weeks. Please keep utilities on and access clear (crawlspace, mechanical closet, attic). Repair requests, if any, come to your agent for review.
- **Appraisal:** the buyer's lender orders an independent value estimate.
- **Closing date:** we do everything we can to hold it, but loans, inspections, and repairs can shift it — we'll keep you posted as it firms up.
- **Taxes:** for questions about the sale's tax impact, your tax professional is the right stop.

**Key dates to keep in view:**

{{key_dates}}

Your private portal — dates, documents, and contacts, no password needed:

{{portal_link}}

We're glad to be working with you and {{agent_first_name}} on this.

{{tc_first_name}}`,
  },
  {
    key: "seller_other_intro",
    name: "Seller · Other agent/closer intro",
    group: "Seller side",
    category: "CONTRACT",
    subject: "Under contract — {{property_address}} — {{last_names}}",
    toDefault: "{{title_company_email}};{{buyer_agent_email}}",
    composeNote: "Trim the checklist and remove anything that doesn't apply.",
    body: `Hello all,

{{agent_name}}'s client, **{{client_name}}**, has accepted an offer on **{{property_full_address}}**. I'm {{tc_first_name}}, the transaction coordinator — please copy me on all correspondence for this file, and let me know if there's an assistant I should include.

The executed contract and amendments are attached; more to follow as it arrives.

**To get us started:**

- Buyer's agent: a heads-up when the inspection is scheduled would help.
- Closer: please confirm receipt of the contract, and share the earnest-money receipt with both sides once received.

**Dates & contacts on this file:**

{{key_dates}}

{{parties_list}}

Anything you need, just ask.

{{tc_first_name}}`,
  },
  {
    key: "seller_checkin",
    name: "Seller · Check-in",
    group: "Seller side",
    category: "DUE_DILIGENCE",
    subject: "Checking in — {{property_address}}",
    toDefault: "{{seller_emails}}",
    ccDefault: AGENT_CC,
    body: `{{seller_first_name}},

A quick check-in from our side. Any questions about how things are moving, or anything we can take off your plate right now?

We're here whenever you need us.

{{tc_first_name}}`,
  },
  {
    key: "seller_other_checkin",
    name: "Seller · Other agent/closer check-in",
    group: "Seller side",
    category: "DUE_DILIGENCE",
    subject: "Check-in — {{property_address}}",
    toDefault: "{{buyer_agent_email}};{{title_company_email}}",
    body: `Hello all,

Checking in on **{{property_full_address}}**:

- Are we on track to close on {{close_date}}?
- Is anything outstanding from our side?

Let us know what you need from the seller's side.

{{tc_first_name}}`,
  },
  {
    key: "seller_preparing",
    name: "Seller · Preparing to close",
    group: "Seller side",
    category: "CLOSING",
    subject: "Preparing to close — {{property_address}}",
    toDefault: "{{seller_emails}}",
    ccDefault: AGENT_CC,
    body: `{{seller_first_name}},

Closing is getting close — a few reminders as you get ready:

- **Utilities:** schedule disconnection for the day after closing (or the possession date if there's a post-closing occupancy agreement) so everything still works for the final walk-through.
- **Mail:** file a change of address ahead of time online.
- **Insurance:** end your policies the day after closing.
- **Move-out & cleaning:** belongings out before the buyer's final walk-through (usually within 48 hours of closing), and leave the home the way you'd want to receive it — floors swept, trash out, agreed repairs done, surfaces wiped down. Most cleaning companies offer a move-out package if you'd rather not do it yourself.

Questions any time as we approach the date — and it helps to keep some flexibility in case of a last-minute shift.

{{tc_first_name}}`,
  },
  {
    key: "seller_thankyou",
    name: "Seller · Closed & thank you",
    group: "Seller side",
    category: "POST_CLOSE",
    subject: "Closed & funded — {{property_address}}",
    toDefault: "{{seller_emails}}",
    ccDefault: AGENT_CC,
    body: `{{seller_first_name}},

It's official — the sale has **closed and funded**. Congratulations!

Thank you for your patience and quick responses throughout; it made a real difference. If anything comes up after closing, we're still here — and we'd love to work with you again on the next one.

All the best,
{{tc_first_name}}`,
  },

  // --------------------------------------------------------------- Either side
  {
    key: "either_agent_kickoff",
    name: "Either · Agent UC kickoff",
    group: "Either side",
    category: "CONTRACT",
    subject: "Your TC on {{property_address}} — {{last_names}}",
    toDefault: AGENT_CC,
    ccDefault: "",
    body: `{{agent_first_name}},

Thanks for trusting me with this one. I'll run the coordination from executed contract to funded closing and copy you on every email, so you always know exactly where the file stands. The goal is to make this as hands-off for you as it can safely be.

Your agent portal (dates, tasks, and documents across your files, no password): {{agent_portal_link}}

How I work: office hours Monday–Friday 8–5, replies within two business hours. After closing I'll email your invoice, due within 7 days.

**Contact:** {{tc_phone}} · {{tc_email}}

{{tc_first_name}}`,
  },
  {
    key: "dual_closer_lender_intro",
    name: "Dual · Closer/lender intro",
    group: "Either side",
    category: "CONTRACT",
    subject: "Under contract — {{property_address}} — {{last_names}}",
    toDefault: "{{title_company_email}};{{lender_email}}",
    body: `Hello all,

**{{client_name}}** is under contract on **{{property_full_address}}**, and our office is coordinating both sides of the file. I'm {{tc_first_name}} — please copy me on all correspondence, and let me know if there's an assistant I should include.

Executed contract and amendments attached; more as it arrives.

- Closer: please confirm receipt, and share the earnest-money receipt with both sides once received.
- Lender: please confirm receipt, and flag us when the appraisal is ordered.

{{key_dates}}

{{parties_list}}

{{tc_first_name}}`,
  },
  {
    key: "either_send_documents",
    name: "Either · Send documents",
    group: "Either side",
    category: "GENERAL",
    subject: "Documents — {{property_address}} — {{last_names}}",
    composeNote: "Fill in the recipients and list the attached files before sending.",
    body: `Hello,

Regarding **{{property_full_address}}** — attached please find:

-

Let me know if you need anything further from us.

Thank you!
{{tc_first_name}}`,
  },
  {
    key: "either_agent_checkin",
    name: "Either · Agent check-in",
    group: "Either side",
    category: "GENERAL",
    subject: "Agent check-in — {{property_address}}",
    toDefault: AGENT_CC,
    ccDefault: "",
    composeNote: "Fill in the update and needs bullets.",
    body: `{{agent_first_name}},

A quick status update on **{{property_full_address}}**:

**Where things stand:**

-

**What I need from you:**

-

Questions? You know where to find me.

{{tc_first_name}}`,
  },
  {
    key: "either_other_agent_checkin",
    name: "Either · Other agent check-in",
    group: "Either side",
    category: "GENERAL",
    subject: "Check-in — {{property_address}}",
    toDefault: "{{other_agent_email}}",
    body: `Hello,

Checking in on **{{property_full_address}}**:

- Are we on track for {{close_date}}?
- Anything you're waiting on from us?

Thanks for keeping us posted.

{{tc_first_name}}`,
  },
  {
    key: "either_lender_closer_checkin",
    name: "Either · Lender/closer check-in",
    group: "Either side",
    category: "CLOSING",
    subject: "Check-in — {{property_address}}",
    toDefault: "{{lender_email}};{{title_company_email}}",
    body: `Hello all,

Checking in on **{{property_full_address}}**:

- Are we on track for {{close_date}}?
- Are you missing any documents from us?

Thanks for keeping us in the loop.

{{tc_first_name}}`,
  },
  {
    key: "either_other_agent_thankyou",
    name: "Either · Other agent thank you",
    group: "Either side",
    category: "POST_CLOSE",
    subject: "Thank you — {{property_address}}",
    toDefault: "{{other_agent_email}}",
    ccDefault: "",
    body: `Hi {{other_agent_first_name}},

Now that we've closed, I wanted to say thank you — your responsiveness and attention to detail on this one made the whole file run smoother.

Good working relationships across the table matter a lot in this business, and this was a good one. If there's ever anything my office can do to support your transactions, don't hesitate to reach out.

Hope we get to work together again soon,
{{tc_first_name}}`,
  },
  {
    key: "either_agent_thankyou_invoice",
    name: "Either · Agent thank you & invoice",
    group: "Either side",
    category: "POST_CLOSE",
    subject: "Thank you — {{property_address}} — {{last_names}}",
    toDefault: AGENT_CC,
    ccDefault: "",
    filePlaceholders: "Invoice",
    composeNote: "Attach the invoice, or drop the invoice line if this file isn't billed.",
    body: `{{agent_first_name}},

Another one closed! Thank you for the trust — and for everything you did to keep this file moving. It's a pleasure working with you.

My invoice for this file is attached; as a reminder it's due within 7 calendar days of closing. Any questions about it, just ask.

Looking forward to the next one,
{{tc_first_name}}`,
  },

  // ---------------------------------------------------------- Client outreach
  {
    key: "marketing_agent_first",
    name: "Marketing · Agent outreach, first touch",
    group: "Client outreach",
    category: "GENERAL",
    subject: "Great working with you on our last closing",
    ccDefault: "",
    body: `Hello,

I really enjoyed working with you on our recent closing. I noticed you may not have a dedicated transaction coordinator, and I'd love to show you what having one in your corner looks like.

My job is taking the repetitive, deadline-heavy part of each file off your desk so you can stay focused on clients and closings. I adapt to your workflow and your branding, so to your clients it all feels like you. If you're open to it, I'd love 20 minutes to walk you through how I work.

Hoping to connect,
{{tc_first_name}}`,
  },
  {
    key: "marketing_agent_followup",
    name: "Marketing · Agent outreach, follow-up",
    group: "Client outreach",
    category: "GENERAL",
    subject: "Following up",
    ccDefault: "",
    body: `Hello,

Circling back on my note about transaction coordination. I know how full an agent's plate gets — that's exactly the problem I solve.

If you're curious but not sure, here's an easy way to find out: let me run your next file free, no strings attached. I think you'll be surprised how much time it hands back. A few minutes on the phone and I can explain how I'd slot into your workflow.

Best,
{{tc_first_name}}`,
  },
  {
    key: "marketing_agent_final",
    name: "Marketing · Agent outreach, final touch",
    group: "Client outreach",
    category: "GENERAL",
    subject: "Last note from me",
    ccDefault: "",
    body: `Hello,

Last note from me, I promise! If a transaction coordinator isn't the right fit right now, no worries at all — the door stays open.

If things change mid-season when files stack up, my earlier offer stands: I'll take your next transaction at no charge so you can see the difference risk-free. Either way, wishing you a great selling season.

Best,
{{tc_first_name}}`,
  },
  {
    key: "marketing_buyer_first",
    name: "Marketing · Past buyer series, first touch",
    group: "Client outreach",
    category: "GENERAL",
    subject: "So nice to meet you!",
    ccDefault: "",
    body: `Hello!

Thanks for reaching out — I'd love to help you find the right home. Want to set up a time to talk through what you're looking for?

If any listings have caught your eye, send them over — we can arrange a showing or just use them to sharpen the search.

Happy to answer any questions,
{{tc_first_name}}`,
  },
  {
    key: "marketing_buyer_checkin",
    name: "Marketing · Past buyer series, check-in",
    group: "Client outreach",
    category: "GENERAL",
    subject: "Still house hunting?",
    ccDefault: "",
    body: `Hello,

Just checking in on your home search. The market's always moving — if you'd like a fresh list of homes that match what you're after, say the word.

No pressure either way; I'm here when you're ready.

{{tc_first_name}}`,
  },
  {
    key: "marketing_buyer_final",
    name: "Marketing · Past buyer series, final touch",
    group: "Client outreach",
    category: "GENERAL",
    subject: "Here when you're ready",
    ccDefault: "",
    body: `Hello,

I'll stop filling your inbox after this one! If the home search is on pause, that's completely fine — timing matters.

Whenever you're ready to pick it back up, just reply to this email and we'll jump right back in.

All the best,
{{tc_first_name}}`,
  },
  {
    key: "marketing_seller_first",
    name: "Marketing · Past seller series, first touch",
    group: "Client outreach",
    category: "GENERAL",
    subject: "Thinking of selling?",
    ccDefault: "",
    body: `Hello!

Thanks for getting in touch about selling your home. I'd love to walk you through what your home could list for in today's market and what the process looks like start to finish.

Would a quick call this week work to talk it through?

{{tc_first_name}}`,
  },
  {
    key: "marketing_seller_checkin",
    name: "Marketing · Past seller series, check-in",
    group: "Client outreach",
    category: "GENERAL",
    subject: "Still thinking it over?",
    ccDefault: "",
    body: `Hello,

Following up on your interest in selling. If it would help, I can put together a no-obligation market snapshot for your address — what similar homes nearby have sold for lately and what that suggests for yours.

Just reply and I'll get it started.

{{tc_first_name}}`,
  },
  {
    key: "marketing_seller_final",
    name: "Marketing · Past seller series, final touch",
    group: "Client outreach",
    category: "GENERAL",
    subject: "The market will be ready when you are",
    ccDefault: "",
    body: `Hello,

Last note from me for now. If selling isn't the right move at the moment, that's a perfectly good answer — timing is everything with a home.

When you're ready to revisit it, I'm one reply away, and I'll bring up-to-date numbers for your neighborhood when you are.

All the best,
{{tc_first_name}}`,
  },

  // -------------------------------------------------------------------- Reports
  {
    key: "report_listing_summary",
    name: "Report · Listing summary",
    group: "Reports",
    category: "GENERAL",
    subject: "{{property_address}} — Listing summary",
    ccDefault: "",
    body: `Listing summary for **{{property_full_address}}**

**Listing info**
List date: {{list_date}}
Expires: {{expire_date}}

**Key dates**
{{key_dates}}

**Parties**
{{parties_list}}

{{tc_first_name}}`,
  },
  {
    key: "report_closing_summary",
    name: "Report · Closing summary",
    group: "Reports",
    category: "GENERAL",
    subject: "{{property_address}} — Closing summary",
    ccDefault: "",
    body: `Closing summary for **{{property_full_address}}**

**Transaction details**
Contract date: {{contract_date}}
Closing date: {{close_date}}

**Key dates**
{{key_dates}}

**Parties**
{{parties_list}}

{{tc_first_name}}`,
  },

  // --------------------------------------------------------------------- System
  {
    key: "system_portal_update",
    name: "System · Portal update",
    group: "System",
    category: "GENERAL",
    subject: "Property update",
    ccDefault: "",
    body: `{{client_first_name}},

A reminder that your file's activity is always available through your portal link below. We appreciate the chance to work with you on this transaction — reach out with any questions.

{{portal_link}}

Thank you!`,
  },
];

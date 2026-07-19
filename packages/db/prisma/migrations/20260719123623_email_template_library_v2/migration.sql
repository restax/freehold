-- Refresh the sample email-template library in every workspace: the
-- Stage-1 template studio ships 14 categorized templates. Only rows still
-- marked isSample are replaced; tenant-authored templates are untouched.

DELETE FROM "email_template" WHERE "isSample" = true;

INSERT INTO "email_template" ("id", "tenant_id", "name", "subject", "body", "category", "task_match", "isSample", "createdAt", "updatedAt")
SELECT gen_random_uuid(), o."id", $tpl$Status update (Sample)$tpl$, $tpl$Update on {{property_address}}$tpl$, $tpl$Hi {{client_name}},

A quick status update on **{{property_address}}**:

- Contract date: {{contract_date}}
- Closing date: {{close_date}}

Everything is on track. Reply to this email with any questions — it lands right on the file.

{{tc_name}}$tpl$, $tpl$STATUS$tpl$, $tpl$status,update$tpl$, true, NOW(), NOW() FROM "organization" o;

INSERT INTO "email_template" ("id", "tenant_id", "name", "subject", "body", "category", "task_match", "isSample", "createdAt", "updatedAt")
SELECT gen_random_uuid(), o."id", $tpl$Introductions — all parties (Sample)$tpl$, $tpl$Introductions: {{property_address}}$tpl$, $tpl$Hello all,

Introducing the team for **{{property_address}}**:

- Buyer's agent: {{buyer_agent_name}}
- Listing agent: {{listing_agent_name}}
- Lender: {{lender_name}}
- Title: {{title_company_name}}

I'm coordinating this file for {{tenant_name}} and will keep everyone on schedule toward the {{close_date}} closing. Reply-all works — replies land on the transaction record.

{{tc_name}}$tpl$, $tpl$INTRO$tpl$, $tpl$introduction,intro$tpl$, true, NOW(), NOW() FROM "organization" o;

INSERT INTO "email_template" ("id", "tenant_id", "name", "subject", "body", "category", "task_match", "isSample", "createdAt", "updatedAt")
SELECT gen_random_uuid(), o."id", $tpl$Portal invitation (Sample)$tpl$, $tpl$Your transaction portal — {{property_address}}$tpl$, $tpl$Hi {{client_name}},

Here's your private portal for **{{property_address}}** — every date, document, and milestone, always current:

[paste portal link here]

Bookmark it. When something changes, the portal already knows.

{{tc_name}}$tpl$, $tpl$PORTAL$tpl$, $tpl$portal$tpl$, true, NOW(), NOW() FROM "organization" o;

INSERT INTO "email_template" ("id", "tenant_id", "name", "subject", "body", "category", "task_match", "isSample", "createdAt", "updatedAt")
SELECT gen_random_uuid(), o."id", $tpl$Earnest money reminder (Sample)$tpl$, $tpl$Earnest money deposit — {{property_address}}$tpl$, $tpl$Hi {{buyer_name}},

A friendly reminder that the earnest money deposit for **{{property_address}}** is coming due. Your agent or the title company ({{title_company_name}}) can confirm the exact amount and wiring instructions.

**Important: always confirm wiring instructions by phone using a number you already trust. Never wire based on emailed instructions alone.**

Reply here once it's sent and we'll confirm receipt on our side.

{{tc_name}}$tpl$, $tpl$MILESTONE$tpl$, $tpl$earnest,emd,deposit$tpl$, true, NOW(), NOW() FROM "organization" o;

INSERT INTO "email_template" ("id", "tenant_id", "name", "subject", "body", "category", "task_match", "isSample", "createdAt", "updatedAt")
SELECT gen_random_uuid(), o."id", $tpl$Inspection scheduled (Sample)$tpl$, $tpl$Inspection scheduled — {{property_address}}$tpl$, $tpl$Hi {{buyer_name}},

Your inspection for **{{property_address}}** is scheduled. A few reminders:

- Plan for 2–3 hours on site
- Bring questions — the inspector will walk you through findings
- The written report follows within 24–48 hours

We'll review the report together as soon as it lands.

{{tc_name}}$tpl$, $tpl$MILESTONE$tpl$, $tpl$inspection$tpl$, true, NOW(), NOW() FROM "organization" o;

INSERT INTO "email_template" ("id", "tenant_id", "name", "subject", "body", "category", "task_match", "isSample", "createdAt", "updatedAt")
SELECT gen_random_uuid(), o."id", $tpl$Inspection report received (Sample)$tpl$, $tpl$Inspection report — {{property_address}}$tpl$, $tpl$Hi {{client_name}},

The inspection report for **{{property_address}}** is in and shared to your portal. Next step: review it with your agent and decide on any repair requests before the contingency deadline.

Nothing in a report is a surprise if we talk it through — reply here or call any time.

{{tc_name}}$tpl$, $tpl$MILESTONE$tpl$, $tpl$inspection,contingency,resolution$tpl$, true, NOW(), NOW() FROM "organization" o;

INSERT INTO "email_template" ("id", "tenant_id", "name", "subject", "body", "category", "task_match", "isSample", "createdAt", "updatedAt")
SELECT gen_random_uuid(), o."id", $tpl$Appraisal ordered (Sample)$tpl$, $tpl$Appraisal ordered — {{property_address}}$tpl$, $tpl$Hi {{client_name}},

The appraisal for **{{property_address}}** has been ordered by {{lender_name}}. Typical turnaround is about a week; the property just needs to be accessible.

We'll let you know the moment the report comes back.

{{tc_name}}$tpl$, $tpl$MILESTONE$tpl$, $tpl$appraisal$tpl$, true, NOW(), NOW() FROM "organization" o;

INSERT INTO "email_template" ("id", "tenant_id", "name", "subject", "body", "category", "task_match", "isSample", "createdAt", "updatedAt")
SELECT gen_random_uuid(), o."id", $tpl$Loan approval / clear to close (Sample)$tpl$, $tpl$Great news — clear to close on {{property_address}}$tpl$, $tpl$Hi {{buyer_name}},

**{{lender_name}} has issued the clear to close** for {{property_address}} — the financing hurdle is behind you.

From here: final walkthrough, then closing on {{close_date}}. We'll confirm times shortly.

{{tc_name}}$tpl$, $tpl$MILESTONE$tpl$, $tpl$loan,financing,clear to close,commitment,approval$tpl$, true, NOW(), NOW() FROM "organization" o;

INSERT INTO "email_template" ("id", "tenant_id", "name", "subject", "body", "category", "task_match", "isSample", "createdAt", "updatedAt")
SELECT gen_random_uuid(), o."id", $tpl$Title & escrow opened (Sample)$tpl$, $tpl$Title opened — {{property_address}}$tpl$, $tpl$Hello all,

Title and escrow for **{{property_address}}** are open with {{title_company_name}}. The title commitment will circulate once issued; flag any questions on it early.

{{tc_name}}
{{tenant_name}}$tpl$, $tpl$MILESTONE$tpl$, $tpl$title,escrow,commitment$tpl$, true, NOW(), NOW() FROM "organization" o;

INSERT INTO "email_template" ("id", "tenant_id", "name", "subject", "body", "category", "task_match", "isSample", "createdAt", "updatedAt")
SELECT gen_random_uuid(), o."id", $tpl$Final walkthrough & closing details (Sample)$tpl$, $tpl$Closing details — {{property_address}}$tpl$, $tpl$Hi {{client_name}},

We're almost there on **{{property_address}}**:

- Final walkthrough: typically the day before or morning of closing
- Closing date: {{close_date}}
- Bring government-issued ID; funds per {{title_company_name}}'s instructions

**Confirm any wiring instructions by phone with the title company before sending funds.**

{{tc_name}}$tpl$, $tpl$MILESTONE$tpl$, $tpl$walkthrough,closing,funding$tpl$, true, NOW(), NOW() FROM "organization" o;

INSERT INTO "email_template" ("id", "tenant_id", "name", "subject", "body", "category", "task_match", "isSample", "createdAt", "updatedAt")
SELECT gen_random_uuid(), o."id", $tpl$Listing live (Sample)$tpl$, $tpl$You're live — {{property_address}}$tpl$, $tpl$Hi {{seller_name}},

**{{property_address}} is live on the MLS** and syndicating to the major sites. Photos, sign, and showings are all set.

We'll pass along showing feedback as it arrives so you always know how the market is responding.

{{tc_name}}$tpl$, $tpl$LISTING$tpl$, $tpl$listing,mls,syndication,photography,sign$tpl$, true, NOW(), NOW() FROM "organization" o;

INSERT INTO "email_template" ("id", "tenant_id", "name", "subject", "body", "category", "task_match", "isSample", "createdAt", "updatedAt")
SELECT gen_random_uuid(), o."id", $tpl$Showing feedback request (Sample)$tpl$, $tpl$Feedback on your showing — {{property_address}}$tpl$, $tpl$Hi,

Thanks for showing **{{property_address}}**. Two quick questions while it's fresh:

- How did your buyers respond?
- Any feedback on price or condition?

A one-line reply is perfect — it lands straight on our file and helps the sellers enormously.

{{tc_name}}
{{tenant_name}}$tpl$, $tpl$LISTING$tpl$, $tpl$showing,feedback$tpl$, true, NOW(), NOW() FROM "organization" o;

INSERT INTO "email_template" ("id", "tenant_id", "name", "subject", "body", "category", "task_match", "isSample", "createdAt", "updatedAt")
SELECT gen_random_uuid(), o."id", $tpl$Closed — congratulations (Sample)$tpl$, $tpl$Congratulations — {{property_address}} is closed!$tpl$, $tpl$Hi {{client_name}},

**{{property_address}} is officially closed.** Congratulations!

Your complete records package stays available in your portal. Keep it — you'll want it at tax time.

It was a pleasure working with you.

{{tc_name}}$tpl$, $tpl$POST_CLOSE$tpl$, $tpl$congratulations,records,post-close,closed$tpl$, true, NOW(), NOW() FROM "organization" o;

INSERT INTO "email_template" ("id", "tenant_id", "name", "subject", "body", "category", "task_match", "isSample", "createdAt", "updatedAt")
SELECT gen_random_uuid(), o."id", $tpl$Review / referral ask (Sample)$tpl$, $tpl$A small favor?$tpl$, $tpl$Hi {{client_name}},

Now that **{{property_address}}** has closed, one small ask: if the process felt smooth, a short review or a referral to anyone buying or selling means the world to a business like ours.

Either way — thank you for trusting us with it.

{{tc_name}}
{{tenant_name}}$tpl$, $tpl$POST_CLOSE$tpl$, $tpl$review,referral$tpl$, true, NOW(), NOW() FROM "organization" o;


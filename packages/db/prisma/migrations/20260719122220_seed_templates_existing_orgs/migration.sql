-- The sample email templates and document template originally seeded only
-- new workspaces. Backfill them into workspaces that predate the feature
-- (marked isSample, so "Remove sample data" clears them). Idempotent: only
-- fills workspaces with no email templates / no doc templates.

INSERT INTO "email_template" ("id", "tenant_id", "name", "subject", "body", "isSample", "createdAt", "updatedAt")
SELECT gen_random_uuid(), o."id", 'Status update (Sample)', 'Update on {{property_address}}',
$$Hi {{client_name}},

A quick status update on **{{property_address}}**:

- Contract date: {{contract_date}}
- Closing date: {{close_date}}

Everything is on track. Reply to this email with any questions — it lands right on the file.

{{tc_name}}
{{tenant_name}}$$, true, NOW(), NOW()
FROM "organization" o
WHERE NOT EXISTS (SELECT 1 FROM "email_template" t WHERE t."tenant_id" = o."id");

INSERT INTO "email_template" ("id", "tenant_id", "name", "subject", "body", "isSample", "createdAt", "updatedAt")
SELECT gen_random_uuid(), o."id", 'Introductions — lender & title (Sample)', 'Introductions: {{property_address}}',
$$Hello all,

Introducing the team for **{{property_address}}**:

- Buyer's agent: {{buyer_agent_name}}
- Lender: {{lender_name}}
- Title: {{title_company_name}}

I'm coordinating this file for {{tenant_name}} and will keep everyone on schedule toward the {{close_date}} closing. Reply-all works — replies land on the transaction record.

{{tc_name}}$$, true, NOW(), NOW()
FROM "organization" o
WHERE NOT EXISTS (SELECT 1 FROM "email_template" t WHERE t."tenant_id" = o."id" AND t."name" LIKE 'Introductions%');

INSERT INTO "email_template" ("id", "tenant_id", "name", "subject", "body", "isSample", "createdAt", "updatedAt")
SELECT gen_random_uuid(), o."id", 'Inspection scheduled (Sample)', 'Inspection scheduled — {{property_address}}',
$$Hi {{buyer_name}},

Your inspection for **{{property_address}}** is scheduled. A few reminders:

- Plan for 2–3 hours on site
- Bring questions — the inspector will walk you through findings
- The written report follows within 24–48 hours

We'll review the report together as soon as it lands.

{{tc_name}}
{{tenant_name}}$$, true, NOW(), NOW()
FROM "organization" o
WHERE NOT EXISTS (SELECT 1 FROM "email_template" t WHERE t."tenant_id" = o."id" AND t."name" LIKE 'Inspection%');

INSERT INTO "email_template" ("id", "tenant_id", "name", "subject", "body", "isSample", "createdAt", "updatedAt")
SELECT gen_random_uuid(), o."id", 'Portal invitation (Sample)', 'Your transaction portal — {{property_address}}',
$$Hi {{client_name}},

Here's your private portal for **{{property_address}}** — every date, document, and milestone, always current:

[paste portal link here]

Bookmark it. When something changes, the portal already knows.

{{tc_name}}
{{tenant_name}}$$, true, NOW(), NOW()
FROM "organization" o
WHERE NOT EXISTS (SELECT 1 FROM "email_template" t WHERE t."tenant_id" = o."id" AND t."name" LIKE 'Portal invitation%');

INSERT INTO "doc_template" ("id", "tenant_id", "name", "description", "body", "isSample", "createdAt", "updatedAt")
SELECT gen_random_uuid(), o."id", 'Closing intro letter (Sample)', 'Shows merge fields — generate a filled PDF from any transaction.',
$${{today}}

Dear {{party.BUYER.name}},

{{tenant.name}} is coordinating your purchase of {{transaction.propertyAddress}}. From contract to closing on {{transaction.closeDate}}, we track every deadline and document so nothing slips.

You can reach your agent, {{client.name}}, at {{client.email}} — and reply to any email from us to reach the file directly.

Warm regards,
{{tenant.name}}$$, true, NOW(), NOW()
FROM "organization" o
WHERE NOT EXISTS (SELECT 1 FROM "doc_template" d WHERE d."tenant_id" = o."id");

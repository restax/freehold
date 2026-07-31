import { ClientType, DateAnchor, PartyRole, withTenant } from "@freehold/db";
import { instantiatePlan } from "@freehold/workflows";
import { DEFAULT_EMAIL_TEMPLATES, EMAIL_PHASES, phaseOf } from "@/lib/default-email-templates";
import { EMAIL_TEMPLATE_LIBRARY } from "@/lib/email-template-library";
import { ensureGroup } from "@/lib/starter-library-seed";

const PHASE_LABEL = new Map(EMAIL_PHASES.map((p) => [p.key, p.label]));

/**
 * Seed the built-in phase templates as permanent (non-sample) defaults, so
 * "remove sample data" leaves them. Idempotent by name — re-running restores
 * any a tenant deleted without duplicating the rest. A pre-existing row
 * missing its folder (from before templates were foldered) is backfilled
 * rather than skipped, so re-running the restore button is also how an
 * older workspace picks up folders it never had. Returns how many were
 * newly added.
 */
export async function seedDefaultEmailTemplates(tenantId: string): Promise<number> {
  return withTenant(tenantId, async (tx) => {
    const groupCache = new Map<string, string>();
    const existing = await tx.emailTemplate.findMany({
      where: { name: { in: DEFAULT_EMAIL_TEMPLATES.map((t) => t.name) } },
      select: { id: true, name: true, groupId: true },
    });
    const existingByName = new Map(existing.map((t) => [t.name, t]));

    let added = 0;
    for (const t of DEFAULT_EMAIL_TEMPLATES) {
      const groupId = await ensureGroup(
        tx,
        tenantId,
        "EMAIL",
        PHASE_LABEL.get(phaseOf(t.category)) ?? "General",
        groupCache,
      );
      const found = existingByName.get(t.name);
      if (found) {
        if (!found.groupId) {
          await tx.emailTemplate.update({ where: { id: found.id }, data: { groupId } });
        }
        continue;
      }
      await tx.emailTemplate.create({
        data: {
          tenantId,
          groupId,
          name: t.name,
          subject: t.subject,
          body: t.body,
          category: t.category,
          taskMatch: t.taskMatch ?? null,
          attachMatch: t.attachMatch ?? null,
          isSample: false,
        },
      });
      added++;
    }
    return added;
  });
}

export const SAMPLE_PLAN: Array<{ title: string; anchor: DateAnchor; offsetDays: number }> = [
  {
    title: "Send introduction emails to all parties",
    anchor: DateAnchor.CONTRACT_DATE,
    offsetDays: 1,
  },
  { title: "Confirm earnest money deposited", anchor: DateAnchor.CONTRACT_DATE, offsetDays: 3 },
  { title: "Schedule home inspection", anchor: DateAnchor.CONTRACT_DATE, offsetDays: 5 },
  { title: "Buyer loan application submitted", anchor: DateAnchor.CONTRACT_DATE, offsetDays: 5 },
  { title: "Appraisal ordered", anchor: DateAnchor.CONTRACT_DATE, offsetDays: 7 },
  { title: "Inspection contingency deadline", anchor: DateAnchor.CONTRACT_DATE, offsetDays: 10 },
  { title: "Title commitment received", anchor: DateAnchor.CONTRACT_DATE, offsetDays: 14 },
  { title: "Clear to close from lender", anchor: DateAnchor.CLOSE_DATE, offsetDays: -7 },
  { title: "Schedule closing with title company", anchor: DateAnchor.CLOSE_DATE, offsetDays: -5 },
  { title: "Final walkthrough", anchor: DateAnchor.CLOSE_DATE, offsetDays: -1 },
  {
    title: "Closing day — confirm funding and recording",
    anchor: DateAnchor.CLOSE_DATE,
    offsetDays: 0,
  },
];

/**
 * Additional prebuilt checklists covering the task families working TCs run:
 * compliance, listing prep, and post-close follow-up. Seeded as removable
 * samples; tenants edit them or build their own in Action plans.
 */
export const EXTRA_PLANS: Array<{
  name: string;
  tasks: Array<{ title: string; anchor: DateAnchor; offsetDays: number }>;
}> = [
  {
    name: "Documents & compliance (Sample)",
    tasks: [
      {
        title: "Upload executed purchase agreement + extract dates",
        anchor: DateAnchor.CONTRACT_DATE,
        offsetDays: 0,
      },
      {
        title: "Send required disclosures for signature (lead paint, seller property)",
        anchor: DateAnchor.CONTRACT_DATE,
        offsetDays: 2,
      },
      {
        title: "Confirm all addenda signed and filed",
        anchor: DateAnchor.CONTRACT_DATE,
        offsetDays: 6,
      },
      {
        title: "Share executed documents to the client portal",
        anchor: DateAnchor.CONTRACT_DATE,
        offsetDays: 7,
      },
      {
        title: "Submit complete file for broker compliance approval",
        anchor: DateAnchor.CLOSE_DATE,
        offsetDays: -3,
      },
      {
        title: "Confirm commission disbursement authorization",
        anchor: DateAnchor.CLOSE_DATE,
        offsetDays: -2,
      },
    ],
  },
  {
    name: "Listing prep (Sample)",
    tasks: [
      {
        title: "Schedule photography and staging",
        anchor: DateAnchor.CONTRACT_DATE,
        offsetDays: -14,
      },
      { title: "Order sign installation", anchor: DateAnchor.CONTRACT_DATE, offsetDays: -12 },
      {
        title: "Verify MLS details and syndication to third-party sites",
        anchor: DateAnchor.CONTRACT_DATE,
        offsetDays: -10,
      },
      {
        title: "Log marketing activities and build email list",
        anchor: DateAnchor.CONTRACT_DATE,
        offsetDays: -9,
      },
      {
        title: "Collect and organize showing feedback for the seller",
        anchor: DateAnchor.CONTRACT_DATE,
        offsetDays: -3,
      },
    ],
  },
  {
    name: "Post-close follow-up (Sample)",
    tasks: [
      {
        title: "Send congratulations + records package to client",
        anchor: DateAnchor.CLOSE_DATE,
        offsetDays: 1,
      },
      {
        title: "Confirm utilities transferred and keys delivered",
        anchor: DateAnchor.CLOSE_DATE,
        offsetDays: 2,
      },
      { title: "Ask for a review / referral", anchor: DateAnchor.CLOSE_DATE, offsetDays: 14 },
      { title: "30-day check-in call", anchor: DateAnchor.CLOSE_DATE, offsetDays: 30 },
      {
        title: "Set purchase-anniversary touch date on the contact",
        anchor: DateAnchor.CLOSE_DATE,
        offsetDays: 30,
      },
    ],
  },
];

export function utcToday(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export function addDaysUtc(d: Date, days: number): Date {
  const r = new Date(d.getTime());
  r.setUTCDate(r.getUTCDate() + days);
  return r;
}

/**
 * Seed the removable sample dataset into a tenant. No session involved:
 * callers are responsible for authorization (the onboarding action verifies
 * membership; the demo reset endpoint authenticates via CRON_SECRET).
 */
export async function seedTenantData(tenantId: string, userId: string) {
  const contractDate = addDaysUtc(utcToday(), -5);
  const closeDate = addDaysUtc(utcToday(), 25);

  await withTenant(tenantId, async (tx) => {
    const client = await tx.client.create({
      data: {
        tenantId,
        name: "Sunrise Realty (Sample)",
        type: ClientType.BROKERAGE,
        email: "sample.sunrise@freeholdtc.dev",
        isSample: true,
      },
    });

    // Sequential on purpose: concurrent queries on one interactive
    // transaction client are a known Prisma footgun.
    const buyer = await tx.contact.create({
      data: {
        tenantId,
        name: "Jordan Bell (Sample)",
        category: "Buyer",
        email: "sample.buyer@freeholdtc.dev",
        phone: "555-0101",
        isSample: true,
      },
    });
    const buyerAgent = await tx.contact.create({
      data: {
        tenantId,
        name: "Casey Rivera (Sample)",
        category: "Agent",
        email: "sample.agent@freeholdtc.dev",
        phone: "555-0102",
        rating: 5,
        isSample: true,
      },
    });
    const lender = await tx.contact.create({
      data: {
        tenantId,
        name: "Morgan Lee (Sample)",
        category: "Lender",
        email: "sample.lender@freeholdtc.dev",
        phone: "555-0103",
        isSample: true,
      },
    });
    const title = await tx.contact.create({
      data: {
        tenantId,
        name: "Alexis Chen (Sample)",
        category: "Title",
        email: "sample.title@freeholdtc.dev",
        phone: "555-0104",
        isSample: true,
      },
    });

    const plan = await tx.actionPlan.create({
      data: {
        tenantId,
        name: "Standard buy-side closing (Sample)",
        description:
          "Typical residential buy-side checklist, anchored to contract and close dates.",
        isSample: true,
        tasks: {
          create: SAMPLE_PLAN.map((t, i) => ({
            tenantId,
            title: t.title,
            anchor: t.anchor,
            offsetDays: t.offsetDays,
            sortOrder: i + 1,
          })),
        },
      },
    });
    void plan;

    const txn = await tx.transaction.create({
      data: {
        tenantId,
        clientId: client.id,
        propertyAddress: "412 Maple Avenue (Sample)",
        city: "Springfield",
        state: "IL",
        zip: "62704",
        purchasePrice: 385000,
        contractDate,
        closeDate,
        isSample: true,
        parties: {
          create: [
            { tenantId, contactId: buyer.id, role: PartyRole.BUYER },
            { tenantId, contactId: buyerAgent.id, role: PartyRole.BUYER_AGENT },
            { tenantId, contactId: lender.id, role: PartyRole.LENDER },
            { tenantId, contactId: title.id, role: PartyRole.TITLE_COMPANY },
          ],
        },
      },
    });

    await tx.transaction.create({
      data: {
        tenantId,
        clientId: client.id,
        propertyAddress: "88 Harbor Lane (Sample)",
        city: "Springfield",
        state: "IL",
        status: "ACTIVE",
        side: "SELL_SIDE",
        isSample: true,
      },
    });

    const instantiated = instantiatePlan(
      SAMPLE_PLAN.map((t, i) => ({ ...t, sortOrder: i + 1 })),
      { contractDate, closeDate },
    );
    await tx.task.createMany({
      data: instantiated.map((t, i) => ({
        tenantId,
        transactionId: txn.id,
        title: t.title,
        dueDate: t.dueDate,
        anchor: SAMPLE_PLAN[i]?.anchor ?? null,
        offsetDays: SAMPLE_PLAN[i]?.offsetDays ?? null,
        sortOrder: i + 1,
        assigneeId: userId,
        isSample: true,
      })),
    });

    await tx.docTemplate.create({
      data: {
        tenantId,
        name: "Closing intro letter (Sample)",
        description: "Shows merge fields — generate a filled PDF from any transaction.",
        isSample: true,
        body: `{{today}}

Dear {{party.BUYER.name}},

{{tenant.name}} is coordinating your purchase of {{transaction.propertyAddress}}. From contract to closing on {{transaction.closeDate}}, we track every deadline and document so nothing slips.

You can reach your agent, {{client.name}}, at {{client.email}} — and reply to any email from us to reach the file directly.

Warm regards,
{{tenant.name}}`,
      },
    });

    for (const plan of EXTRA_PLANS) {
      await tx.actionPlan.create({
        data: {
          tenantId,
          name: plan.name,
          isSample: true,
          tasks: {
            create: plan.tasks.map((t, i) => ({
              tenantId,
              title: t.title,
              anchor: t.anchor,
              offsetDays: t.offsetDays,
              sortOrder: i + 1,
            })),
          },
        },
      });
    }

    for (const t of EMAIL_TEMPLATE_LIBRARY) {
      await tx.emailTemplate.create({
        data: {
          tenantId,
          name: `${t.name} (Sample)`,
          subject: t.subject,
          body: t.body,
          category: t.category,
          taskMatch: t.taskMatch,
          isSample: true,
        },
      });
    }
  });
}

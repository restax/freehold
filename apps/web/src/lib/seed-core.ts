import { ClientType, DateAnchor, PartyRole, withTenant } from "@freehold/db";
import { instantiatePlan } from "@freehold/workflows";

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
        email: "team@sunriserealty.example",
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
        email: "jordan@example.com",
        phone: "555-0101",
        isSample: true,
      },
    });
    const buyerAgent = await tx.contact.create({
      data: {
        tenantId,
        name: "Casey Rivera (Sample)",
        category: "Agent",
        email: "casey@sunriserealty.example",
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
        email: "morgan@lender.example",
        phone: "555-0103",
        isSample: true,
      },
    });
    const title = await tx.contact.create({
      data: {
        tenantId,
        name: "Alexis Chen (Sample)",
        category: "Title",
        email: "alexis@titleco.example",
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
        status: "LISTING",
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
        sortOrder: i + 1,
        assigneeId: userId,
        isSample: true,
      })),
    });
  });
}

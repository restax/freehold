"use server";

import { ClientType, DateAnchor, PartyRole, prisma, withTenant } from "@freehold/db";
import { instantiatePlan } from "@freehold/workflows";
import { revalidatePath } from "next/cache";
import { requireTenant } from "@/lib/tenant";

const SAMPLE_PLAN: Array<{ title: string; anchor: DateAnchor; offsetDays: number }> = [
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

function utcToday(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function addDaysUtc(d: Date, days: number): Date {
  const r = new Date(d.getTime());
  r.setUTCDate(r.getUTCDate() + days);
  return r;
}

/**
 * Seed removable demo data into a tenant. Called right after workspace
 * creation (onboarding checkbox); tenantId comes from the client, so
 * membership is verified before any write.
 */
export async function seedSampleData(tenantId: string) {
  const { userId } = await requireTenant();
  const membership = await prisma.member.findFirst({
    where: { organizationId: tenantId, userId },
    select: { id: true },
  });
  if (!membership) return;

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

    const [buyer, buyerAgent, lender, title] = await Promise.all([
      tx.contact.create({
        data: {
          tenantId,
          name: "Jordan Bell (Sample)",
          category: "Buyer",
          email: "jordan@example.com",
          phone: "555-0101",
          isSample: true,
        },
      }),
      tx.contact.create({
        data: {
          tenantId,
          name: "Casey Rivera (Sample)",
          category: "Agent",
          email: "casey@sunriserealty.example",
          phone: "555-0102",
          rating: 5,
          isSample: true,
        },
      }),
      tx.contact.create({
        data: {
          tenantId,
          name: "Morgan Lee (Sample)",
          category: "Lender",
          email: "morgan@lender.example",
          phone: "555-0103",
          isSample: true,
        },
      }),
      tx.contact.create({
        data: {
          tenantId,
          name: "Alexis Chen (Sample)",
          category: "Title",
          email: "alexis@titleco.example",
          phone: "555-0104",
          isSample: true,
        },
      }),
    ]);

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

export async function removeSampleData() {
  const { tenantId } = await requireTenant();
  await withTenant(tenantId, async (tx) => {
    // Order matters only for clarity — cascades cover children either way.
    await tx.task.deleteMany({ where: { isSample: true } });
    await tx.transaction.deleteMany({ where: { isSample: true } });
    await tx.actionPlan.deleteMany({ where: { isSample: true } });
    await tx.contact.deleteMany({ where: { isSample: true } });
    await tx.client.deleteMany({ where: { isSample: true } });
  });
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/transactions");
  revalidatePath("/dashboard/contacts");
  revalidatePath("/dashboard/clients");
  revalidatePath("/dashboard/action-plans");
  revalidatePath("/dashboard/settings");
}

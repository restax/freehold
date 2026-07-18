import { randomUUID } from "node:crypto";
import { prisma, withTenant } from "@freehold/db";
import { auth } from "@/lib/auth";
import { seedTenantData } from "@/lib/seed-core";

/**
 * The public shared demo: one fictional brokerage every visitor explores
 * through the demo@ account. The account is a plain "member", so everything
 * owner/admin-gated (team changes, billing, API keys, workspace deletion)
 * stays locked; the nightly reset wipes and re-seeds whatever visitors did.
 * Active only when DEMO_USER_PASSWORD is set — self-hosted installs don't
 * grow a surprise public login.
 */
export const DEMO_EMAIL = "demo@freeholdtc.dev";
const DEMO_OWNER_EMAIL = "demo-owner@freeholdtc.dev";
export const DEMO_SLUG = "demo-brokerage";

export function demoEnabled(): boolean {
  return Boolean(process.env.DEMO_USER_PASSWORD);
}

async function ensureUser(email: string, name: string, password: string) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return existing;
  await auth.api.signUpEmail({ body: { email, password, name } });
  const created = await prisma.user.findUnique({ where: { email } });
  if (!created) throw new Error(`demo bootstrap: failed to create ${email}`);
  return created;
}

export async function ensureDemo() {
  const password = process.env.DEMO_USER_PASSWORD;
  if (!password) throw new Error("DEMO_USER_PASSWORD is not set");

  // The owner exists so the workspace has one, but nobody ever signs in as
  // it: its password is random and discarded.
  const owner = await ensureUser(DEMO_OWNER_EMAIL, "Demo Owner", `${randomUUID()}${randomUUID()}`);
  const visitor = await ensureUser(DEMO_EMAIL, "Demo Visitor", password);

  let org = await prisma.organization.findUnique({ where: { slug: DEMO_SLUG } });
  if (!org) {
    org = await prisma.organization.create({
      data: {
        id: randomUUID(),
        name: "Maplewood Transactions (Demo)",
        slug: DEMO_SLUG,
        createdAt: new Date(),
      },
    });
  }

  const memberships: Array<[typeof owner, string]> = [
    [owner, "owner"],
    [visitor, "member"],
  ];
  for (const [user, role] of memberships) {
    const existing = await prisma.member.findFirst({
      where: { organizationId: org.id, userId: user.id },
      select: { id: true },
    });
    if (!existing) {
      await prisma.member.create({
        data: { id: randomUUID(), organizationId: org.id, userId: user.id, role },
      });
    }
  }

  return { org, owner, visitor };
}

/** Wipe everything in the demo tenant and re-seed the sample brokerage. */
export async function resetDemoData() {
  const { org, visitor } = await ensureDemo();

  await withTenant(org.id, async (tx) => {
    // Child tables first; cascades cover the rest either way.
    await tx.invoice.deleteMany({});
    await tx.signatureEnvelope.deleteMany({});
    await tx.contractExtraction.deleteMany({});
    await tx.task.deleteMany({});
    await tx.transaction.deleteMany({});
    await tx.actionPlan.deleteMany({});
    await tx.document.deleteMany({});
    await tx.docTemplate.deleteMany({});
    await tx.contact.deleteMany({});
    await tx.client.deleteMany({});
    await tx.vaultAccessLog.deleteMany({});
    await tx.vaultCredential.deleteMany({});
    await tx.webhookEndpoint.deleteMany({});
  });

  // Capability tables carry no RLS; scope the delete explicitly.
  await prisma.portalLink.deleteMany({ where: { tenantId: org.id } });
  await prisma.apiKey.deleteMany({ where: { tenantId: org.id } });

  // Log out any lingering visitor sessions so each day starts clean, and
  // refresh the free-tier AI trial credits visitors burn through.
  await prisma.session.deleteMany({ where: { userId: visitor.id } });
  await prisma.organization.update({ where: { id: org.id }, data: { aiExtractionsUsed: 0 } });

  await seedTenantData(org.id, visitor.id);
}

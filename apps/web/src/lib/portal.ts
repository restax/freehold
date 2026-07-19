import { prisma, withTenant } from "@freehold/db";

/**
 * The origin portal links are shown with. On the tenant's subdomain
 * (acme.freeholdtc.dev) when the deployment has a real domain; the plain
 * base URL otherwise (localhost, bare-IP self-hosts).
 */
export async function portalOrigin(tenantId: string): Promise<string> {
  const base = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
  let url: URL;
  try {
    url = new URL(base);
  } catch {
    return base;
  }
  const bareHost = url.hostname === "localhost" || /^[0-9.]+$/.test(url.hostname);
  if (bareHost) return base;
  const org = await prisma.organization.findUnique({
    where: { id: tenantId },
    select: { slug: true },
  });
  if (!org?.slug) return base;
  return `${url.protocol}//${org.slug}.${url.host}`;
}

async function liveLink(token: string) {
  const link = await prisma.portalLink.findUnique({ where: { token } });
  if (!link || link.revokedAt) return null;
  // Fire-and-forget access timestamp; portal rendering never blocks on it.
  prisma.portalLink
    .update({ where: { id: link.id }, data: { lastAccessedAt: new Date() } })
    .catch(() => {});
  return link;
}

async function tenantName(tenantId: string): Promise<string> {
  const tenant = await prisma.organization.findUnique({
    where: { id: tenantId },
    select: { name: true },
  });
  return tenant?.name ?? "Your transaction coordinator";
}

/**
 * Resolve a buyer/seller portal token to its link + the data the link is
 * allowed to show. The bare-token lookup runs outside withTenant on purpose
 * (portal_link has no RLS — see the schema note); everything else is fetched
 * tenant-scoped. Tasks and documents are pre-filtered to the client audience.
 */
export async function resolvePortal(token: string) {
  const link = await liveLink(token);
  if (!link || link.audience !== "CLIENT" || !link.transactionId) return null;
  const transactionId = link.transactionId;

  const txn = await withTenant(link.tenantId, (tx) =>
    tx.transaction.findUnique({
      where: { id: transactionId },
      include: {
        client: { select: { name: true } },
        parties: { include: { contact: { select: { name: true, email: true, phone: true } } } },
        tasks: {
          where: { visibleToClient: true },
          orderBy: [{ dueDate: "asc" }, { sortOrder: "asc" }],
          select: { id: true, title: true, dueDate: true, status: true },
        },
        documents: {
          where: { visibleToClient: true },
          orderBy: { createdAt: "desc" },
          select: { id: true, filename: true, sizeBytes: true, createdAt: true },
        },
      },
    }),
  );
  if (!txn) return null;
  return { link, txn, tenantName: await tenantName(link.tenantId) };
}

/**
 * Resolve a managed-agent portal token: the client record plus every one of
 * their transactions (pipeline, history) and a recent-activity feed drawn
 * from the audit trail and task completions.
 */
export async function resolveAgentPortal(token: string) {
  const link = await liveLink(token);
  if (!link || link.audience !== "AGENT" || !link.clientId) return null;
  const clientId = link.clientId;

  const data = await withTenant(link.tenantId, async (tx) => {
    const client = await tx.client.findUnique({
      where: { id: clientId },
      select: { id: true, name: true, type: true },
    });
    if (!client) return null;
    const transactions = await tx.transaction.findMany({
      where: { clientId },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        propertyAddress: true,
        city: true,
        state: true,
        status: true,
        side: true,
        purchasePrice: true,
        contractDate: true,
        closeDate: true,
        updatedAt: true,
      },
    });
    const weekAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000);
    const in30 = new Date(Date.now() + 30 * 24 * 3600 * 1000);
    const txnIds = transactions.map((t) => t.id);
    const upcoming = await tx.task.findMany({
      where: {
        transactionId: { in: txnIds },
        visibleToAgent: true,
        status: "OPEN",
        dueDate: { gte: new Date(Date.now() - 24 * 3600 * 1000), lte: in30 },
      },
      orderBy: { dueDate: "asc" },
      take: 12,
      select: {
        id: true,
        title: true,
        dueDate: true,
        transaction: { select: { id: true, propertyAddress: true } },
      },
    });
    const recentTasks = await tx.task.findMany({
      where: {
        transactionId: { in: txnIds },
        visibleToAgent: true,
        completedAt: { gte: weekAgo },
      },
      orderBy: { completedAt: "desc" },
      take: 15,
      select: {
        id: true,
        title: true,
        completedAt: true,
        transaction: { select: { id: true, propertyAddress: true } },
      },
    });
    const recentDocs = await tx.document.findMany({
      where: { transactionId: { in: txnIds }, visibleToAgent: true, createdAt: { gte: weekAgo } },
      orderBy: { createdAt: "desc" },
      take: 15,
      select: {
        id: true,
        filename: true,
        createdAt: true,
        transaction: { select: { id: true, propertyAddress: true } },
      },
    });
    return { client, transactions, recentTasks, recentDocs, upcoming };
  });
  if (!data) return null;
  return { link, ...data, tenantName: await tenantName(link.tenantId) };
}

/** One transaction through an agent portal link, agent-visible items only. */
export async function resolveAgentPortalTxn(token: string, txnId: string) {
  const link = await liveLink(token);
  if (!link || link.audience !== "AGENT" || !link.clientId) return null;
  const clientId = link.clientId;

  const txn = await withTenant(link.tenantId, (tx) =>
    tx.transaction.findFirst({
      where: { id: txnId, clientId },
      include: {
        client: { select: { name: true } },
        parties: { include: { contact: { select: { name: true, email: true, phone: true } } } },
        tasks: {
          where: { visibleToAgent: true },
          orderBy: [{ dueDate: "asc" }, { sortOrder: "asc" }],
          select: { id: true, title: true, dueDate: true, status: true },
        },
        documents: {
          where: { visibleToAgent: true },
          orderBy: { createdAt: "desc" },
          select: { id: true, filename: true, sizeBytes: true, createdAt: true },
        },
      },
    }),
  );
  if (!txn) return null;
  return { link, txn, tenantName: await tenantName(link.tenantId) };
}

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

/**
 * Resolve a portal token to its link + the data the link is allowed to show.
 * The bare-token lookup runs outside withTenant on purpose (portal_link has
 * no RLS — see the schema note); everything else is fetched tenant-scoped.
 */
export async function resolvePortal(token: string) {
  const link = await prisma.portalLink.findUnique({ where: { token } });
  if (!link || link.revokedAt) return null;

  // Fire-and-forget access timestamp; portal rendering never blocks on it.
  prisma.portalLink
    .update({ where: { id: link.id }, data: { lastAccessedAt: new Date() } })
    .catch(() => {});

  const tenant = await prisma.organization.findUnique({
    where: { id: link.tenantId },
    select: { name: true },
  });

  // Includes are unconditional so Prisma's types stay precise; the page and
  // the document route both gate on the link's show* toggles before rendering
  // or serving anything.
  const txn = await withTenant(link.tenantId, (tx) =>
    tx.transaction.findUnique({
      where: { id: link.transactionId },
      include: {
        client: { select: { name: true } },
        parties: { include: { contact: { select: { name: true, email: true, phone: true } } } },
        tasks: {
          orderBy: [{ dueDate: "asc" }, { sortOrder: "asc" }],
          select: { id: true, title: true, dueDate: true, status: true },
        },
        documents: {
          orderBy: { createdAt: "desc" },
          select: { id: true, filename: true, sizeBytes: true, createdAt: true },
        },
      },
    }),
  );
  if (!txn) return null;
  return { link, txn, tenantName: tenant?.name ?? "Your transaction coordinator" };
}

import { createHash } from "node:crypto";
import { prisma, withTenant } from "@freehold/db";
import { deliverWebhooks } from "@freehold/integrations";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

/**
 * Public REST API v1. Authentication: `Authorization: Bearer fh_live_...`.
 * Keys are stored hashed; every request runs inside the tenant's RLS scope.
 */

const STATUSES = ["LISTING", "UNDER_CONTRACT", "PENDING", "CLOSED", "CANCELLED"] as const;
const SIDES = ["BUY_SIDE", "SELL_SIDE", "DUAL"] as const;

async function authenticate(req: FastifyRequest, reply: FastifyReply): Promise<string | null> {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token?.startsWith("fh_")) {
    reply.code(401).send({ error: "missing_api_key" });
    return null;
  }
  const hash = createHash("sha256").update(token).digest("hex");
  const key = await prisma.apiKey.findUnique({ where: { hash } });
  if (!key || key.revokedAt) {
    reply.code(401).send({ error: "invalid_api_key" });
    return null;
  }
  prisma.apiKey.update({ where: { id: key.id }, data: { lastUsedAt: new Date() } }).catch(() => {});
  return key.tenantId;
}

async function emit(tenantId: string, event: string, data: unknown) {
  const endpoints = await withTenant(tenantId, (tx) =>
    tx.webhookEndpoint.findMany({ where: { active: true, events: { has: event } } }),
  );
  if (endpoints.length > 0) void deliverWebhooks(endpoints, event, data);
}

const dateOnly = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

function transactionJson(t: {
  id: string;
  propertyAddress: string;
  city: string | null;
  state: string | null;
  zip: string | null;
  status: string;
  side: string;
  purchasePrice: number | null;
  contractDate: Date | null;
  closeDate: Date | null;
  createdAt: Date;
}) {
  return {
    id: t.id,
    propertyAddress: t.propertyAddress,
    city: t.city,
    state: t.state,
    zip: t.zip,
    status: t.status,
    side: t.side,
    purchasePrice: t.purchasePrice,
    contractDate: dateOnly(t.contractDate),
    closeDate: dateOnly(t.closeDate),
    createdAt: t.createdAt.toISOString(),
  };
}

export function registerV1(app: FastifyInstance) {
  app.get("/v1/account", async (req, reply) => {
    const tenantId = await authenticate(req, reply);
    if (!tenantId) return;
    const org = await prisma.organization.findUniqueOrThrow({
      where: { id: tenantId },
      select: { name: true, slug: true, planTier: true },
    });
    const counts = await withTenant(tenantId, async (tx) => ({
      activeTransactions: await tx.transaction.count({
        where: { status: { notIn: ["CLOSED", "CANCELLED"] } },
      }),
      closedTransactions: await tx.transaction.count({ where: { status: "CLOSED" } }),
      contacts: await tx.contact.count(),
      clients: await tx.client.count(),
      openTasks: await tx.task.count({ where: { status: "OPEN" } }),
    }));
    reply.send({ workspace: org.name, slug: org.slug, plan: org.planTier, ...counts });
  });

  app.get("/v1/clients", async (req, reply) => {
    const tenantId = await authenticate(req, reply);
    if (!tenantId) return;
    const clients = await withTenant(tenantId, (tx) =>
      tx.client.findMany({
        orderBy: { name: "asc" },
        take: 200,
        include: {
          _count: { select: { transactions: true, clientNotes: true } },
          portalLinks: {
            select: { label: true, audience: true, revokedAt: true, lastAccessedAt: true },
          },
        },
      }),
    );
    reply.send({
      clients: clients.map((c) => ({
        id: c.id,
        name: c.name,
        type: c.type,
        email: c.email,
        phone: c.phone,
        transactions: c._count.transactions,
        notes: c._count.clientNotes,
        portals: c.portalLinks.map((pl) => ({
          label: pl.label,
          audience: pl.audience,
          active: !pl.revokedAt,
          lastOpenedAt: pl.lastAccessedAt?.toISOString() ?? null,
        })),
      })),
    });
  });

  app.get("/v1/transactions", async (req, reply) => {
    const tenantId = await authenticate(req, reply);
    if (!tenantId) return;
    const { status } = req.query as { status?: string };
    const where = STATUSES.includes(status as (typeof STATUSES)[number])
      ? // biome-ignore lint/suspicious/noExplicitAny: validated against STATUSES above
        { status: status as any }
      : {};
    const transactions = await withTenant(tenantId, (tx) =>
      tx.transaction.findMany({ where, orderBy: { createdAt: "desc" }, take: 200 }),
    );
    return { data: transactions.map(transactionJson) };
  });

  app.post("/v1/transactions", async (req, reply) => {
    const tenantId = await authenticate(req, reply);
    if (!tenantId) return;
    const body = (req.body ?? {}) as Record<string, unknown>;
    const propertyAddress = typeof body.propertyAddress === "string" ? body.propertyAddress : "";
    if (!propertyAddress) {
      return reply.code(422).send({ error: "propertyAddress_required" });
    }
    const status = STATUSES.includes(body.status as (typeof STATUSES)[number])
      ? (body.status as string)
      : "UNDER_CONTRACT";
    const side = SIDES.includes(body.side as (typeof SIDES)[number])
      ? (body.side as string)
      : "BUY_SIDE";
    const created = await withTenant(tenantId, (tx) =>
      tx.transaction.create({
        data: {
          tenantId,
          propertyAddress,
          city: typeof body.city === "string" ? body.city : null,
          state: typeof body.state === "string" ? body.state.toUpperCase() : null,
          zip: typeof body.zip === "string" ? body.zip : null,
          // biome-ignore lint/suspicious/noExplicitAny: validated against enum lists above
          status: status as any,
          // biome-ignore lint/suspicious/noExplicitAny: validated against enum lists above
          side: side as any,
          purchasePrice:
            typeof body.purchasePrice === "number" ? Math.round(body.purchasePrice) : null,
          contractDate: typeof body.contractDate === "string" ? new Date(body.contractDate) : null,
          closeDate: typeof body.closeDate === "string" ? new Date(body.closeDate) : null,
        },
      }),
    );
    const json = transactionJson(created);
    await emit(tenantId, "transaction.created", json);
    return reply.code(201).send({ data: json });
  });

  app.get("/v1/contacts", async (req, reply) => {
    const tenantId = await authenticate(req, reply);
    if (!tenantId) return;
    const contacts = await withTenant(tenantId, (tx) =>
      tx.contact.findMany({ orderBy: { name: "asc" }, take: 500 }),
    );
    return {
      data: contacts.map((c) => ({
        id: c.id,
        name: c.name,
        email: c.email,
        phone: c.phone,
        category: c.category,
      })),
    };
  });

  app.post("/v1/contacts", async (req, reply) => {
    const tenantId = await authenticate(req, reply);
    if (!tenantId) return;
    const body = (req.body ?? {}) as Record<string, unknown>;
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) return reply.code(422).send({ error: "name_required" });
    const created = await withTenant(tenantId, (tx) =>
      tx.contact.create({
        data: {
          tenantId,
          name,
          email: typeof body.email === "string" ? body.email : null,
          phone: typeof body.phone === "string" ? body.phone : null,
          category: typeof body.category === "string" ? body.category : "Other",
        },
      }),
    );
    return reply.code(201).send({
      data: {
        id: created.id,
        name: created.name,
        email: created.email,
        phone: created.phone,
        category: created.category,
      },
    });
  });

  app.get("/v1/tasks", async (req, reply) => {
    const tenantId = await authenticate(req, reply);
    if (!tenantId) return;
    const { transactionId } = req.query as { transactionId?: string };
    const tasks = await withTenant(tenantId, (tx) =>
      tx.task.findMany({
        where: transactionId ? { transactionId } : {},
        orderBy: [{ dueDate: "asc" }],
        take: 500,
      }),
    );
    return {
      data: tasks.map((t) => ({
        id: t.id,
        transactionId: t.transactionId,
        title: t.title,
        status: t.status,
        dueDate: dateOnly(t.dueDate),
      })),
    };
  });
}

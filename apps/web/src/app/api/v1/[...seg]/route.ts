import { createHash } from "node:crypto";
import { prisma, withTenant } from "@freehold/db";
import { generateWebhookSecret } from "@freehold/integrations";
import { NextResponse } from "next/server";
import { emitWebhook } from "@/lib/webhook-emit";

export const dynamic = "force-dynamic";

/**
 * Public REST API v1, mounted in the web app so Freehold Cloud serves it at
 * https://<host>/api/v1/* without the separate API service. Self-hosted
 * installs additionally get the standalone Fastify service on :3001 — same
 * endpoints, same keys. Keep the two in sync (unification is a TODO).
 */

const STATUSES = ["LISTING", "UNDER_CONTRACT", "PENDING", "CLOSED", "CANCELLED"] as const;
const SIDES = ["BUY_SIDE", "SELL_SIDE", "DUAL"] as const;

const dateOnly = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

async function authenticate(req: Request): Promise<string | null> {
  const header = req.headers.get("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token?.startsWith("fh_")) return null;
  const hash = createHash("sha256").update(token).digest("hex");
  const key = await prisma.apiKey.findUnique({ where: { hash } });
  if (!key || key.revokedAt) return null;
  prisma.apiKey.update({ where: { id: key.id }, data: { lastUsedAt: new Date() } }).catch(() => {});
  return key.tenantId;
}

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

function transactionJson(t: {
  id: string;
  propertyAddress: string;
  city: string | null;
  state: string | null;
  zip: string | null;
  status: string;
  side: string;
  purchasePrice: number | null;
  listPrice: number | null;
  mlsId: string | null;
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
    listPrice: t.listPrice,
    mlsId: t.mlsId,
    contractDate: dateOnly(t.contractDate),
    closeDate: dateOnly(t.closeDate),
    createdAt: t.createdAt.toISOString(),
  };
}

async function handle(req: Request, seg: string[]): Promise<Response> {
  const tenantId = await authenticate(req);
  if (!tenantId) return json({ error: "invalid_api_key" }, 401);
  const url = new URL(req.url);
  const path = seg.join("/");
  const method = req.method;

  if (path === "account" && method === "GET") {
    const org = await prisma.organization.findUniqueOrThrow({
      where: { id: tenantId },
      select: { name: true, slug: true, planTier: true, createdAt: true },
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
    return json({ workspace: org.name, slug: org.slug, plan: org.planTier, ...counts });
  }

  if (path === "clients" && method === "GET") {
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
    return json({
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
  }

  if (path === "transactions" && method === "GET") {
    const status = url.searchParams.get("status");
    const clientId = url.searchParams.get("clientId");
    const where = {
      ...(status && (STATUSES as readonly string[]).includes(status)
        ? { status: status as (typeof STATUSES)[number] }
        : {}),
      ...(clientId ? { clientId } : {}),
    };
    const transactions = await withTenant(tenantId, (tx) =>
      tx.transaction.findMany({ where, orderBy: { createdAt: "desc" }, take: 200 }),
    );
    return json({ transactions: transactions.map(transactionJson) });
  }

  if (path === "transactions" && method === "POST") {
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    const propertyAddress = typeof body?.propertyAddress === "string" ? body.propertyAddress : "";
    if (!propertyAddress) return json({ error: "propertyAddress_required" }, 400);
    const str = (k: string) => (typeof body?.[k] === "string" ? (body[k] as string) : null);
    const num = (k: string) => (typeof body?.[k] === "number" ? (body[k] as number) : null);
    const day = (k: string) => {
      const v = str(k);
      return v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(`${v}T00:00:00Z`) : null;
    };
    const status = (STATUSES as readonly string[]).includes(str("status") ?? "")
      ? (str("status") as (typeof STATUSES)[number])
      : "UNDER_CONTRACT";
    const side = (SIDES as readonly string[]).includes(str("side") ?? "")
      ? (str("side") as (typeof SIDES)[number])
      : "BUY_SIDE";
    const created = await withTenant(tenantId, (tx) =>
      tx.transaction.create({
        data: {
          tenantId,
          propertyAddress,
          city: str("city"),
          state: str("state"),
          zip: str("zip"),
          status,
          side,
          purchasePrice: num("purchasePrice"),
          contractDate: day("contractDate"),
          closeDate: day("closeDate"),
        },
      }),
    );
    await emitWebhook(tenantId, "transaction.created", transactionJson(created));
    return json({ transaction: transactionJson(created) }, 201);
  }

  if (path === "contacts" && method === "GET") {
    const contacts = await withTenant(tenantId, (tx) =>
      tx.contact.findMany({ orderBy: { name: "asc" }, take: 500 }),
    );
    return json({
      contacts: contacts.map((c) => ({
        id: c.id,
        name: c.name,
        email: c.email,
        phone: c.phone,
        categories: c.categories,
        grade: c.grade,
        nextTouchAt: dateOnly(c.nextTouchAt),
      })),
    });
  }

  if (path === "contacts" && method === "POST") {
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    const name = typeof body?.name === "string" ? body.name : "";
    if (!name) return json({ error: "name_required" }, 400);
    const str = (k: string) => (typeof body?.[k] === "string" ? (body[k] as string) : null);
    const created = await withTenant(tenantId, (tx) =>
      tx.contact.create({
        data: {
          tenantId,
          name,
          email: str("email"),
          phone: str("phone"),
          category: str("category") ?? "Other",
        },
      }),
    );
    return json({ contact: { id: created.id, name: created.name } }, 201);
  }

  if (path === "tasks" && method === "GET") {
    const transactionId = url.searchParams.get("transactionId");
    const tasks = await withTenant(tenantId, (tx) =>
      tx.task.findMany({
        where: transactionId ? { transactionId } : {},
        orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }],
        take: 300,
        include: { transaction: { select: { id: true, propertyAddress: true } } },
      }),
    );
    return json({
      tasks: tasks.map((t) => ({
        id: t.id,
        title: t.title,
        status: t.status,
        dueDate: dateOnly(t.dueDate),
        transactionId: t.transactionId,
        propertyAddress: t.transaction?.propertyAddress ?? null,
      })),
    });
  }

  if (path === "tasks" && method === "POST") {
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    const title = typeof body?.title === "string" ? body.title.slice(0, 300) : "";
    if (!title) return json({ error: "title_required" }, 400);
    const due = typeof body?.dueDate === "string" ? new Date(`${body.dueDate}T00:00:00Z`) : null;
    const transactionId = typeof body?.transactionId === "string" ? body.transactionId : null;
    const priority =
      typeof body?.priority === "string" && ["NORMAL", "HIGH", "CRITICAL"].includes(body.priority)
        ? (body.priority as "NORMAL" | "HIGH" | "CRITICAL")
        : "NORMAL";
    const created = await withTenant(tenantId, (tx) =>
      tx.task.create({
        data: {
          tenantId,
          title,
          transactionId,
          priority,
          dueDate: due && !Number.isNaN(due.getTime()) ? due : null,
        },
      }),
    );
    return json(
      { task: { id: created.id, title: created.title, dueDate: dateOnly(created.dueDate) } },
      201,
    );
  }

  // Append a timestamped line to a transaction's notes (Zapier writeback).
  if (path === "notes" && method === "POST") {
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    const transactionId = typeof body?.transactionId === "string" ? body.transactionId : "";
    const text = typeof body?.body === "string" ? body.body.slice(0, 2000) : "";
    if (!transactionId || !text) return json({ error: "transactionId_and_body_required" }, 400);
    const stamp = new Date().toISOString().slice(0, 10);
    const updated = await withTenant(tenantId, async (tx) => {
      const t = await tx.transaction.findUnique({
        where: { id: transactionId },
        select: { notes: true },
      });
      if (!t) return null;
      return tx.transaction.update({
        where: { id: transactionId },
        data: { notes: `${t.notes ? `${t.notes}\n` : ""}[${stamp}] ${text}` },
        select: { id: true },
      });
    });
    if (!updated) return json({ error: "transaction_not_found" }, 404);
    return json({ ok: true, transactionId: updated.id }, 201);
  }

  // Webhook endpoint management — enables Zapier REST-hook subscriptions.
  if (path === "webhooks" && method === "GET") {
    const endpoints = await withTenant(tenantId, (tx) =>
      tx.webhookEndpoint.findMany({ where: { active: true }, orderBy: { createdAt: "desc" } }),
    );
    return json({
      webhooks: endpoints.map((e) => ({ id: e.id, url: e.url, events: e.events })),
    });
  }

  if (path === "webhooks" && method === "POST") {
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    const target = typeof body?.url === "string" ? body.url : "";
    const events = Array.isArray(body?.events)
      ? (body.events as unknown[]).filter((e): e is string => typeof e === "string")
      : [];
    if (!target.startsWith("http") || events.length === 0) {
      return json({ error: "url_and_events_required" }, 400);
    }
    const secret = generateWebhookSecret();
    const created = await withTenant(tenantId, (tx) =>
      tx.webhookEndpoint.create({ data: { tenantId, url: target, secret, events } }),
    );
    // The secret is returned once so the consumer can verify signatures.
    return json({ webhook: { id: created.id, url: created.url, events, secret } }, 201);
  }

  if (seg[0] === "webhooks" && seg.length === 2 && method === "DELETE") {
    await withTenant(tenantId, (tx) => tx.webhookEndpoint.deleteMany({ where: { id: seg[1] } }));
    return json({ ok: true });
  }

  return json({ error: "not_found" }, 404);
}

export async function GET(req: Request, ctx: { params: Promise<{ seg: string[] }> }) {
  const { seg } = await ctx.params;
  return handle(req, seg);
}

export async function POST(req: Request, ctx: { params: Promise<{ seg: string[] }> }) {
  const { seg } = await ctx.params;
  return handle(req, seg);
}

export async function DELETE(req: Request, ctx: { params: Promise<{ seg: string[] }> }) {
  const { seg } = await ctx.params;
  return handle(req, seg);
}

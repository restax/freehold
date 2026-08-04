import { randomUUID } from "node:crypto";
import { type PartyRole, prisma, type TenantTx, withTenant } from "@freehold/db";
import { auth } from "@/lib/auth";
import {
  DEMO_CLIENTS,
  DEMO_CONTACT_COMMENTS,
  DEMO_CONTACTS,
  DEMO_TEAMMATES,
  DEMO_TRANSACTIONS,
  type DemoTransactionSpec,
} from "@/lib/demo-dataset/data";
import { mlsSheetPdf, purchaseAgreementPdf } from "@/lib/demo-dataset/pdf";
import { addDaysUtc, utcToday } from "@/lib/seed-core";

/**
 * The operator demo dataset, loaded into one real workspace so training
 * videos have something to show. See lib/demo-dataset/data.ts for the cast.
 *
 * Distinct from lib/demo.ts, which resets the *public* shared demo workspace
 * on a nightly cron. This one is operator-triggered, targets Paul's own
 * workspace, and is much richer.
 *
 * Everything written here is `isSample: true` so the wipe can find it, but
 * Organization.hasSampleData is deliberately left false — see the field's doc
 * comment in schema.prisma. Nothing carries a "(Sample)" suffix either: this
 * data is meant to be filmed.
 *
 * ## Why the work is split across many small transactions
 *
 * `withTenant` runs inside a Prisma interactive transaction with a 15 second
 * timeout, and its own comment warns that sample-data seeding can overrun it
 * from a cold start. This dataset is an order of magnitude bigger than that
 * one, so a single wrapping transaction would reliably fail against a managed
 * Postgres. Each phase (and each individual transaction file) therefore gets
 * its own short `withTenant` call, and PDF generation — pure CPU work — runs
 * outside them entirely. The trade is that a failed seed can leave a partial
 * dataset behind; that is what the Wipe button is for, and the seeder wipes
 * before it writes anyway.
 */

export const DEMO_WORKSPACE_SLUG = "acme-brokers-inc";

export interface DemoWorkspaceStatus {
  orgId: string;
  orgName: string;
  seededAt: Date | null;
  counts: {
    clients: number;
    contacts: number;
    transactions: number;
    tasks: number;
    documents: number;
    emails: number;
    invoices: number;
  };
}

/** The workspace the demo data loads into, or null if it doesn't exist here. */
export async function findDemoOrg(): Promise<{ id: string; name: string } | null> {
  return prisma.organization.findFirst({
    where: { slug: DEMO_WORKSPACE_SLUG },
    select: { id: true, name: true },
  });
}

export async function demoWorkspaceStatus(): Promise<DemoWorkspaceStatus | null> {
  const org = await prisma.organization.findFirst({
    where: { slug: DEMO_WORKSPACE_SLUG },
    select: { id: true, name: true, demoSeededAt: true },
  });
  if (!org) return null;

  const counts = await withTenant(org.id, async (tx) => {
    const scope = await demoRowScope(tx);
    return {
      clients: scope.clientIds.length,
      contacts: scope.contactIds.length,
      transactions: scope.transactionIds.length,
      tasks: await tx.task.count({ where: { isSample: true } }),
      // Scoped to the demo's own rows, not the whole workspace — this panel
      // exists to say what the demo put here, and counting a real invoice
      // among them would be actively misleading about what Wipe removes.
      documents: await tx.document.count({
        where: { transactionId: { in: scope.transactionIds } },
      }),
      emails: await tx.email.count({ where: { transactionId: { in: scope.transactionIds } } }),
      invoices: await tx.invoice.count({ where: { transactionId: { in: scope.transactionIds } } }),
    };
  });

  return { orgId: org.id, orgName: org.name, seededAt: org.demoSeededAt, counts };
}

/**
 * The ids the demo owns: sample-flagged transactions, clients and contacts.
 *
 * Everything else the seeder writes (documents, email, invoices, activity,
 * notes) hangs off one of these three, and none of those tables has an
 * isSample flag of its own — so this is how the wipe stays surgical.
 */
async function demoRowScope(tx: TenantTx) {
  const [transactions, clients, contacts] = await Promise.all([
    tx.transaction.findMany({ where: { isSample: true }, select: { id: true } }),
    tx.client.findMany({ where: { isSample: true }, select: { id: true } }),
    tx.contact.findMany({ where: { isSample: true }, select: { id: true } }),
  ]);
  return {
    transactionIds: transactions.map((r) => r.id),
    clientIds: clients.map((r) => r.id),
    contactIds: contacts.map((r) => r.id),
  };
}

/**
 * Remove the demo's rows, and only those.
 *
 * This deliberately does NOT clear the workspace's document/email/invoice
 * tables wholesale. An earlier version did, on the assumption that this
 * workspace had never held anything real — which turned out to be false:
 * Acme Brokers Inc already had a genuine invoice ("Caputo sale California
 * Ave") plus a month of automated daily-briefing send records, none of which
 * the demo put there. Everything the seeder writes hangs off a sample
 * transaction, client, or contact, so scoping by those ids removes exactly
 * what was seeded and nothing else.
 */
export async function wipeDemoWorkspace(orgId: string): Promise<void> {
  const scope = await withTenant(orgId, demoRowScope);
  const onDemoTxn = { transactionId: { in: scope.transactionIds } };

  // Child-first, in its own short transaction each, for the same timeout
  // reason the seed is split up.
  if (scope.transactionIds.length > 0) {
    await withTenant(orgId, async (tx) => {
      const invoices = await tx.invoice.findMany({ where: onDemoTxn, select: { id: true } });
      const invoiceIds = invoices.map((r) => r.id);
      if (invoiceIds.length > 0) {
        await tx.invoiceLine.deleteMany({ where: { invoiceId: { in: invoiceIds } } });
        await tx.invoicePayment.deleteMany({ where: { invoiceId: { in: invoiceIds } } });
        await tx.invoice.deleteMany({ where: { id: { in: invoiceIds } } });
      }
    });
    await withTenant(orgId, async (tx) => {
      await tx.transactionActivity.deleteMany({ where: onDemoTxn });
      await tx.email.deleteMany({ where: onDemoTxn });
      await tx.document.deleteMany({ where: onDemoTxn });
    });
  }

  await withTenant(orgId, async (tx) => {
    await tx.task.deleteMany({ where: { isSample: true } });
    await tx.transaction.deleteMany({ where: { isSample: true } });
  });
  await withTenant(orgId, async (tx) => {
    if (scope.clientIds.length > 0) {
      await tx.clientNote.deleteMany({ where: { clientId: { in: scope.clientIds } } });
    }
    if (scope.contactIds.length > 0) {
      await tx.contactNote.deleteMany({ where: { contactId: { in: scope.contactIds } } });
    }
    await tx.contact.deleteMany({ where: { isSample: true } });
    await tx.client.deleteMany({ where: { isSample: true } });
  });
  await prisma.organization.update({ where: { id: orgId }, data: { demoSeededAt: null } });
}

/**
 * Create (or find) the two extra coordinators and add them to the workspace.
 *
 * Their passwords are random and thrown away — nobody signs in as them, they
 * exist so tasks, notes and activity have more than one name on them. If you
 * ever want to actually log in as one, use the password reset flow.
 */
async function ensureTeammates(orgId: string): Promise<Record<string, string>> {
  const ids: Record<string, string> = {};
  for (const mate of DEMO_TEAMMATES) {
    let user = await prisma.user.findUnique({ where: { email: mate.email } });
    if (!user) {
      await auth.api.signUpEmail({
        body: { email: mate.email, password: `${randomUUID()}${randomUUID()}`, name: mate.name },
      });
      user = await prisma.user.findUnique({ where: { email: mate.email } });
      if (!user) throw new Error(`demo seed: could not create ${mate.email}`);
      await prisma.user.update({ where: { id: user.id }, data: { emailVerified: true } });
    }
    const existing = await prisma.member.findFirst({
      where: { organizationId: orgId, userId: user.id },
      select: { id: true },
    });
    if (!existing) {
      await prisma.member.create({
        data: { id: randomUUID(), organizationId: orgId, userId: user.id, role: mate.role },
      });
    }
    ids[mate.key] = user.id;
  }
  return ids;
}

/**
 * When an invoice was paid, pulled forward if needed so it lands inside the
 * current calendar month.
 *
 * The dataset's natural "paid 8 / 12 / 21 days ago" puts every payment in the
 * previous month whenever the demo is loaded near the start of one, and the
 * dashboard's Money panel then reads "collected this month: $0.00" through a
 * whole recording. Clamping to days-elapsed-this-month keeps the payments in
 * the past (never dated into the future) while guaranteeing they count.
 *
 * `index` staggers them by a day each so three payments don't stack on one
 * date when there is room to spread them.
 */
function paidThisMonth(anchor: Date, preferredDaysAgo: number, index: number): Date {
  const daysElapsedThisMonth = anchor.getUTCDate() - 1;
  const daysAgo = Math.min(preferredDaysAgo, Math.max(0, daysElapsedThisMonth - index));
  return addDaysUtc(anchor, -daysAgo);
}

/** Resolve an author key to a real user id. */
const authorId = (
  key: "owner" | "alex" | "priya",
  ownerId: string,
  mates: Record<string, string>,
) => (key === "owner" ? ownerId : (mates[key] ?? ownerId));

const authorName = (key: "owner" | "alex" | "priya", ownerName: string) =>
  key === "owner" ? ownerName : (DEMO_TEAMMATES.find((m) => m.key === key)?.name ?? ownerName);

/**
 * Seed the whole dataset. Wipes first, so this doubles as "reset".
 *
 * `ownerUserId` is whoever is running it — the tasks assigned to "owner" land
 * on them, which is what makes the demo dashboard show *your* work when you
 * sign in.
 */
export async function seedDemoWorkspace(orgId: string, ownerUserId: string): Promise<void> {
  await wipeDemoWorkspace(orgId);

  const owner = await prisma.user.findUnique({
    where: { id: ownerUserId },
    select: { name: true, email: true },
  });
  const ownerName = owner?.name ?? "Coordinator";
  const mates = await ensureTeammates(orgId);
  const anchor = utcToday();

  // ---- Clients and contacts -------------------------------------------
  const clientIds: Record<string, string> = {};
  await withTenant(orgId, async (tx) => {
    for (const spec of DEMO_CLIENTS) {
      const row = await tx.client.create({
        data: {
          tenantId: orgId,
          name: spec.name,
          type: spec.type,
          email: spec.email,
          phone: spec.phone,
          address: spec.address ?? null,
          notes: spec.notes ?? null,
          isSample: true,
        },
        select: { id: true },
      });
      clientIds[spec.key] = row.id;
    }
  });

  const contactIds: Record<string, string> = {};
  await withTenant(orgId, async (tx) => {
    for (const spec of DEMO_CONTACTS) {
      const [firstName, ...rest] = spec.name.split(" ");
      const row = await tx.contact.create({
        data: {
          tenantId: orgId,
          name: spec.name,
          firstName,
          lastName: rest.join(" ") || null,
          category: spec.category,
          categories: [spec.category],
          email: spec.email,
          phone: spec.phone,
          company: spec.company ?? null,
          jobTitle: spec.jobTitle ?? null,
          rating: spec.rating ?? null,
          grade: spec.grade ?? null,
          leadType: spec.leadType ?? null,
          isSample: true,
        },
        select: { id: true },
      });
      contactIds[spec.key] = row.id;
    }
  });

  // ---- Notes on clients and contacts ("comments") ----------------------
  await withTenant(orgId, async (tx) => {
    for (const spec of DEMO_CLIENTS) {
      for (const note of spec.comments ?? []) {
        await tx.clientNote.create({
          data: {
            tenantId: orgId,
            clientId: clientIds[spec.key],
            authorId: authorId(note.author, ownerUserId, mates),
            body: note.body,
            createdAt: addDaysUtc(anchor, -note.daysAgo),
          },
        });
      }
    }
    for (const [contactKey, notes] of Object.entries(DEMO_CONTACT_COMMENTS)) {
      const contactId = contactIds[contactKey];
      if (!contactId) continue;
      for (const note of notes) {
        await tx.contactNote.create({
          data: {
            tenantId: orgId,
            contactId,
            authorId: authorId(note.author, ownerUserId, mates),
            body: note.body,
            createdAt: addDaysUtc(anchor, -note.daysAgo),
          },
        });
      }
    }
  });

  // ---- Per-transaction: file, parties, tasks, mail, documents ----------
  const nameOf = (key?: string) => DEMO_CONTACTS.find((c) => c.key === key)?.name;
  const companyOf = (key?: string) => DEMO_CONTACTS.find((c) => c.key === key)?.company;

  let contractVariant = 0;
  const closedForInvoicing: Array<{ spec: DemoTransactionSpec; txnId: string }> = [];

  for (const spec of DEMO_TRANSACTIONS) {
    const contractDate =
      spec.contractOffset === null ? null : addDaysUtc(anchor, spec.contractOffset);
    const closeDate = spec.closeOffset === null ? null : addDaysUtc(anchor, spec.closeOffset);

    // PDFs first, outside any transaction — this is CPU work and must not
    // burn the 15s transaction budget.
    const pdfs: Array<{
      filename: string;
      bytes: Uint8Array;
      label: string;
      folder: string;
    }> = [];
    const mls = await mlsSheetPdf({
      mlsNumber: spec.mlsNumber,
      status: spec.status
        .replace(/_/g, " ")
        .toLowerCase()
        .replace(/\b\w/g, (m) => m.toUpperCase()),
      address: spec.address,
      city: spec.city,
      state: spec.state,
      zip: spec.zip,
      price: spec.price,
      beds: spec.beds,
      baths: spec.baths,
      sqft: spec.sqft,
      yearBuilt: spec.yearBuilt,
      lotAcres: spec.lotAcres,
      remarks: spec.remarks,
      listingAgentName: nameOf(spec.sellerAgentKey),
      listingOfficeName: companyOf(spec.sellerAgentKey),
    });
    pdfs.push({
      filename: `MLS listing sheet - ${spec.address}.pdf`,
      bytes: mls,
      label: "MLS listing sheet",
      folder: "Listing",
    });

    if (spec.hasContract && contractDate && closeDate) {
      const contract = await purchaseAgreementPdf({
        address: spec.address,
        city: spec.city,
        state: spec.state,
        zip: spec.zip,
        price: spec.price,
        buyerName: nameOf(spec.buyerKey) ?? "Buyer",
        sellerName: nameOf(spec.sellerKey) ?? "Seller",
        buyerAgentName: [nameOf(spec.buyerAgentKey), companyOf(spec.buyerAgentKey)]
          .filter(Boolean)
          .join(", "),
        sellerAgentName: [nameOf(spec.sellerAgentKey), companyOf(spec.sellerAgentKey)]
          .filter(Boolean)
          .join(", "),
        lenderName: [nameOf(spec.lenderKey), companyOf(spec.lenderKey)].filter(Boolean).join(", "),
        titleName: companyOf(spec.titleKey) ?? nameOf(spec.titleKey),
        contractDate,
        closeDate,
        variant: contractVariant++,
      });
      pdfs.push({
        filename: `Purchase agreement - ${spec.address}.pdf`,
        bytes: contract,
        label: "Executed purchase agreement",
        folder: "Contract",
      });
    }

    const txnId = await withTenant(orgId, async (tx) => {
      const txn = await tx.transaction.create({
        data: {
          tenantId: orgId,
          clientId: clientIds[spec.clientKey],
          propertyAddress: spec.address,
          city: spec.city,
          state: spec.state,
          zip: spec.zip,
          purchasePrice: spec.price,
          // The listing panel on the transaction page reads these; leaving
          // them null showed an empty "Listing details" card on every file.
          mlsId: spec.mlsNumber,
          listPrice: spec.listPrice ?? spec.price,
          status: spec.status,
          side: spec.side,
          contractDate,
          closeDate,
          listDate: contractDate ? addDaysUtc(contractDate, -21) : addDaysUtc(anchor, -12),
          onMarketDate: contractDate ? addDaysUtc(contractDate, -21) : addDaysUtc(anchor, -12),
          isSample: true,
        },
        select: { id: true },
      });

      const parties: Array<[string | undefined, PartyRole]> = [
        [spec.buyerKey, "BUYER"],
        [spec.sellerKey, "SELLER"],
        [spec.buyerAgentKey, "BUYER_AGENT"],
        [spec.sellerAgentKey, "LISTING_AGENT"],
        [spec.lenderKey, "LENDER"],
        [spec.titleKey, "TITLE_COMPANY"],
      ];
      for (const [key, role] of parties) {
        const contactId = key ? contactIds[key] : undefined;
        if (!contactId) continue;
        await tx.transactionParty.create({
          data: { tenantId: orgId, transactionId: txn.id, contactId, role },
        });
      }

      await tx.task.createMany({
        data: spec.tasks.map((task, i) => ({
          tenantId: orgId,
          transactionId: txn.id,
          title: task.title,
          notes: task.notes ?? null,
          dueDate: addDaysUtc(anchor, task.dueOffset),
          status: task.done ? ("DONE" as const) : ("OPEN" as const),
          completedAt: task.done ? addDaysUtc(anchor, task.dueOffset) : null,
          milestone: task.milestone ?? false,
          assigneeId: authorId(task.assignee ?? "owner", ownerUserId, mates),
          sortOrder: i + 1,
          isSample: true,
        })),
      });
      return txn.id;
    });

    // Documents in their own transaction: PDF bytes make these the heaviest
    // inserts in the seed.
    //
    // Each Document also needs a TransactionAttachment row pointing at it.
    // The Attachments tab renders rows, not documents — a Document with no row
    // is invisible in the UI even though it is in the database and counted by
    // the admin panel. Writing only Documents is exactly the bug that shipped
    // the first time.
    await withTenant(orgId, async (tx) => {
      const folderIds = new Map<string, string>();
      let sortOrder = 0;
      for (const pdf of pdfs) {
        const doc = await tx.document.create({
          data: {
            tenantId: orgId,
            transactionId: txnId,
            filename: pdf.filename,
            contentType: "application/pdf",
            sizeBytes: pdf.bytes.byteLength,
            // Inline Postgres bytes rather than putObject: the demo is wiped
            // and reseeded constantly, and object storage would accumulate
            // orphans every cycle. Raw bytes are fine — getObjectBytes sniffs
            // for encryption rather than assuming it.
            data: Buffer.from(pdf.bytes),
            storageProvider: "DB",
            uploadedById: ownerUserId,
            uploadedByName: ownerName,
            createdAt: contractDate ?? addDaysUtc(anchor, -10),
          },
          select: { id: true },
        });

        let folderId = folderIds.get(pdf.folder);
        if (!folderId) {
          const folder = await tx.attachmentFolder.create({
            data: {
              tenantId: orgId,
              transactionId: txnId,
              name: pdf.folder,
              sortOrder: folderIds.size,
            },
            select: { id: true },
          });
          folderId = folder.id;
          folderIds.set(pdf.folder, folderId);
        }

        await tx.transactionAttachment.create({
          data: {
            tenantId: orgId,
            transactionId: txnId,
            documentId: doc.id,
            folderId,
            label: pdf.label,
            // The file is here, so the row is satisfied.
            completedAt: contractDate ?? addDaysUtc(anchor, -10),
            required: true,
            createdById: ownerUserId,
            createdByName: ownerName,
            sortOrder: sortOrder++,
          },
        });
      }
    });

    if (spec.emails?.length) {
      await withTenant(orgId, async (tx) => {
        for (const mail of spec.emails ?? []) {
          const contactId = contactIds[mail.contactKey];
          const contactSpec = DEMO_CONTACTS.find((c) => c.key === mail.contactKey);
          const workspaceAddress = owner?.email ?? "coordinator@freeholdtc.dev";
          await tx.email.create({
            data: {
              tenantId: orgId,
              transactionId: txnId,
              contactId: contactId ?? null,
              direction: mail.direction,
              fromAddr:
                mail.direction === "INBOUND" ? (contactSpec?.email ?? "") : workspaceAddress,
              toAddr: mail.direction === "INBOUND" ? workspaceAddress : (contactSpec?.email ?? ""),
              subject: mail.subject,
              bodyText: mail.body,
              status: "SENT",
              createdAt: addDaysUtc(anchor, -mail.daysAgo),
            },
          });
        }
      });
    }

    // A little activity history so the timeline and briefing have something.
    await withTenant(orgId, async (tx) => {
      const done = spec.tasks.filter((t) => t.done).slice(-3);
      for (const task of done) {
        await tx.transactionActivity.create({
          data: {
            tenantId: orgId,
            transactionId: txnId,
            actorId: authorId(task.assignee ?? "owner", ownerUserId, mates),
            actorName: authorName(task.assignee ?? "owner", ownerName),
            action: "task.completed",
            summary: `Completed "${task.title}"`,
            createdAt: addDaysUtc(anchor, task.dueOffset),
          },
        });
      }
      await tx.transactionActivity.create({
        data: {
          tenantId: orgId,
          transactionId: txnId,
          actorId: ownerUserId,
          actorName: ownerName,
          action: "document.uploaded",
          summary: `Uploaded ${pdfs.length} document${pdfs.length === 1 ? "" : "s"} to the file`,
          createdAt: contractDate ?? addDaysUtc(anchor, -10),
        },
      });
    });

    if (spec.invoice) closedForInvoicing.push({ spec, txnId });
  }

  // ---- Invoices on the closed files ------------------------------------
  await withTenant(orgId, async (tx) => {
    let number = 1041;
    let paidIndex = 0;
    for (const { spec, txnId } of closedForInvoicing) {
      const inv = spec.invoice;
      if (!inv) continue;
      const issued = addDaysUtc(anchor, -inv.issuedDaysAgo);
      const paidAt =
        inv.paidDaysAgo === null ? null : paidThisMonth(anchor, inv.paidDaysAgo, paidIndex++);
      const invoice = await tx.invoice.create({
        data: {
          tenantId: orgId,
          clientId: clientIds[spec.clientKey],
          transactionId: txnId,
          number: number++,
          description: `Transaction coordination - ${spec.address}`,
          amountCents: inv.amount * 100,
          paymentTerms: "Due at closing",
          dueDate: addDaysUtc(issued, 15),
          status: inv.paidDaysAgo === null ? "SENT" : "PAID",
          sentAt: issued,
          paidAt,
          paidNote: paidAt === null ? null : "Paid from closing proceeds",
          createdAt: issued,
        },
        select: { id: true },
      });
      await tx.invoiceLine.create({
        data: {
          tenantId: orgId,
          invoiceId: invoice.id,
          transactionId: txnId,
          kind: "service",
          description: "Full-service transaction coordination",
          amountCents: inv.amount * 100,
          sortOrder: 1,
        },
      });
      // The money surfaces read the payment ledger, not Invoice.paidAt:
      // "collected this month" aggregates InvoicePayment.receivedAt, and
      // invoiceMoney derives the balance from payments too. An invoice marked
      // PAID with no ledger row therefore showed as settled on the invoice
      // itself while contributing nothing to revenue — the dashboard read
      // "collected this month: $0.00" with three paid invoices on screen.
      if (paidAt) {
        await tx.invoicePayment.create({
          data: {
            tenantId: orgId,
            invoiceId: invoice.id,
            amountCents: inv.amount * 100,
            method: "Closing proceeds",
            source: "direct",
            recordedByName: ownerName,
            receivedAt: paidAt,
            createdAt: paidAt,
          },
        });
      }
    }
  });

  await prisma.organization.update({
    where: { id: orgId },
    data: { demoSeededAt: anchor },
  });
}

/**
 * Shift every demo date forward so the dataset looks freshly dated again,
 * without destroying anything edited during a past demo.
 *
 * Done as raw UPDATEs with interval arithmetic rather than read-modify-write:
 * a few hundred rows across seven tables would otherwise be a few hundred
 * round trips, which is both slow and very likely to blow the 15s transaction
 * budget. Returns the number of days shifted.
 */
export async function redateDemoWorkspace(orgId: string): Promise<number> {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { demoSeededAt: true },
  });
  if (!org?.demoSeededAt) return 0;

  const anchor = utcToday();
  const seeded = Date.UTC(
    org.demoSeededAt.getUTCFullYear(),
    org.demoSeededAt.getUTCMonth(),
    org.demoSeededAt.getUTCDate(),
  );
  const shiftDays = Math.round((anchor.getTime() - seeded) / 86_400_000);
  if (shiftDays === 0) return 0;

  // Same scoping discipline as the wipe: these tables hold real rows too
  // (a genuine invoice, a month of automated briefing sends), and silently
  // rewriting their dates would be its own kind of data loss.
  //
  // The foreign-key column name is NOT consistent across these tables —
  // email/document/invoice use "transactionId", transaction_activity uses
  // "transaction_id" — so each one is spelled out rather than looped over a
  // shared string.
  const scope = await withTenant(orgId, demoRowScope);
  const shift = (tx: TenantTx, sql: string, ...extra: unknown[]) =>
    tx.$executeRawUnsafe(sql, shiftDays, orgId, ...extra);

  await withTenant(orgId, async (tx) => {
    await shift(
      tx,
      `UPDATE "transaction" SET contract_date = contract_date + ($1 || ' days')::interval,
         close_date = close_date + ($1 || ' days')::interval,
         list_date = list_date + ($1 || ' days')::interval,
         on_market_date = on_market_date + ($1 || ' days')::interval
       WHERE tenant_id = $2 AND "isSample" = true`,
    );
    await shift(
      tx,
      `UPDATE "task" SET due_date = due_date + ($1 || ' days')::interval,
         completed_at = completed_at + ($1 || ' days')::interval
       WHERE tenant_id = $2 AND "isSample" = true`,
    );
  });

  if (scope.transactionIds.length > 0) {
    await withTenant(orgId, async (tx) => {
      for (const [table, fk] of [
        ["email", '"transactionId"'],
        ["document", '"transactionId"'],
        ["transaction_activity", "transaction_id"],
      ] as const) {
        await shift(
          tx,
          `UPDATE "${table}" SET "createdAt" = "createdAt" + ($1 || ' days')::interval
             WHERE tenant_id = $2 AND ${fk} = ANY($3::text[])`,
          scope.transactionIds,
        );
      }
    });

    await withTenant(orgId, async (tx) => {
      await shift(
        tx,
        `UPDATE "invoice" SET "createdAt" = "createdAt" + ($1 || ' days')::interval,
           due_date = due_date + ($1 || ' days')::interval,
           sent_at = sent_at + ($1 || ' days')::interval,
           paid_at = paid_at + ($1 || ' days')::interval
         WHERE tenant_id = $2 AND "transactionId" = ANY($3::text[])`,
        scope.transactionIds,
      );
      // The payment ledger is what "collected this month" actually aggregates,
      // so it has to move with the invoice it belongs to.
      await shift(
        tx,
        `UPDATE "invoice_payment" SET received_at = received_at + ($1 || ' days')::interval,
           "createdAt" = "createdAt" + ($1 || ' days')::interval
         WHERE tenant_id = $2 AND invoice_id IN (
           SELECT id FROM "invoice" WHERE tenant_id = $2 AND "transactionId" = ANY($3::text[])
         )`,
        scope.transactionIds,
      );
      // A uniform shift can still land a payment in last month (seed late in
      // one month, re-date early in the next), which puts the dashboard's
      // "collected this month" back at $0. Pull any stragglers forward, for
      // the same reason paidThisMonth exists at seed time. Invoice and ledger
      // are clamped to the same instant so they cannot disagree.
      const monthStart = `date_trunc('month', timezone('UTC', now()))`;
      await tx.$executeRawUnsafe(
        `UPDATE "invoice" SET paid_at = ${monthStart} + interval '1 day'
           WHERE tenant_id = $1 AND "transactionId" = ANY($2::text[])
             AND paid_at IS NOT NULL AND paid_at < ${monthStart}`,
        orgId,
        scope.transactionIds,
      );
      await tx.$executeRawUnsafe(
        `UPDATE "invoice_payment" SET received_at = ${monthStart} + interval '1 day'
           WHERE tenant_id = $1 AND received_at < ${monthStart} AND invoice_id IN (
             SELECT id FROM "invoice" WHERE tenant_id = $1 AND "transactionId" = ANY($2::text[])
           )`,
        orgId,
        scope.transactionIds,
      );
    });
  }

  await withTenant(orgId, async (tx) => {
    if (scope.clientIds.length > 0) {
      await shift(
        tx,
        `UPDATE "client_note" SET "createdAt" = "createdAt" + ($1 || ' days')::interval
           WHERE tenant_id = $2 AND client_id = ANY($3::text[])`,
        scope.clientIds,
      );
    }
    if (scope.contactIds.length > 0) {
      await shift(
        tx,
        `UPDATE "contact_note" SET "createdAt" = "createdAt" + ($1 || ' days')::interval
           WHERE tenant_id = $2 AND contact_id = ANY($3::text[])`,
        scope.contactIds,
      );
    }
  });

  await prisma.organization.update({ where: { id: orgId }, data: { demoSeededAt: anchor } });
  return shiftDays;
}

"use server";

import { type TransactionSide, type TransactionStatus, withTenant } from "@freehold/db";
import { buildContacts, buildTransactions, parseCsv } from "@freehold/importers";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { nextTouchFrom } from "@/lib/crm";
import { isCloud, transactionLimit } from "@/lib/plans";
import { requireAdminTenant } from "@/lib/tenant";

const REPORT_COOKIE = "freehold-import-report";
const MAX_ISSUES = 20;

export interface ImportReport {
  kind: "contacts" | "transactions";
  dryRun: boolean;
  ready: number;
  imported: number;
  mapped: string[];
  unmatched: string[];
  issues: string[];
  blocked?: string;
}

async function saveReport(report: ImportReport) {
  (await cookies()).set(REPORT_COOKIE, JSON.stringify(report), {
    path: "/dashboard/import",
    maxAge: 600,
  });
}

export async function readReport(): Promise<ImportReport | null> {
  const raw = (await cookies()).get(REPORT_COOKIE)?.value;
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ImportReport;
  } catch {
    return null;
  }
}

export async function importCsv(formData: FormData) {
  const { tenantId, userId, isAdmin } = await requireAdminTenant();
  if (!isAdmin) return;
  const kind = formData.get("kind") === "contacts" ? "contacts" : "transactions";
  const dryRun = formData.get("dryRun") === "on";
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return;
  if (file.size > 5 * 1024 * 1024) {
    await saveReport({
      kind,
      dryRun,
      ready: 0,
      imported: 0,
      mapped: [],
      unmatched: [],
      issues: [],
      blocked: "That file is over 5 MB. Export a smaller range and try again.",
    });
    redirect("/dashboard/import");
  }
  const rows = parseCsv(await file.text());

  if (kind === "contacts") {
    const { records, issues, mapping } = buildContacts(rows);
    let imported = 0;
    if (!dryRun && records.length > 0) {
      await withTenant(tenantId, async (tx) => {
        // Prisma's Json input type wants a plain object, not one of our
        // named interfaces — round-tripping through JSON.stringify is the
        // same cast `parseContactForm` already uses for the hand-entered
        // form, so an imported contact and a hand-entered one store the
        // same shape.
        type Json = string | number | boolean | null | Json[] | { [k: string]: Json };
        const asJson = <T>(v: T | null | undefined) =>
          v == null ? undefined : (JSON.parse(JSON.stringify(v)) as { [k: string]: Json });

        // Created one at a time, not createMany: each contact's real id is
        // needed right away to attach its owner and any dated notes, and
        // createMany doesn't hand rows back.
        for (const r of records) {
          const secondarySearch =
            [r.secondary?.first, r.secondary?.last, r.secondary?.email]
              .filter(Boolean)
              .join(" ")
              .toLowerCase()
              .trim() || null;
          const created = await tx.contact.create({
            data: {
              tenantId,
              name: r.name,
              email: r.email,
              phone: r.phone,
              workPhone: r.workPhone,
              fax: r.fax,
              category: r.category ?? "Other",
              categories: r.categories,
              personTitle: r.personTitle,
              firstName: r.firstName,
              middleName: r.middleName,
              lastName: r.lastName,
              jobTitle: r.jobTitle,
              company: r.company,
              website: r.website,
              grade: r.grade,
              referralSource: r.referralSource,
              secondary: asJson(r.secondary),
              secondarySearch,
              extraContacts: asJson(r.extraContacts),
              homeAddress: asJson(r.homeAddress),
              workAddress: asJson(r.workAddress),
              touchDates: asJson(r.touchDates),
              nextTouchAt: nextTouchFrom(r.grade),
              owners: { create: [{ tenantId, userId }] },
            },
            select: { id: true },
          });
          if (r.notes.length > 0) {
            await tx.contactNote.createMany({
              data: r.notes.map((n) => ({
                tenantId,
                contactId: created.id,
                authorId: userId,
                body: n.body,
                ...(n.date ? { createdAt: new Date(`${n.date}T00:00:00Z`) } : {}),
              })),
            });
          }
          imported++;
        }
      });
      revalidatePath("/dashboard/contacts");
    }
    await saveReport({
      kind,
      dryRun,
      ready: records.length,
      imported,
      mapped: Object.keys(mapping.mapping),
      unmatched: mapping.unmatched,
      issues: issues.slice(0, MAX_ISSUES).map((i) => `Row ${i.row}: ${i.problem}`),
    });
    redirect("/dashboard/import");
  }

  const { records, issues, mapping } = buildTransactions(rows);
  const allIssues = issues.slice(0, MAX_ISSUES).map((i) => `Row ${i.row}: ${i.problem}`);

  if (isCloud()) {
    const limit = await transactionLimit(tenantId);
    if (limit.limit != null) {
      const remaining = Math.max(0, limit.limit - limit.active);
      const activeIncoming = records.filter(
        (r) => r.status !== "CLOSED" && r.status !== "CANCELLED",
      ).length;
      if (activeIncoming > remaining) {
        await saveReport({
          kind,
          dryRun,
          ready: records.length,
          imported: 0,
          mapped: Object.keys(mapping.mapping),
          unmatched: mapping.unmatched,
          issues: allIssues,
          blocked: `This file has ${activeIncoming} active transactions but your Free plan has ${remaining} slots left. Upgrade on the Billing page, or import a smaller file.`,
        });
        redirect("/dashboard/import");
      }
    }
  }

  let imported = 0;
  if (!dryRun && records.length > 0) {
    const unknownClients = new Set<string>();
    await withTenant(tenantId, async (tx) => {
      const clients = await tx.client.findMany({ select: { id: true, name: true } });
      const clientByName = new Map(clients.map((c) => [c.name.toLowerCase(), c.id]));
      for (const r of records) {
        let clientId: string | null = null;
        if (r.clientName) {
          clientId = clientByName.get(r.clientName.toLowerCase()) ?? null;
          if (clientId === null) unknownClients.add(r.clientName);
        }
        await tx.transaction.create({
          data: {
            tenantId,
            propertyAddress: r.propertyAddress,
            city: r.city,
            state: r.state,
            zip: r.zip,
            status: r.status as TransactionStatus,
            side: r.side as TransactionSide,
            purchasePrice: r.purchasePrice,
            contractDate: r.contractDate ? new Date(r.contractDate) : null,
            closeDate: r.closeDate ? new Date(r.closeDate) : null,
            clientId,
          },
        });
        imported++;
      }
    });
    for (const name of [...unknownClients].slice(0, 5)) {
      allIssues.push(`Client "${name}" isn't in Freehold yet; those files were left unassigned.`);
    }
    revalidatePath("/dashboard/transactions");
    revalidatePath("/dashboard");
  }
  await saveReport({
    kind,
    dryRun,
    ready: records.length,
    imported,
    mapped: Object.keys(mapping.mapping),
    unmatched: mapping.unmatched,
    issues: allIssues,
  });
  redirect("/dashboard/import");
}

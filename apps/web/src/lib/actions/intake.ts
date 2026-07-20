"use server";

import { prisma, withTenant } from "@freehold/db";
import { redirect } from "next/navigation";
import { intakeFields } from "@/lib/intake";
import { putObject } from "@/lib/storage";

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_FILES = 5;

/**
 * Public intake submission from a client portal. Authorization is the
 * portal token itself (capability link) — no session. The submission is
 * stored, uploads become client-visible documents on the transaction, and
 * the TC gets a HIGH-priority review task due today.
 */
export async function submitIntake(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const kind = String(formData.get("kind") ?? "");
  if (!token || (kind !== "buy" && kind !== "sell")) return;

  const link = await prisma.portalLink.findUnique({ where: { token } });
  if (!link || link.revokedAt || !link.showIntake || !link.transactionId) return;
  if (link.audience !== "CLIENT") return;
  const tenantId = link.tenantId;
  const transactionId = link.transactionId;

  const fields = intakeFields(kind);
  const data: Record<string, string> = {};
  for (const f of fields) {
    const v = formData.get(`f_${f.id}`);
    if (typeof v === "string" && v.trim()) data[f.id] = v.trim().slice(0, 2000);
  }
  if (Object.keys(data).length === 0) return;
  const submitterName = data.legalNames ?? "client";

  // Uploads first (outside the DB transaction — storage calls can be slow).
  const uploads: Array<{
    filename: string;
    contentType: string;
    sizeBytes: number;
    stored: Awaited<ReturnType<typeof putObject>>;
  }> = [];
  const files = formData.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  for (const file of files.slice(0, MAX_FILES)) {
    if (file.size > MAX_FILE_BYTES) continue;
    const filename = `Intake — ${file.name || "upload"}`;
    const stored = await putObject(
      tenantId,
      filename,
      Buffer.from(await file.arrayBuffer()),
      file.type || "application/octet-stream",
    );
    uploads.push({
      filename,
      contentType: file.type || "application/octet-stream",
      sizeBytes: file.size,
      stored,
    });
  }

  await withTenant(tenantId, async (tx) => {
    const documentIds: string[] = [];
    for (const u of uploads) {
      const doc = await tx.document.create({
        data: {
          tenantId,
          transactionId,
          filename: u.filename,
          contentType: u.contentType,
          sizeBytes: u.sizeBytes,
          data: u.stored.data,
          storageKey: u.stored.storageKey,
          storageProvider: u.stored.storageProvider,
          visibleToClient: true,
          visibleToAgent: true,
        },
      });
      documentIds.push(doc.id);
    }
    await tx.intakeSubmission.create({
      data: {
        tenantId,
        transactionId,
        portalLinkId: link.id,
        side: kind === "buy" ? "BUY_SIDE" : "SELL_SIDE",
        data,
        documentIds,
      },
    });
    await tx.task.create({
      data: {
        tenantId,
        transactionId,
        title: `Review intake form: ${submitterName.slice(0, 120)}`,
        dueDate: new Date(),
        priority: "HIGH",
      },
    });
  });

  redirect(`/portal/${token}?intake=done`);
}

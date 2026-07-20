import { Prisma, prisma } from "@freehold/db";
import { emailEnabled, sendTenantEmail } from "@/lib/email";
import { buildWorkspaceExport } from "@/lib/export";
import { putTenantExport } from "@/lib/storage";

/**
 * Nightly client-owned exports. A workspace opts in by connecting its own
 * storage bucket (Integrations → Document storage) — that connection is the
 * "access key". Each night we build the full export and push it to their
 * bucket under freehold-exports/, then email the owner a heads-up with a link
 * to download on demand. The bucket copy is the real insurance: it lives in
 * storage they control, untouched by any Freehold outage.
 */

const appUrl = () => (process.env.BETTER_AUTH_URL ?? "http://localhost:3000").replace(/\/$/, "");

async function ownerEmail(tenantId: string): Promise<string | null> {
  const owner = await prisma.member.findFirst({
    where: { organizationId: tenantId, role: "owner" },
    select: { user: { select: { email: true } } },
  });
  return owner?.user.email ?? null;
}

export interface ExportRunSummary {
  workspaces: number;
  pushed: number;
  emailed: number;
  errors: number;
}

export async function runOwnerExports(): Promise<ExportRunSummary> {
  // Opted in = has connected their own storage.
  const orgs = await prisma.organization.findMany({
    where: { NOT: { storageConfig: { equals: Prisma.DbNull } } },
    select: { id: true, name: true },
  });

  const summary: ExportRunSummary = {
    workspaces: orgs.length,
    pushed: 0,
    emailed: 0,
    errors: 0,
  };
  const stamp = new Date().toISOString().slice(0, 10);

  for (const org of orgs) {
    try {
      const result = await buildWorkspaceExport(org.id);
      const key = `freehold-exports/${stamp}.zip`;
      const put = await putTenantExport(org.id, key, result.zip, "application/zip");
      if (!put.ok) continue; // storage disconnected between the query and now
      summary.pushed += 1;

      if (emailEnabled()) {
        const to = await ownerEmail(org.id);
        if (to) {
          await sendTenantEmail({
            tenantId: org.id,
            to,
            subject: "Your nightly Freehold export is ready",
            body: [
              `Tonight's export of ${org.name} was delivered to your own storage:`,
              `  ${put.bucket}/${key}`,
              "",
              `It contains all your records plus ${result.documentCount} document${
                result.documentCount === 1 ? "" : "s"
              }, ready to open. This copy lives in storage you control — it stays yours no matter what.`,
              "",
              `Download the latest anytime: ${appUrl()}/dashboard/settings`,
            ].join("\n"),
          }).then(
            () => {
              summary.emailed += 1;
            },
            () => {
              /* email failure never blocks the export that already landed */
            },
          );
        }
      }
    } catch {
      summary.errors += 1;
    }
  }
  return summary;
}

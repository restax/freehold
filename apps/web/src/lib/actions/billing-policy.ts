"use server";

import { Prisma, prisma, withTenant } from "@freehold/db";
import { revalidatePath } from "next/cache";
import { logAudit } from "@/lib/audit";
import { BILLING_MODES, type BillingMode } from "@/lib/billing-policy";
import { str } from "@/lib/forms";
import { parseFeeCents } from "@/lib/pay";
import { requireAdminTenant } from "@/lib/tenant";

/**
 * Billing policy settings: the workspace default (Settings page) and the
 * per-client override (client profile). Stored as JSON and resolved by
 * lib/billing-policy.ts — these actions only translate forms into that shape.
 */

const modeOf = (v: string): BillingMode | null =>
  BILLING_MODES.some((m) => m.key === v) ? (v as BillingMode) : null;

function lateFeeFromForm(formData: FormData) {
  return {
    enabled: str(formData, "lateFeeEnabled") === "1",
    type: str(formData, "lateFeeType") === "percent" ? ("percent" as const) : ("flat" as const),
    flatCents: parseFeeCents(str(formData, "lateFeeFlat")) ?? 2500,
    percent: Math.min(100, Math.max(0, Number(str(formData, "lateFeePercent")) || 1.5)),
    graceDays: Math.min(365, Math.max(0, Math.round(Number(str(formData, "lateFeeGrace")) || 0))),
  };
}

/** Workspace-wide billing defaults, from the Settings card. */
export async function saveBillingDefaults(formData: FormData) {
  const { tenantId, isAdmin, session } = await requireAdminTenant();
  if (!isAdmin) return;

  const mode = modeOf(str(formData, "mode")) ?? "per_file_close";
  const policy = {
    mode,
    depositPercent: Math.min(
      100,
      Math.max(1, Math.round(Number(str(formData, "depositPercent")) || 50)),
    ),
    lateFee: lateFeeFromForm(formData),
    defaultFeeCents: parseFeeCents(str(formData, "defaultFee")),
  };
  await prisma.organization.update({
    where: { id: tenantId },
    data: { billingDefaults: policy },
  });
  logAudit({
    tenantId,
    actorId: session.user.id,
    actorEmail: session.user.email,
    action: "billing.defaults_changed",
    summary: `Billing defaults: ${mode}${policy.lateFee.enabled ? ", late fees on" : ""}`,
  });
  revalidatePath("/dashboard/settings");
}

/**
 * One client's overrides. Empty selections store nothing for that key, so the
 * client keeps following the workspace default — "override" and "happens to
 * match today's default" stay distinguishable.
 */
export async function saveClientBilling(formData: FormData) {
  const { tenantId, isAdmin, session } = await requireAdminTenant();
  if (!isAdmin) return;
  const id = str(formData, "id");
  if (!id) return;

  // Concrete JSON-compatible shape (the db package re-exports Prisma as a
  // value only, so the namespace types aren't reachable here).
  const config: {
    mode?: BillingMode;
    lateFee?: ReturnType<typeof lateFeeFromForm> | { enabled: boolean };
  } = {};
  const mode = modeOf(str(formData, "mode"));
  if (mode) config.mode = mode;
  const lateFeeChoice = str(formData, "lateFeeChoice"); // "" default | "on" | "off"
  if (lateFeeChoice === "off") config.lateFee = { enabled: false };
  if (lateFeeChoice === "on") config.lateFee = lateFeeFromForm(formData);

  const defaultFeeCents = parseFeeCents(str(formData, "defaultFee"));

  const updated = await withTenant(tenantId, (tx) =>
    tx.client.update({
      where: { id },
      data: {
        defaultFeeCents,
        billingConfig: Object.keys(config).length > 0 ? config : Prisma.DbNull,
      },
      select: { name: true },
    }),
  );
  logAudit({
    tenantId,
    actorId: session.user.id,
    actorEmail: session.user.email,
    action: "billing.client_changed",
    summary: `Billing for ${updated.name}: ${mode ?? "workspace default"}${
      defaultFeeCents != null ? `, fee ${(defaultFeeCents / 100).toFixed(2)}` : ""
    }`,
  });
  revalidatePath(`/dashboard/clients/${id}`);
  revalidatePath("/dashboard/invoices");
}

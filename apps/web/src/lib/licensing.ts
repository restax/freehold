import { prisma, type TenantTx } from "@freehold/db";
import { licenseValid } from "./licenses";

/**
 * Licensed-state enforcement. Some states require a licensed transaction
 * coordinator on every file; a workspace marks which of the states it operates
 * in are license-required (Settings → Operating states), and Freehold checks
 * that somebody assigned to the file actually holds a current license there.
 *
 * Freehold never ships its own list of which states require licensing — that
 * is a legal judgment each business makes. We only enforce what the tenant
 * declares.
 */

export type Enforcement = "warn" | "block";

export interface LicenseGap {
  /** The state whose requirement isn't met. */
  state: string;
  /** True when someone is assigned but their license for that state lapsed. */
  expiredOnly: boolean;
}

export interface GapInput {
  /** The transaction's state code, if any. */
  state: string | null;
  /** States the tenant marked license-required (uppercase). */
  requiredStates: Set<string>;
  /** Every license held by the currently assigned users. */
  assigneeLicenses: Array<{ state: string; expiresAt: Date | null }>;
}

/**
 * The gap, or null when the file is fine. A file with no state, or in a state
 * the tenant hasn't flagged, is always fine — we never guess at requirements.
 * An expired license reads differently from none at all, so the caller can say
 * "renew it" instead of "assign someone".
 */
export function licenseGap(input: GapInput, now: Date = new Date()): LicenseGap | null {
  const state = input.state?.trim().toUpperCase();
  if (!state || !input.requiredStates.has(state)) return null;

  const forState = input.assigneeLicenses.filter((l) => l.state.toUpperCase() === state);
  if (forState.some((l) => licenseValid(l.expiresAt, now))) return null;
  return { state, expiredOnly: forState.length > 0 };
}

/** Message for the banner or the blocked-write error. */
export function gapMessage(gap: LicenseGap): string {
  return gap.expiredOnly
    ? `${gap.state} requires a licensed coordinator, and the assigned license has expired. Renew it or assign someone currently licensed in ${gap.state}.`
    : `${gap.state} requires a licensed coordinator. Assign someone licensed in ${gap.state}.`;
}

/** The workspace's enforcement mode; "warn" unless it says otherwise. */
export async function licenseEnforcement(tenantId: string): Promise<Enforcement> {
  const org = await prisma.organization.findUnique({
    where: { id: tenantId },
    select: { licenseEnforcement: true },
  });
  return org?.licenseEnforcement === "block" ? "block" : "warn";
}

/** The tenant's license-required states, uppercased. */
export async function requiredStates(tx: TenantTx): Promise<Set<string>> {
  const rows = await tx.tenantState.findMany({
    where: { licenseRequired: true },
    select: { state: true },
  });
  return new Set(rows.map((r) => r.state.toUpperCase()));
}

/**
 * Evaluate one transaction as it stands in the database. Used by the banner
 * and the list flags; the write path uses `licenseGap` directly with the
 * values it is about to save.
 */
export async function gapForTransaction(
  tx: TenantTx,
  transactionId: string,
): Promise<LicenseGap | null> {
  const txn = await tx.transaction.findUnique({
    where: { id: transactionId },
    select: { state: true, assignees: { select: { userId: true } } },
  });
  if (!txn) return null;
  const required = await requiredStates(tx);
  if (required.size === 0) return null;
  const licenses = await tx.userLicense.findMany({
    where: { userId: { in: txn.assignees.map((a) => a.userId) } },
    select: { state: true, expiresAt: true },
  });
  return licenseGap({ state: txn.state, requiredStates: required, assigneeLicenses: licenses });
}

/**
 * Gap check for a write that hasn't happened yet: the state being saved plus
 * the users who will be assigned. Returns null when nothing is required.
 */
export async function gapForPending(
  tx: TenantTx,
  state: string | null,
  assigneeUserIds: string[],
): Promise<LicenseGap | null> {
  const required = await requiredStates(tx);
  if (required.size === 0) return null;
  const licenses =
    assigneeUserIds.length === 0
      ? []
      : await tx.userLicense.findMany({
          where: { userId: { in: assigneeUserIds } },
          select: { state: true, expiresAt: true },
        });
  return licenseGap({ state, requiredStates: required, assigneeLicenses: licenses });
}

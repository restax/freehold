import { EngagementStatus } from "@freehold/db";

/**
 * Rules for who may do what to an engagement. Pure, so the awkward cases are
 * pinned by tests rather than discovered in production: an engagement is the
 * one record two different workspaces both act on, and getting the sides
 * confused would let one company operate inside another's.
 */

export interface EngagementParties {
  /** Workspace that owns the files and asked for coverage. */
  tenantId: string;
  /** Workspace providing the coverage. */
  vendorTenantId: string;
  status: EngagementStatus;
}

/** Only the vendor answers, and only while it's still pending. */
export function canRespond(e: EngagementParties, actingTenantId: string): boolean {
  return e.vendorTenantId === actingTenantId && e.status === EngagementStatus.REQUESTED;
}

/** Either side can end a running engagement; nobody can end anything else. */
export function canEnd(e: EngagementParties, actingTenantId: string): boolean {
  if (e.status !== EngagementStatus.ACTIVE) return false;
  return e.tenantId === actingTenantId || e.vendorTenantId === actingTenantId;
}

/** Guest access exists exactly while the engagement is active. */
export function grantsAccess(status: EngagementStatus): boolean {
  return status === EngagementStatus.ACTIVE;
}

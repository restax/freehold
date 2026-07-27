/**
 * Who may see and touch the money. Owners and admins always hold full
 * authority; everyone else gets exactly what the Team page granted them.
 * Deliberately dependency-free (the billing-cadence pattern) so the
 * capability table is unit-testable.
 *
 * The three grants, in strictly increasing order:
 *  - view:   read invoices, balances, revenue, reports, exports.
 *  - manage: also create/issue invoices, record payments, credit, late fees.
 *  - comp:   also see what teammates are paid (pay requests, payouts, net).
 */
export interface BillingCapability {
  view: boolean;
  manage: boolean;
  comp: boolean;
}

export const NO_BILLING_ACCESS: BillingCapability = { view: false, manage: false, comp: false };

export const BILLING_ROLE_OPTIONS: Array<[string, string]> = [
  ["default", "Follows role"],
  ["view", "View billing"],
  ["manage", "Manage billing"],
  ["full", "Full (incl. team pay)"],
];

export function billingCapability(
  role: string | null | undefined,
  billingRole: string | null | undefined,
): BillingCapability {
  // Outside coverage staff never see money, whatever else is set.
  if (role === "guest") return NO_BILLING_ACCESS;
  if (role === "owner" || role === "admin") return { view: true, manage: true, comp: true };
  switch (billingRole) {
    case "view":
      return { view: true, manage: false, comp: false };
    case "manage":
      return { view: true, manage: true, comp: false };
    case "full":
      return { view: true, manage: true, comp: true };
    default:
      return NO_BILLING_ACCESS;
  }
}

/** Label for the Team page: what this member's access reads as. */
export function billingRoleLabel(
  role: string | null | undefined,
  billingRole: string | null | undefined,
): string {
  if (role === "owner" || role === "admin") return "Full authority";
  const cap = billingCapability(role, billingRole);
  if (cap.comp) return "Full (incl. team pay)";
  if (cap.manage) return "Manage billing";
  if (cap.view) return "View billing";
  return "No billing access";
}

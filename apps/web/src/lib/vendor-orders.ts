import { VendorOrderStatus } from "@freehold/db";

/**
 * Pure order-status logic, unit-tested. The actions enforce it; keeping the
 * transitions here is what pins the state machine.
 *
 * The design principle that matters most: appointment history is never
 * overwritten. A miss doesn't erase the schedule — both events stay in the
 * VendorOrderEvent log — because "it was set for Tuesday and missed" is the
 * exact evidence a coordinator needs and a mutable status column would lose.
 */

const ORDER = VendorOrderStatus;

/** Whether a vendor may act on an order at all (open work). */
export function isOpen(status: VendorOrderStatus): boolean {
  return status === ORDER.SENT || status === ORDER.ACCEPTED || status === ORDER.SCHEDULED;
}

/** A vendor can accept only a freshly-sent order. */
export function canAcceptOrder(status: VendorOrderStatus): boolean {
  return status === ORDER.SENT;
}

/** A vendor can decline while it's still sent or accepted (not once scheduled/done). */
export function canDeclineOrder(status: VendorOrderStatus): boolean {
  return status === ORDER.SENT || status === ORDER.ACCEPTED;
}

/** Scheduling (or rescheduling) is allowed on any open order. */
export function canSchedule(status: VendorOrderStatus): boolean {
  return isOpen(status);
}

/** Only a scheduled order can be marked missed. */
export function canMarkMissed(status: VendorOrderStatus): boolean {
  return status === ORDER.SCHEDULED;
}

/** Any open order can be completed. */
export function canComplete(status: VendorOrderStatus): boolean {
  return isOpen(status);
}

/** The coordinator can cancel anything that isn't already terminal. */
export function canCancel(status: VendorOrderStatus): boolean {
  return status !== ORDER.COMPLETED && status !== ORDER.CANCELLED && status !== ORDER.DECLINED;
}

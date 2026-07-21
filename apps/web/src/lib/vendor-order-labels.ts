/** Display helpers shared by the TC's Vendors tab and the vendor's order inbox. */

export const ORDER_STATUS_STYLE: Record<string, string> = {
  SENT: "bg-stone-100 text-stone-600",
  ACCEPTED: "bg-amber-100 text-amber-800",
  SCHEDULED: "bg-brand-100 text-brand-800",
  COMPLETED: "bg-brand-600 text-white",
  DECLINED: "bg-red-100 text-red-700",
  CANCELLED: "bg-stone-100 text-stone-400",
  DRAFT: "bg-stone-100 text-stone-500",
};

export const ORDER_EVENT_LABEL: Record<string, string> = {
  created: "Ordered",
  accepted: "Accepted",
  declined: "Declined",
  scheduled: "Scheduled",
  rescheduled: "Rescheduled",
  missed: "Missed appointment",
  completed: "Completed",
  cancelled: "Cancelled",
  note: "Note",
};

/** A date-time for appointments and event stamps. UTC so it matches the stored value. */
export function fmtDateTime(d: Date | null): string {
  if (!d) return "";
  return d.toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  });
}

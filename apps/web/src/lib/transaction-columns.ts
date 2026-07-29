/**
 * Which columns the transactions table shows, in which order.
 *
 * The catalogue lives here rather than in the page so the picker, the table
 * header, and the row renderer all read one definition — a column can't
 * exist in the picker but be missing from the table, or drift out of order
 * between header and body.
 *
 * Dependency-free (the billing-cadence pattern): stored preferences are user
 * input that outlives a deploy. A column removed in a later release, or a
 * hand-edited preference blob, must degrade to a sensible table rather than
 * a blank one — so resolution is unit-tested.
 */

import { type ColumnDef, makeColumnSet } from "./table-columns";

export type { ColumnAlign, ColumnDef } from "./table-columns";

export const TRANSACTION_COLUMNS: readonly ColumnDef[] = [
  // Property location
  { key: "address", label: "Address", group: "Property location", width: "16rem", locked: true },
  { key: "city", label: "City", group: "Property location", width: "9rem" },
  { key: "state", label: "State", group: "Property location", width: "5rem" },
  { key: "zip", label: "ZIP", group: "Property location", width: "6rem" },
  // Transaction info
  { key: "status", label: "Status", group: "Transaction info", width: "9rem" },
  { key: "side", label: "Side", group: "Transaction info", width: "7rem" },
  { key: "buyersSellers", label: "Buyers / sellers", group: "Transaction info", width: "14rem" },
  { key: "client", label: "Client", group: "Transaction info", width: "12rem" },
  {
    key: "price",
    label: "Current price",
    group: "Transaction info",
    width: "8rem",
    align: "right",
  },
  {
    key: "listPrice",
    label: "List price",
    group: "Transaction info",
    width: "8rem",
    align: "right",
  },
  {
    key: "contractPrice",
    label: "Contract price",
    group: "Transaction info",
    width: "8rem",
    align: "right",
  },
  { key: "mlsId", label: "MLS ID", group: "Transaction info", width: "7rem" },
  // Dates
  { key: "contractDate", label: "Contract date", group: "Dates", width: "8rem", align: "right" },
  { key: "closeDate", label: "Closing", group: "Dates", width: "8rem", align: "right" },
  { key: "nextDate", label: "Next key date", group: "Dates", width: "11rem" },
  { key: "dom", label: "DOM", group: "Dates", width: "5rem", align: "right" },
  // Activity
  { key: "tasks", label: "Tasks", group: "Activity", width: "6rem", align: "right" },
  { key: "documents", label: "Documents", group: "Activity", width: "6rem", align: "right" },
  { key: "coordinators", label: "Coordinators", group: "Activity", width: "11rem" },
] as const;

/** What a coordinator sees before touching the picker. */
export const DEFAULT_COLUMN_KEYS = [
  "address",
  "status",
  "side",
  "buyersSellers",
  "price",
  "closeDate",
  "tasks",
  "coordinators",
] as const;

const SET = makeColumnSet(TRANSACTION_COLUMNS, DEFAULT_COLUMN_KEYS);

export const LOCKED_KEYS = SET.lockedKeys;
export const columnByKey = SET.byKey;
export const columnGroups = SET.groups;
export const resolveColumns = SET.resolve;
export const normalizeColumnSelection = SET.normalize;
export const tableMinWidth = SET.minWidth;

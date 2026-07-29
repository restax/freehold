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

export type ColumnAlign = "left" | "right";

export interface ColumnDef {
  key: string;
  label: string;
  /** Section heading in the picker, mirroring how a coordinator thinks. */
  group: string;
  /**
   * Fixed width, so the column is identical on every row.
   *
   * Every column carries one. An earlier version left the address column
   * width-less to absorb slack, which collapsed it to 0px — and with it the
   * only link into the file — as soon as the other columns filled the
   * container. Columns are sized; the table scrolls instead of squeezing.
   */
  width: string;
  align?: ColumnAlign;
  /** Always shown, never unchecked — without it a row has nothing to click. */
  locked?: boolean;
}

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

const BY_KEY = new Map(TRANSACTION_COLUMNS.map((c) => [c.key, c]));

export const LOCKED_KEYS = TRANSACTION_COLUMNS.filter((c) => c.locked).map((c) => c.key);

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

export function columnByKey(key: string): ColumnDef | undefined {
  return BY_KEY.get(key);
}

/** Picker sections in catalogue order, without hardcoding the group list twice. */
export function columnGroups(): Array<{ group: string; columns: ColumnDef[] }> {
  const out: Array<{ group: string; columns: ColumnDef[] }> = [];
  for (const col of TRANSACTION_COLUMNS) {
    const last = out[out.length - 1];
    if (last && last.group === col.group) last.columns.push(col);
    else out.push({ group: col.group, columns: [col] });
  }
  return out;
}

/**
 * Stored preference → the columns to actually render.
 *
 * Unknown keys are dropped (a column deleted in a later release shouldn't
 * break the table), duplicates collapse, locked columns are forced back in
 * at the front, and an empty or unusable preference falls back to the
 * defaults rather than rendering a table with no columns.
 */
export function resolveColumns(stored: unknown): ColumnDef[] {
  const raw = Array.isArray(stored) ? stored : [];
  const seen = new Set<string>();
  const picked: ColumnDef[] = [];
  for (const k of raw) {
    if (typeof k !== "string" || seen.has(k)) continue;
    const col = BY_KEY.get(k);
    if (!col) continue;
    seen.add(k);
    picked.push(col);
  }
  // Nothing usable stored — show the defaults, not an empty grid.
  if (picked.length === 0) {
    return DEFAULT_COLUMN_KEYS.map((k) => BY_KEY.get(k)).filter((c): c is ColumnDef => Boolean(c));
  }
  // A locked column can't be dropped, even by a hand-edited preference.
  for (const key of LOCKED_KEYS) {
    if (!seen.has(key)) {
      const col = BY_KEY.get(key);
      if (col) picked.unshift(col);
    }
  }
  return picked;
}

/**
 * Minimum width the table needs for the chosen columns, so none of them get
 * squeezed to nothing. The wrapper scrolls horizontally past this; a data
 * grid that scrolls is normal, a column crushed to 0px is a bug.
 */
export function tableMinWidth(columns: readonly ColumnDef[]): string {
  const rem = columns.reduce((sum, c) => sum + Number.parseFloat(c.width), 0);
  return `${rem}rem`;
}

/** Normalize a picker submission before storing it. */
export function normalizeColumnSelection(keys: readonly string[]): string[] {
  return resolveColumns(keys).map((c) => c.key);
}

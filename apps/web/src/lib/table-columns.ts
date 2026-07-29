/**
 * Shared machinery for pickable, reorderable table columns.
 *
 * Two lists now use it — transactions and contacts — and the rules they need
 * are identical: stored preferences are user input that outlives a deploy, so
 * a column removed in a later release, or a hand-edited preference blob, must
 * degrade to a sensible table rather than a blank one.
 *
 * Dependency-free (the billing-cadence pattern). Each list supplies its own
 * catalogue and defaults; the resolution rules live here once, tested once.
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
   * Every column carries one. A width-less column collapses to 0px as soon as
   * the others fill the container — which once made the only link into a
   * transaction unclickable.
   */
  width: string;
  align?: ColumnAlign;
  /** Always shown, never unchecked — without it a row has nothing to click. */
  locked?: boolean;
}

export interface ColumnSet {
  all: readonly ColumnDef[];
  defaultKeys: readonly string[];
  lockedKeys: string[];
  byKey: (key: string) => ColumnDef | undefined;
  groups: () => Array<{ group: string; columns: ColumnDef[] }>;
  resolve: (stored: unknown) => ColumnDef[];
  normalize: (keys: readonly string[]) => string[];
  minWidth: (columns: readonly ColumnDef[]) => string;
}

export function makeColumnSet(
  all: readonly ColumnDef[],
  defaultKeys: readonly string[],
): ColumnSet {
  const map = new Map(all.map((c) => [c.key, c]));
  const lockedKeys = all.filter((c) => c.locked).map((c) => c.key);

  /** Picker sections in catalogue order, without hardcoding the group list. */
  const groups = () => {
    const out: Array<{ group: string; columns: ColumnDef[] }> = [];
    for (const col of all) {
      const last = out[out.length - 1];
      if (last && last.group === col.group) last.columns.push(col);
      else out.push({ group: col.group, columns: [col] });
    }
    return out;
  };

  /**
   * Stored preference → the columns to actually render. Unknown keys are
   * dropped, duplicates collapse, locked columns are forced back in at the
   * front, and an unusable preference falls back to the defaults rather than
   * rendering a table with no columns.
   */
  const resolve = (stored: unknown): ColumnDef[] => {
    const raw = Array.isArray(stored) ? stored : [];
    const seen = new Set<string>();
    const picked: ColumnDef[] = [];
    for (const k of raw) {
      if (typeof k !== "string" || seen.has(k)) continue;
      const col = map.get(k);
      if (!col) continue;
      seen.add(k);
      picked.push(col);
    }
    if (picked.length === 0) {
      return defaultKeys.map((k) => map.get(k)).filter((c): c is ColumnDef => Boolean(c));
    }
    for (const key of lockedKeys) {
      if (!seen.has(key)) {
        const col = map.get(key);
        if (col) picked.unshift(col);
      }
    }
    return picked;
  };

  return {
    all,
    defaultKeys,
    lockedKeys,
    byKey: (key: string) => map.get(key),
    groups,
    resolve,
    normalize: (keys: readonly string[]) => resolve(keys).map((c) => c.key),
    /**
     * Minimum width the table needs for the chosen columns, so none get
     * squeezed to nothing. The wrapper scrolls past this; a data grid that
     * scrolls is normal, a column crushed to 0px is a bug.
     */
    minWidth: (columns: readonly ColumnDef[]) =>
      `${columns.reduce((sum, c) => sum + Number.parseFloat(c.width), 0)}rem`,
  };
}

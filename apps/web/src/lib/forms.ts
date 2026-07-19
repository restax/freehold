/** Tiny FormData parsers for zero-JS server-action forms. */

export function str(fd: FormData, key: string): string {
  return String(fd.get(key) ?? "").trim();
}

export function optStr(fd: FormData, key: string): string | null {
  const v = str(fd, key);
  return v === "" ? null : v;
}

export function intOr(fd: FormData, key: string, fallback: number | null = null): number | null {
  const v = str(fd, key).replace(/[$,\s]/g, "");
  if (v === "") return fallback;
  const n = Number.parseInt(v, 10);
  return Number.isNaN(n) ? fallback : n;
}

/** "YYYY-MM-DD" -> UTC midnight Date (matches @db.Date columns), else null. */
export function dateOnly(fd: FormData, key: string): Date | null {
  const v = str(fd, key);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  return new Date(`${v}T00:00:00.000Z`);
}

/** Membership of an enum-like object, else fallback. */
export function oneOf<T extends string>(
  fd: FormData,
  key: string,
  values: readonly T[],
  fallback: T,
): T {
  const v = str(fd, key) as T;
  return values.includes(v) ? v : fallback;
}

/**
 * Server-side half of the DangerDelete contract: destructive actions no-op
 * unless the user typed DELETE. UI hiding is never the enforcement.
 */
export function confirmed(formData: FormData): boolean {
  return (
    String(formData.get("confirm") ?? "")
      .trim()
      .toUpperCase() === "DELETE"
  );
}

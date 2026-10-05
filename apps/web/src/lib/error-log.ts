import { prisma } from "@freehold/db";

export interface ErrorLogEntry {
  source: "server" | "client";
  message: string;
  stack?: string | null;
  digest?: string | null;
  path?: string | null;
  action?: string | null;
  userId?: string | null;
  userEmail?: string | null;
  tenantId?: string | null;
  userAgent?: string | null;
  detail?: Record<string, string | number | boolean | null>;
}

const cut = (v: string | null | undefined, n: number) => (v ? v.slice(0, n) : null);

/**
 * Record an error for the operator panel. Fire-and-forget: logging a failure
 * must never become a second failure, so every error in here is swallowed.
 * Keep `detail` to facts about the attempt (file name, size, type), never
 * file contents or form values.
 */
export function logError(entry: ErrorLogEntry): void {
  prisma.errorLog
    .create({
      data: {
        source: entry.source,
        message: cut(entry.message, 1000) ?? "Unknown error",
        stack: cut(entry.stack, 4000),
        digest: cut(entry.digest, 100),
        path: cut(entry.path, 500),
        action: cut(entry.action, 200),
        userId: entry.userId ?? null,
        userEmail: entry.userEmail ?? null,
        tenantId: entry.tenantId ?? null,
        userAgent: cut(entry.userAgent, 400),
        ...(entry.detail === undefined ? {} : { detail: entry.detail }),
      },
    })
    .catch(() => {});
}

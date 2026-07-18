import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

/**
 * On Vercel with a marketplace Postgres, the connection string is only
 * available at runtime as STORAGE_DATABASE_URL (owner credentials, pooled).
 * The app must connect as the non-owner `freehold_app` role — owners bypass
 * row-level security — so swap in those credentials here. Anywhere else,
 * DATABASE_URL is used as-is.
 */
function resolveDatabaseUrl(): string | undefined {
  const configured = process.env.DATABASE_URL;
  const storage = process.env.STORAGE_DATABASE_URL;
  const appPassword = process.env.FREEHOLD_APP_DB_PASSWORD;
  const unusable = !configured || configured.includes("not-provisioned");
  if (unusable && storage && appPassword) {
    const url = new URL(storage);
    url.username = "freehold_app";
    url.password = encodeURIComponent(appPassword);
    url.searchParams.set("pgbouncer", "true");
    return url.toString();
  }
  return configured;
}

/**
 * Process-wide Prisma client. Cached on globalThis so Next.js dev-mode HMR
 * doesn't exhaust the connection pool with new clients on every reload.
 */
export const prisma: PrismaClient =
  globalForPrisma.prisma ?? new PrismaClient({ datasourceUrl: resolveDatabaseUrl() });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

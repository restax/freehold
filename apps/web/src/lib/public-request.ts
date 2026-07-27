import "server-only";
import { createHash } from "node:crypto";
import { prisma } from "@freehold/db";
import { headers } from "next/headers";

/**
 * Shared bits for the unauthenticated public-form surface: identifying a
 * request's source for rate limiting, and building the absolute URLs that
 * go into emails.
 */

/** Best-available source address behind whatever proxy is in front of us. */
export async function sourceIp(): Promise<string> {
  const h = await headers();
  const fwd = h.get("x-forwarded-for");
  return (fwd?.split(",")[0] ?? h.get("x-real-ip") ?? "unknown").trim();
}

/**
 * Salted per tenant, so the same visitor hashes differently in different
 * workspaces and the value can't be correlated across them. Stored instead
 * of the address itself: this is abuse-control data, not a record the
 * workspace has any reason to read.
 */
export function hashSource(ip: string, tenantId: string): string {
  return createHash("sha256").update(`${tenantId}:${ip}`).digest("hex").slice(0, 32);
}

/**
 * Absolute origin for a tenant's public form links — their own subdomain
 * when the install has a real domain, the plain base URL locally.
 */
export async function publicFormBase(tenantId: string): Promise<string> {
  const base = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
  let url: URL;
  try {
    url = new URL(base);
  } catch {
    return base;
  }
  const bareHost = url.hostname === "localhost" || /^[0-9.]+$/.test(url.hostname);
  const org = await prisma.organization.findUnique({
    where: { id: tenantId },
    select: { slug: true },
  });
  if (bareHost || !org) return `${base.replace(/\/$/, "")}/t/${org?.slug ?? ""}`;
  return `${url.protocol}//${org.slug}.${url.host}`;
}

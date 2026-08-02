/**
 * Rules for a workspace's own domain: what counts as one, and what the TC has
 * to put in their DNS.
 *
 * Pure and dependency-free — this decides what hostname a workspace is allowed
 * to claim, so the rules are unit-tested rather than buried in an action.
 */

/** The DNS record a workspace's registrar needs, in the registrar's own words. */
export interface DnsRecord {
  type: "A" | "CNAME";
  /** What registrars call the "name" or "host" field. */
  name: string;
  value: string;
}

// Vercel's published targets. An apex can't be a CNAME (DNS forbids it
// alongside the zone's SOA/NS records), which is the whole reason these differ.
const VERCEL_A_RECORD = "76.76.21.21";
const VERCEL_CNAME_TARGET = "cname.vercel-dns.com";

/**
 * What the user typed, reduced to a bare hostname: no scheme, no path, no
 * port, no trailing dot, lowercase. TCs paste "https://www.smithtc.com/" as
 * often as they type the hostname.
 */
export function normalizeCustomDomain(input: string): string {
  let s = input.trim().toLowerCase();
  s = s.replace(/^[a-z][a-z0-9+.-]*:\/\//, "");
  s = s.split("/")[0].split("?")[0];
  // Strip a port, but leave IPv6-looking junk alone — it fails validation anyway.
  if (!s.startsWith("[")) s = s.split(":")[0];
  return s.replace(/\.$/, "");
}

const LABEL = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;

/**
 * Why this hostname can't be used, or null if it can.
 *
 * `rootHost` is the platform's own domain. Refusing anything under it matters:
 * a workspace that claimed "other.freeholdtc.dev" wouldn't actually hijack
 * that subdomain (host-routing.ts matches the subdomain branch first, and
 * never consults this field there), but storing it would be a claim on a name
 * the workspace doesn't own, and the unique index would then block the real
 * owner. Refuse it at the door instead.
 */
export function customDomainError(domain: string, rootHost: string): string | null {
  if (!domain) return "Enter the domain you want to use.";
  if (domain.length > 253) return "That domain is too long.";

  const labels = domain.split(".");
  if (labels.length < 2) return "Enter a full domain, like www.yourbusiness.com.";
  if (labels.some((l) => !LABEL.test(l))) {
    return "Domains use letters, numbers, and hyphens only.";
  }
  // A bare TLD-looking last label with digits isn't a real domain.
  if (/^\d+$/.test(labels[labels.length - 1])) return "That doesn't look like a domain.";

  const root = rootHost.toLowerCase();
  if (domain === root || domain.endsWith(`.${root}`)) {
    return `${root} addresses are already yours — this is for a domain you own elsewhere.`;
  }
  if (domain.endsWith(".vercel.app")) return "That address belongs to our hosting, not to you.";
  return null;
}

/**
 * Whether this is the apex (smithtc.com) rather than a subdomain
 * (www.smithtc.com). Two labels is the honest approximation: a real answer
 * needs the public suffix list, so "smithtc.co.uk" reads as a subdomain here.
 * `apexName` is the domain provider's own answer and wins when we have it —
 * which we do as soon as the domain has been added.
 */
export function isApexDomain(domain: string, apexName?: string | null): boolean {
  if (apexName) return domain === apexName.toLowerCase();
  return domain.split(".").length === 2;
}

/** The one record the TC has to add at their registrar. */
export function dnsRecordFor(domain: string, apexName?: string | null): DnsRecord {
  if (isApexDomain(domain, apexName)) {
    return { type: "A", name: "@", value: VERCEL_A_RECORD };
  }
  return {
    type: "CNAME",
    name: domain.split(".")[0],
    value: VERCEL_CNAME_TARGET,
  };
}

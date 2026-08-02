import { describe, expect, it } from "vitest";
import { customDomainError, dnsRecordFor, isApexDomain, normalizeCustomDomain } from "./domains";

const ROOT = "freeholdtc.dev";

describe("normalizeCustomDomain", () => {
  it("reduces a pasted URL to a bare hostname", () => {
    expect(normalizeCustomDomain("https://www.SmithTC.com/about?x=1")).toBe("www.smithtc.com");
    expect(normalizeCustomDomain("  http://smithtc.com  ")).toBe("smithtc.com");
  });

  it("drops a port and a trailing dot", () => {
    expect(normalizeCustomDomain("smithtc.com:8443")).toBe("smithtc.com");
    expect(normalizeCustomDomain("smithtc.com.")).toBe("smithtc.com");
  });

  it("leaves a plain hostname alone", () => {
    expect(normalizeCustomDomain("www.smithtc.com")).toBe("www.smithtc.com");
  });
});

describe("customDomainError", () => {
  it("accepts a real domain", () => {
    expect(customDomainError("www.smithtc.com", ROOT)).toBeNull();
    expect(customDomainError("smithtc.com", ROOT)).toBeNull();
    expect(customDomainError("tc-of-austin.co.uk", ROOT)).toBeNull();
  });

  it("rejects empty, single-label, and over-long input", () => {
    expect(customDomainError("", ROOT)).toMatch(/Enter the domain/);
    expect(customDomainError("localhost", ROOT)).toMatch(/full domain/);
    expect(customDomainError(`${"a".repeat(250)}.com`, ROOT)).toMatch(/too long/);
  });

  it("rejects labels that aren't hostname labels", () => {
    expect(customDomainError("smith_tc.com", ROOT)).toMatch(/letters, numbers/);
    expect(customDomainError("-smithtc.com", ROOT)).toMatch(/letters, numbers/);
    expect(customDomainError("smithtc-.com", ROOT)).toMatch(/letters, numbers/);
    expect(customDomainError("192.168.0.1", ROOT)).toMatch(/doesn't look like a domain/);
  });

  it("refuses to let a workspace claim a name on the platform's own domain", () => {
    // Not a hijack — host-routing matches the subdomain branch first — but
    // storing it would block the real owner behind the unique index.
    expect(customDomainError("other.freeholdtc.dev", ROOT)).toMatch(/already yours/);
    expect(customDomainError(ROOT, ROOT)).toMatch(/already yours/);
  });

  it("refuses a hosting address that isn't the workspace's to claim", () => {
    expect(customDomainError("freehold-abc.vercel.app", ROOT)).toMatch(/our hosting/);
  });
});

describe("isApexDomain / dnsRecordFor", () => {
  it("counts labels when the provider hasn't told us the apex yet", () => {
    expect(isApexDomain("smithtc.com")).toBe(true);
    expect(isApexDomain("www.smithtc.com")).toBe(false);
  });

  it("prefers the provider's answer, which handles multi-part suffixes", () => {
    // The label count alone would call this a subdomain.
    expect(isApexDomain("smithtc.co.uk", "smithtc.co.uk")).toBe(true);
    expect(isApexDomain("www.smithtc.co.uk", "smithtc.co.uk")).toBe(false);
  });

  it("gives an apex an A record — DNS forbids a CNAME there", () => {
    expect(dnsRecordFor("smithtc.com")).toEqual({
      type: "A",
      name: "@",
      value: "76.76.21.21",
    });
  });

  it("gives a subdomain a CNAME named after its first label", () => {
    expect(dnsRecordFor("www.smithtc.com")).toEqual({
      type: "CNAME",
      name: "www",
      value: "cname.vercel-dns.com",
    });
  });
});

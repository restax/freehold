import { describe, expect, it } from "vitest";
import { normalizeHost, onTenantHost, routeForHost } from "./host-routing";
import { publicTenantWhere } from "./public-tenant";

const ROOT = "freeholdtc.dev";
const route = (host: string | null, pathname: string, root: string | null = ROOT) =>
  routeForHost(host, root, pathname);

describe("normalizeHost", () => {
  it("lowercases and drops the port", () => {
    expect(normalizeHost("Acme.FreeholdTC.dev:3000")).toBe("acme.freeholdtc.dev");
    expect(normalizeHost(" localhost:3010 ")).toBe("localhost");
  });

  it("keeps an IPv6 literal intact rather than cutting at its colons", () => {
    expect(normalizeHost("[::1]:3010")).toBe("[::1]");
    expect(normalizeHost("[::1]")).toBe("[::1]");
  });
});

describe("routeForHost — the app's own host", () => {
  it("leaves the root host alone", () => {
    expect(route(ROOT, "/dashboard")).toEqual({ kind: "next" });
    expect(route("FREEHOLDTC.DEV:443", "/")).toEqual({ kind: "next" });
  });

  it("does nothing when the root host isn't configured", () => {
    expect(route("anything.com", "/", null)).toEqual({ kind: "next" });
  });

  it("passes preview deployments through instead of treating them as a customer domain", () => {
    // Regression guard: without this, every page on a preview build 404s.
    expect(route("freehold-abc123.vercel.app", "/")).toEqual({ kind: "next" });
    expect(route("freehold-abc123.vercel.app", "/dashboard")).toEqual({ kind: "next" });
  });

  it("passes localhost and loopback through", () => {
    expect(route("localhost:3010", "/", "localhost:3010")).toEqual({ kind: "next" });
    expect(route("127.0.0.1:3010", "/")).toEqual({ kind: "next" });
    expect(route("[::1]:3010", "/")).toEqual({ kind: "next" });
  });

  it("ignores a host that isn't shaped like a hostname", () => {
    expect(route("evil.com/../../etc", "/")).toEqual({ kind: "next" });
    expect(route("a..b.com", "/")).toEqual({ kind: "next" });
  });
});

describe("routeForHost — workspace subdomains", () => {
  it("serves the mini-site at the root of the subdomain", () => {
    expect(route("acme.freeholdtc.dev", "/")).toEqual({ kind: "rewrite", pathname: "/t/acme" });
  });

  it("serves public forms on the workspace's own face", () => {
    expect(route("acme.freeholdtc.dev", "/f/intake")).toEqual({
      kind: "rewrite",
      pathname: "/t/acme/f/intake",
    });
    expect(route("acme.freeholdtc.dev", "/fl/tok123")).toEqual({
      kind: "rewrite",
      pathname: "/t/acme/fl/tok123",
    });
  });

  it("lets token links through untouched, keeping the branded URL that was emailed", () => {
    expect(route("acme.freeholdtc.dev", "/portal/abc")).toEqual({ kind: "next" });
    expect(route("acme.freeholdtc.dev", "/r/abc")).toEqual({ kind: "next" });
  });

  it("sends app paths back to the apex", () => {
    expect(route("acme.freeholdtc.dev", "/dashboard")).toEqual({ kind: "redirect-root" });
  });

  it("refuses reserved and malformed slugs", () => {
    expect(route("www.freeholdtc.dev", "/")).toEqual({ kind: "next" });
    expect(route("a.b.freeholdtc.dev", "/")).toEqual({ kind: "next" });
  });
});

describe("routeForHost — the vendor site", () => {
  it("serves everything from /vendor/*", () => {
    expect(route("vendor.freeholdtc.dev", "/")).toEqual({
      kind: "rewrite",
      pathname: "/vendor/dashboard",
    });
    expect(route("vendor.freeholdtc.dev", "/profile")).toEqual({
      kind: "rewrite",
      pathname: "/vendor/profile",
    });
  });

  it("doesn't double-prefix an already-/vendor path", () => {
    expect(route("vendor.freeholdtc.dev", "/vendor/dashboard")).toEqual({ kind: "next" });
  });

  it("sends public vendor pages to the apex where they're canonical", () => {
    expect(route("vendor.freeholdtc.dev", "/v/acme-title")).toEqual({ kind: "redirect-root" });
  });
});

describe("routeForHost — custom domains", () => {
  it("gives a customer's own domain the same surface as a subdomain", () => {
    expect(route("www.smithtc.com", "/")).toEqual({
      kind: "rewrite",
      pathname: "/t/www.smithtc.com",
    });
    expect(route("www.smithtc.com", "/f/intake")).toEqual({
      kind: "rewrite",
      pathname: "/t/www.smithtc.com/f/intake",
    });
    expect(route("www.smithtc.com", "/portal/abc")).toEqual({ kind: "next" });
    expect(route("www.smithtc.com", "/dashboard")).toEqual({ kind: "redirect-root" });
  });

  it("normalises the host before it becomes a path segment", () => {
    expect(route("WWW.SmithTC.com:8443", "/")).toEqual({
      kind: "rewrite",
      pathname: "/t/www.smithtc.com",
    });
  });
});

describe("publicTenantWhere", () => {
  it("reads a dotless param as a workspace slug", () => {
    expect(publicTenantWhere("acme")).toEqual({ slug: "acme" });
  });

  it("reads a dotted param as a custom domain, and only serves an active one", () => {
    // Slugs are [a-z0-9-]+ (lib/username.ts), so a dot can only be a hostname.
    expect(publicTenantWhere("www.smithtc.com")).toEqual({
      customDomain: "www.smithtc.com",
      customDomainStatus: "active",
    });
  });

  it("normalises the domain the same way the router did", () => {
    expect(publicTenantWhere("WWW.SmithTC.com")).toEqual({
      customDomain: "www.smithtc.com",
      customDomainStatus: "active",
    });
  });
});

describe("onTenantHost", () => {
  it("recognises the workspace's subdomain", () => {
    expect(onTenantHost("acme.freeholdtc.dev", "acme", null)).toBe(true);
  });

  it("recognises the workspace's own domain", () => {
    expect(onTenantHost("www.smithtc.com:443", "acme", "www.smithtc.com")).toBe(true);
  });

  it("is false at the apex, where links need the /t/<slug> prefix", () => {
    expect(onTenantHost("freeholdtc.dev", "acme", "www.smithtc.com")).toBe(false);
    expect(onTenantHost(null, "acme", null)).toBe(false);
  });

  it("is false on someone else's domain", () => {
    expect(onTenantHost("www.otherco.com", "acme", "www.smithtc.com")).toBe(false);
  });
});

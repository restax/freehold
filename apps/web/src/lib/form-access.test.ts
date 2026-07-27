import { describe, expect, it } from "vitest";
import {
  isEmailish,
  LINK_TTL_HOURS,
  linkExpiry,
  linkRejection,
  linkUsable,
  normalizeEmail,
  prefillFromClient,
} from "./form-access";

const at = (iso: string) => new Date(iso);

describe("normalizeEmail / isEmailish", () => {
  it("trims and lowercases so lookups match however it was typed", () => {
    expect(normalizeEmail("  Dana@Office.Example ")).toBe("dana@office.example");
  });

  it("rejects things that aren't addresses", () => {
    expect(isEmailish("dana@office.example")).toBe(true);
    expect(isEmailish("dana@office")).toBe(false);
    expect(isEmailish("dana")).toBe(false);
    expect(isEmailish("")).toBe(false);
    expect(isEmailish("a b@c.example")).toBe(false);
  });
});

describe("linkExpiry", () => {
  it("is the configured window out from now", () => {
    const now = at("2026-07-28T00:00:00.000Z");
    expect(linkExpiry(now).toISOString()).toBe("2026-07-31T00:00:00.000Z");
    expect(LINK_TTL_HOURS).toBe(72);
  });
});

describe("linkUsable / linkRejection", () => {
  const now = at("2026-07-28T12:00:00.000Z");

  it("a live link opens the form", () => {
    const link = { expiresAt: at("2026-07-29T00:00:00.000Z"), revokedAt: null };
    expect(linkUsable(link, now)).toBe(true);
    expect(linkRejection(link, now)).toBeNull();
  });

  it("an expired link does not, and says so", () => {
    const link = { expiresAt: at("2026-07-28T11:59:59.000Z"), revokedAt: null };
    expect(linkUsable(link, now)).toBe(false);
    expect(linkRejection(link, now)).toBe("expired");
  });

  it("expiry is exclusive at the boundary", () => {
    const link = { expiresAt: now, revokedAt: null };
    expect(linkUsable(link, now)).toBe(false);
  });

  it("revocation beats an otherwise-live link", () => {
    const link = {
      expiresAt: at("2030-01-01T00:00:00.000Z"),
      revokedAt: at("2026-07-28T00:00:00Z"),
    };
    expect(linkUsable(link, now)).toBe(false);
    expect(linkRejection(link, now)).toBe("revoked");
  });
});

describe("prefillFromClient", () => {
  it("fills identity only, and skips what isn't on file", () => {
    expect(
      prefillFromClient({
        name: "Harborline Realty",
        email: "ops@harborline.example",
        phone: null,
        address: "200 Main St",
      }),
    ).toEqual({
      clientName: "Harborline Realty",
      email: "ops@harborline.example",
      address: "200 Main St",
    });
  });

  it("never carries deal information", () => {
    const filled = prefillFromClient({
      name: "Harborline Realty",
      email: null,
      phone: null,
      address: null,
    });
    // Only identity keys — an opened link must not reveal transactions.
    expect(Object.keys(filled)).toEqual(["clientName"]);
  });
});

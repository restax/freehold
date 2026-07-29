import { describe, expect, it } from "vitest";
import { ADMIN_HOME, ADMIN_PATHS, isAdminPath } from "./nav-sections";

describe("isAdminPath", () => {
  it("recognises every admin route", () => {
    for (const p of ADMIN_PATHS) expect(isAdminPath(p)).toBe(true);
  });

  it("recognises a nested admin route", () => {
    // Deep links have to keep the admin menu, or navigating into a record
    // silently throws you back to the everyday menu.
    expect(isAdminPath("/dashboard/invoices/inv_123")).toBe(true);
    expect(isAdminPath("/dashboard/team/settings")).toBe(true);
  });

  it("leaves the everyday routes alone", () => {
    for (const p of [
      "/dashboard",
      "/dashboard/transactions",
      "/dashboard/transactions/abc",
      "/dashboard/contacts",
      "/dashboard/calendar",
      "/dashboard/vault",
      "/dashboard/profile",
    ]) {
      expect(isAdminPath(p)).toBe(false);
    }
  });

  it("doesn't match on a shared prefix", () => {
    // "/dashboard/teams" is not "/dashboard/team".
    expect(isAdminPath("/dashboard/teams")).toBe(false);
    expect(isAdminPath("/dashboard/billing-history")).toBe(false);
  });

  it("is safe on nothing", () => {
    expect(isAdminPath(null)).toBe(false);
    expect(isAdminPath(undefined)).toBe(false);
    expect(isAdminPath("")).toBe(false);
  });

  it("lands Admin on a real admin route", () => {
    expect(isAdminPath(ADMIN_HOME)).toBe(true);
  });
});

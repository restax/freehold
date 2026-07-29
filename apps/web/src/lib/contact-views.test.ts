import { describe, expect, it } from "vitest";
import {
  CONTACT_VIEWS,
  contactViewShape,
  hasContactFilters,
  isContactViewKey,
  multiValue,
  parseCategoryFilter,
  readContactFilters,
  staleBefore,
  upcomingWindow,
} from "./contact-views";

describe("the view list", () => {
  it("has unique keys and starts at All", () => {
    const keys = CONTACT_VIEWS.map((v) => v.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys[0]).toBe("all");
  });

  it("recognises only its own keys", () => {
    expect(isContactViewKey("sphere")).toBe(true);
    expect(isContactViewKey("nope")).toBe(false);
    expect(isContactViewKey(undefined)).toBe(false);
  });
});

describe("contactViewShape", () => {
  it("leaves All unfiltered", () => {
    expect(contactViewShape("all")).toEqual({
      mineOnly: false,
      sphereOnly: false,
      staleOnly: false,
      upcomingTouch: false,
      onOpenFile: false,
      openTasks: false,
    });
  });

  it("scopes both sphere views to me", () => {
    // "My sphere" is mine by definition — somebody else's relationships
    // showing up here would be actively misleading.
    expect(contactViewShape("sphere").mineOnly).toBe(true);
    expect(contactViewShape("sphere-stale").mineOnly).toBe(true);
  });

  it("adds staleness only to the 90-day view", () => {
    expect(contactViewShape("sphere").staleOnly).toBe(false);
    expect(contactViewShape("sphere-stale").staleOnly).toBe(true);
    expect(contactViewShape("sphere-stale").sphereOnly).toBe(true);
  });

  it("maps the file and task views", () => {
    expect(contactViewShape("participants").onOpenFile).toBe(true);
    expect(contactViewShape("tasks").openTasks).toBe(true);
    expect(contactViewShape("touch").upcomingTouch).toBe(true);
  });

  it("falls back to unfiltered for an unknown key", () => {
    expect(contactViewShape("garbage" as never)).toEqual(contactViewShape("all"));
  });
});

describe("date windows", () => {
  const now = new Date("2026-07-29T00:00:00.000Z");

  it("puts the stale cutoff 90 days back", () => {
    expect(staleBefore(now).toISOString().slice(0, 10)).toBe("2026-04-30");
  });

  it("spans today to two weeks out for upcoming touches", () => {
    const w = upcomingWindow(now);
    expect(w.gte.toISOString().slice(0, 10)).toBe("2026-07-29");
    expect(w.lte.toISOString().slice(0, 10)).toBe("2026-08-12");
  });

  it("doesn't mutate the date it was handed", () => {
    const before = now.toISOString();
    staleBefore(now);
    upcomingWindow(now);
    expect(now.toISOString()).toBe(before);
  });
});

describe("parseCategoryFilter", () => {
  it("splits a typed list", () => {
    expect(parseCategoryFilter("Sphere, Past Client")).toEqual({
      include: ["Sphere", "Past Client"],
      exclude: [],
    });
  });

  it("treats a leading minus as an exclusion", () => {
    // "everyone in my sphere who isn't a vendor" in one filter.
    expect(parseCategoryFilter("Sphere, -Vendor")).toEqual({
      include: ["Sphere"],
      exclude: ["Vendor"],
    });
  });

  it("handles an exclusion with a space after the minus", () => {
    expect(parseCategoryFilter("- Vendor")).toEqual({ include: [], exclude: ["Vendor"] });
  });

  it("accepts repeated params as well as one comma string", () => {
    expect(parseCategoryFilter(["Sphere", "-Vendor"])).toEqual({
      include: ["Sphere"],
      exclude: ["Vendor"],
    });
  });

  it("drops blanks and a bare minus instead of filtering on nothing", () => {
    expect(parseCategoryFilter(" , , - , ")).toEqual({ include: [], exclude: [] });
    expect(parseCategoryFilter(undefined)).toEqual({ include: [], exclude: [] });
    expect(parseCategoryFilter("")).toEqual({ include: [], exclude: [] });
  });
});

describe("multiValue", () => {
  it("dedupes and trims", () => {
    expect(multiValue(["a", " a ", "b", ""])).toEqual(["a", "b"]);
  });

  it("copes with a single value or nothing", () => {
    expect(multiValue("a")).toEqual(["a"]);
    expect(multiValue(undefined)).toEqual([]);
  });
});

describe("readContactFilters", () => {
  it("defaults to All with nothing set", () => {
    const f = readContactFilters({});
    expect(f.view).toBe("all");
    expect(hasContactFilters(f)).toBe(false);
  });

  it("ignores an unknown view rather than showing an empty page", () => {
    expect(readContactFilters({ view: "made-up" }).view).toBe("all");
  });

  it("reads every field", () => {
    const f = readContactFilters({
      view: "sphere",
      q: " raman ",
      firstName: "Priya",
      lastName: " Raman ",
      company: "Harborline",
      category: "Sphere,-Vendor",
      noCategory: "1",
      owner: ["u1", "u1", "u2"],
    });
    expect(f).toEqual({
      view: "sphere",
      q: "raman",
      firstName: "Priya",
      lastName: "Raman",
      company: "Harborline",
      categories: { include: ["Sphere"], exclude: ["Vendor"] },
      noCategory: true,
      ownerIds: ["u1", "u2"],
    });
    expect(hasContactFilters(f)).toBe(true);
  });

  it("treats whitespace-only text as unset", () => {
    const f = readContactFilters({ q: "   ", firstName: "" });
    expect(f.q).toBeNull();
    expect(f.firstName).toBeNull();
    expect(hasContactFilters(f)).toBe(false);
  });

  it("counts an exclusion on its own as an active filter", () => {
    expect(hasContactFilters(readContactFilters({ category: "-Vendor" }))).toBe(true);
  });
});

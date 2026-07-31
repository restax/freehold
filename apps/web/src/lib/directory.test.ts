import { describe, expect, it } from "vitest";
import {
  canListWithCoverage,
  type DirectoryListing,
  directoryNudgeDue,
  filterListings,
  freeholdListing,
  publicListing,
  sortListings,
} from "./directory";

const FEED = "https://findtcpros.example/api/directory/feed";

const listing = (over: Partial<DirectoryListing>): DirectoryListing => ({
  source: "public",
  id: "x",
  name: "X",
  states: [],
  city: null,
  specializations: [],
  software: [],
  availability: null,
  pricingModel: null,
  licenseStatus: null,
  yearsExperience: null,
  remote: false,
  verified: false,
  rating: null,
  reviewCount: null,
  blurb: null,
  contactEmail: null,
  profileUrl: null,
  engageable: false,
  ...over,
});

describe("freeholdListing", () => {
  const tenant = {
    id: "t1",
    name: "Maplewood Transactions",
    directoryConfig: {
      listed: true,
      blurb: "Buy-side specialists",
      specializations: ["Residential"],
    },
    states: [{ state: "tx" }, { state: "FL" }],
  };

  it("returns null unless the workspace opted in", () => {
    expect(freeholdListing({ ...tenant, directoryConfig: {} })).toBeNull();
    expect(freeholdListing({ ...tenant, directoryConfig: { listed: false } })).toBeNull();
    expect(freeholdListing({ ...tenant, directoryConfig: null })).toBeNull();
  });

  it("normalizes and sorts state codes", () => {
    expect(freeholdListing(tenant)?.states).toEqual(["FL", "TX"]);
  });

  it("is engageable — a file can be handed to a real workspace", () => {
    expect(freeholdListing(tenant)?.engageable).toBe(true);
    expect(freeholdListing(tenant)?.source).toBe("freehold");
  });
});

describe("publicListing", () => {
  it("normalizes a well-formed row", () => {
    const out = publicListing(
      {
        slug: "sarah-mitchell-austin-tx",
        name: "Sarah Mitchell",
        state: "tx",
        city: "Austin",
        specializations: ["Residential"],
        software: ["Dotloop", "DocuSign"],
        yearsExperience: 8,
        remote: true,
        verified: true,
        rating: 5,
        reviewCount: 2,
        profileUrl: "/directory/sarah-mitchell-austin-tx",
      },
      FEED,
    );
    expect(out).toMatchObject({
      source: "public",
      name: "Sarah Mitchell",
      states: ["TX"],
      city: "Austin",
      yearsExperience: 8,
      verified: true,
      engageable: false,
    });
    expect(out?.profileUrl).toBe("https://findtcpros.example/directory/sarah-mitchell-austin-tx");
  });

  it("drops rows with no name or no slug rather than throwing", () => {
    expect(publicListing({ name: "No Slug" }, FEED)).toBeNull();
    expect(publicListing({ slug: "no-name" }, FEED)).toBeNull();
    expect(publicListing({}, FEED)).toBeNull();
  });

  it("survives wrong types in every field", () => {
    const out = publicListing(
      {
        slug: "s",
        name: "N",
        states: "TX",
        specializations: [1, "Residential", null],
        yearsExperience: "eight",
        rating: null,
        remote: "yes",
      },
      FEED,
    );
    expect(out).toMatchObject({
      states: [],
      specializations: ["Residential"],
      yearsExperience: null,
      remote: false, // only a real boolean true counts
    });
  });

  it("refuses a profile URL pointing off the feed's origin", () => {
    const out = publicListing(
      { slug: "s", name: "N", profileUrl: "https://evil.example/phish" },
      FEED,
    );
    expect(out?.profileUrl).toBeNull();
  });

  it("never marks a public row engageable, even if the feed claims it", () => {
    const out = publicListing(
      { slug: "s", name: "N", engageable: true } as Record<string, unknown>,
      FEED,
    );
    expect(out?.engageable).toBe(false);
  });
});

describe("filterListings", () => {
  const rows = [
    listing({
      id: "a",
      name: "Alpha",
      source: "freehold",
      states: ["TX"],
      specializations: ["Residential"],
      software: ["Dotloop"],
    }),
    listing({
      id: "b",
      name: "Beta",
      source: "public",
      states: ["FL"],
      specializations: ["Commercial"],
      blurb: "luxury condos",
    }),
  ];

  it("filters by source, which is the Freehold-vs-public toggle", () => {
    expect(filterListings(rows, { source: "freehold" }).map((r) => r.id)).toEqual(["a"]);
    expect(filterListings(rows, { source: "public" }).map((r) => r.id)).toEqual(["b"]);
  });

  it("filters by state, case-insensitively", () => {
    expect(filterListings(rows, { state: "tx" }).map((r) => r.id)).toEqual(["a"]);
  });

  it("filters by specialization and software", () => {
    expect(filterListings(rows, { specialization: "Commercial" }).map((r) => r.id)).toEqual(["b"]);
    expect(filterListings(rows, { software: "Dotloop" }).map((r) => r.id)).toEqual(["a"]);
  });

  it("searches name and blurb together", () => {
    expect(filterListings(rows, { q: "luxury" }).map((r) => r.id)).toEqual(["b"]);
    expect(filterListings(rows, { q: "alph" }).map((r) => r.id)).toEqual(["a"]);
  });

  it("returns everything with an empty filter", () => {
    expect(filterListings(rows, {})).toHaveLength(2);
  });
});

describe("sortListings", () => {
  const rows = [
    listing({ name: "Zed", source: "public", yearsExperience: 20 }),
    listing({ name: "Ann", source: "public", yearsExperience: 5 }),
    listing({ name: "Mid", source: "freehold", yearsExperience: null }),
  ];

  it("puts Freehold-enabled workspaces first by default", () => {
    expect(sortListings(rows, "source").map((r) => r.name)).toEqual(["Mid", "Ann", "Zed"]);
  });

  it("sorts by name across both sources", () => {
    expect(sortListings(rows, "name").map((r) => r.name)).toEqual(["Ann", "Mid", "Zed"]);
  });

  it("sorts by experience, with unknown experience last", () => {
    expect(sortListings(rows, "experience").map((r) => r.name)).toEqual(["Zed", "Ann", "Mid"]);
  });

  it("does not mutate the input", () => {
    const before = rows.map((r) => r.name);
    sortListings(rows, "name");
    expect(rows.map((r) => r.name)).toEqual(before);
  });
});

describe("directoryNudgeDue", () => {
  it("nudges a brand-new workspace, which has neither flag set", () => {
    expect(directoryNudgeDue({})).toBe(true);
  });

  it("stops once the workspace is listed", () => {
    expect(directoryNudgeDue({ listed: true })).toBe(false);
  });

  it("stops once they ask not to be reminded", () => {
    expect(directoryNudgeDue({ remindersOff: true })).toBe(false);
  });

  it("treats an explicit listed:false as still worth nudging", () => {
    expect(directoryNudgeDue({ listed: false })).toBe(true);
  });

  it("keeps quiet for a listed workspace that also silenced reminders", () => {
    expect(directoryNudgeDue({ listed: true, remindersOff: true })).toBe(false);
  });
});

describe("canListWithCoverage", () => {
  it("refuses a listing with no operating states", () => {
    expect(canListWithCoverage(0)).toBe(false);
  });

  it("allows one state", () => {
    expect(canListWithCoverage(1)).toBe(true);
  });
});

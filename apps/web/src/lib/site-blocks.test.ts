import { describe, expect, it } from "vitest";
import {
  defaultBlocks,
  linesOf,
  newSiteBlock,
  normalizeSiteBlocks,
  parseSiteBlocks,
  type SiteBlock,
  siteBlocks,
} from "./site-blocks";

describe("parseSiteBlocks", () => {
  it("reads a well-formed list", () => {
    const blocks = parseSiteBlocks([
      { id: "a", type: "hero", heading: "Closing on time" },
      { id: "b", type: "services", items: ["One", "Two"] },
    ]);
    expect(blocks.map((b) => b.type)).toEqual(["hero", "services"]);
    expect(blocks[0]).toMatchObject({ heading: "Closing on time" });
  });

  it("never throws on junk — a public page must not crash", () => {
    expect(parseSiteBlocks(null)).toEqual([]);
    expect(parseSiteBlocks("nope")).toEqual([]);
    expect(parseSiteBlocks({})).toEqual([]);
    expect(parseSiteBlocks([null, 3, "x", []])).toEqual([]);
  });

  it("drops blocks with no id or an unknown type", () => {
    expect(parseSiteBlocks([{ type: "hero" }])).toEqual([]);
    expect(parseSiteBlocks([{ id: "a", type: "carousel" }])).toEqual([]);
  });

  it("trims strings and discards blank ones", () => {
    const [b] = parseSiteBlocks([{ id: "a", type: "about", heading: "  Us  ", body: "   " }]);
    expect(b).toEqual({ id: "a", type: "about", heading: "Us" });
  });

  it("keeps only string items on a services block", () => {
    const [b] = parseSiteBlocks([{ id: "a", type: "services", items: ["Real", 7, null, " Ok "] }]);
    expect(b).toEqual({ id: "a", type: "services", items: ["Real", "Ok"] });
  });
});

describe("normalizeSiteBlocks", () => {
  it("drops duplicate ids", () => {
    const blocks = normalizeSiteBlocks([
      { id: "x", type: "text" },
      { id: "x", type: "about" },
    ] as SiteBlock[]);
    expect(blocks).toHaveLength(1);
  });

  it("allows only one of each singleton, but many of the repeatables", () => {
    const blocks = normalizeSiteBlocks([
      { id: "1", type: "registration" },
      { id: "2", type: "registration" },
      { id: "3", type: "text" },
      { id: "4", type: "text" },
    ] as SiteBlock[]);
    expect(blocks.map((b) => b.type)).toEqual(["registration", "text", "text"]);
  });
});

describe("defaultBlocks — the pre-blocks site, translated", () => {
  it("mirrors what the old renderer showed", () => {
    const blocks = defaultBlocks({
      tagline: "Closing on time",
      about: "We coordinate.",
      services: "Contracts\nDeadlines",
      showRegistration: true,
    });
    expect(blocks.map((b) => b.type)).toEqual(["hero", "services", "forms", "registration"]);
    expect(blocks[0]).toMatchObject({ heading: "Closing on time", body: "We coordinate." });
    expect(blocks[1]).toMatchObject({ items: ["Contracts", "Deadlines"] });
  });

  it("omits services when there were none, exactly like the old renderer", () => {
    const blocks = defaultBlocks({ tagline: "Hi", showRegistration: true });
    expect(blocks.map((b) => b.type)).toEqual(["hero", "forms", "registration"]);
  });

  it("omits the contact form when registration is off", () => {
    const blocks = defaultBlocks({ tagline: "Hi", showRegistration: false });
    expect(blocks.map((b) => b.type)).not.toContain("registration");
    expect(blocks[0]).not.toHaveProperty("ctaLabel");
  });

  it("still produces a hero for a completely empty config", () => {
    expect(defaultBlocks({}).map((b) => b.type)).toEqual(["hero", "forms"]);
  });
});

describe("siteBlocks — stored wins, legacy is the fallback", () => {
  it("uses a stored array when there is one", () => {
    const site = {
      tagline: "ignored",
      blocks: [{ id: "only", type: "text", heading: "Just this" }],
    };
    expect(siteBlocks(site).map((b) => b.id)).toEqual(["only"]);
  });

  it("falls back to the legacy layout when blocks are absent", () => {
    expect(siteBlocks({ tagline: "Hi" }).map((b) => b.type)).toEqual(["hero", "forms"]);
  });

  it("falls back rather than blanking the site when blocks are corrupt", () => {
    const site = { tagline: "Hi", blocks: "not-an-array" };
    expect(siteBlocks(site).map((b) => b.type)).toEqual(["hero", "forms"]);
  });
});

describe("helpers", () => {
  it("linesOf trims and drops blanks", () => {
    expect(linesOf(" a \n\n  b  \n")).toEqual(["a", "b"]);
    expect(linesOf(undefined)).toEqual([]);
  });

  it("newSiteBlock always carries the id it was given", () => {
    for (const type of ["hero", "about", "services", "text", "image", "testimonial"] as const) {
      expect(newSiteBlock(type, "gen")).toMatchObject({ id: "gen", type });
    }
  });
});

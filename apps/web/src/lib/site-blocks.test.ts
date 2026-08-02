import { describe, expect, it } from "vitest";
import {
  blockHiddenReason,
  defaultBlocks,
  linesOf,
  newSiteBlock,
  normalizeSiteBlocks,
  parseSiteBlocks,
  referencedImageIds,
  type SiteBlock,
  siteBlocks,
  siteImageId,
  siteImageRef,
  siteImageUrl,
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

describe("image refs", () => {
  it("round-trips an uploaded image id", () => {
    expect(siteImageId(siteImageRef("abc-123"))).toBe("abc-123");
  });

  it("treats anything else as a literal URL, not a ref", () => {
    expect(siteImageId("https://example.com/a.jpg")).toBeNull();
    expect(siteImageId(undefined)).toBeNull();
    // A prefix with nothing after it is a broken ref, not an empty-id ref.
    expect(siteImageId("siteimg:")).toBeNull();
  });

  it("addresses uploads through the tenant's slug and passes URLs through", () => {
    expect(siteImageUrl(siteImageRef("img1"), "acme")).toBe("/api/site-image/acme/img1");
    expect(siteImageUrl("https://example.com/a.jpg", "acme")).toBe("https://example.com/a.jpg");
    expect(siteImageUrl(undefined, "acme")).toBeUndefined();
  });

  it("escapes the slug and id rather than letting them shape the path", () => {
    expect(siteImageUrl(siteImageRef("a/b"), "x y")).toBe("/api/site-image/x%20y/a%2Fb");
  });

  it("collects the uploads a layout still points at, ignoring pasted URLs", () => {
    const blocks: SiteBlock[] = [
      { id: "h", type: "hero", imageSrc: siteImageRef("one") },
      { id: "i1", type: "image", src: siteImageRef("two") },
      { id: "i2", type: "image", src: "https://example.com/x.jpg" },
      { id: "i3", type: "image", src: siteImageRef("one") },
      { id: "t", type: "text", heading: "no image here" },
    ];
    expect(referencedImageIds(blocks).sort()).toEqual(["one", "two"]);
  });

  it("reports nothing referenced for an empty layout, so a sweep clears everything", () => {
    expect(referencedImageIds([])).toEqual([]);
  });
});

describe("blockHiddenReason", () => {
  it("flags the blocks the renderer skips", () => {
    expect(blockHiddenReason({ id: "a", type: "text" }, true)).toMatch(/Empty/);
    expect(blockHiddenReason({ id: "a", type: "about" }, true)).toMatch(/Empty/);
    expect(blockHiddenReason({ id: "s", type: "services", items: [] }, true)).toMatch(/Empty/);
    expect(blockHiddenReason({ id: "i", type: "image" }, true)).toMatch(/No photo/);
    expect(blockHiddenReason({ id: "q", type: "testimonial" }, true)).toMatch(/No quote/);
  });

  it("stays quiet once the block has what it needs", () => {
    expect(blockHiddenReason({ id: "a", type: "text", body: "hi" }, true)).toBeNull();
    expect(blockHiddenReason({ id: "s", type: "services", items: ["x"] }, true)).toBeNull();
    expect(blockHiddenReason({ id: "i", type: "image", src: "u" }, true)).toBeNull();
    expect(blockHiddenReason({ id: "q", type: "testimonial", quote: "q" }, true)).toBeNull();
  });

  it("ties the forms block to whether anything is published", () => {
    expect(blockHiddenReason({ id: "f", type: "forms" }, false)).toMatch(/publish a form/);
    expect(blockHiddenReason({ id: "f", type: "forms" }, true)).toBeNull();
  });

  it("never hides hero or the contact form, which always render", () => {
    expect(blockHiddenReason({ id: "h", type: "hero" }, false)).toBeNull();
    expect(blockHiddenReason({ id: "r", type: "registration" }, false)).toBeNull();
  });
});

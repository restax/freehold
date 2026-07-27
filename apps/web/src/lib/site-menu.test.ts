import { describe, expect, it } from "vitest";
import { MAX_FORM_LINKS, siteMenu } from "./site-menu";

const form = (n: number) => ({ slug: `f${n}`, title: `Form ${n}` });

describe("siteMenu", () => {
  it("puts a published form on the menu without anyone linking it", () => {
    expect(siteMenu({ hasServices: false, forms: [form(1)], showRegistration: false })).toEqual([
      { href: "/f/f1", label: "Form 1" },
    ]);
  });

  it("collapses to one entry once there are too many forms", () => {
    const many = Array.from({ length: MAX_FORM_LINKS + 1 }, (_, i) => form(i));
    const menu = siteMenu({ hasServices: false, forms: many, showRegistration: false });
    expect(menu).toEqual([{ href: "#forms", label: "Get started" }]);
  });

  it("keeps the reading order: what we do, how to start, how to reach us", () => {
    const menu = siteMenu({ hasServices: true, forms: [form(1)], showRegistration: true });
    expect(menu.map((i) => i.href)).toEqual(["#services", "/f/f1", "#work-with-us"]);
  });

  it("is empty for a site with nothing to point at", () => {
    expect(siteMenu({ hasServices: false, forms: [], showRegistration: false })).toEqual([]);
  });

  it("carries the path prefix when the site isn't on its own host", () => {
    const menu = siteMenu({
      hasServices: false,
      forms: [form(1)],
      showRegistration: false,
      formBase: "/t/acme/f",
    });
    expect(menu[0].href).toBe("/t/acme/f/f1");
  });
});

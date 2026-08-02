import type { TenantSiteConfig } from "@/lib/site-config";

/**
 * The tenant mini-site's document model: an ordered list of blocks.
 *
 * Same shape as the intake-form model in lib/form-schema.ts and for the same
 * reason — an ordered list gives the designer one drag target ("put this
 * block there") instead of free geometry, and renders as plain server-side
 * sections with no layout engine.
 *
 * Dependency-free, so every rule that decides what a stranger sees on a
 * public page is unit-tested without pulling the app's module graph in.
 *
 * Backwards compatibility is the whole trick here. Sites created before
 * blocks existed store flat fields (tagline/about/services) and no `blocks`
 * array; `siteBlocks()` derives an equivalent block list for them, so an
 * existing site renders identically after this shipped and no migration had
 * to run. A workspace only gets a stored `blocks` array once it saves in the
 * designer, and from that point the array is the page.
 */

export const SITE_BLOCK_TYPES = [
  "hero",
  "about",
  "services",
  "forms",
  "registration",
  "text",
  "image",
  "testimonial",
] as const;
export type SiteBlockType = (typeof SITE_BLOCK_TYPES)[number];

export const SITE_BLOCK_LABEL: Record<SiteBlockType, string> = {
  hero: "Hero",
  about: "About",
  services: "Services",
  forms: "Intake forms",
  registration: "Contact form",
  text: "Text",
  image: "Image",
  testimonial: "Testimonial",
};

/** One-line "what is this" for the designer's palette. */
export const SITE_BLOCK_HINT: Record<SiteBlockType, string> = {
  hero: "Headline, intro, and a photo at the top of the page",
  about: "A heading and a paragraph about the business",
  services: "A checklist of what you handle",
  forms: "Cards linking the intake forms you've published",
  registration: "The form new clients fill in to reach you",
  text: "A free heading and paragraph, anywhere on the page",
  image: "A full-width photograph",
  testimonial: "A quote from a client, with attribution",
};

/**
 * Blocks a page should only ever have one of. The designer greys these out in
 * the palette once used: two contact forms means a lead lands twice, and two
 * "Get started" form lists is just noise.
 */
export const SINGLETON_BLOCKS: ReadonlySet<SiteBlockType> = new Set([
  "hero",
  "forms",
  "registration",
]);

export interface HeroBlock {
  id: string;
  type: "hero";
  heading?: string;
  body?: string;
  ctaLabel?: string;
  imageSrc?: string;
}
export interface AboutBlock {
  id: string;
  type: "about";
  heading?: string;
  body?: string;
}
export interface ServicesBlock {
  id: string;
  type: "services";
  heading?: string;
  items: string[];
}
export interface FormsBlock {
  id: string;
  type: "forms";
  heading?: string;
}
export interface RegistrationBlock {
  id: string;
  type: "registration";
  heading?: string;
}
export interface TextBlock {
  id: string;
  type: "text";
  heading?: string;
  body?: string;
}
export interface ImageBlock {
  id: string;
  type: "image";
  src?: string;
  alt?: string;
}
export interface TestimonialBlock {
  id: string;
  type: "testimonial";
  quote?: string;
  author?: string;
  role?: string;
}

export type SiteBlock =
  | HeroBlock
  | AboutBlock
  | ServicesBlock
  | FormsBlock
  | RegistrationBlock
  | TextBlock
  | ImageBlock
  | TestimonialBlock;

function str(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

function isBlockType(v: unknown): v is SiteBlockType {
  return typeof v === "string" && (SITE_BLOCK_TYPES as readonly string[]).includes(v);
}

/** Newline-separated text → trimmed, non-empty lines. The services shape. */
export function linesOf(raw: string | undefined): string[] {
  return (raw ?? "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseBlock(raw: unknown): SiteBlock | null {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const id = str(o.id);
  const type = o.type;
  if (!id || !isBlockType(type)) return null;

  switch (type) {
    case "hero":
      return {
        id,
        type,
        ...(str(o.heading) && { heading: str(o.heading) }),
        ...(str(o.body) && { body: str(o.body) }),
        ...(str(o.ctaLabel) && { ctaLabel: str(o.ctaLabel) }),
        ...(str(o.imageSrc) && { imageSrc: str(o.imageSrc) }),
      };
    case "services":
      return {
        id,
        type,
        ...(str(o.heading) && { heading: str(o.heading) }),
        items: Array.isArray(o.items)
          ? o.items.map(str).filter((s): s is string => Boolean(s))
          : [],
      };
    case "image":
      return {
        id,
        type,
        ...(str(o.src) && { src: str(o.src) }),
        ...(str(o.alt) && { alt: str(o.alt) }),
      };
    case "testimonial":
      return {
        id,
        type,
        ...(str(o.quote) && { quote: str(o.quote) }),
        ...(str(o.author) && { author: str(o.author) }),
        ...(str(o.role) && { role: str(o.role) }),
      };
    default:
      // about | forms | registration | text — heading and (sometimes) body.
      return {
        id,
        type,
        ...(str(o.heading) && { heading: str(o.heading) }),
        ...(str(o.body) && { body: str(o.body) }),
      } as SiteBlock;
  }
}

/**
 * Tolerant parse. A malformed array reads as empty rather than throwing —
 * these render on public, unauthenticated pages, where a crash is worse than
 * a missing section (same rule as parseLayout in form-schema.ts).
 */
export function parseSiteBlocks(raw: unknown): SiteBlock[] {
  if (!Array.isArray(raw)) return [];
  return normalizeSiteBlocks(raw.map(parseBlock).filter((b): b is SiteBlock => b !== null));
}

/**
 * Enforce what the designer is supposed to maintain: unique ids, and at most
 * one of each singleton block. A duplicate id would make React reorder the
 * wrong node during a drag; a second contact form would double-file leads.
 */
export function normalizeSiteBlocks(blocks: SiteBlock[]): SiteBlock[] {
  const ids = new Set<string>();
  const singletons = new Set<SiteBlockType>();
  const out: SiteBlock[] = [];
  for (const b of blocks) {
    if (ids.has(b.id)) continue;
    if (SINGLETON_BLOCKS.has(b.type)) {
      if (singletons.has(b.type)) continue;
      singletons.add(b.type);
    }
    ids.add(b.id);
    out.push(b);
  }
  return out;
}

/** A fresh block of `type`, for the designer's palette. */
export function newSiteBlock(type: SiteBlockType, id: string): SiteBlock {
  switch (type) {
    case "services":
      return { id, type, heading: "What we handle", items: [] };
    case "hero":
      return { id, type };
    case "about":
      return { id, type, heading: "About us" };
    case "forms":
      return { id, type, heading: "Get started" };
    case "registration":
      return { id, type, heading: "Tell us about your move" };
    case "text":
      return { id, type };
    case "image":
      return { id, type };
    case "testimonial":
      return { id, type };
  }
}

/**
 * The block list an older site implies, so it renders unchanged the first
 * time this code sees it. Sections are omitted exactly where the pre-blocks
 * renderer omitted them (no services line → no services section), which is
 * what makes this a faithful translation rather than a redesign.
 */
export function defaultBlocks(site: TenantSiteConfig): SiteBlock[] {
  const blocks: SiteBlock[] = [
    {
      id: "hero",
      type: "hero",
      ...(site.tagline && { heading: site.tagline }),
      ...(site.about && { body: site.about }),
      ...(site.showRegistration && { ctaLabel: "Work with us" }),
    },
  ];
  const services = linesOf(site.services);
  if (services.length > 0) {
    blocks.push({ id: "services", type: "services", heading: "What we handle", items: services });
  }
  // The forms block placed itself in the old renderer too — it appears when
  // the workspace has published a form to its public site, never by hand.
  blocks.push({ id: "forms", type: "forms", heading: "Get started" });
  if (site.showRegistration) {
    blocks.push({ id: "registration", type: "registration", heading: "Tell us about your move" });
  }
  return blocks;
}

/**
 * The page, however it is stored. A saved `blocks` array wins; anything else
 * (never opened the designer, or a corrupt value) falls back to the layout
 * implied by the flat fields, so the site is never blank.
 */
export function siteBlocks(site: TenantSiteConfig): SiteBlock[] {
  const stored = parseSiteBlocks((site as { blocks?: unknown }).blocks);
  return stored.length > 0 ? stored : defaultBlocks(site);
}

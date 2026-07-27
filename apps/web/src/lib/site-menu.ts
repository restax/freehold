/**
 * The public site's menu, assembled from what the workspace actually has.
 *
 * There is no menu editor and there shouldn't be one: a TC who publishes a
 * form has already said where it goes, and asking them to then link it by
 * hand is how sites end up with a "New client" form nobody can find. So the
 * menu is derived — sections that exist, forms that are published to the
 * website, and the enquiry form if it's switched on.
 *
 * Pure and dependency-free so the ordering and the collapse rule are tested
 * rather than read off a pile of JSX conditionals.
 */

export interface SiteMenuItem {
  href: string;
  label: string;
}

export interface SiteMenuInput {
  hasServices: boolean;
  /** Published, public-website forms, already in display order. */
  forms: ReadonlyArray<{ slug: string; title: string }>;
  showRegistration: boolean;
  /**
   * Where form links point. On the tenant's own host that's "/f"; reached at
   * the apex as /t/<slug> it has to carry the prefix, or every form link on
   * the page 404s.
   */
  formBase?: string;
}

/**
 * Past this many forms the menu lists a single "Get started" pointing at the
 * section instead: a header is a signpost, not an index, and five form titles
 * across the top reads as clutter on the one screen a visitor judges you by.
 */
export const MAX_FORM_LINKS = 3;

export function siteMenu({
  hasServices,
  forms,
  showRegistration,
  formBase = "/f",
}: SiteMenuInput): SiteMenuItem[] {
  const items: SiteMenuItem[] = [];
  if (hasServices) items.push({ href: "#services", label: "What we handle" });

  if (forms.length > MAX_FORM_LINKS) {
    items.push({ href: "#forms", label: "Get started" });
  } else {
    for (const f of forms) items.push({ href: `${formBase}/${f.slug}`, label: f.title });
  }

  if (showRegistration) items.push({ href: "#work-with-us", label: "Work with us" });
  return items;
}

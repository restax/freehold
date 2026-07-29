/**
 * Which half of the app a route belongs to.
 *
 * The sidebar shows one of two menus — the everyday one, and admin. Which is
 * showing is *derived from the current path* rather than held in client state:
 * a refresh keeps you where you were, an admin URL pasted to a colleague opens
 * with the admin menu, and there's no toggle to get out of step with the page.
 *
 * Dependency-free so both the server-rendered sidebar and the client top bar
 * can ask the same question and always agree.
 */

/** Routes that belong to workspace administration, not daily coordination. */
export const ADMIN_PATHS = [
  "/dashboard/invoices",
  "/dashboard/reviews",
  "/dashboard/directory",
  "/dashboard/vendors",
  "/dashboard/engagements",
  "/dashboard/website",
  "/dashboard/integrations",
  "/dashboard/team",
  "/dashboard/billing",
  "/dashboard/support",
  "/dashboard/settings",
] as const;

/** Where the Admin button lands. */
export const ADMIN_HOME = "/dashboard/settings";

export function isAdminPath(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  return ADMIN_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

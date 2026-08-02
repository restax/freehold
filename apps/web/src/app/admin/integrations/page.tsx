import { prisma } from "@freehold/db";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SaveButton } from "@/components/save-button";
import { saveIntegrationBranding } from "@/lib/actions/integration-branding";
import { INTEGRATION_CATALOG } from "@/lib/integration-catalog";
import { isOperator } from "@/lib/operator";
import { card, input, label as labelCls } from "@/lib/ui";

export const dynamic = "force-dynamic";

/**
 * Operator-only branding for each card on every workspace's
 * /dashboard/integrations — a logo and a link to the provider's own site.
 * Global, not per-tenant: one Documenso logo, seen by everyone.
 *
 * A card with nothing uploaded shows its plain-letter mark (the same "Do",
 * "FB", "Tw" initials the dashboard page already falls back to) — this page
 * shows that same fallback rather than a placeholder image, so what an
 * operator sees here is exactly what a tenant sees until they upload
 * something.
 */
export default async function AdminIntegrationsPage() {
  if (!(await isOperator())) notFound();

  const rows = await prisma.integrationBranding.findMany();
  const byKey = new Map(rows.map((r) => [r.key, r]));

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-10 sm:px-6">
      <div>
        <Link href="/admin" className="text-sm text-brand-600 hover:underline">
          ← Admin
        </Link>
        <h1 className="mt-1 text-xl font-semibold">Integration branding</h1>
        <p className="text-sm text-stone-500">
          Logo and link for each card on every workspace's Integrations page. Nothing uploaded means
          the card keeps showing its plain letter mark.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        {INTEGRATION_CATALOG.map((entry) => {
          const branding = byKey.get(entry.key);
          return (
            <section key={entry.key} className={`${card} flex flex-wrap items-end gap-4`}>
              <div className="flex items-center gap-3">
                {branding?.logo ? (
                  // biome-ignore lint/performance/noImgElement: an admin-uploaded data URL, not a bundled asset next/image can size.
                  <img
                    src={branding.logo}
                    alt=""
                    className="h-11 w-11 shrink-0 rounded-xl border border-stone-200 object-contain p-1"
                  />
                ) : (
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-stone-100 font-display text-base font-bold text-stone-700">
                    {entry.mono}
                  </span>
                )}
                <p className="w-40 font-medium">{entry.name}</p>
              </div>

              <form
                action={saveIntegrationBranding}
                className="flex flex-1 flex-wrap items-end gap-3"
              >
                <input type="hidden" name="key" value={entry.key} />
                <label className={labelCls}>
                  Logo (PNG/JPEG/WebP/SVG, up to 500 KB)
                  <input
                    type="file"
                    name="logo"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    className="text-sm text-stone-600 file:mr-3 file:rounded-lg file:border-0 file:bg-stone-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-stone-700 hover:file:bg-stone-200"
                  />
                </label>
                <label className={`${labelCls} min-w-56 flex-1`}>
                  Website
                  <input
                    name="url"
                    type="url"
                    defaultValue={branding?.url ?? ""}
                    placeholder="https://…"
                    className={input}
                  />
                </label>
                {branding?.logo && (
                  <label className="flex items-center gap-1.5 pb-2 text-xs text-stone-500">
                    <input type="checkbox" name="removeLogo" className="accent-brand-600" />
                    Remove logo
                  </label>
                )}
                <SaveButton className="rounded-md bg-brand-700 px-3 py-1.5 text-sm font-medium text-[var(--color-brand-fg)] shadow-xs transition hover:bg-brand-600 active:scale-[0.98]" />
              </form>
            </section>
          );
        })}
      </div>
    </main>
  );
}

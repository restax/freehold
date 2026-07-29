import { withTenant } from "@freehold/db";
import { redirect } from "next/navigation";
import { DashboardNav, ProfileNavLink, SettingsNavLink } from "@/components/dashboard-nav";
import { DemoWatermark } from "@/components/demo-watermark";
import { Wordmark } from "@/components/marketing";
import { SignOutButton } from "@/components/sign-out-button";
import { SupportTicketWidget } from "@/components/support-ticket-widget";
import { VoiceWidget } from "@/components/voice-widget";
import { openBillingPortal } from "@/lib/actions/billing";
import { brandRamp, priorityVars, tenantAppearance } from "@/lib/appearance";
import { DEMO_SLUG } from "@/lib/demo";
import { getTenantPlan } from "@/lib/plans";
import { getSession, listTenants } from "@/lib/session";
import { supportUnreadCount } from "@/lib/support-unread";
import { GUEST_ROLE, getMemberRole } from "@/lib/tenant";
import { btn } from "@/lib/ui";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const tenants = await listTenants();
  if (tenants.length === 0) redirect("/onboarding");
  const active = tenants.find((t) => t.id === session.session.activeOrganizationId) ?? tenants[0];

  // Outside coverage staff get a stripped sidebar: no create menu, no
  // settings, only the files they were handed. Pages enforce this themselves —
  // the sidebar just stops offering doors that won't open.
  const isGuest = (await getMemberRole(active.id, session.user.id)) === GUEST_ROLE;
  const supportUnread = await supportUnreadCount(active.id, session.user.id);
  // What's sitting in the intake queue, on the menu entry that leads to it.
  const formsPending = isGuest
    ? 0
    : await withTenant(active.id, (tx) => tx.formSubmission.count({ where: { status: "new" } }));
  const appearance = await tenantAppearance(active.id);

  // Failed-renewal lock: access is paused until payment is fixed, but nothing
  // is deleted and the recovery path (Stripe portal, sign-out) stays open.
  const plan = await getTenantPlan(active.id);
  if (plan.suspended) {
    return (
      <main className="flex min-h-[100dvh] items-center justify-center bg-stone-50 p-4">
        <div className="w-full max-w-md rounded-2xl border border-stone-200/70 bg-white p-8 text-center shadow-sm">
          <p className="font-display text-lg font-bold text-brand-800">Freehold</p>
          <h1 className="mt-5 text-xl font-semibold text-stone-900">Your workspace is paused</h1>
          <p className="mt-2 text-sm leading-relaxed text-stone-600">
            A recent payment didn't go through, so access is paused. Your data is safe — nothing has
            been deleted. Update your payment method to restore access right away.
          </p>
          {plan.stripeCustomerId ? (
            <form action={openBillingPortal} className="mt-6">
              <button type="submit" className={`${btn} w-full justify-center`}>
                Update payment method
              </button>
            </form>
          ) : (
            <p className="mt-6 text-sm text-stone-500">
              Ask your workspace owner to update billing, or email{" "}
              <a href="mailto:hello@freeholdtc.dev" className="text-brand-700 hover:underline">
                hello@freeholdtc.dev
              </a>
              .
            </p>
          )}
          <p className="mt-4 text-xs text-stone-400">
            Trouble? Email{" "}
            <a href="mailto:hello@freeholdtc.dev" className="text-brand-600 hover:underline">
              hello@freeholdtc.dev
            </a>{" "}
            — we'll sort it out.
          </p>
          <div className="mt-6 border-t border-stone-100 pt-4">
            <SignOutButton />
          </div>
        </div>
      </main>
    );
  }

  const isDemoTenant = active?.slug === DEMO_SLUG;

  // The colour theme paints the whole dashboard the same way it paints the
  // portal — overriding the brand ramp reskins every brand class, sidebar
  // included. Forest is the native palette, so skip the override there and
  // leave existing default workspaces pixel-identical.
  const themeVars = appearance.theme === "forest" ? {} : brandRamp(appearance.theme);

  return (
    <div
      className="flex min-h-screen"
      style={{ ...themeVars, ...priorityVars(appearance) } as React.CSSProperties}
    >
      {isDemoTenant && <DemoWatermark />}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-white focus:px-3 focus:py-2 focus:text-sm focus:shadow-md"
      >
        Skip to content
      </a>
      {/* shrink-0 is load-bearing: as a flex child the sidebar would otherwise
          be squeezed below its own width on a narrow window and clip every
          label. Below lg it collapses to an icon rail instead of shrinking —
          still legible (each item keeps a tooltip), and the content area gets
          its width back. */}
      <aside className="sticky top-0 flex h-screen w-14 shrink-0 flex-col overflow-y-auto overflow-x-hidden border-r border-stone-200 bg-white px-2 py-6 lg:w-56 lg:px-4">
        <div className="mb-1 flex shrink-0 justify-center lg:justify-start">
          <Wordmark href="/dashboard" collapsible />
        </div>
        {/* shrink-0 matters here specifically: `truncate` sets overflow:hidden,
            which per the flexbox spec gives this item an automatic minimum
            size of 0 (instead of its content size). Once the sidebar's total
            content outgrows h-screen, flexbox shrinks its children to fit —
            and this item, uniquely allowed to shrink to nothing, was the one
            that collapsed to a sliver while its siblings barely moved. The
            fix is to opt every sidebar section out of shrinking, so
            overflow-y-auto scrolls the sidebar instead of crushing a child. */}
        <div className="mb-4 mt-1 hidden shrink-0 truncate rounded-lg bg-stone-100/80 px-2.5 py-1.5 text-xs font-medium text-stone-500 lg:block">
          {active?.name}
        </div>
        {isGuest && (
          <p className="mb-3 hidden shrink-0 rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs text-amber-900 lg:block">
            You're covering files for this workspace as a guest.
          </p>
        )}
        {!isGuest && (
          <details className="group relative mb-3 shrink-0">
            <summary
              title="Create"
              className="flex cursor-pointer select-none items-center justify-center gap-1 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-brand-700"
            >
              +<span className="hidden lg:inline">&nbsp;Create</span>
            </summary>
            {/* min-w keeps the menu usable when the rail itself is only 56px. */}
            <div className="absolute left-0 z-10 mt-1 flex min-w-40 flex-col rounded-lg border border-stone-200 bg-white py-1 shadow-lg lg:right-0">
              <a
                href="/dashboard/transactions/new"
                className="px-3 py-1.5 text-sm text-stone-700 hover:bg-stone-50"
              >
                Transaction
              </a>
              <a
                href="/dashboard/contacts/new"
                className="px-3 py-1.5 text-sm text-stone-700 hover:bg-stone-50"
              >
                Contact
              </a>
              <a
                href="/dashboard/contacts?due=1"
                className="px-3 py-1.5 text-sm text-stone-700 hover:bg-stone-50"
              >
                Contact note
              </a>
              <a
                href="/dashboard/transactions"
                className="px-3 py-1.5 text-sm text-stone-700 hover:bg-stone-50"
              >
                Task
              </a>
            </div>
          </details>
        )}
        <DashboardNav isGuest={isGuest} supportUnread={supportUnread} formsPending={formsPending} />
        <div className="mt-auto flex shrink-0 flex-col gap-1 border-t border-stone-200 pt-3">
          {/* Text-only composer with no icon to collapse to — hidden on the
              rail, where Support is still one click away in the nav above. */}
          <div className="hidden lg:block">
            <SupportTicketWidget />
          </div>
          <ProfileNavLink />
          {!isGuest && <SettingsNavLink />}
          <div className="flex flex-col items-center gap-1 pt-1 lg:flex-row lg:items-center lg:justify-between lg:gap-2 lg:px-2.5">
            <span className="hidden truncate text-xs text-stone-400 lg:inline">
              {session.user.email}
            </span>
            <SignOutButton collapsible />
          </div>
        </div>
      </aside>
      {/* min-w-0 lets the content column shrink below its intrinsic width — a
          flex item defaults to min-width:auto, which is what was pushing the
          whole page into a horizontal scroll on a narrow window. */}
      <main id="main" className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <div className="mx-auto max-w-[1920px]">{children}</div>
      </main>
      {/* Lives in the layout so voice search is one press away on every
          dashboard page, not just a destination you have to navigate to. */}
      <VoiceWidget />
    </div>
  );
}

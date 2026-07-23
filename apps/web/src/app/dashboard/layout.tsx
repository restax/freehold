import { redirect } from "next/navigation";
import { DashboardNav, ProfileNavLink, SettingsNavLink } from "@/components/dashboard-nav";
import { DemoWatermark } from "@/components/demo-watermark";
import { Wordmark } from "@/components/marketing";
import { SignOutButton } from "@/components/sign-out-button";
import { SupportTicketWidget } from "@/components/support-ticket-widget";
import { VoiceWidget } from "@/components/voice-widget";
import { openBillingPortal } from "@/lib/actions/billing";
import { priorityVars, tenantAppearance } from "@/lib/appearance";
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

  return (
    <div className="flex min-h-screen" style={priorityVars(appearance)}>
      {isDemoTenant && <DemoWatermark />}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-white focus:px-3 focus:py-2 focus:text-sm focus:shadow-md"
      >
        Skip to content
      </a>
      <aside className="sticky top-0 flex h-screen w-56 flex-col overflow-y-auto border-r border-stone-200 bg-white px-4 py-6">
        <div className="mb-1">
          <Wordmark href="/dashboard" />
        </div>
        <div className="mb-4 mt-1 truncate rounded-lg bg-stone-100/80 px-2.5 py-1.5 text-xs font-medium text-stone-500">
          {active?.name}
        </div>
        {isGuest && (
          <p className="mb-3 rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs text-amber-900">
            You're covering files for this workspace as a guest.
          </p>
        )}
        {!isGuest && (
          <details className="group relative mb-3">
            <summary className="flex cursor-pointer select-none items-center justify-center gap-1 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-brand-700">
              + Create
            </summary>
            <div className="absolute left-0 right-0 z-10 mt-1 flex flex-col rounded-lg border border-stone-200 bg-white py-1 shadow-lg">
              <a
                href="/dashboard/transactions"
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
        <DashboardNav isGuest={isGuest} supportUnread={supportUnread} />
        <div className="mt-auto flex flex-col gap-1 border-t border-stone-200 pt-3">
          <SupportTicketWidget />
          <ProfileNavLink />
          {!isGuest && <SettingsNavLink />}
          <div className="flex items-center justify-between gap-2 px-2.5 pt-1">
            <span className="truncate text-xs text-stone-400">{session.user.email}</span>
            <SignOutButton />
          </div>
        </div>
      </aside>
      <main id="main" className="flex-1 px-8 py-8">
        <div className="mx-auto max-w-[1920px]">{children}</div>
      </main>
      {/* Lives in the layout so voice search is one press away on every
          dashboard page, not just a destination you have to navigate to. */}
      <VoiceWidget />
    </div>
  );
}

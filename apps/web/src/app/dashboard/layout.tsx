import { prisma, withTenant } from "@freehold/db";
import Link from "next/link";
import { redirect } from "next/navigation";
import { DashboardNav } from "@/components/dashboard-nav";
import { DemoWatermark } from "@/components/demo-watermark";
import { Wordmark } from "@/components/marketing";
import { SignOutButton } from "@/components/sign-out-button";
import { SupportTicketWidget } from "@/components/support-ticket-widget";
import { TopBar } from "@/components/top-bar";
import { VoiceWidget } from "@/components/voice-widget";
import { openBillingPortal } from "@/lib/actions/billing";
import { priorityVars, tenantAppearance, themeTokens } from "@/lib/appearance";
import { cloudPromptDue, cloudPromptText, readCloudPromptConfig } from "@/lib/cloud-prompt";
import { DEMO_SLUG } from "@/lib/demo";
import { directoryNudgeDue, readDirectoryConfig } from "@/lib/directory";
import { getTenantPlan, isCloud } from "@/lib/plans";
import { getPlatformSettings } from "@/lib/platform-settings";
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
  // The workspace's own mark, shown at the top of the rail when they've set one.
  const org = await prisma.organization.findUnique({
    where: { id: active.id },
    select: { logo: true, directoryConfig: true, cloudPromptConfig: true },
  });
  // Both bell nudges are admin decisions about the workspace, so neither is
  // offered to a member who couldn't act on it anyway.
  const isAdmin = ["owner", "admin"].includes(await getMemberRole(active.id, session.user.id));

  // One standing nudge for admins whose workspace isn't in the directory —
  // it costs them referrals to leave it off, and it's easy to never notice
  // the setting exists. Silenced by listing, or by asking not to be asked.
  const directoryNudge =
    isAdmin && directoryNudgeDue(readDirectoryConfig(org?.directoryConfig)) ? 1 : 0;

  // Self-host only, once a month: a note that Freehold Cloud exists. Cloud
  // installs never see it, an operator can reword or remove it install-wide,
  // and a workspace can snooze it or switch it off. See lib/cloud-prompt.ts.
  const cloudPromptOn =
    !isCloud() &&
    isAdmin &&
    cloudPromptDue(readCloudPromptConfig(org?.cloudPromptConfig)) &&
    (await getPlatformSettings().then(
      (s) => cloudPromptText(s.cloudPromptText, s.cloudPromptEnabled) != null,
    ));
  const cloudNudge = cloudPromptOn ? 1 : 0;

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
  // portal: the tokens cover the brand ramp *and* the shaded section strips,
  // top bar and address pills, so one choice moves every themed surface.
  //
  // Emitted for every theme including the default. It used to short-circuit
  // on "forest" to keep default workspaces byte-identical, which quietly
  // meant the default could never be re-tuned from one place — the CSS
  // fallback and the preset had to be kept in agreement by hand.
  const themeVars = themeTokens(appearance);

  return (
    <div
      className="flex min-h-screen flex-col"
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
      <TopBar
        userName={session.user.name ?? session.user.email}
        userEmail={session.user.email}
        isGuest={isGuest}
        alerts={supportUnread + formsPending + directoryNudge + cloudNudge}
      />
      <div className="flex min-h-0 flex-1">
        <aside className="sticky top-14 flex h-[calc(100vh-3.5rem)] w-14 shrink-0 flex-col overflow-y-auto overflow-x-hidden border-r border-stone-200 bg-white px-2 py-6 lg:w-56 lg:px-4">
          {/* The workspace owns the top of the rail now — its name, and its
            logo when one has been uploaded. Freehold's own mark moved to the
            foot of the menu: whose software this is matters less, every
            minute of the day, than whose workspace you're in. */}
          <Link
            href="/dashboard"
            title={active?.name}
            className="mb-4 flex shrink-0 items-center gap-2 rounded-lg px-1 py-1 transition-colors hover:bg-stone-100 lg:px-2"
          >
            {org?.logo ? (
              // biome-ignore lint/performance/noImgElement: tenant logo is a data URL, not a static asset next/image can optimise
              <img src={org.logo} alt="" className="h-7 w-7 shrink-0 rounded object-contain" />
            ) : (
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-brand-600 text-sm font-bold text-white">
                {(active?.name ?? "?").trim().charAt(0).toUpperCase()}
              </span>
            )}
            <span className="hidden truncate text-sm font-semibold text-stone-900 lg:block">
              {active?.name}
            </span>
          </Link>
          {isGuest && (
            <p className="mb-3 hidden shrink-0 rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs text-amber-900 lg:block">
              You're covering files for this workspace as a guest.
            </p>
          )}
          <DashboardNav
            isGuest={isGuest}
            supportUnread={supportUnread}
            formsPending={formsPending}
          />
          <div className="mt-auto flex shrink-0 flex-col gap-2 border-t border-stone-200 pt-3">
            {/* Text-only composer with no icon to collapse to — hidden on the
              rail, where Support is still one click away. */}
            <div className="hidden lg:block">
              <SupportTicketWidget />
            </div>
            <div className="flex justify-center pt-1 lg:justify-start lg:px-1">
              <Wordmark href="/dashboard" collapsible />
            </div>
          </div>
        </aside>
        {/* min-w-0 lets the content column shrink below its intrinsic width — a
          flex item defaults to min-width:auto, which is what was pushing the
          whole page into a horizontal scroll on a narrow window. */}
        <main id="main" className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div className="mx-auto max-w-[1920px]">{children}</div>
        </main>
      </div>
      {/* Lives in the layout so voice search is one press away on every
          dashboard page, not just a destination you have to navigate to. */}
      <VoiceWidget />
    </div>
  );
}

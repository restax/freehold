import { redirect } from "next/navigation";
import { DashboardNav, SettingsNavLink } from "@/components/dashboard-nav";
import { Wordmark } from "@/components/marketing";
import { SignOutButton } from "@/components/sign-out-button";
import { getSession, listTenants } from "@/lib/session";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const tenants = await listTenants();
  if (tenants.length === 0) redirect("/onboarding");
  const active = tenants.find((t) => t.id === session.session.activeOrganizationId) ?? tenants[0];

  return (
    <div className="flex min-h-screen">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-white focus:px-3 focus:py-2 focus:text-sm focus:shadow-md"
      >
        Skip to content
      </a>
      <aside className="flex w-56 flex-col border-r border-stone-200 bg-white px-4 py-6">
        <div className="mb-1">
          <Wordmark href="/dashboard" />
        </div>
        <div className="mb-4 mt-1 truncate rounded-lg bg-stone-100/80 px-2.5 py-1.5 text-xs font-medium text-stone-500">
          {active?.name}
        </div>
        <DashboardNav />
        <div className="mt-auto flex flex-col gap-1 border-t border-stone-200 pt-3">
          <SettingsNavLink />
          <div className="flex items-center justify-between gap-2 px-2.5 pt-1">
            <span className="truncate text-xs text-stone-400">{session.user.email}</span>
            <SignOutButton />
          </div>
        </div>
      </aside>
      <main id="main" className="flex-1 px-8 py-8">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}

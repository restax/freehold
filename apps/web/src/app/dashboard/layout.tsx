import { redirect } from "next/navigation";
import { DashboardNav } from "@/components/dashboard-nav";
import { Wordmark } from "@/components/marketing";
import { SignOutButton } from "@/components/sign-out-button";
import { getSession, listTenants } from "@/lib/session";

const NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/dashboard/transactions", label: "Transactions" },
  { href: "/dashboard/contacts", label: "Contacts" },
  { href: "/dashboard/clients", label: "Clients" },
  { href: "/dashboard/action-plans", label: "Action plans" },
  { href: "/dashboard/templates", label: "Templates" },
  { href: "/dashboard/vault", label: "Vault" },
  { href: "/dashboard/team", label: "Team" },
  { href: "/dashboard/billing", label: "Billing" },
  { href: "/dashboard/settings", label: "Settings" },
];

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
        <div className="mb-6 truncate text-sm text-stone-500">{active?.name}</div>
        <DashboardNav items={NAV} />
        <div className="mt-auto flex flex-col gap-2 border-t border-stone-200 pt-4">
          <span className="truncate text-xs text-stone-400">{session.user.email}</span>
          <SignOutButton />
        </div>
      </aside>
      <main id="main" className="flex-1 px-8 py-8">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}

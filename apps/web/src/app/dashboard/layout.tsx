import Link from "next/link";
import { redirect } from "next/navigation";
import { SignOutButton } from "@/components/sign-out-button";
import { getSession, listTenants } from "@/lib/session";

const NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/dashboard/transactions", label: "Transactions" },
  { href: "/dashboard/contacts", label: "Contacts" },
  { href: "/dashboard/clients", label: "Clients" },
  { href: "/dashboard/action-plans", label: "Action plans" },
  { href: "/dashboard/templates", label: "Templates" },
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
      <aside className="flex w-56 flex-col border-r border-stone-200 bg-white px-4 py-6">
        <div className="mb-1 text-lg font-semibold tracking-tight text-brand-700">Freehold</div>
        <div className="mb-6 truncate text-sm text-stone-500">{active?.name}</div>
        <nav className="flex flex-col gap-1">
          {NAV.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className="rounded-lg px-3 py-2 text-sm text-stone-700 hover:bg-stone-100"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto flex flex-col gap-2 border-t border-stone-200 pt-4">
          <span className="truncate text-xs text-stone-400">{session.user.email}</span>
          <SignOutButton />
        </div>
      </aside>
      <main className="flex-1 px-8 py-6">{children}</main>
    </div>
  );
}

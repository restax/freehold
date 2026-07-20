"use client";

import {
  AddressBook,
  Buildings,
  CreditCard,
  DownloadSimple,
  EnvelopeSimple,
  Files,
  FileText,
  GearSix,
  Globe,
  House,
  type Icon,
  ListChecks,
  LockKey,
  PlugsConnected,
  Receipt,
  ShieldCheck,
  Sun,
  UsersThree,
} from "@phosphor-icons/react";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavItem {
  href: string;
  label: string;
  icon: Icon;
}

interface NavGroup {
  label: string | null;
  items: NavItem[];
}

const GROUPS: NavGroup[] = [
  {
    label: null,
    items: [{ href: "/dashboard", label: "Today", icon: Sun }],
  },
  {
    label: "Work",
    items: [
      { href: "/dashboard/transactions", label: "Transactions", icon: House },
      { href: "/dashboard/contacts", label: "Contacts", icon: AddressBook },
      { href: "/dashboard/clients", label: "Clients", icon: Buildings },
      { href: "/dashboard/documents", label: "Documents", icon: Files },
    ],
  },
  {
    label: "Library",
    items: [
      { href: "/dashboard/action-plans", label: "Action plans", icon: ListChecks },
      { href: "/dashboard/compliance", label: "Compliance", icon: ShieldCheck },
      { href: "/dashboard/templates", label: "Doc templates", icon: FileText },
      { href: "/dashboard/emails", label: "Email templates", icon: EnvelopeSimple },
      { href: "/dashboard/vault", label: "Vault", icon: LockKey },
      { href: "/dashboard/import", label: "Import", icon: DownloadSimple },
    ],
  },
  {
    label: "Business",
    items: [
      { href: "/dashboard/invoices", label: "Invoices", icon: Receipt },
      { href: "/dashboard/website", label: "Website", icon: Globe },
      { href: "/dashboard/integrations", label: "Integrations", icon: PlugsConnected },
      { href: "/dashboard/team", label: "Team", icon: UsersThree },
      { href: "/dashboard/billing", label: "Billing", icon: CreditCard },
    ],
  },
];

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  const IconComponent = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={`flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] transition-colors ${
        active
          ? "bg-brand-50 font-medium text-brand-800"
          : "text-stone-600 hover:bg-stone-100 hover:text-stone-900"
      }`}
    >
      <IconComponent
        size={16}
        weight={active ? "fill" : "regular"}
        className={active ? "text-brand-700" : "text-stone-400"}
        aria-hidden
      />
      {item.label}
    </Link>
  );
}

export function DashboardNav() {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(href);

  return (
    <nav className="flex flex-col">
      {GROUPS.map((group) => (
        <div key={group.label ?? "top"} className="flex flex-col gap-0.5">
          {group.label && (
            <p className="mb-1 mt-5 px-2.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-stone-400">
              {group.label}
            </p>
          )}
          {group.items.map((item) => (
            <NavLink key={item.href} item={item} active={isActive(item.href)} />
          ))}
        </div>
      ))}
    </nav>
  );
}

export function SettingsNavLink() {
  const pathname = usePathname();
  const active = pathname.startsWith("/dashboard/settings");
  return (
    <Link
      href="/dashboard/settings"
      aria-current={active ? "page" : undefined}
      className={`flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] transition-colors ${
        active
          ? "bg-brand-50 font-medium text-brand-800"
          : "text-stone-600 hover:bg-stone-100 hover:text-stone-900"
      }`}
    >
      <GearSix
        size={16}
        weight={active ? "fill" : "regular"}
        className={active ? "text-brand-700" : "text-stone-400"}
        aria-hidden
      />
      Settings
    </Link>
  );
}

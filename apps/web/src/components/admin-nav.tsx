"use client";

import {
  ArrowLeft,
  Bell,
  Camera,
  Flask,
  GearSix,
  House,
  type Icon,
  Lifebuoy,
  MapPin,
  Megaphone,
  PaperPlaneTilt,
  PlugsConnected,
  ShareNetwork,
  Tray,
} from "@phosphor-icons/react";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface AdminNavItem {
  href: string;
  label: string;
  icon: Icon;
}

interface AdminNavGroup {
  label: string;
  items: AdminNavItem[];
}

/**
 * Every section of the /admin operator panel, grouped the same way the
 * dashboard's own sidebar groups a tenant's tools — replacing what used to be
 * a single row of buttons across the top of the operator-panel page, which
 * had grown to eleven links and stopped fitting on one line.
 */
const GROUPS: AdminNavGroup[] = [
  {
    label: "Overview",
    items: [{ href: "/admin", label: "Operator panel", icon: House }],
  },
  {
    label: "Growth",
    items: [
      { href: "/admin/recommendations", label: "Recommendations", icon: PaperPlaneTilt },
      { href: "/admin/crm-capture", label: "Screenshot to CRM", icon: Camera },
      { href: "/admin/socialmedia", label: "Social media kit", icon: ShareNetwork },
      { href: "/admin/ads", label: "Vendor ads", icon: Megaphone },
    ],
  },
  {
    label: "Content",
    items: [
      { href: "/admin/messages", label: "Critical messages", icon: Bell },
      { href: "/admin/states", label: "State reference", icon: MapPin },
      { href: "/admin/integrations", label: "Integration branding", icon: PlugsConnected },
    ],
  },
  {
    label: "Support",
    items: [
      { href: "/admin/tickets", label: "Support tickets", icon: Lifebuoy },
      { href: "/admin/inbound", label: "Unmatched inbound", icon: Tray },
    ],
  },
  {
    label: "Platform",
    items: [
      { href: "/admin/settings", label: "Platform settings", icon: GearSix },
      { href: "/admin/demo-data", label: "Demo data", icon: Flask },
    ],
  },
];

const navRowCls =
  "flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm transition-colors lg:gap-2.5";

export function AdminNav({ openTickets = 0 }: { openTickets?: number }) {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);

  return (
    <nav className="flex shrink-0 flex-col">
      {GROUPS.map((group) => (
        <div key={group.label} className="flex flex-col gap-0.5">
          <p className="mb-1 mt-5 hidden px-2.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-stone-400 first:mt-0 lg:block">
            {group.label}
          </p>
          {group.items.map((item) => {
            const active = isActive(item.href);
            const badge = item.href === "/admin/tickets" ? openTickets : 0;
            return (
              <Link
                key={item.href}
                href={item.href}
                title={item.label}
                aria-current={active ? "page" : undefined}
                className={`${navRowCls} ${
                  active
                    ? "bg-brand-50 font-medium text-brand-800"
                    : "text-stone-600 hover:bg-stone-100 hover:text-stone-900"
                }`}
              >
                <item.icon
                  size={16}
                  weight={active ? "fill" : "regular"}
                  className={`shrink-0 ${active ? "text-brand-700" : "text-stone-400"}`}
                  aria-hidden
                />
                <span className="hidden truncate lg:block">{item.label}</span>
                {badge > 0 && (
                  <span className="ml-auto hidden shrink-0 rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white lg:block">
                    {badge > 9 ? "9+" : badge}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      ))}
      <Link
        href="/dashboard"
        title="Back to workspace"
        className={`${navRowCls} mt-5 border-t border-stone-200 pt-4 text-stone-600 hover:bg-stone-100 hover:text-stone-900`}
      >
        <ArrowLeft size={16} className="shrink-0 text-stone-400" aria-hidden />
        <span className="hidden truncate lg:block">Back to workspace</span>
      </Link>
    </nav>
  );
}

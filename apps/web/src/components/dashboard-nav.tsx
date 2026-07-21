"use client";

import {
  AddressBook,
  Buildings,
  CalendarBlank,
  Compass,
  CreditCard,
  DownloadSimple,
  EnvelopeSimple,
  Files,
  FileText,
  GearSix,
  Globe,
  Handshake,
  House,
  type Icon,
  Lifebuoy,
  ListChecks,
  LockKey,
  Microphone,
  PlugsConnected,
  Receipt,
  ShieldCheck,
  Sun,
  Toolbox,
  UserCircle,
  UsersThree,
} from "@phosphor-icons/react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { VOICE_OPEN_EVENT } from "@/components/voice-widget";

const SUPPORT_HREF = "/dashboard/support";
const UNREAD_POLL_MS = 15000;

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
      { href: "/dashboard/calendar", label: "Calendar", icon: CalendarBlank },
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
      { href: "/dashboard/directory", label: "Directory", icon: Compass },
      { href: "/dashboard/vendors", label: "Vendors", icon: Toolbox },
      { href: "/dashboard/engagements", label: "Engagements", icon: Handshake },
      { href: "/dashboard/website", label: "Website", icon: Globe },
      { href: "/dashboard/integrations", label: "Integrations", icon: PlugsConnected },
      { href: "/dashboard/team", label: "Team", icon: UsersThree },
      { href: "/dashboard/billing", label: "Billing", icon: CreditCard },
      { href: "/dashboard/support", label: "Support", icon: Lifebuoy },
    ],
  },
];

function NavLink({ item, active, badge = 0 }: { item: NavItem; active: boolean; badge?: number }) {
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
      {badge > 0 && (
        <span
          role="status"
          aria-label={`${badge} new`}
          className="ml-auto inline-flex min-w-4 animate-bounce items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-semibold leading-4 text-white"
        >
          {badge > 9 ? "9+" : badge}
        </span>
      )}
    </Link>
  );
}

/** The only destinations outside coverage staff can reach. */
const GUEST_HREFS = new Set([
  "/dashboard",
  "/dashboard/transactions",
  "/dashboard/calendar",
  "/dashboard/support",
]);

export function DashboardNav({
  isGuest = false,
  supportUnread = 0,
}: {
  isGuest?: boolean;
  supportUnread?: number;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const isActive = (href: string) =>
    href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(href);

  const onSupport = pathname.startsWith(SUPPORT_HREF);
  const [unread, setUnread] = useState(supportUnread);

  // Landing on the Support page clears the badge immediately — the server also
  // marks it seen, but that only reaches us on the next poll.
  useEffect(() => {
    if (onSupport) setUnread(0);
  }, [onSupport]);

  // Poll for operator/Slack replies. While the Support page is open, a new one
  // also triggers a soft refresh so it shows up without a manual reload (client
  // state and form inputs are preserved). Skip while the tab is hidden.
  useEffect(() => {
    let active = true;
    const tick = async () => {
      if (typeof document !== "undefined" && document.hidden) return;
      try {
        const res = await fetch("/api/support/unread", { cache: "no-store" });
        if (!res.ok || !active) return;
        const { unread: n } = (await res.json()) as { unread: number };
        if (n > 0 && pathname.startsWith(SUPPORT_HREF)) {
          router.refresh();
          setUnread(0);
        } else {
          setUnread(n);
        }
      } catch {
        // A failed poll just means we try again next tick.
      }
    };
    const id = setInterval(tick, UNREAD_POLL_MS);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [pathname, router]);

  const badgeFor = (href: string) => (href === SUPPORT_HREF && !onSupport ? unread : 0);

  // Hiding these is courtesy, not security — every page refuses guests
  // server-side regardless of what the sidebar shows.
  const groups = isGuest
    ? GROUPS.map((g) => ({ ...g, items: g.items.filter((i) => GUEST_HREFS.has(i.href)) })).filter(
        (g) => g.items.length > 0,
      )
    : GROUPS;

  return (
    <nav className="flex flex-col">
      {groups.map((group) => (
        <div key={group.label ?? "top"} className="flex flex-col gap-0.5">
          {group.label && (
            <p className="mb-1 mt-5 px-2.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-stone-400">
              {group.label}
            </p>
          )}
          {group.items.map((item) => (
            <NavLink
              key={item.href}
              item={item}
              active={isActive(item.href)}
              badge={badgeFor(item.href)}
            />
          ))}
          {/* Voice search isn't a page — it's the panel that lives on every
              screen — so the menu entry opens it where you already are. */}
          {group.label === "Work" && (
            <button
              type="button"
              onClick={() => window.dispatchEvent(new CustomEvent(VOICE_OPEN_EVENT))}
              className="flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-[13px] text-stone-600 transition-colors hover:bg-stone-100 hover:text-stone-900"
            >
              <Microphone size={16} className="text-stone-400" aria-hidden />
              Voice search
            </button>
          )}
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

export function ProfileNavLink() {
  const pathname = usePathname();
  const active = pathname.startsWith("/dashboard/profile");
  return (
    <Link
      href="/dashboard/profile"
      aria-current={active ? "page" : undefined}
      className={`flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] transition-colors ${
        active
          ? "bg-brand-50 font-medium text-brand-800"
          : "text-stone-600 hover:bg-stone-100 hover:text-stone-900"
      }`}
    >
      <UserCircle
        size={16}
        weight={active ? "fill" : "regular"}
        className={active ? "text-brand-700" : "text-stone-400"}
        aria-hidden
      />
      Profile
    </Link>
  );
}

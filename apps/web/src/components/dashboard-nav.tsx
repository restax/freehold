"use client";

import {
  AddressBook,
  ArrowLeft,
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
  ListDashes,
  LockKey,
  Microphone,
  PlugsConnected,
  Receipt,
  ShieldCheck,
  Star,
  Sun,
  Toolbox,
  UserCircle,
  UsersThree,
} from "@phosphor-icons/react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { VOICE_OPEN_EVENT } from "@/components/voice-widget";
import { isAdminPath } from "@/lib/nav-sections";

const SUPPORT_HREF = "/dashboard/support";
const FORMS_HREF = "/dashboard/forms";
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
      { href: "/dashboard/templates", label: "Templates", icon: FileText },
      { href: "/dashboard/compliance", label: "Compliance", icon: ShieldCheck },
      { href: "/dashboard/emails", label: "Email settings", icon: EnvelopeSimple },
      { href: "/dashboard/forms", label: "Forms", icon: ListDashes },
      { href: "/dashboard/vault", label: "Vault", icon: LockKey },
    ],
  },
];

/**
 * The admin menu. Everything here is set-up-and-configure work rather than
 * coordinating a file, so it lives behind the Admin button instead of making
 * the everyday menu twice as long as it needs to be.
 */
const ADMIN_GROUPS: NavGroup[] = [
  {
    label: "Money",
    items: [
      { href: "/dashboard/invoices", label: "Invoices", icon: Receipt },
      { href: "/dashboard/billing", label: "Billing", icon: CreditCard },
    ],
  },
  {
    label: "Network",
    items: [
      { href: "/dashboard/reviews", label: "Reviews", icon: Star },
      { href: "/dashboard/directory", label: "Directory", icon: Compass },
      { href: "/dashboard/vendors", label: "Vendors", icon: Toolbox },
      { href: "/dashboard/engagements", label: "Engagements", icon: Handshake },
    ],
  },
  {
    label: "Workspace",
    items: [
      { href: "/dashboard/settings", label: "Settings", icon: GearSix },
      { href: "/dashboard/team", label: "Team", icon: UsersThree },
      { href: "/dashboard/website", label: "Website", icon: Globe },
      { href: "/dashboard/integrations", label: "Integrations", icon: PlugsConnected },
      { href: "/dashboard/import", label: "Import", icon: DownloadSimple },
      { href: "/dashboard/support", label: "Support", icon: Lifebuoy },
    ],
  },
];

/**
 * One sidebar row. Below lg the sidebar is a 56px icon rail, so the label is
 * hidden and the icon centres; the accessible name still reaches screen
 * readers (and a tooltip reaches the mouse) via `title`.
 */
export const navRowCls =
  "flex items-center justify-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] transition-colors lg:justify-start";
export const navLabelCls = "hidden lg:inline";

function NavLink({
  item,
  active,
  badge = 0,
  urgent = true,
}: {
  item: NavItem;
  active: boolean;
  badge?: number;
  /** A support reply is waiting on a person; a queue of intake forms isn't. */
  urgent?: boolean;
}) {
  const IconComponent = item.icon;
  return (
    <Link
      href={item.href}
      title={item.label}
      aria-current={active ? "page" : undefined}
      className={`${navRowCls} ${
        active
          ? "bg-brand-50 font-medium text-brand-800"
          : "text-stone-600 hover:bg-stone-100 hover:text-stone-900"
      }`}
    >
      <IconComponent
        size={16}
        weight={active ? "fill" : "regular"}
        className={`shrink-0 ${active ? "text-brand-700" : "text-stone-400"}`}
        aria-hidden
      />
      <span className={navLabelCls}>{item.label}</span>
      {badge > 0 && (
        <span
          role="status"
          aria-label={`${badge} new`}
          className={`inline-flex min-w-4 items-center justify-center rounded-full px-1.5 text-[10px] font-semibold leading-4 lg:ml-auto ${
            urgent ? "animate-bounce bg-red-500 text-white" : "bg-stone-200 text-stone-600"
          }`}
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
  formsPending = 0,
}: {
  isGuest?: boolean;
  supportUnread?: number;
  /** Form submissions nobody has reviewed yet — a count, not an alarm. */
  formsPending?: number;
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

  const badgeFor = (href: string) => {
    if (href === SUPPORT_HREF) return onSupport ? 0 : unread;
    // Forms place themselves on this menu too: what's waiting is on the entry
    // that leads to it, rather than only inside the page nobody opened.
    if (href === FORMS_HREF) return formsPending;
    return 0;
  };

  // Hiding these is courtesy, not security — every page refuses guests
  // server-side regardless of what the sidebar shows.
  // Which menu shows is derived from the path, not held in state: a refresh
  // keeps you where you were, and an admin URL opens with the admin menu.
  const inAdmin = !isGuest && isAdminPath(pathname);
  const source = inAdmin ? ADMIN_GROUPS : GROUPS;
  const groups = isGuest
    ? source
        .map((g) => ({ ...g, items: g.items.filter((i) => GUEST_HREFS.has(i.href)) }))
        .filter((g) => g.items.length > 0)
    : source;

  return (
    <nav className="flex shrink-0 flex-col">
      {groups.map((group) => (
        <div key={group.label ?? "top"} className="flex flex-col gap-0.5">
          {group.label && (
            <p className="mb-1 mt-5 hidden px-2.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-stone-400 lg:block">
              {group.label}
            </p>
          )}
          {group.items.map((item) => (
            <NavLink
              key={item.href}
              item={item}
              active={isActive(item.href)}
              badge={badgeFor(item.href)}
              urgent={item.href !== FORMS_HREF}
            />
          ))}
          {/* Voice search isn't a page — it's the panel that lives on every
              screen — so the menu entry opens it where you already are. */}
          {group.label === "Work" && (
            <button
              type="button"
              title="Voice search"
              onClick={() => window.dispatchEvent(new CustomEvent(VOICE_OPEN_EVENT))}
              className={`${navRowCls} text-left text-stone-600 hover:bg-stone-100 hover:text-stone-900`}
            >
              <Microphone size={16} className="shrink-0 text-stone-400" aria-hidden />
              <span className={navLabelCls}>Voice search</span>
            </button>
          )}
        </div>
      ))}
      {/* The way out of admin. Without it the only route back is the browser's
          back button or hunting for the Admin toggle you came in by. */}
      {inAdmin && (
        <Link
          href="/dashboard"
          title="Back to your workspace"
          className={`${navRowCls} mt-5 border-t border-stone-200 pt-4 text-stone-600 hover:bg-stone-100 hover:text-stone-900`}
        >
          <ArrowLeft size={16} className="shrink-0 text-stone-400" aria-hidden />
          <span className={navLabelCls}>Back to workspace</span>
        </Link>
      )}
    </nav>
  );
}

export function SettingsNavLink() {
  const pathname = usePathname();
  const active = pathname.startsWith("/dashboard/settings");
  return (
    <Link
      href="/dashboard/settings"
      title="Settings"
      aria-current={active ? "page" : undefined}
      className={`${navRowCls} ${
        active
          ? "bg-brand-50 font-medium text-brand-800"
          : "text-stone-600 hover:bg-stone-100 hover:text-stone-900"
      }`}
    >
      <GearSix
        size={16}
        weight={active ? "fill" : "regular"}
        className={`shrink-0 ${active ? "text-brand-700" : "text-stone-400"}`}
        aria-hidden
      />
      <span className={navLabelCls}>Settings</span>
    </Link>
  );
}

export function ProfileNavLink() {
  const pathname = usePathname();
  const active = pathname.startsWith("/dashboard/profile");
  return (
    <Link
      href="/dashboard/profile"
      title="Profile"
      aria-current={active ? "page" : undefined}
      className={`${navRowCls} ${
        active
          ? "bg-brand-50 font-medium text-brand-800"
          : "text-stone-600 hover:bg-stone-100 hover:text-stone-900"
      }`}
    >
      <UserCircle
        size={16}
        weight={active ? "fill" : "regular"}
        className={`shrink-0 ${active ? "text-brand-700" : "text-stone-400"}`}
        aria-hidden
      />
      <span className={navLabelCls}>Profile</span>
    </Link>
  );
}

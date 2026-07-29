"use client";

import {
  CaretDown,
  Gear,
  MagnifyingGlass,
  Microphone,
  Plus,
  Question,
  SignOut,
  UserCircle,
} from "@phosphor-icons/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { VOICE_OPEN_EVENT } from "@/components/voice-widget";
import { authClient } from "@/lib/auth-client";
import { ADMIN_HOME, isAdminPath } from "@/lib/nav-sections";

/**
 * The bar across the top of every dashboard page.
 *
 * Everything you start an action with lives here — create, search, ask — plus
 * who you're signed in as and the way into admin. Previously these were spread
 * down the left rail with the create button above the nav and the signed-in
 * user at the very bottom, which meant the two things you reach for most were
 * as far apart as the screen allows.
 *
 * A client component for the two dropdowns and the voice trigger; the nav and
 * page content stay server-rendered.
 */
export function TopBar({
  userName,
  userEmail,
  isGuest,
  alerts,
}: {
  userName: string;
  userEmail: string;
  isGuest: boolean;
  /** Anything wanting attention — drives the count on the bell. */
  alerts: number;
}) {
  const pathname = usePathname();
  const [menu, setMenu] = useState<"none" | "create" | "user">("none");
  const rootRef = useRef<HTMLDivElement>(null);
  const inAdmin = isAdminPath(pathname);

  useEffect(() => {
    if (menu === "none") return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setMenu("none");
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [menu]);

  // Close whatever's open when the route changes — a menu that survives a
  // navigation is a menu hanging over the wrong page.
  // biome-ignore lint/correctness/useExhaustiveDependencies: pathname is the trigger
  useEffect(() => setMenu("none"), [pathname]);

  const itemCls =
    "block px-3 py-1.5 text-left text-sm text-stone-700 transition-colors hover:bg-stone-50";

  return (
    <div
      ref={rootRef}
      className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 bg-[var(--topbar)] px-3 text-white sm:gap-3 sm:px-4"
    >
      {!isGuest && (
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => setMenu(menu === "create" ? "none" : "create")}
            aria-expanded={menu === "create"}
            className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-brand-500"
          >
            <Plus size={14} weight="bold" aria-hidden />
            <span className="hidden sm:inline">Create</span>
          </button>
          {menu === "create" && (
            <div className="absolute left-0 z-40 mt-1 flex min-w-44 flex-col rounded-lg border border-stone-200 bg-white py-1 shadow-lg">
              <Link href="/dashboard/transactions/new" className={itemCls}>
                Transaction
              </Link>
              <Link href="/dashboard/contacts/new" className={itemCls}>
                Contact
              </Link>
              <Link href="/dashboard/clients?new=agent" className={itemCls}>
                Client
              </Link>
              <Link href="/dashboard/contacts?view=touch" className={itemCls}>
                Contact note
              </Link>
            </div>
          )}
        </div>
      )}

      {/* Search is a plain GET form so it works before hydration. */}
      <form action="/dashboard/search" className="relative min-w-0 flex-1 sm:max-w-md">
        <MagnifyingGlass
          size={15}
          className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400"
          aria-hidden
        />
        <input
          name="q"
          type="search"
          placeholder="Search transactions, contacts, clients…"
          aria-label="Search"
          className="w-full rounded-lg border border-white/10 bg-white/10 py-1.5 pl-8 pr-3 text-sm text-white placeholder:text-stone-400 focus:border-brand-400 focus:bg-white/15 focus:outline-none"
        />
      </form>

      <button
        type="button"
        title="Voice search"
        onClick={() => window.dispatchEvent(new CustomEvent(VOICE_OPEN_EVENT))}
        className="shrink-0 rounded-lg p-1.5 text-stone-300 transition-colors hover:bg-white/10 hover:text-white"
      >
        <Microphone size={17} weight="fill" aria-hidden />
        <span className="sr-only">Voice search</span>
      </button>

      {/* The right-hand cluster. ml-auto anchors it to the window edge, so on a
          wide monitor these sit where the eye expects them rather than
          trailing whatever width the search box happened to stop at. */}
      <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3">
        <Link
          href="/dashboard?alerts=1"
          title={`${alerts} needing attention`}
          className="relative shrink-0 rounded-lg p-1.5 text-stone-300 transition-colors hover:bg-white/10 hover:text-white"
        >
          <span aria-hidden className="text-base leading-none">
            🔔
          </span>
          <span className="sr-only">{alerts} needing attention</span>
          {alerts > 0 && (
            <span className="absolute -right-0.5 -top-0.5 min-w-4 rounded-full bg-brand-500 px-1 text-[10px] font-semibold leading-4 text-white">
              {alerts > 99 ? "99+" : alerts}
            </span>
          )}
        </Link>

        {!isGuest && (
          <Link
            href={inAdmin ? "/dashboard" : ADMIN_HOME}
            title={inAdmin ? "Back to your workspace" : "Workspace admin"}
            className={`hidden shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm transition-colors sm:flex ${
              inAdmin
                ? "bg-white/15 text-white"
                : "text-stone-300 hover:bg-white/10 hover:text-white"
            }`}
          >
            <Gear size={15} weight="fill" aria-hidden />
            Admin
          </Link>
        )}

        {/* The help sign: one place that always leads to "something's wrong". */}
        <Link
          href="/dashboard/support"
          title="Help &amp; report an issue"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sky-600 text-white transition-colors hover:bg-sky-500"
        >
          <Question size={15} weight="bold" aria-hidden />
          <span className="sr-only">Help and report an issue</span>
        </Link>

        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => setMenu(menu === "user" ? "none" : "user")}
            aria-expanded={menu === "user"}
            className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-stone-200 transition-colors hover:bg-white/10 hover:text-white"
          >
            <UserCircle size={18} weight="fill" aria-hidden />
            <span className="hidden max-w-28 truncate sm:inline">{userName}</span>
            <CaretDown size={11} weight="bold" aria-hidden />
          </button>
          {menu === "user" && (
            <div className="absolute right-0 z-40 mt-1 flex min-w-52 flex-col rounded-lg border border-stone-200 bg-white py-1 shadow-lg">
              <p className="truncate border-b border-stone-100 px-3 pb-2 pt-1 text-xs text-stone-400">
                {userEmail}
              </p>
              <Link href="/dashboard/profile" className={itemCls}>
                Profile
              </Link>
              <button
                type="button"
                onClick={async () => {
                  setMenu("none");
                  await authClient.signOut();
                  window.location.href = "/";
                }}
                className={`${itemCls} flex items-center gap-2`}
              >
                <SignOut size={14} aria-hidden />
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

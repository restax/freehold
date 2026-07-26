"use client";

import { SignOut } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export function SignOutButton({
  /**
   * Sidebar use: below lg the sidebar is a 56px icon rail where "Sign out"
   * wraps to two lines, so show the icon alone there and the words at lg+.
   */
  collapsible = false,
}: {
  collapsible?: boolean;
} = {}) {
  const router = useRouter();
  const signOut = async () => {
    await authClient.signOut();
    router.push("/");
    router.refresh();
  };

  if (!collapsible) {
    return (
      <button
        type="button"
        onClick={signOut}
        className="text-sm text-stone-500 hover:text-stone-800"
      >
        Sign out
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={signOut}
      title="Sign out"
      className="flex items-center justify-center gap-2 rounded-lg px-2.5 py-1.5 text-sm text-stone-500 transition-colors hover:bg-stone-100 hover:text-stone-800 lg:px-0 lg:py-0 lg:hover:bg-transparent"
    >
      <SignOut size={16} className="shrink-0 lg:hidden" aria-hidden />
      <span className="hidden lg:inline">Sign out</span>
    </button>
  );
}

"use client";

import { CaretDown } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import { PendingButton } from "@/components/pending-button";
import { btn, input, label } from "@/lib/ui";

const ROLES = ["admin", "member"] as const;

/**
 * The one way onto the team, split into the two ways a person actually joins:
 * added directly by an admin (no email round-trip needed to start working),
 * or invited to accept on their own. A dropdown rather than two buttons
 * because both are rare enough that neither deserves permanent screen space.
 */
export function TeamNewMenu({
  addAction,
  inviteAction,
  seatsLimited,
}: {
  addAction: (formData: FormData) => void;
  inviteAction: (formData: FormData) => void;
  seatsLimited: boolean;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [mode, setMode] = useState<"none" | "add" | "invite">("none");
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [menuOpen]);

  return (
    <div ref={rootRef} className="flex flex-col items-end gap-2">
      <div className="relative">
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          aria-expanded={menuOpen}
          disabled={seatsLimited}
          className={`${btn} flex items-center gap-1.5`}
        >
          + New
          <CaretDown size={11} weight="bold" aria-hidden />
        </button>
        {menuOpen && (
          <div className="absolute right-0 z-20 mt-1 flex min-w-40 flex-col rounded-lg border border-stone-200 bg-white py-1 shadow-lg">
            <button
              type="button"
              onClick={() => {
                setMode("add");
                setMenuOpen(false);
              }}
              className="px-3 py-1.5 text-left text-sm text-stone-700 hover:bg-stone-50"
            >
              Add User
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("invite");
                setMenuOpen(false);
              }}
              className="px-3 py-1.5 text-left text-sm text-stone-700 hover:bg-stone-50"
            >
              Invite User
            </button>
          </div>
        )}
      </div>

      {mode === "add" && (
        <form
          action={addAction}
          className="flex w-full max-w-2xl flex-wrap items-end gap-3 rounded-lg border border-stone-200 bg-white p-3 shadow-xs"
        >
          <p className="w-full text-xs text-stone-500">
            Creates the account directly — they can sign in right away once you send them the "set
            your password" email below.
          </p>
          <label className={label}>
            Name
            <input name="name" className={input} placeholder="Jamie Rivera" />
          </label>
          <label className={label}>
            Email *
            <input name="email" type="email" required className={input} />
          </label>
          <label className={label}>
            Role
            <select name="role" className={input} defaultValue="member">
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </label>
          <PendingButton pendingLabel="Adding…" className={btn}>
            Add user
          </PendingButton>
          <button
            type="button"
            onClick={() => setMode("none")}
            className="text-xs text-stone-400 hover:text-stone-600"
          >
            Cancel
          </button>
        </form>
      )}

      {mode === "invite" && (
        <form
          action={inviteAction}
          className="flex w-full max-w-2xl flex-wrap items-end gap-3 rounded-lg border border-stone-200 bg-white p-3 shadow-xs"
        >
          <label className={label}>
            Email *
            <input name="email" type="email" required className={input} />
          </label>
          <label className={label}>
            Role
            <select name="role" className={input} defaultValue="member">
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </label>
          <PendingButton pendingLabel="Sending…" className={btn}>
            Send invitation
          </PendingButton>
          <button
            type="button"
            onClick={() => setMode("none")}
            className="text-xs text-stone-400 hover:text-stone-600"
          >
            Cancel
          </button>
        </form>
      )}
    </div>
  );
}

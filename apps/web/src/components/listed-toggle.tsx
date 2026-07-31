"use client";

import { useFormStatus } from "react-dom";

/**
 * The listed / not listed switch for the workspace's directory entry.
 *
 * A real switch rather than a checkbox buried in the profile form: whether
 * your workspace is publicly findable is the one setting on this page worth
 * being able to read at a glance, and it takes effect on its own rather
 * than waiting for a Save somewhere below it.
 *
 * Renders as a submit button that posts the *opposite* of the current state,
 * so it works with no client state at all — the server is the only place
 * that decides what "listed" means.
 */
export function ListedToggle({ listed }: { listed: boolean }) {
  const { pending } = useFormStatus();

  return (
    <div className="flex items-center gap-3">
      <input type="hidden" name="listed" value={listed ? "off" : "on"} />
      <button
        type="submit"
        role="switch"
        aria-checked={listed}
        aria-label={listed ? "Listed in the directory" : "Not listed in the directory"}
        disabled={pending}
        className={`relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-60 ${
          listed ? "bg-brand-600" : "bg-stone-300"
        }`}
      >
        <span
          aria-hidden
          className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
            listed ? "translate-x-6" : "translate-x-1"
          }`}
        />
      </button>
      <span className="flex flex-col">
        <span
          className={`text-sm font-semibold ${listed ? "text-brand-700" : "text-stone-500"}`}
          aria-hidden
        >
          {pending ? "Saving…" : listed ? "Listed" : "Not listed"}
        </span>
        <span className="text-xs text-stone-400">
          {listed
            ? "Other coordinators can find this workspace."
            : "Nobody can find this workspace in the directory."}
        </span>
      </span>
    </div>
  );
}

/**
 * "Don't remind me again" — offered only while unlisted, since that's the
 * only state the reminder fires in. Unchecked on every new workspace: not
 * being nagged is a choice an admin makes, never one they inherit.
 */
export function ReminderOptOut({
  action,
  defaultChecked,
}: {
  action: (formData: FormData) => Promise<void>;
  defaultChecked: boolean;
}) {
  return (
    <form action={action}>
      <label className="flex items-center gap-1.5 text-xs text-stone-500">
        <input
          type="checkbox"
          name="remindersOff"
          defaultChecked={defaultChecked}
          onChange={(e) => e.currentTarget.form?.requestSubmit()}
          className="accent-brand-600"
        />
        Don't remind me to list this workspace
      </label>
    </form>
  );
}

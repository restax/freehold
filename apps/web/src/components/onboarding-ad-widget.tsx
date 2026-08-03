"use client";

import { X } from "@phosphor-icons/react";
import { useState } from "react";
import { dismissOnboardingAd } from "@/lib/actions/onboarding-ad";

/**
 * The "call your rep" ad in the nav footer. Server-decided whether to mount
 * at all (see onboardingAdDue in layout.tsx) — this component only owns the
 * X button's optimistic hide, not the due/hide decision itself.
 */
export function OnboardingAdWidget({ phone }: { phone: string }) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  return (
    <div className="relative rounded-lg border border-stone-200 bg-white p-2.5 pr-7 text-xs">
      <button
        type="button"
        onClick={() => {
          setDismissed(true);
          dismissOnboardingAd();
        }}
        aria-label="Dismiss"
        className="absolute right-1.5 top-1.5 rounded-md p-1 text-stone-400 transition hover:bg-stone-100 hover:text-stone-600"
      >
        <X size={12} weight="bold" />
      </button>
      <p className="font-medium text-stone-700">Free onboarding help</p>
      <p className="mt-0.5 text-stone-500">
        Call{" "}
        <a href={`tel:${phone}`} className="font-medium text-brand-700 hover:underline">
          {phone}
        </a>{" "}
        anytime in your first 30 days.
      </p>
    </div>
  );
}

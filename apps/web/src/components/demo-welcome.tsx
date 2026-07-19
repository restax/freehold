"use client";

import { X } from "@phosphor-icons/react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

/**
 * First-visit experience for the live demo: a welcome dialog (with the
 * option to decline) and a spotlight product tour that walks the sidebar.
 * Always mounted on the dashboard; activates when the page arrives with
 * ?welcome=demo, then immediately cleans the URL so later router
 * canonicalization can't unmount it mid-tour.
 */

interface TourStep {
  selector: string;
  title: string;
  body: string;
}

const TOUR: TourStep[] = [
  {
    selector: 'a[href="/dashboard/transactions"]',
    title: "Transactions",
    body: "Every file you're working — status, deadlines, parties, documents, and emails in one place. Open one to see the whole story.",
  },
  {
    selector: 'a[href="/dashboard/action-plans"]',
    title: "Action plans",
    body: "Apply a checklist to any file and every deadline becomes a dated task, computed from the contract and close dates.",
  },
  {
    selector: 'a[href="/dashboard/emails"]',
    title: "Email templates",
    body: "A full email studio: starter templates with merge fields, automated sends, quiet hours, even voice dictation.",
  },
  {
    selector: 'a[href="/dashboard/clients"]',
    title: "Clients & portals",
    body: "The agents you serve, each with a branded portal you can share by private link — they see progress, you stay in control.",
  },
  {
    selector: 'a[href="/dashboard/vault"]',
    title: "Credential vault",
    body: "MLS and lender logins stored envelope-encrypted, revealed only on click, with every reveal audited.",
  },
  {
    selector: 'a[href="/dashboard/website"]',
    title: "Your own website",
    body: "Every workspace gets a promotional site on its own subdomain, with client intake forms built in.",
  },
];

function firstVisibleRect(selector: string): DOMRect | null {
  for (const el of document.querySelectorAll(selector)) {
    if (!(el instanceof HTMLElement) || el.offsetParent === null) continue;
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) return r;
  }
  return null;
}

function targetRect(selector: string): DOMRect | null {
  // The sidebar nav is the tour surface; scope there first so same-href
  // links elsewhere (like the + Create menu) can't steal the spotlight.
  return firstVisibleRect(`nav ${selector}`) ?? firstVisibleRect(selector);
}

export function DemoWelcome() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [phase, setPhase] = useState<"idle" | "welcome" | "tour" | "done">("idle");
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    if (phase === "idle" && searchParams.get("welcome") === "demo") {
      setPhase("welcome");
      router.replace("/dashboard", { scroll: false });
    }
  }, [phase, searchParams, router]);

  const close = useCallback(() => {
    setPhase("done");
  }, []);

  // Track the highlighted element through resizes while the tour runs.
  useEffect(() => {
    if (phase !== "tour") return;
    const update = () => setRect(targetRect(TOUR[step].selector));
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [phase, step]);

  useEffect(() => {
    if (phase === "done" || phase === "idle") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, close]);

  if (phase === "done" || phase === "idle") return null;

  if (phase === "welcome") {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <button
          type="button"
          aria-label="Close"
          onClick={close}
          className="absolute inset-0 cursor-default bg-stone-900/50"
        />
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="demo-welcome-title"
          className="relative w-full max-w-md overflow-hidden rounded-2xl bg-white text-left shadow-xl"
        >
          <Image
            src="/marketing/demo-welcome.jpg"
            alt="A house key resting on signed closing documents"
            width={896}
            height={504}
            priority
            className="h-40 w-full object-cover"
          />
          <button
            type="button"
            aria-label="Close"
            onClick={close}
            className="absolute right-3 top-3 rounded-md bg-white/85 p-1.5 text-stone-500 shadow-xs transition hover:bg-white hover:text-stone-700"
          >
            <X size={16} weight="bold" />
          </button>
          <div className="p-6">
            <h2 id="demo-welcome-title" className="font-display text-xl font-bold text-stone-900">
              Welcome to the live demo
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-stone-600">
              This is a sample workspace that resets itself — feel free to click around, open
              things, and explore everything.
            </p>
            <div className="mt-5 flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setStep(0);
                  setPhase("tour");
                }}
                className="rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand-700 active:scale-[0.98]"
              >
                Show me around
              </button>
              <button
                type="button"
                onClick={close}
                className="rounded-lg px-3 py-2.5 text-sm font-medium text-stone-500 transition hover:text-stone-700"
              >
                Explore on my own
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Tour phase. If the target can't be found (e.g. collapsed nav), end gracefully.
  if (!rect) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/50 p-4">
        <div className="rounded-2xl bg-white p-6 text-center shadow-xl">
          <p className="text-sm text-stone-600">The tour needs a bigger screen — explore freely!</p>
          <button
            type="button"
            onClick={close}
            className="mt-4 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700"
          >
            Got it
          </button>
        </div>
      </div>
    );
  }

  const pad = 6;
  const cardTop = Math.max(16, Math.min(rect.top - 12, window.innerHeight - 240));
  const cardLeft = Math.min(rect.right + 24, window.innerWidth - 320 - 16);
  const last = step === TOUR.length - 1;

  return (
    <div className="fixed inset-0 z-50">
      {/* Spotlight: the hole is the highlighted element; everything else dims. */}
      <div
        className="absolute rounded-xl transition-all duration-300 ease-out"
        style={{
          top: rect.top - pad,
          left: rect.left - pad,
          width: rect.width + pad * 2,
          height: rect.height + pad * 2,
          boxShadow: "0 0 0 9999px rgba(28, 25, 23, 0.55)",
        }}
      />
      <div
        className="absolute animate-pulse rounded-xl border-2 border-brand-400 transition-all duration-300 ease-out"
        style={{
          top: rect.top - pad,
          left: rect.left - pad,
          width: rect.width + pad * 2,
          height: rect.height + pad * 2,
        }}
      />
      <div
        className="absolute w-80 rounded-2xl bg-white p-5 shadow-xl transition-all duration-300 ease-out"
        style={{ top: cardTop, left: cardLeft }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-step-title"
      >
        {/* Arrow pointing at the highlighted element */}
        <div
          className="absolute -left-1.5 top-6 h-3 w-3 rotate-45 bg-white"
          aria-hidden
          style={{ boxShadow: "-2px 2px 3px rgba(28,25,23,0.06)" }}
        />
        <p className="text-xs font-medium uppercase tracking-wide text-brand-700">
          {step + 1} of {TOUR.length}
        </p>
        <h3 id="tour-step-title" className="mt-1 font-display text-base font-bold text-stone-900">
          {TOUR[step].title}
        </h3>
        <p className="mt-1.5 text-sm leading-relaxed text-stone-600">{TOUR[step].body}</p>
        <div className="mt-4 flex items-center gap-2">
          <button
            type="button"
            onClick={() => (last ? close() : setStep(step + 1))}
            className="rounded-lg bg-brand-600 px-3.5 py-2 text-sm font-medium text-white transition hover:bg-brand-700 active:scale-[0.98]"
          >
            {last ? "Done — explore freely" : "Next"}
          </button>
          {step > 0 && (
            <button
              type="button"
              onClick={() => setStep(step - 1)}
              className="rounded-lg border border-stone-300 px-3.5 py-2 text-sm font-medium text-stone-600 transition hover:border-stone-400"
            >
              Back
            </button>
          )}
          <button
            type="button"
            onClick={close}
            className="ml-auto text-xs font-medium text-stone-400 transition hover:text-stone-600"
          >
            Skip tour
          </button>
        </div>
      </div>
    </div>
  );
}

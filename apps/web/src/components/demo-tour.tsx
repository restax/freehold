"use client";

import {
  CaretLeft,
  CaretRight,
  ListBullets,
  Pause,
  Play,
  SpeakerHigh,
  SpeakerSlash,
  X,
} from "@phosphor-icons/react";
import Image from "next/image";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  chapterStartIndex,
  FIRST_TRANSACTION,
  TOUR_CHAPTERS,
  TOUR_STOPS,
  type TourStop,
} from "@/lib/demo-tour";

/**
 * The narrated tour of the live demo.
 *
 * Mounted in the dashboard *layout*, not a page, which is load-bearing: the
 * tour walks across a dozen routes, and a component mounted on a page would
 * unmount on the first navigation, taking the audio element and the playback
 * position with it. The layout survives navigation between /dashboard/*, so
 * the same <audio> keeps playing while the page underneath changes.
 *
 * Audio is pre-generated (see scripts/generate-tour-audio.mjs) and served as
 * static files. The demo is public and unauthenticated, so calling a
 * text-to-speech vendor per visitor would put a metered spend on an open
 * endpoint; the same reasoning that put a rate limit on the homepage voice
 * demo applies here, only more so, because this is thirty clips per visit.
 *
 * Everything is captioned on screen as well as spoken, so the tour works
 * muted, works before the first click (browsers refuse autoplay until then),
 * and works for anyone who cannot hear it.
 */

const STORAGE_KEY = "freehold.demo-tour";
/** Rough speaking pace, for advancing when there is no audio to wait on. */
const WORDS_PER_SECOND = 2.6;
/** How long to wait for a stop's target to appear before giving up on it. */
const TARGET_TIMEOUT_MS = 4000;

type Phase = "welcome" | "running" | "done";

interface Saved {
  phase: Phase;
  index: number;
  muted: boolean;
  /** The sample transaction the tour opened, resolved once and reused. */
  txnHref?: string;
}

function load(): Saved | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Saved) : null;
  } catch {
    return null;
  }
}

function save(s: Saved) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    // Private mode with storage disabled: the tour still runs, it just
    // cannot be resumed after a reload. Not worth failing over.
  }
}

function clear() {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* see save() */
  }
}

/** First visible match, skipping hidden duplicates (collapsed nav, print-only). */
function visibleTarget(selector: string): HTMLElement | null {
  for (const el of document.querySelectorAll(selector)) {
    if (!(el instanceof HTMLElement) || el.offsetParent === null) continue;
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) return el;
  }
  return null;
}

/**
 * Poll until one of these anchors shows up, taking the earliest in the list
 * that is on screen. Priority matters: a stop names its ideal target first and
 * a guaranteed-present fallback last, so a conditionally rendered panel that
 * happens to be absent degrades to lighting something rather than nothing.
 */
function awaitTarget(anchors: string[], signal: AbortSignal): Promise<HTMLElement | null> {
  return awaitAny(
    anchors.map((a) => `[data-tour="${a}"]`),
    signal,
  );
}

/** The same wait, for a plain CSS selector rather than a tour anchor. */
function awaitAny(selectors: string[], signal: AbortSignal): Promise<HTMLElement | null> {
  return new Promise((resolve) => {
    const started = Date.now();
    const tick = () => {
      if (signal.aborted) return resolve(null);
      for (const sel of selectors) {
        const el = visibleTarget(sel);
        if (el) return resolve(el);
      }
      if (Date.now() - started > TARGET_TIMEOUT_MS) return resolve(null);
      requestAnimationFrame(tick);
    };
    tick();
  });
}

/** The sample transaction to open, read off the list the tour is standing on. */
function findTransactionHref(): string | null {
  for (const el of document.querySelectorAll('a[href^="/dashboard/transactions/"]')) {
    const href = el.getAttribute("href");
    if (href && href !== "/dashboard/transactions/new" && !href.includes("/extractions/")) {
      return href;
    }
  }
  return null;
}

export function DemoTour() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [phase, setPhase] = useState<Phase | null>(null);
  const [index, setIndex] = useState(0);
  const [muted, setMuted] = useState(false);
  const [paused, setPaused] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const txnHref = useRef<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<number | null>(null);

  const stop: TourStop | undefined = TOUR_STOPS[index];
  const chapter = TOUR_CHAPTERS.find((c) => c.id === stop?.chapter);

  // Boot: either the demo hand-off (?welcome=demo) or a tour already running
  // that survived a reload. The parameter is cleaned immediately so a later
  // router canonicalisation cannot restart the tour underneath itself.
  useEffect(() => {
    if (phase !== null) return;
    const saved = load();
    if (saved && saved.phase !== "done") {
      txnHref.current = saved.txnHref ?? null;
      setIndex(saved.index);
      setMuted(saved.muted);
      setPhase(saved.phase);
      return;
    }
    if (searchParams.get("welcome") === "demo") {
      setPhase("welcome");
      router.replace(pathname, { scroll: false });
      return;
    }
    setPhase("done");
  }, [phase, searchParams, router, pathname]);

  useEffect(() => {
    if (phase === null || phase === "done") return;
    save({ phase, index, muted, txnHref: txnHref.current ?? undefined });
  }, [phase, index, muted]);

  const finish = useCallback(() => {
    audioRef.current?.pause();
    if (timerRef.current) window.clearTimeout(timerRef.current);
    clear();
    setPhase("done");
    setRect(null);
  }, []);

  const go = useCallback((next: number) => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    audioRef.current?.pause();
    setRect(null);
    setPaused(false);
    setIndex(next);
  }, []);

  const advance = useCallback(() => {
    if (index >= TOUR_STOPS.length - 1) finish();
    else go(index + 1);
  }, [index, finish, go]);

  // Held in a ref so the navigation effect below can call it without taking
  // it as a dependency. It changes identity on every stop, and an effect that
  // re-ran on that would restart the clip it is in the middle of playing.
  const advanceRef = useRef(advance);
  advanceRef.current = advance;

  // Navigation and spotlight. Deliberately does not touch audio: this effect
  // re-runs on every pathname change it causes, and anything it did to the
  // <audio> element would interrupt a clip already mid-sentence.
  useEffect(() => {
    if (phase !== "running" || !stop) return;
    const ac = new AbortController();

    (async () => {
      // The transaction stops need an id that only exists in the reseeded
      // sample data, so the tour reads one off the list rather than
      // hardcoding something that will rot.
      let want = stop.route;
      if (want.startsWith(FIRST_TRANSACTION)) {
        const suffix = want.slice(FIRST_TRANSACTION.length);
        if (!txnHref.current) {
          if (pathname !== "/dashboard/transactions") {
            router.push("/dashboard/transactions");
            return;
          }
          await awaitAny(['a[href^="/dashboard/transactions/"]'], ac.signal);
          if (ac.signal.aborted) return;
          txnHref.current = findTransactionHref();
          if (!txnHref.current) return advanceRef.current(); // no sample data
        }
        want = txnHref.current + suffix;
      }
      // Compare paths only: the tab lives in the query, which usePathname drops.
      if (pathname !== want.split("?")[0]) {
        router.push(want);
        return;
      }

      const el = await awaitTarget(stop.anchors, ac.signal);
      if (ac.signal.aborted || !el) return;
      el.scrollIntoView({ block: "center", behavior: "smooth" });
      // Let the smooth scroll settle before measuring, or the spotlight lands
      // where the element used to be.
      await new Promise((r) => setTimeout(r, 350));
      if (ac.signal.aborted) return;
      setRect(el.getBoundingClientRect());
    })();

    return () => ac.abort();
  }, [phase, stop, pathname, router]);

  // Narration. Keyed on the stop's identity rather than on anything that
  // changes during a stop, and it re-points the element only when the clip
  // actually differs, so a re-render mid-sentence is a no-op. Audio drives
  // the pacing when it plays; a reading timer does when it cannot (muted,
  // autoplay blocked, or the clip missing).
  useEffect(() => {
    if (phase !== "running" || !stop) return;
    const audio = audioRef.current;
    const want = `/tour/${stop.id}.mp3`;
    let cancelled = false;

    if (audio && !muted) {
      if (!audio.src.endsWith(want)) audio.src = want;
      audio.play().catch(() => {
        // Autoplay refused or the file is missing: fall back to reading time.
        if (cancelled) return;
        const words = stop.narration.split(/\s+/).length;
        timerRef.current = window.setTimeout(
          () => advanceRef.current(),
          (words / WORDS_PER_SECOND) * 1000 + 1200,
        );
      });
    } else {
      const words = stop.narration.split(/\s+/).length;
      timerRef.current = window.setTimeout(
        () => advanceRef.current(),
        (words / WORDS_PER_SECOND) * 1000 + 1200,
      );
    }

    return () => {
      cancelled = true;
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [phase, stop, muted]);

  // Keep the spotlight on the target through scrolling and resizing.
  useEffect(() => {
    if (phase !== "running" || !stop) return;
    const update = () => {
      for (const a of stop.anchors) {
        const el = visibleTarget(`[data-tour="${a}"]`);
        if (el) return setRect(el.getBoundingClientRect());
      }
    };
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [phase, stop]);

  useEffect(() => {
    if (phase === null || phase === "done") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, finish]);

  const togglePause = useCallback(() => {
    const audio = audioRef.current;
    if (paused) {
      setPaused(false);
      if (audio && !muted && audio.src) void audio.play().catch(() => {});
    } else {
      setPaused(true);
      audio?.pause();
      if (timerRef.current) window.clearTimeout(timerRef.current);
    }
  }, [paused, muted]);

  if (phase === null || phase === "done") {
    // biome-ignore lint/a11y/useMediaCaption: narration is captioned on screen in the tour bar, which is the same text this element speaks
    return <audio ref={audioRef} className="hidden" aria-hidden preload="none" />;
  }

  if (phase === "welcome") {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* biome-ignore lint/a11y/useMediaCaption: narration is captioned on screen in the tour bar */}
        <audio ref={audioRef} className="hidden" aria-hidden preload="none" />
        <button
          type="button"
          aria-label="Close"
          onClick={finish}
          className="absolute inset-0 cursor-default bg-stone-900/50"
        />
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="demo-welcome-title"
          className="relative w-full max-w-md overflow-hidden rounded-xl bg-white text-left shadow-xl"
        >
          <Image
            src="/marketing/demo-welcome.jpg"
            alt="A house key resting on signed closing documents"
            width={896}
            height={504}
            priority
            className="h-36 w-full object-cover"
          />
          <button
            type="button"
            aria-label="Close"
            onClick={finish}
            className="absolute right-3 top-3 rounded-md bg-white/85 p-1.5 text-stone-500 shadow-xs transition hover:bg-white hover:text-stone-700"
          >
            <X size={16} weight="bold" />
          </button>
          <div className="p-6">
            <h2 id="demo-welcome-title" className="font-display text-xl font-bold text-stone-900">
              Welcome to the live demo
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-stone-600">
              This is a real workspace with sample data, and it resets itself. Nothing you click can
              break anything.
            </p>
            <div className="mt-4 rounded-lg border border-brand-600/20 bg-brand-50/60 p-3">
              <p className="text-sm font-medium text-stone-900">
                Take the guided tour. It is worth it.
              </p>
              <p className="mt-1 text-sm leading-relaxed text-stone-600">
                Seven minutes, narrated, and it opens everything: a closing end to end, e-signing,
                client portals, your own website, and what it costs. Turn your sound on.
              </p>
            </div>
            <div className="mt-5 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => {
                  setIndex(0);
                  setPhase("running");
                }}
                className="rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand-700 active:scale-[0.98]"
              >
                Start the tour with sound
              </button>
              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setMuted(true);
                    setIndex(0);
                    setPhase("running");
                  }}
                  className="rounded-lg px-3 py-2 text-sm font-medium text-stone-600 transition hover:text-stone-900"
                >
                  Take it without sound
                </button>
                <button
                  type="button"
                  onClick={finish}
                  className="rounded-lg px-3 py-2 text-sm font-medium text-stone-400 transition hover:text-stone-600"
                >
                  Explore on my own
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const pad = 6;
  const first = index === 0;
  const last = index === TOUR_STOPS.length - 1;

  return (
    <>
      {/* biome-ignore lint/a11y/useMediaCaption: the caption is rendered on screen below, this element carries only the narration of that same text */}
      <audio
        ref={audioRef}
        className="hidden"
        aria-hidden
        preload="auto"
        onEnded={advance}
        onError={() => {
          // A missing clip must not stall the tour: fall back to reading time.
          if (timerRef.current) window.clearTimeout(timerRef.current);
          const words = stop?.narration.split(/\s+/).length ?? 20;
          timerRef.current = window.setTimeout(advance, (words / WORDS_PER_SECOND) * 1000 + 1200);
        }}
      />

      {/* Spotlight. With no target the whole screen dims and the caption
          carries the stop on its own, which is what the page-level stops want. */}
      <div className="pointer-events-none fixed inset-0 z-40" aria-hidden>
        {rect ? (
          <>
            <div
              className="absolute rounded-xl transition-all duration-300 ease-out motion-reduce:transition-none"
              style={{
                top: rect.top - pad,
                left: rect.left - pad,
                width: rect.width + pad * 2,
                height: rect.height + pad * 2,
                boxShadow: "0 0 0 9999px rgba(28, 25, 23, 0.55)",
              }}
            />
            <div
              className="absolute rounded-xl border-2 border-brand-400 transition-all duration-300 ease-out motion-reduce:transition-none"
              style={{
                top: rect.top - pad,
                left: rect.left - pad,
                width: rect.width + pad * 2,
                height: rect.height + pad * 2,
              }}
            />
          </>
        ) : (
          <div className="absolute inset-0 bg-stone-900/55" />
        )}
      </div>

      {/* Caption and controls: one fixed bar, so it never fights the spotlight
          for space and never lands off screen on a small window. */}
      <div className="fixed inset-x-0 bottom-0 z-[60] p-3 pr-20 sm:p-4 sm:pr-24">
        <div className="mx-auto max-w-3xl rounded-xl bg-white p-4 shadow-[0_-4px_24px_rgba(28,25,23,0.18)]">
          {menuOpen ? (
            <div>
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-stone-900">Jump to a chapter</p>
                <button
                  type="button"
                  onClick={() => setMenuOpen(false)}
                  className="rounded-md p-1 text-stone-400 transition hover:text-stone-700"
                  aria-label="Close the chapter list"
                >
                  <X size={16} weight="bold" />
                </button>
              </div>
              <ul className="mt-2 flex flex-col divide-y divide-stone-100">
                {TOUR_CHAPTERS.map((c) => {
                  const at = chapterStartIndex(c.id);
                  return (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setMenuOpen(false);
                          go(at);
                        }}
                        className={`flex w-full items-center gap-3 py-2.5 text-left transition hover:text-brand-700 ${
                          c.id === chapter?.id ? "text-brand-700" : "text-stone-700"
                        }`}
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-medium">{c.title}</span>
                          <span className="block text-xs leading-snug text-stone-500">
                            {c.blurb}
                          </span>
                        </span>
                        <CaretRight size={14} weight="bold" aria-hidden className="shrink-0" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : (
            <>
              <div className="flex items-baseline justify-between gap-4">
                <p className="text-xs font-medium uppercase tracking-wide text-brand-700">
                  {chapter?.title}
                </p>
                <p className="shrink-0 text-xs tabular-nums text-stone-400">
                  {index + 1} of {TOUR_STOPS.length}
                </p>
              </div>
              <h3 className="mt-1 font-display text-base font-bold text-stone-900">
                {stop?.title}
              </h3>
              <p className="mt-1 text-sm leading-relaxed text-stone-600">{stop?.narration}</p>
              <div className="mt-3 h-1 overflow-hidden rounded-full bg-stone-100">
                <div
                  className="h-full rounded-full bg-brand-600 transition-all duration-500 motion-reduce:transition-none"
                  style={{ width: `${((index + 1) / TOUR_STOPS.length) * 100}%` }}
                />
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={togglePause}
                  className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-brand-700 active:scale-[0.98]"
                >
                  <span className="flex items-center gap-1.5">
                    {paused ? (
                      <Play size={14} weight="fill" aria-hidden />
                    ) : (
                      <Pause size={14} weight="fill" aria-hidden />
                    )}
                    {paused ? "Resume" : "Pause"}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => !first && go(index - 1)}
                  disabled={first}
                  className="rounded-lg border border-stone-300 p-2 text-stone-600 transition hover:border-stone-400 disabled:opacity-40"
                  aria-label="Previous"
                >
                  <CaretLeft size={14} weight="bold" aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={advance}
                  className="rounded-lg border border-stone-300 p-2 text-stone-600 transition hover:border-stone-400"
                  aria-label={last ? "Finish" : "Next"}
                >
                  <CaretRight size={14} weight="bold" aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const next = !muted;
                    setMuted(next);
                    if (next) audioRef.current?.pause();
                  }}
                  className="rounded-lg border border-stone-300 p-2 text-stone-600 transition hover:border-stone-400"
                  aria-label={muted ? "Turn sound on" : "Turn sound off"}
                >
                  {muted ? (
                    <SpeakerSlash size={14} weight="bold" aria-hidden />
                  ) : (
                    <SpeakerHigh size={14} weight="bold" aria-hidden />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setMenuOpen(true)}
                  className="flex items-center gap-1.5 rounded-lg border border-stone-300 px-3 py-2 text-sm font-medium text-stone-600 transition hover:border-stone-400"
                >
                  <ListBullets size={14} weight="bold" aria-hidden />
                  Chapters
                </button>
                <button
                  type="button"
                  onClick={finish}
                  className="ml-auto rounded-lg px-3 py-2 text-sm font-medium text-stone-400 transition hover:text-stone-700"
                >
                  End tour
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

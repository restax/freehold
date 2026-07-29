"use client";

import { Microphone } from "@phosphor-icons/react";
import { VOICE_OPEN_EVENT } from "@/components/voice-widget";

/**
 * Voice search, offered where someone is already searching.
 *
 * It opens the same panel the floating button and the sidebar entry open —
 * one feature with three doors, not three implementations. Worth a door here
 * because the questions people ask out loud ("who haven't I called since the
 * spring?") are exactly the ones the filter boxes make you assemble by hand.
 */
export function VoiceSearchBox() {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new CustomEvent(VOICE_OPEN_EVENT))}
      className="flex w-full items-center gap-2 rounded-lg border border-stone-200 bg-white px-3 py-2 text-left text-sm text-stone-500 transition-colors hover:border-brand-400 hover:text-stone-700"
    >
      <Microphone size={15} weight="fill" className="shrink-0 text-brand-600" aria-hidden />
      <span className="min-w-0 flex-1 truncate">Ask instead of filtering…</span>
    </button>
  );
}

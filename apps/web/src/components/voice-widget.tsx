"use client";

import { Microphone, X } from "@phosphor-icons/react";
import {
  type Participant,
  Room,
  RoomEvent,
  Track,
  type TranscriptionSegment,
} from "livekit-client";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Voice search: hold a conversation with Claude about this workspace's data.
 *
 * The browser only ever joins a LiveKit room — it never talks to Deepgram,
 * Anthropic, or ElevenLabs directly, and never sees an API key. The agent
 * worker does the pipeline; the app decides what that agent may read.
 *
 * `portalToken` switches this to the portal flavour: a client or agent asking
 * about their own file, scoped by their capability link.
 */

/** Dispatched by the sidebar menu item to pop this panel open. */
export const VOICE_OPEN_EVENT = "freehold:voice-open";

type State = "idle" | "connecting" | "live" | "upgrade" | "unavailable" | "error";

interface Line {
  id: string;
  who: "you" | "assistant";
  text: string;
}

export function VoiceWidget({ portalToken }: { portalToken?: string }) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<State>("idle");
  const [lines, setLines] = useState<Line[]>([]);
  const [note, setNote] = useState<string | null>(null);
  const roomRef = useRef<Room | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const hangUp = useCallback(async () => {
    await roomRef.current?.disconnect();
    roomRef.current = null;
    setState("idle");
  }, []);

  // Never leave a room (or a mic) open behind us.
  useEffect(() => () => void roomRef.current?.disconnect(), []);

  // The sidebar's "Voice search" item opens this same panel — one feature,
  // reachable from the menu as well as the button.
  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener(VOICE_OPEN_EVENT, onOpen);
    return () => window.removeEventListener(VOICE_OPEN_EVENT, onOpen);
  }, []);

  async function start() {
    setState("connecting");
    setLines([]);
    setNote(null);
    try {
      const res = await fetch("/api/voice/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(portalToken ? { portalToken } : {}),
      });

      if (res.status === 402) {
        const body = (await res.json()) as { used?: number; limit?: number };
        setNote(
          body.limit === 0
            ? "Voice search is on the paid plans."
            : `You've used all ${body.limit} voice sessions this month.`,
        );
        setState("upgrade");
        return;
      }
      if (res.status === 501) {
        setNote("Voice search isn't configured on this install.");
        setState("unavailable");
        return;
      }
      if (!res.ok) throw new Error(`token ${res.status}`);

      const { url, token } = (await res.json()) as { url: string; token: string };
      const room = new Room({ adaptiveStream: true });
      roomRef.current = room;

      // Play whatever the agent says.
      room.on(RoomEvent.TrackSubscribed, (track: Track) => {
        if (track.kind === Track.Kind.Audio) {
          const el = track.attach();
          el.autoplay = true;
          document.body.appendChild(el);
        }
      });
      // Live captions, so the answer is readable as well as audible.
      room.on(
        RoomEvent.TranscriptionReceived,
        (segments: TranscriptionSegment[], participant?: Participant) => {
          // Anyone other than us speaking is the agent.
          const who: Line["who"] =
            participant && participant.identity !== room.localParticipant.identity
              ? "assistant"
              : "you";
          setLines((prev) => {
            const next = [...prev];
            for (const seg of segments) {
              const at = next.findIndex((l) => l.id === seg.id);
              const line = { id: seg.id, who, text: seg.text };
              if (at >= 0) next[at] = line;
              else next.push(line);
            }
            return next.slice(-8);
          });
          scrollRef.current?.scrollTo({ top: 99999, behavior: "smooth" });
        },
      );
      room.on(RoomEvent.Disconnected, () => {
        roomRef.current = null;
        setState("idle");
      });

      await room.connect(url, token);
      await room.localParticipant.setMicrophoneEnabled(true);
      setState("live");
    } catch {
      setNote("Couldn't start voice search. Check your microphone and try again.");
      setState("error");
    }
  }

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-3">
      {open && (
        <div className="flex w-80 flex-col overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-xl">
          <div className="flex items-center justify-between bg-brand-700 px-4 py-3 text-white">
            <p className="text-sm font-semibold">Voice search</p>
            <button
              type="button"
              onClick={async () => {
                await hangUp();
                setOpen(false);
              }}
              aria-label="Close voice search"
              className="text-white/70 transition hover:text-white"
            >
              <X size={16} weight="bold" />
            </button>
          </div>

          <div
            ref={scrollRef}
            className="flex max-h-72 min-h-24 flex-col gap-2 overflow-y-auto p-3"
          >
            {lines.length === 0 && (
              <p className="text-sm leading-relaxed text-stone-500">
                {state === "live"
                  ? "Listening — ask away."
                  : portalToken
                    ? "Ask about your file: where things stand, what's next, which documents you have."
                    : "Ask about your files: what's closing this week, who's the lender on Maple, how many active deals."}
              </p>
            )}
            {lines.map((l) => (
              <p
                key={l.id}
                className={`max-w-[85%] whitespace-pre-wrap rounded-xl px-3 py-2 text-sm leading-relaxed ${
                  l.who === "you"
                    ? "self-end bg-brand-600 text-white"
                    : "self-start bg-stone-100 text-stone-800"
                }`}
              >
                {l.text}
              </p>
            ))}
          </div>

          {note && (
            <p className="border-t border-stone-100 px-3 py-2 text-xs text-stone-500">
              {note}
              {state === "upgrade" && !portalToken && (
                <a href="/dashboard/billing" className="ml-1 font-medium text-brand-700 underline">
                  See plans
                </a>
              )}
            </p>
          )}

          <div className="border-t border-stone-100 p-2">
            {state === "live" ? (
              <button
                type="button"
                onClick={hangUp}
                className="w-full rounded-lg bg-stone-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-stone-700"
              >
                End
              </button>
            ) : (
              <button
                type="button"
                onClick={start}
                disabled={state === "connecting"}
                className="w-full rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-brand-700 disabled:opacity-50"
              >
                {state === "connecting" ? "Connecting…" : "Start talking"}
              </button>
            )}
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Close voice search" : "Voice search"}
        className={`grid h-12 w-12 place-items-center rounded-full text-white shadow-lg transition active:scale-95 ${
          state === "live" ? "animate-pulse bg-red-600" : "bg-brand-700 hover:bg-brand-600"
        }`}
      >
        {open ? <X size={20} weight="bold" /> : <Microphone size={20} weight="fill" />}
      </button>
    </div>
  );
}

"use client";

import { Microphone } from "@phosphor-icons/react";
import {
  type Participant,
  Room,
  RoomEvent,
  Track,
  type TranscriptionSegment,
} from "livekit-client";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * The homepage demo: let a visitor hear the product instead of reading about
 * it. Same pipeline as the real thing, but the marketing scope reaches no
 * customer data at all — it answers about Freehold from a fixed brief.
 */

type State = "idle" | "connecting" | "live" | "blocked" | "unavailable" | "error";

interface Line {
  id: string;
  who: "you" | "assistant";
  text: string;
}

export function VoiceDemo() {
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

  useEffect(() => () => void roomRef.current?.disconnect(), []);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 99999, behavior: "smooth" });
  }, []);

  async function start() {
    setState("connecting");
    setLines([]);
    setNote(null);
    // Timing marks (console.debug) so the wait can be attributed: token round
    // trip, LiveKit connect, then time-to-first-audio (the agent's greeting).
    const t0 = performance.now();
    const since = () => `${Math.round(performance.now() - t0)}ms`;
    try {
      const res = await fetch("/api/voice/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ demo: true }),
      });
      console.debug(`[voice] token ready +${since()}`);

      if (res.status === 429) {
        const body = (await res.json()) as { message?: string };
        setNote(body.message ?? "The demo is busy right now — try again shortly.");
        setState("blocked");
        return;
      }
      if (res.status === 501) {
        setNote("The voice demo isn't switched on right now.");
        setState("unavailable");
        return;
      }
      if (!res.ok) throw new Error(String(res.status));

      const { url, token } = (await res.json()) as { url: string; token: string };
      const room = new Room({ adaptiveStream: true });
      roomRef.current = room;

      let firstAudioLogged = false;
      room.on(RoomEvent.TrackSubscribed, (track: Track) => {
        if (track.kind === Track.Kind.Audio) {
          if (!firstAudioLogged) {
            firstAudioLogged = true;
            console.debug(`[voice] first agent audio +${since()}`);
          }
          const el = track.attach();
          el.autoplay = true;
          document.body.appendChild(el);
        }
      });
      room.on(
        RoomEvent.TranscriptionReceived,
        (segments: TranscriptionSegment[], participant?: Participant) => {
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
            return next.slice(-6);
          });
          scrollRef.current?.scrollTo({ top: 99999, behavior: "smooth" });
        },
      );
      room.on(RoomEvent.Disconnected, () => {
        roomRef.current = null;
        setState("idle");
      });

      await room.connect(url, token);
      console.debug(`[voice] room connected +${since()}`);
      await room.localParticipant.setMicrophoneEnabled(true);
      setState("live");
    } catch {
      setNote("Couldn't start the demo — your browser may have blocked the microphone.");
      setState("error");
    }
  }

  return (
    <div className="rounded-2xl border border-stone-200/70 bg-white p-5 shadow-[0_1px_2px_rgb(41_37_36/0.04),0_2px_8px_rgb(41_37_36/0.04)]">
      <div className="flex items-start gap-3">
        <span
          className={`grid h-10 w-10 shrink-0 place-items-center rounded-full text-white ${
            state === "live" ? "animate-pulse bg-red-600" : "bg-brand-700"
          }`}
        >
          <Microphone size={18} weight="fill" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-display font-bold">Ask about Freehold, out loud</p>
          <p className="mt-0.5 text-sm leading-relaxed text-stone-600">
            The same voice built into the product — here it answers about Freehold itself. Ask what
            it costs, whether it self-hosts, anything.
          </p>
        </div>
      </div>

      {(lines.length > 0 || state === "live") && (
        <div
          ref={scrollRef}
          className="mt-4 flex max-h-44 flex-col gap-2 overflow-y-auto rounded-xl bg-stone-50 p-3"
        >
          {lines.length === 0 ? (
            <p className="text-sm text-stone-400">Listening…</p>
          ) : (
            lines.map((l) => (
              <p
                key={l.id}
                className={`max-w-[85%] whitespace-pre-wrap rounded-xl px-3 py-2 text-sm leading-relaxed ${
                  l.who === "you"
                    ? "self-end bg-brand-600 text-white"
                    : "self-start bg-white text-stone-800 shadow-xs"
                }`}
              >
                {l.text}
              </p>
            ))
          )}
        </div>
      )}

      {note && <p className="mt-3 text-sm text-stone-500">{note}</p>}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        {state === "live" ? (
          <button
            type="button"
            onClick={hangUp}
            className="rounded-full bg-stone-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-stone-700 active:scale-[0.98]"
          >
            End
          </button>
        ) : (
          <button
            type="button"
            onClick={start}
            disabled={state === "connecting"}
            className="rounded-full bg-brand-600 px-5 py-2.5 text-sm font-medium text-white shadow-xs transition hover:bg-brand-700 active:scale-[0.98] disabled:opacity-50"
          >
            {state === "connecting" ? "Connecting…" : "Talk to it"}
          </button>
        )}
        <span className="text-xs text-stone-400">Uses your microphone. Nothing is stored.</span>
      </div>
    </div>
  );
}

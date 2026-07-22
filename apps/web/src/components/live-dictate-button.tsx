"use client";

import { Microphone, Stop } from "@phosphor-icons/react";
import { type Participant, Room, RoomEvent, type TranscriptionSegment } from "livekit-client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

type State = "idle" | "connecting" | "live" | "upgrade" | "unavailable" | "error";

/**
 * Live dictation via LiveKit: joins a transcribe-only room where the agent
 * streams the speaker's words back as transcription, and writes them straight
 * into the target textarea as they're spoken. Replaces the old record-then-POST
 * dictation. Inside a transaction it's gated on that transaction's pro state;
 * elsewhere it's paid-only, surfaced as an upgrade note.
 */
export function LiveDictateButton({
  targetId,
  transactionId,
}: {
  targetId: string;
  /** When set, dictation is gated on this transaction's pro state. */
  transactionId?: string;
}) {
  const [state, setState] = useState<State>("idle");
  const roomRef = useRef<Room | null>(null);
  // Text that was in the field before this dictation run, and the ordered
  // transcription segments — combined live into the textarea.
  const baseRef = useRef("");
  const segsRef = useRef<Array<{ id: string; text: string }>>([]);

  const stop = useCallback(async () => {
    await roomRef.current?.disconnect();
    roomRef.current = null;
    setState("idle");
  }, []);

  // Always tear the room down if the component unmounts mid-session.
  useEffect(() => () => void roomRef.current?.disconnect(), []);

  const writeTranscript = useCallback(() => {
    const area = document.getElementById(targetId) as HTMLTextAreaElement | null;
    if (!area) return;
    const transcript = segsRef.current
      .map((s) => s.text)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    const base = baseRef.current;
    const sep = base && transcript && !/\s$/.test(base) ? " " : "";
    area.value = base + sep + transcript;
    // Let a controlled React textarea pick up the change.
    area.dispatchEvent(new Event("input", { bubbles: true }));
  }, [targetId]);

  async function start() {
    setState("connecting");
    segsRef.current = [];
    const area = document.getElementById(targetId) as HTMLTextAreaElement | null;
    baseRef.current = area?.value ?? "";
    try {
      const res = await fetch("/api/voice/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dictation: true, ...(transactionId ? { transactionId } : {}) }),
      });
      if (res.status === 402) {
        setState("upgrade");
        return;
      }
      if (res.status === 501) {
        setState("unavailable");
        return;
      }
      if (!res.ok) throw new Error(`token ${res.status}`);

      const { url, token } = (await res.json()) as { url: string; token: string };
      const room = new Room({ adaptiveStream: true });
      roomRef.current = room;

      room.on(
        RoomEvent.TranscriptionReceived,
        (segments: TranscriptionSegment[], _participant?: Participant) => {
          // Only the speaker is transcribed in dictation mode, so every segment
          // is ours. Upsert by id (interim → final updates in place).
          for (const seg of segments) {
            const at = segsRef.current.findIndex((s) => s.id === seg.id);
            if (at >= 0) segsRef.current[at] = { id: seg.id, text: seg.text };
            else segsRef.current.push({ id: seg.id, text: seg.text });
          }
          writeTranscript();
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
      roomRef.current = null;
      setState("error");
    }
  }

  if (state === "upgrade") {
    return (
      <span className="text-xs text-amber-700">
        {transactionId
          ? "Enable pro features on this transaction to dictate."
          : "Dictation is a paid-plan feature."}{" "}
        <Link href="/dashboard/billing" className="font-medium underline">
          See plans
        </Link>
      </span>
    );
  }
  if (state === "unavailable") {
    return (
      <span className="text-xs text-stone-400">Dictation isn't configured on this install.</span>
    );
  }

  const live = state === "live";
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={live || state === "connecting" ? stop : start}
        className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm transition ${
          live
            ? "border-red-300 bg-red-50 text-red-700 hover:bg-red-100"
            : "border-stone-300 text-stone-600 hover:bg-stone-50"
        }`}
      >
        {live ? (
          <>
            <Stop size={16} weight="fill" aria-hidden /> Stop
          </>
        ) : (
          <>
            <Microphone size={16} aria-hidden /> {state === "connecting" ? "Starting…" : "Dictate"}
          </>
        )}
      </button>
      {live && (
        <span className="flex items-center gap-1 text-xs text-stone-400">
          <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" /> Listening…
        </span>
      )}
      {state === "error" && (
        <span className="text-xs text-red-600">Couldn't start — check your mic.</span>
      )}
    </div>
  );
}

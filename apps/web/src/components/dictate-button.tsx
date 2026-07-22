"use client";

import { Microphone, Stop } from "@phosphor-icons/react";
import Link from "next/link";
import { useRef, useState } from "react";

/**
 * Push-to-dictate for the email compose box: records from the microphone,
 * sends the audio to /api/transcribe (Deepgram), and appends the transcript
 * to the target textarea. Cloud Free sees an upgrade prompt instead.
 */
export function DictateButton({
  targetId,
  transactionId,
}: {
  targetId: string;
  /** When set, dictation is gated on this transaction's pro state, so a Free
   *  workspace that unlocked pro on it can dictate. Absent = paid-only. */
  transactionId?: string;
}) {
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const [state, setState] = useState<"idle" | "recording" | "busy" | "upgrade" | "error">("idle");

  async function start() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunks.current = [];
      rec.ondataavailable = (e) => e.data.size > 0 && chunks.current.push(e.data);
      rec.onstop = async () => {
        for (const track of stream.getTracks()) track.stop();
        setState("busy");
        const blob = new Blob(chunks.current, { type: rec.mimeType || "audio/webm" });
        const res = await fetch("/api/transcribe", {
          method: "POST",
          headers: {
            "content-type": blob.type,
            ...(transactionId ? { "x-transaction-id": transactionId } : {}),
          },
          body: blob,
        });
        if (res.status === 402) {
          setState("upgrade");
          return;
        }
        if (!res.ok) {
          setState("error");
          return;
        }
        const { text } = (await res.json()) as { text: string };
        const area = document.getElementById(targetId) as HTMLTextAreaElement | null;
        if (area && text) {
          area.value = area.value ? `${area.value.trimEnd()}\n\n${text}` : text;
          area.dispatchEvent(new Event("input", { bubbles: true }));
        }
        setState("idle");
      };
      rec.start();
      recorder.current = rec;
      setState("recording");
    } catch {
      setState("error");
    }
  }

  if (state === "upgrade") {
    return (
      <span className="text-xs text-amber-700">
        Voice dictation is a paid-plan feature.{" "}
        <Link href="/dashboard/billing" className="font-medium underline">
          Upgrade →
        </Link>
      </span>
    );
  }

  return (
    <span className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => (state === "recording" ? recorder.current?.stop() : start())}
        disabled={state === "busy"}
        title={state === "recording" ? "Stop and transcribe" : "Dictate with your voice"}
        className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${
          state === "recording"
            ? "border-red-300 bg-red-50 text-red-700"
            : "border-stone-300 text-stone-600 hover:border-brand-600 hover:text-brand-700"
        } disabled:opacity-50`}
      >
        {state === "recording" ? (
          <>
            <Stop size={14} weight="fill" aria-hidden /> Stop
          </>
        ) : state === "busy" ? (
          "Transcribing…"
        ) : (
          <>
            <Microphone size={14} weight="bold" aria-hidden /> Dictate
          </>
        )}
      </button>
      {state === "error" && (
        <span className="text-xs text-stone-400">Mic or transcription unavailable.</span>
      )}
    </span>
  );
}

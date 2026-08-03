"use client";

import { useRef, useState } from "react";

interface Msg {
  id: string;
  role: "user" | "assistant";
  content: string;
}

const GREETING: Msg = {
  id: "greeting",
  role: "assistant",
  content:
    "Hi! Ask me anything about Freehold: pricing, self-hosting, the AI extraction, whatever. Real questions get real answers.",
};

function msg(role: Msg["role"], content: string): Msg {
  return { id: crypto.randomUUID(), role, content };
}

/** Floating site messenger on the marketing pages. */
export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([GREETING]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  async function send() {
    const content = draft.trim();
    if (!content || busy) return;
    const next: Msg[] = [...messages, msg("user", content)];
    setMessages(next);
    setDraft("");
    setBusy(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // The server sees the conversation without the canned greeting.
        body: JSON.stringify({
          messages: next.slice(1).map(({ role, content: c }) => ({ role, content: c })),
        }),
      });
      const data = (await res.json()) as { reply?: string; error?: string };
      setMessages((m) => [
        ...m,
        msg(
          "assistant",
          data.reply ??
            data.error ??
            "Something went wrong. Email hello@freeholdtc.dev and a human will answer.",
        ),
      ]);
    } catch {
      setMessages((m) => [
        ...m,
        msg("assistant", "Connection hiccup. Try again, or email hello@freeholdtc.dev."),
      ]);
    } finally {
      setBusy(false);
      setTimeout(() => listRef.current?.scrollTo({ top: 99999, behavior: "smooth" }), 50);
    }
  }

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-3">
      {open && (
        <div className="flex h-[28rem] w-80 flex-col overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-xl">
          <div className="flex items-center justify-between bg-brand-700 px-4 py-3 text-white">
            <p className="text-sm font-semibold">Freehold</p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close chat"
              title="Close chat"
              className="text-white/70 transition hover:text-white"
            >
              ✕
            </button>
          </div>
          <div ref={listRef} className="flex flex-1 flex-col gap-2 overflow-y-auto p-3">
            {messages.map((m) => (
              <p
                key={m.id}
                className={`max-w-[85%] whitespace-pre-wrap rounded-xl px-3 py-2 text-sm leading-relaxed ${
                  m.role === "user"
                    ? "self-end bg-brand-600 text-white"
                    : "self-start bg-stone-100 text-stone-800"
                }`}
              >
                {m.content}
              </p>
            ))}
            {busy && <p className="self-start px-3 py-2 text-sm text-stone-400">…</p>}
          </div>
          <form
            className="flex gap-2 border-t border-stone-100 p-2"
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
          >
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Ask about Freehold…"
              maxLength={2000}
              className="flex-1 rounded-lg border border-stone-200 px-3 py-2 text-sm outline-none focus:border-brand-400"
            />
            <button
              type="submit"
              disabled={busy || draft.trim().length === 0}
              className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-brand-700 disabled:opacity-40"
            >
              Send
            </button>
          </form>
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Close chat" : "Chat with us"}
        title={open ? "Close chat" : "Chat with us. Ask a question about Freehold"}
        className="grid h-13 w-13 place-items-center rounded-full bg-brand-700 text-white shadow-lg transition hover:bg-brand-600 active:scale-95"
      >
        {open ? (
          <span className="text-lg">✕</span>
        ) : (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" role="img" aria-label="Chat">
            <title>Chat</title>
            <path
              d="M21 12a8 8 0 0 1-8 8H4.5a1 1 0 0 1-.7-1.7l1.9-1.9A8 8 0 1 1 21 12Z"
              fill="currentColor"
            />
          </svg>
        )}
      </button>
    </div>
  );
}

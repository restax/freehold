import { fmtDateTime } from "@/lib/vendor-order-labels";

/**
 * The order conversation, rendered from either side. `mine` is whichever
 * authorKind is the current viewer (TC on the coordinator surface, VENDOR on
 * the vendor/link surfaces), so their own messages align right. Presentational
 * only — each surface supplies its own compose form.
 */

export interface ThreadMessage {
  id: string;
  authorKind: string;
  authorName: string | null;
  body: string;
  viaEmail: boolean;
  createdAt: Date;
}

export function VendorOrderThread({
  messages,
  mine,
}: {
  messages: ThreadMessage[];
  mine: "TC" | "VENDOR";
}) {
  if (messages.length === 0) {
    return <p className="text-xs text-stone-400">No messages yet.</p>;
  }
  return (
    <ol className="flex flex-col gap-2">
      {messages.map((m) => {
        const isMine = m.authorKind === mine;
        return (
          <li key={m.id} className={`flex flex-col ${isMine ? "items-end" : "items-start"}`}>
            <div
              className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                isMine ? "bg-brand-600 text-white" : "bg-stone-100 text-stone-800"
              }`}
            >
              <span className="whitespace-pre-wrap">{m.body}</span>
            </div>
            <span className="mt-0.5 px-1 text-[11px] text-stone-400">
              {m.authorName ?? m.authorKind.toLowerCase()}
              {m.viaEmail ? " · by email" : ""} · {fmtDateTime(m.createdAt)}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

"use client";

import { useState } from "react";
import { input, label } from "@/lib/ui";

const TRIGGER_LABEL: Record<string, string> = {
  IMMEDIATE: "Immediately, for every workspace",
  HAS_SAMPLE_DATA: "While the workspace still has sample data",
  FIFTH_REAL_TRANSACTION: "Once the workspace's 5th real transaction is created",
  DAYS_AFTER_MESSAGE: "N days after another message was first shown",
};

/**
 * The only bit of the composer that needs client JS: DAYS_AFTER_MESSAGE
 * reveals a message picker and a delay-days input the other three triggers
 * don't need.
 */
export function CriticalMessageTriggerFields({
  defaultTrigger,
  defaultAfterMessageId,
  defaultDelayDays,
  otherMessages,
}: {
  defaultTrigger: string;
  defaultAfterMessageId: string;
  defaultDelayDays: string;
  otherMessages: Array<{ id: string; title: string }>;
}) {
  const [trigger, setTrigger] = useState(defaultTrigger);

  return (
    <>
      <label className={label}>
        Trigger
        <select
          name="trigger"
          className={input}
          value={trigger}
          onChange={(e) => setTrigger(e.target.value)}
        >
          {Object.entries(TRIGGER_LABEL).map(([value, text]) => (
            <option key={value} value={value}>
              {text}
            </option>
          ))}
        </select>
      </label>

      {trigger === "DAYS_AFTER_MESSAGE" && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_8rem]">
          <label className={label}>
            After message
            <select
              name="triggerAfterMessageId"
              className={input}
              defaultValue={defaultAfterMessageId}
            >
              <option value="">Select a message…</option>
              {otherMessages.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.title}
                </option>
              ))}
            </select>
          </label>
          <label className={label}>
            Delay (days)
            <input
              name="triggerDelayDays"
              type="number"
              min={0}
              defaultValue={defaultDelayDays}
              className={input}
            />
          </label>
        </div>
      )}
    </>
  );
}

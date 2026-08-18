"use client";

import { useState } from "react";
import { approveClientConnectorConsent } from "@/lib/actions/client-connector-consent";
import { denyMcpConsent } from "@/lib/actions/mcp-consent";
import { btn, btnGhost, input, label } from "@/lib/ui";

/**
 * Approve or decline, for an outside agent connecting their own Claude.
 *
 * Deliberately a separate component from ConsentForm rather than a mode
 * inside it: the two screens pick different things (a workspace of your own
 * versus a coordinator whose files you are a client of), and the one thing
 * that must never blur is which of those two the person is agreeing to.
 *
 * Declining goes through the staff action, because declining is only Better
 * Auth being told no — there is nothing client-shaped about it.
 */
export function ClientConsentForm({
  oauthClientId,
  appName,
  consentCode,
  options,
}: {
  oauthClientId: string;
  appName: string;
  consentCode: string | null;
  options: Array<{ clientId: string; clientName: string; tenantName: string }>;
}) {
  const [clientId, setClientId] = useState(options[0].clientId);
  const [busy, setBusy] = useState<"approve" | "deny" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(action: "approve" | "deny") {
    setBusy(action);
    setError(null);
    const result =
      action === "approve"
        ? await approveClientConnectorConsent(oauthClientId, clientId, consentCode)
        : await denyMcpConsent(consentCode);
    if (result.redirect) {
      window.location.href = result.redirect;
      return;
    }
    setError(result.error ?? "Something went wrong.");
    setBusy(null);
  }

  return (
    <div className="mt-5 flex flex-col gap-4">
      {options.length === 1 ? (
        <p className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm">
          Your files with <span className="font-medium">{options[0].tenantName}</span>
        </p>
      ) : (
        <label className={label}>
          Whose files
          <select
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            className={input}
            disabled={busy !== null}
          >
            {options.map((option) => (
              <option key={option.clientId} value={option.clientId}>
                Your files with {option.tenantName}
              </option>
            ))}
          </select>
        </label>
      )}

      {error ? <p className="text-sm text-red-700">{error}</p> : null}

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => run("approve")}
          disabled={busy !== null}
          className={btn}
        >
          {busy === "approve" ? "Connecting…" : `Connect ${appName}`}
        </button>
        <button
          type="button"
          onClick={() => run("deny")}
          disabled={busy !== null}
          className={btnGhost}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

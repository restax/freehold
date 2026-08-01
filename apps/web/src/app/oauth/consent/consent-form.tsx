"use client";

import { useState } from "react";
import { approveMcpConsent, denyMcpConsent } from "@/lib/actions/mcp-consent";
import { btn, btnGhost, input, label } from "@/lib/ui";

/**
 * Approve or decline, and pick the workspace.
 *
 * Both outcomes end in a redirect the OAuth client handed us, so navigation
 * goes through window.location rather than the router: the destination is
 * claude.ai, not a route in this app.
 */
export function ConsentForm({
  clientId,
  clientName,
  consentCode,
  tenants,
  defaultTenantId,
}: {
  clientId: string;
  clientName: string;
  consentCode: string | null;
  tenants: Array<{ id: string; name: string }>;
  defaultTenantId: string;
}) {
  const [tenantId, setTenantId] = useState(defaultTenantId);
  const [busy, setBusy] = useState<"approve" | "deny" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(action: "approve" | "deny") {
    setBusy(action);
    setError(null);
    const result =
      action === "approve"
        ? await approveMcpConsent(clientId, tenantId, consentCode)
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
      {/* One workspace and no choice to make: state it rather than showing a
          select with a single option, which reads as a decision the person
          has to think about. */}
      {tenants.length === 1 ? (
        <p className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm">
          Workspace: <span className="font-medium">{tenants[0].name}</span>
        </p>
      ) : (
        <label className={label}>
          Workspace
          <select
            value={tenantId}
            onChange={(e) => setTenantId(e.target.value)}
            className={input}
            disabled={busy !== null}
          >
            {tenants.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
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
          {busy === "approve" ? "Connecting…" : `Connect ${clientName}`}
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

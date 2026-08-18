"use client";

import { useState } from "react";
import { CopyButton } from "@/components/copy-button";
import { claimClientConnectorGrant } from "@/lib/actions/client-connector-portal";
import { authClient } from "@/lib/auth-client";
import { btn, btnGhost, input, label } from "@/lib/ui";

/**
 * "Connect your Claude", on the agent's own portal.
 *
 * The portal is a link, not an account, which is the whole reason this exists
 * here. A link can be forwarded, so it is enough to *show* someone their
 * files but not to let an assistant of theirs read those files on their
 * behalf whenever it likes. Proving the mailbox on the client record is what
 * turns "whoever opened this URL" into a person.
 *
 * Three states, and the middle one is the point: the code goes to the address
 * the coordinator already has, never to one typed in here. Letting the agent
 * supply the address would make the check circular.
 */
type Stage = "idle" | "code" | "done";

export function PortalConnectorOffer({
  token,
  email,
  connectorUrl,
}: {
  token: string;
  email: string;
  connectorUrl: string;
}) {
  const [stage, setStage] = useState<Stage>("idle");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendCode() {
    setBusy(true);
    setError(null);
    const { error: sendError } = await authClient.emailOtp.sendVerificationOtp({
      email,
      type: "sign-in",
    });
    setBusy(false);
    if (sendError) {
      setError(sendError.message ?? "Could not send the code. Try again in a moment.");
      return;
    }
    setStage("code");
  }

  async function verify() {
    setBusy(true);
    setError(null);
    const { error: signInError } = await authClient.signIn.emailOtp({ email, otp: code.trim() });
    if (signInError) {
      setBusy(false);
      setError(signInError.message ?? "That code didn't work. Check it and try again.");
      return;
    }
    // Signed in as the address on the client record. The grant is written
    // server-side, where the portal token is re-checked against a live link
    // and the coordinator's switches — none of which this component is
    // trusted to have got right.
    const result = await claimClientConnectorGrant(token);
    setBusy(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    setStage("done");
  }

  if (stage === "done") {
    return (
      <div className="flex flex-col gap-3 text-sm">
        <p className="font-medium">Your address is confirmed.</p>
        <ol className="flex list-decimal flex-col gap-1.5 pl-5 leading-relaxed text-stone-600">
          <li>
            In Claude, open Settings, then Connectors, then &ldquo;Add custom connector&rdquo;.
          </li>
          <li>Paste the address below.</li>
          <li>
            Sign in as <span className="font-medium">{email}</span> when Claude asks, and approve.
          </li>
        </ol>
        <div className="flex items-center gap-2">
          <code className="min-w-0 flex-1 truncate rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 font-mono text-xs">
            {connectorUrl}
          </code>
          <CopyButton text={connectorUrl} variant="quiet" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 text-sm">
      <p className="leading-relaxed text-stone-600">
        Ask your own Claude what&rsquo;s closing, what&rsquo;s outstanding, and what your
        coordinator is waiting on, without emailing anyone. First confirm this is you: we&rsquo;ll
        send a code to <span className="font-medium">{email}</span>.
      </p>

      {stage === "code" ? (
        <>
          <label className={label}>
            Code from your email
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="123456"
              className={input}
              disabled={busy}
            />
          </label>
          {error ? <p className="text-red-700">{error}</p> : null}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={verify}
              disabled={busy || code.trim().length === 0}
              className={btn}
            >
              {busy ? "Checking…" : "Confirm"}
            </button>
            <button type="button" onClick={sendCode} disabled={busy} className={btnGhost}>
              Send a new code
            </button>
          </div>
        </>
      ) : (
        <>
          {error ? <p className="text-red-700">{error}</p> : null}
          <div>
            <button type="button" onClick={sendCode} disabled={busy} className={btn}>
              {busy ? "Sending…" : "Connect your Claude"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

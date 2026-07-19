"use client";

import QRCode from "qrcode";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";

/**
 * Settings → two-factor authentication. Enrollment: password → TOTP secret
 * as a QR code + backup codes (shown once) → first code verifies and
 * activates. Disable requires the password again.
 */
export function TwoFactorSettings({ enabled: initialEnabled }: { enabled: boolean }) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [phase, setPhase] = useState<"idle" | "enroll" | "done">("idle");
  const [password, setPassword] = useState("");
  const [qr, setQr] = useState<string | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function startEnroll(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { data, error } = await authClient.twoFactor.enable({ password });
    if (error || !data) {
      setError(error?.message ?? "Could not start enrollment.");
      setBusy(false);
      return;
    }
    setQr(await QRCode.toDataURL(data.totpURI, { margin: 1, width: 200 }));
    setBackupCodes(data.backupCodes);
    setPhase("enroll");
    setPassword("");
    setBusy(false);
  }

  async function confirmEnroll(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await authClient.twoFactor.verifyTotp({ code: code.trim() });
    if (error) {
      setError(error.message ?? "That code didn't match — try the next one.");
      setBusy(false);
      return;
    }
    setEnabled(true);
    setPhase("done");
    setCode("");
    setBusy(false);
  }

  async function disable(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await authClient.twoFactor.disable({ password });
    if (error) {
      setError(error.message ?? "Could not disable two-factor.");
      setBusy(false);
      return;
    }
    setEnabled(false);
    setPhase("idle");
    setPassword("");
    setBusy(false);
  }

  const input =
    "rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none";

  if (enabled && phase !== "done") {
    return (
      <form onSubmit={disable} className="flex flex-wrap items-end gap-3">
        <p className="w-full text-sm text-stone-600">
          <span className="mr-2 rounded-full bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-800">
            Enabled
          </span>
          Sign-ins require a code from your authenticator app.
        </p>
        <label className="flex flex-col gap-1 text-sm font-medium text-stone-700">
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className={input}
          />
        </label>
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-600 hover:border-red-300 hover:text-red-700 disabled:opacity-50"
        >
          Disable two-factor
        </button>
        {error && <p className="w-full text-sm text-red-600">{error}</p>}
      </form>
    );
  }

  if (phase === "enroll") {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-6">
          <div>
            <p className="mb-2 text-sm font-medium text-stone-700">
              1. Scan with your authenticator app
            </p>
            {qr && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={qr}
                alt="TOTP enrollment QR code"
                className="rounded-lg border border-stone-200"
              />
            )}
          </div>
          <div className="min-w-56 flex-1">
            <p className="mb-2 text-sm font-medium text-stone-700">
              2. Save these backup codes — shown only once
            </p>
            <pre className="rounded-lg bg-stone-50 p-3 font-mono text-xs leading-relaxed text-stone-700">
              {backupCodes.join("\n")}
            </pre>
            <p className="mt-1 text-xs text-stone-400">
              Each works once if you lose your device. Store them offline.
            </p>
          </div>
        </div>
        <form onSubmit={confirmEnroll} className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-sm font-medium text-stone-700">
            3. Enter the current code to activate
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              className={`${input} text-center font-mono tracking-[0.3em]`}
            />
          </label>
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
          >
            {busy ? "Activating…" : "Activate"}
          </button>
          {error && <p className="w-full text-sm text-red-600">{error}</p>}
        </form>
      </div>
    );
  }

  if (phase === "done") {
    return (
      <p className="rounded-lg border border-brand-100 bg-brand-50 px-4 py-3 text-sm text-brand-900">
        Two-factor authentication is on. You'll be asked for a code at your next sign-in.
      </p>
    );
  }

  return (
    <form onSubmit={startEnroll} className="flex flex-wrap items-end gap-3">
      <p className="w-full text-sm text-stone-600">
        Add a second step to sign-in: a 6-digit code from any authenticator app (Google
        Authenticator, 1Password, Authy). You'll get backup codes for a lost device.
      </p>
      <label className="flex flex-col gap-1 text-sm font-medium text-stone-700">
        Confirm your password
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className={input}
        />
      </label>
      <button
        type="submit"
        disabled={busy}
        className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
      >
        {busy ? "Starting…" : "Enable two-factor"}
      </button>
      {error && <p className="w-full text-sm text-red-600">{error}</p>}
    </form>
  );
}

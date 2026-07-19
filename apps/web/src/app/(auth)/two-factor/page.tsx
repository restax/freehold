"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";

/** Second step of sign-in for accounts with 2FA enabled. */
export default function TwoFactorPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [useBackup, setUseBackup] = useState(false);
  const [trustDevice, setTrustDevice] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = useBackup
      ? await authClient.twoFactor.verifyBackupCode({ code: code.trim(), trustDevice })
      : await authClient.twoFactor.verifyTotp({ code: code.trim(), trustDevice });
    if (error) {
      setError(error.message ?? "That code didn't work — try again.");
      setBusy(false);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <form
      onSubmit={onSubmit}
      className="mx-auto mt-24 flex w-full max-w-sm flex-col gap-4 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm"
    >
      <h1 className="font-display text-xl font-bold">Two-factor verification</h1>
      <p className="text-sm text-stone-500">
        {useBackup
          ? "Enter one of your backup codes. Each code works once."
          : "Enter the 6-digit code from your authenticator app."}
      </p>
      <label className="flex flex-col gap-1 text-sm font-medium text-stone-700">
        {useBackup ? "Backup code" : "Authenticator code"}
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          inputMode={useBackup ? "text" : "numeric"}
          autoComplete="one-time-code"
          required
          className="rounded-lg border border-stone-300 px-3 py-2 text-center font-mono text-lg tracking-[0.3em] focus:border-brand-600 focus:outline-none"
        />
      </label>
      <label className="flex items-center gap-2 text-sm text-stone-600">
        <input
          type="checkbox"
          checked={trustDevice}
          onChange={(e) => setTrustDevice(e.target.checked)}
          className="accent-brand-600"
        />
        Trust this device for 30 days
      </label>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={busy}
        className="rounded-lg bg-brand-600 px-4 py-2 font-medium text-white hover:bg-brand-700 disabled:opacity-50"
      >
        {busy ? "Verifying…" : "Verify"}
      </button>
      <button
        type="button"
        onClick={() => {
          setUseBackup((v) => !v);
          setCode("");
          setError(null);
        }}
        className="text-sm text-brand-700 hover:underline"
      >
        {useBackup ? "Use my authenticator app instead" : "Lost your device? Use a backup code"}
      </button>
      <p className="text-center text-sm text-stone-500">
        <Link href="/login" className="text-brand-600 hover:underline">
          Back to sign in
        </Link>
      </p>
    </form>
  );
}

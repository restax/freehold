"use client";

import Link from "next/link";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await authClient.requestPasswordReset({
      email: email.trim(),
      redirectTo: "/reset-password",
    });
    setBusy(false);
    if (error) {
      setError(error.message ?? "Couldn't send the reset link — try again.");
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-lg font-semibold">Check your email</h1>
        <p className="text-sm text-stone-500">
          If an account exists for <span className="font-medium text-stone-700">{email}</span>,
          we've sent a link to reset the password. It expires in an hour.
        </p>
        <p className="text-center text-sm text-stone-500">
          <Link href="/login" className="text-brand-600 hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold">Reset your password</h1>
      <p className="text-sm text-stone-500">
        Enter the email on your account and we'll send you a link to set a new password.
      </p>
      <label className="flex flex-col gap-1 text-sm">
        Email
        <input
          type="email"
          required
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-lg border border-stone-300 px-3 py-2 focus:border-brand-600 focus:outline-none"
        />
      </label>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={busy}
        className="rounded-lg bg-brand-600 px-4 py-2 font-medium text-white hover:bg-brand-700 disabled:opacity-50"
      >
        {busy ? "Sending…" : "Send reset link"}
      </button>
      <p className="text-center text-sm text-stone-500">
        <Link href="/login" className="text-brand-600 hover:underline">
          Back to sign in
        </Link>
      </p>
    </form>
  );
}

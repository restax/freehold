"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { authClient } from "@/lib/auth-client";

function VerifyEmailForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState(params.get("email") ?? "");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resent, setResent] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await authClient.emailOtp.verifyEmail({ email, otp: code.trim() });
    if (error) {
      setError(error.message ?? "That code didn't work — check it and try again.");
      setBusy(false);
      return;
    }
    router.push("/login?verified=1");
    router.refresh();
  }

  async function resend() {
    setError(null);
    setResent(false);
    const { error } = await authClient.emailOtp.sendVerificationOtp({
      email,
      type: "email-verification",
    });
    if (error) setError(error.message ?? "Could not resend the code.");
    else setResent(true);
  }

  return (
    <form
      onSubmit={onSubmit}
      className="mx-auto mt-24 flex w-full max-w-sm flex-col gap-4 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm"
    >
      <h1 className="font-display text-xl font-bold">Check your email</h1>
      <p className="text-sm text-stone-500">
        We sent a 6-digit code to confirm your address. Enter it below to finish creating your
        account.
      </p>
      <label className="flex flex-col gap-1 text-sm font-medium text-stone-700">
        Email
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="rounded-lg border border-stone-300 px-3 py-2 focus:border-brand-600 focus:outline-none"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium text-stone-700">
        Verification code
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          inputMode="numeric"
          autoComplete="one-time-code"
          required
          className="rounded-lg border border-stone-300 px-3 py-2 text-center font-mono text-lg tracking-[0.3em] focus:border-brand-600 focus:outline-none"
        />
      </label>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {resent && <p className="text-sm text-brand-700">A fresh code is on its way.</p>}
      <button
        type="submit"
        disabled={busy}
        className="rounded-lg bg-brand-600 px-4 py-2 font-medium text-white hover:bg-brand-700 disabled:opacity-50"
      >
        {busy ? "Verifying…" : "Verify email"}
      </button>
      <button type="button" onClick={resend} className="text-sm text-brand-700 hover:underline">
        Resend the code
      </button>
      <p className="text-center text-sm text-stone-500">
        <Link href="/login" className="text-brand-600 hover:underline">
          Back to sign in
        </Link>
      </p>
    </form>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <VerifyEmailForm />
    </Suspense>
  );
}

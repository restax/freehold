"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { MIN_PASSWORD_SCORE, PasswordStrength } from "@/components/password-strength";
import { authClient } from "@/lib/auth-client";

function ResetPasswordForm() {
  const router = useRouter();
  const token = useSearchParams().get("token");
  const invalid = useSearchParams().get("error") === "INVALID_TOKEN";
  const [password, setPassword] = useState("");
  const [score, setScore] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    if (score < MIN_PASSWORD_SCORE) {
      setError("Choose a longer or less common password.");
      return;
    }
    setBusy(true);
    setError(null);
    const { error } = await authClient.resetPassword({ newPassword: password, token });
    if (error) {
      setError(error.message ?? "That link may have expired — request a new one.");
      setBusy(false);
      return;
    }
    router.push("/login");
  }

  if (invalid || !token) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-lg font-semibold">Link expired</h1>
        <p className="text-sm text-stone-500">
          This password reset link is invalid or has expired. Request a new one below.
        </p>
        <Link
          href="/forgot-password"
          className="rounded-lg bg-brand-600 px-4 py-2 text-center font-medium text-white hover:bg-brand-700"
        >
          Send a new link
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold">Choose a new password</h1>
      <label className="flex flex-col gap-1 text-sm">
        New password
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded-lg border border-stone-300 px-3 py-2 focus:border-brand-600 focus:outline-none"
        />
      </label>
      <PasswordStrength password={password} onScore={setScore} />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={busy}
        className="rounded-lg bg-brand-600 px-4 py-2 font-medium text-white hover:bg-brand-700 disabled:opacity-50"
      >
        {busy ? "Saving…" : "Reset password"}
      </button>
      <p className="text-center text-sm text-stone-500">
        <Link href="/login" className="text-brand-600 hover:underline">
          Back to sign in
        </Link>
      </p>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
}

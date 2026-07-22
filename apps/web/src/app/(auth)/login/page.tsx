"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { authClient } from "@/lib/auth-client";

function LoginForm() {
  const router = useRouter();
  const verified = useSearchParams().get("verified") === "1";
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const id = identifier.trim();
    // An "@" means they typed an email; otherwise it's a username. Only the
    // email path can resend a verification code (we have the address).
    const isEmail = id.includes("@");
    const { error } = isEmail
      ? await authClient.signIn.email({ email: id, password })
      : await authClient.signIn.username({ username: id.toLowerCase(), password });
    if (error) {
      if (error.status === 403) {
        if (isEmail) {
          await authClient.emailOtp
            .sendVerificationOtp({ email: id, type: "email-verification" })
            .catch(() => {});
          router.push(`/verify-email?email=${encodeURIComponent(id)}`);
          return;
        }
        setError("Verify your email first — sign in with your email address to get a new code.");
        setBusy(false);
        return;
      }
      setError(error.message ?? "Sign-in failed.");
      setBusy(false);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold">Sign in</h1>
      {verified && (
        <p className="rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-800">
          Email verified — sign in to continue.
        </p>
      )}
      <label className="flex flex-col gap-1 text-sm">
        Username or email
        <input
          type="text"
          required
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          className="rounded-lg border border-stone-300 px-3 py-2 focus:border-brand-600 focus:outline-none"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Password
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded-lg border border-stone-300 px-3 py-2 focus:border-brand-600 focus:outline-none"
        />
      </label>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={busy}
        className="rounded-lg bg-brand-600 px-4 py-2 font-medium text-white hover:bg-brand-700 disabled:opacity-50"
      >
        {busy ? "Signing in…" : "Sign in"}
      </button>
      <p className="text-center text-sm text-stone-500">
        No account?{" "}
        <Link href="/signup" className="text-brand-600 hover:underline">
          Create one
        </Link>
      </p>
    </form>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

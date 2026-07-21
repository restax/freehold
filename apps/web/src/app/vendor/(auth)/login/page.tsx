"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";

export default function VendorLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await authClient.signIn.email({ email, password });
    if (error) {
      setError(error.message ?? "Sign-in failed.");
      setBusy(false);
      return;
    }
    // requireVendor sorts out where they land — dashboard if they have a
    // vendor, register if they somehow don't.
    router.push("/vendor/dashboard");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <h1 className="text-lg font-semibold">Vendor sign in</h1>
      <label className="flex flex-col gap-1 text-sm">
        Email
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
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
        New vendor?{" "}
        <Link href="/vendor/register" className="text-brand-600 hover:underline">
          Register your business
        </Link>
      </p>
    </form>
  );
}

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PhoneInput } from "@/components/phone-input";
import { registerVendor } from "@/lib/actions/vendor";
import { authClient } from "@/lib/auth-client";

const CATEGORIES: Array<[string, string]> = [
  ["TITLE", "Title / escrow"],
  ["INSPECTION", "Inspection"],
  ["PHOTOGRAPHY", "Photography"],
  ["SIGNAGE", "Sign installation"],
  ["LEGAL", "Law office"],
  ["OTHER", "Other"],
];

const field =
  "rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none";

export default function VendorRegisterPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <form
      action={async (formData) => {
        setBusy(true);
        setError(null);
        const result = await registerVendor(formData);
        if (!result.ok) {
          setError(result.error);
          setBusy(false);
          return;
        }
        // Account + vendor exist; sign in browser-side so the session cookie
        // is set reliably, then head to the dashboard.
        const { error: signInError } = await authClient.signIn.email({
          email: String(formData.get("email") ?? "").toLowerCase(),
          password: String(formData.get("password") ?? ""),
        });
        if (signInError) {
          // Rare: registered but couldn't auto-sign-in. Send them to log in.
          router.push("/vendor/login");
          return;
        }
        router.push("/vendor/dashboard");
        router.refresh();
      }}
      className="flex flex-col gap-3"
    >
      <h1 className="text-lg font-semibold">Register your business</h1>
      <p className="-mt-1 text-xs text-stone-500">
        Register once, then connect to any coordinator who works with you.
      </p>

      <label className="flex flex-col gap-1 text-sm">
        Business name
        <input name="businessName" required placeholder="Summit Title Co." className={field} />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        What you do
        <select name="category" defaultValue="TITLE" className={field}>
          {CATEGORIES.map(([v, label]) => (
            <option key={v} value={v}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Service area (optional)
        <input name="serviceArea" placeholder="Chicago metro" className={field} />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Phone (optional)
        <PhoneInput name="phone" className={field} />
      </label>

      <hr className="my-1 border-stone-100" />

      <label className="flex flex-col gap-1 text-sm">
        Your name
        <input name="personName" required placeholder="Dana Reyes" className={field} />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Work email
        <input name="email" type="email" required className={field} />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Password
        <input name="password" type="password" required minLength={8} className={field} />
      </label>

      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={busy}
        className="mt-1 rounded-lg bg-brand-600 px-4 py-2 font-medium text-white hover:bg-brand-700 disabled:opacity-50"
      >
        {busy ? "Creating…" : "Create vendor account"}
      </button>
      <p className="text-center text-sm text-stone-500">
        Already registered?{" "}
        <Link href="/vendor/login" className="text-brand-600 hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}

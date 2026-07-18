"use client";

import { tenantSlug } from "@freehold/db/slug";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";

export function OnboardingForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const slug = tenantSlug(name) || `workspace-${Date.now()}`;
    const { data, error } = await authClient.organization.create({ name, slug });
    if (error || !data) {
      setError(error?.message ?? "Could not create the workspace.");
      setBusy(false);
      return;
    }
    await authClient.organization.setActive({ organizationId: data.id });
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm">
        Business name
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Smith Realty Group"
          className="rounded-lg border border-stone-300 px-3 py-2 focus:border-brand-600 focus:outline-none"
        />
      </label>
      {name && (
        <p className="text-xs text-stone-400">
          Workspace URL name: <code>{tenantSlug(name)}</code>
        </p>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={busy}
        className="rounded-lg bg-brand-600 px-4 py-2 font-medium text-white hover:bg-brand-700 disabled:opacity-50"
      >
        {busy ? "Creating…" : "Create workspace"}
      </button>
    </form>
  );
}

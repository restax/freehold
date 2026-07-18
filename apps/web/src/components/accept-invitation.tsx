"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";

export function AcceptInvitationButton({ invitationId }: { invitationId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          const { error } = await authClient.organization.acceptInvitation({ invitationId });
          if (error) {
            setError(error.message ?? "Could not accept the invitation.");
            setBusy(false);
            return;
          }
          router.push("/dashboard");
          router.refresh();
        }}
        className="rounded-lg bg-brand-600 px-4 py-2 font-medium text-white hover:bg-brand-700 disabled:opacity-50"
      >
        {busy ? "Joining…" : "Accept invitation"}
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}

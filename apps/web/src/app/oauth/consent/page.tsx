import { prisma } from "@freehold/db";
import { redirect } from "next/navigation";
import { Wordmark } from "@/components/marketing";
import { getSession, listTenants } from "@/lib/session";
import { ConsentForm } from "./consent-form";

export const dynamic = "force-dynamic";

/**
 * The screen a coordinator sees when Claude asks to connect their workspace.
 *
 * This is the only place in the whole flow where a human decides anything, so
 * it says plainly what is being connected, to which workspace, and what that
 * lets Claude see. Vague consent screens are how people end up surprised
 * later, and a TC's workspace holds their clients' addresses and deal terms.
 */
export default async function McpConsentPage({
  searchParams,
}: {
  searchParams: Promise<{ client_id?: string; consent_code?: string; scope?: string }>;
}) {
  const { client_id: clientId, consent_code: consentCode } = await searchParams;

  const session = await getSession();
  // Better Auth sends unauthenticated callers to /login first, so arriving
  // here without a session means the session expired mid-flow. Bounce back
  // through login and return to this exact URL.
  if (!session) {
    const target = `/oauth/consent?client_id=${encodeURIComponent(clientId ?? "")}&consent_code=${encodeURIComponent(consentCode ?? "")}`;
    redirect(`/login?next=${encodeURIComponent(target)}`);
  }

  if (!clientId) redirect("/dashboard");

  const [client, tenants] = await Promise.all([
    prisma.oauthApplication.findUnique({
      where: { clientId },
      select: { name: true },
    }),
    listTenants(),
  ]);

  // Someone with no workspace has nothing to connect. Sending them to
  // onboarding is more useful than an empty picker.
  if (tenants.length === 0) redirect("/onboarding");

  const active = tenants.find((t) => t.id === session.session.activeOrganizationId);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 py-12">
      <div className="mb-6">
        <Wordmark />
      </div>
      <div className="w-full max-w-md rounded-xl border border-stone-200 bg-white p-6 shadow-sm">
        <h1 className="text-lg font-semibold">Connect {client?.name ?? "Claude"} to Freehold</h1>
        <p className="mt-2 text-sm leading-relaxed text-stone-600">
          {client?.name ?? "Claude"} is asking to work with one of your workspaces. It will be able
          to read what you can read there, and nothing from any workspace you don&rsquo;t pick
          below.
        </p>

        <ConsentForm
          clientId={clientId}
          clientName={client?.name ?? "Claude"}
          consentCode={consentCode ?? null}
          tenants={tenants.map((t) => ({ id: t.id, name: t.name }))}
          defaultTenantId={active?.id ?? tenants[0].id}
        />

        <p className="mt-5 border-t border-stone-100 pt-4 text-xs leading-relaxed text-stone-500">
          You can disconnect this at any time from Settings, and your workspace owner can turn the
          connector off for everyone. Access follows your role: if your permissions change, what{" "}
          {client?.name ?? "Claude"} can do changes with them.
        </p>
      </div>
    </main>
  );
}

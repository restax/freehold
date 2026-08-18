import { prisma } from "@freehold/db";
import Link from "next/link";
import { setWorkspaceClientConnectorEnabled } from "@/lib/actions/client-connector-settings";
import { btn, btnGhost } from "@/lib/ui";

/**
 * The clients' connector on the Integrations page: the workspace switch, and
 * which clients are currently connected.
 *
 * Its own switch rather than a second use of the team one. The team switch
 * promises the subscriber that turning it off disconnects everyone
 * immediately, and the everyone it means is their staff — a coordinator
 * pausing their own team's assistants should not silently cut off every agent
 * they work for.
 *
 * There is no URL to copy here: a client connects at the same address
 * everyone else does, and which files it opens is decided when they sign in.
 * What differs is that a coordinator picks the level per client first, which
 * is why the roll-up below links back to each client's page rather than
 * offering controls of its own.
 */
export async function ClientConnectorPanel({
  tenantId,
  isAdmin,
}: {
  tenantId: string;
  isAdmin: boolean;
}) {
  const [org, connections] = await Promise.all([
    prisma.organization.findUniqueOrThrow({
      where: { id: tenantId },
      select: { clientConnectorEnabled: true },
    }),
    prisma.clientConnectorConnection.findMany({
      where: { tenantId, revokedAt: null },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        boundEmail: true,
        oauthClientName: true,
        createdAt: true,
        lastUsedAt: true,
        clientId: true,
        client: { select: { name: true } },
      },
    }),
  ]);

  const enabled = org.clientConnectorEnabled;
  const fmt = (d: Date | null) =>
    d ? d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "never";

  return (
    <div className="mt-3 flex flex-col gap-3 border-t border-stone-100 pt-3">
      {isAdmin ? (
        <form action={setWorkspaceClientConnectorEnabled} className="flex items-center gap-2">
          <input type="hidden" name="enabled" value={enabled ? "0" : "1"} />
          <button type="submit" className={enabled ? btnGhost : btn}>
            {enabled ? "Turn it off for clients" : "Turn it on for clients"}
          </button>
          <span className="text-xs text-stone-500">
            {enabled
              ? "On. Each client still gets nothing until you pick what they can do, on their own page."
              : "Off. No client can connect, whatever their page says."}
          </span>
        </form>
      ) : (
        <p className="text-xs text-stone-500">
          {enabled
            ? "Your workspace owner has this switched on."
            : "Your workspace owner has this switched off, so no client can connect yet."}
        </p>
      )}

      {enabled && connections.length === 0 && (
        <p className="text-xs text-stone-500">
          Nobody connected yet. Choose what a client can do on their page under{" "}
          <Link href="/dashboard/clients" className="text-brand-700 hover:underline">
            Clients
          </Link>
          .
        </p>
      )}

      {connections.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <p className="text-xs font-medium text-stone-600">Connected clients</p>
          {connections.map((c) => (
            <div
              key={c.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-stone-200 px-2.5 py-1.5"
            >
              <span className="text-xs">
                <span className="font-medium">{c.client.name}</span>
                <span className="text-stone-500">
                  {" — "}
                  {c.boundEmail} via {c.oauthClientName}, connected {fmt(c.createdAt)}, last used{" "}
                  {fmt(c.lastUsedAt)}
                </span>
              </span>
              <Link
                href={`/dashboard/clients/${c.clientId}`}
                className="text-xs text-brand-700 hover:underline"
              >
                manage →
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

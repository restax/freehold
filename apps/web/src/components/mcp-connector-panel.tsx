import { prisma } from "@freehold/db";
import { CopyButton } from "@/components/copy-button";
import { revokeMcpConnection, setWorkspaceMcpEnabled } from "@/lib/actions/mcp-settings";
import { mcpResourceUrl } from "@/lib/mcp";
import { btn, btnGhost } from "@/lib/ui";

/**
 * The Claude connector's controls on the Integrations page: the workspace
 * switch, the URL to paste into Claude, and who is currently connected.
 *
 * Everyone in the workspace sees this panel, because everyone needs the URL
 * and the ability to disconnect themselves. Only an admin gets the switch and
 * the ability to disconnect somebody else.
 */
export async function McpConnectorPanel({
  tenantId,
  userId,
  isAdmin,
}: {
  tenantId: string;
  userId: string;
  isAdmin: boolean;
}) {
  const [org, connections] = await Promise.all([
    prisma.organization.findUniqueOrThrow({
      where: { id: tenantId },
      select: { mcpEnabled: true },
    }),
    prisma.mcpConnection.findMany({
      where: { tenantId, revokedAt: null },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        clientName: true,
        createdAt: true,
        lastUsedAt: true,
        userId: true,
        user: { select: { name: true, email: true } },
      },
    }),
  ]);

  const url = mcpResourceUrl();
  const fmt = (d: Date | null) =>
    d ? d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "never";

  return (
    <div className="mt-3 flex flex-col gap-3 border-t border-stone-100 pt-3">
      {isAdmin ? (
        <form action={setWorkspaceMcpEnabled} className="flex items-center gap-2">
          <input type="hidden" name="enabled" value={org.mcpEnabled ? "0" : "1"} />
          <button type="submit" className={org.mcpEnabled ? btnGhost : btn}>
            {org.mcpEnabled ? "Turn the connector off" : "Turn the connector on"}
          </button>
          <span className="text-xs text-stone-500">
            {org.mcpEnabled
              ? "On. Turning it off disconnects everyone immediately and revokes any Claude Skill keys."
              : "Off. Nobody in this workspace can connect Claude until you turn it on."}
          </span>
        </form>
      ) : (
        <p className="text-xs text-stone-500">
          {org.mcpEnabled
            ? "Your workspace owner has this switched on."
            : "Your workspace owner has this switched off, so connecting won't work yet."}
        </p>
      )}

      {org.mcpEnabled && (
        <div className="flex flex-wrap items-center gap-2">
          <code className="rounded-lg border border-stone-200 bg-stone-50 px-2 py-1 text-xs">
            {url}
          </code>
          <CopyButton text={url} label="Copy URL" variant="quiet" />
          <span className="text-xs text-stone-500">
            In Claude: Settings, Connectors, Add custom connector.
          </span>
        </div>
      )}

      {connections.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <p className="text-xs font-medium text-stone-600">Connected</p>
          {connections.map((c) => {
            // You can always disconnect yourself; disconnecting somebody else
            // is an admin action.
            const mayRevoke = isAdmin || c.userId === userId;
            return (
              <div
                key={c.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-stone-200 px-2.5 py-1.5"
              >
                <span className="text-xs">
                  <span className="font-medium">{c.clientName}</span>
                  <span className="text-stone-500">
                    {" — "}
                    {c.user.name || c.user.email}, connected {fmt(c.createdAt)}, last used{" "}
                    {fmt(c.lastUsedAt)}
                  </span>
                </span>
                {mayRevoke && (
                  <form action={revokeMcpConnection}>
                    <input type="hidden" name="connectionId" value={c.id} />
                    <button
                      type="submit"
                      className="text-xs text-stone-400 transition-colors hover:text-red-600"
                    >
                      disconnect
                    </button>
                  </form>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

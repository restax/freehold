import { prisma, withTenant } from "@freehold/db";
import { notFound } from "next/navigation";
import { AdminNav } from "@/components/admin-nav";
import { Wordmark } from "@/components/marketing";
import { isOperator } from "@/lib/operator";

export const dynamic = "force-dynamic";

/**
 * Shell for every /admin/* page: a left sidebar listing all eleven sections,
 * grouped the same way the dashboard's own sidebar groups a workspace's
 * tools. Replaces what used to be a single row of buttons at the top of the
 * operator-panel page — that grew past a full line once Screenshot to CRM
 * landed, and every page below had been independently re-deriving its own
 * "← Admin" back-link instead of sharing real navigation.
 *
 * Gated here too, even though every page under it already checks isOperator
 * on its own: this stops the sidebar itself from ever rendering for a
 * non-operator, rather than relying on each page to notice.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  if (!(await isOperator())) notFound();

  // Same per-org loop the operator panel and the tickets page already pay
  // for — support_ticket carries RLS, so there's no single cheap count.
  // Computed once here instead of once per page.
  const orgs = await prisma.organization.findMany({ select: { id: true } });
  const openTicketCounts = await Promise.all(
    orgs.map((o) =>
      withTenant(o.id, (tx) =>
        tx.supportTicket.count({ where: { status: { not: "CLOSED" } } }),
      ).catch(() => 0),
    ),
  );
  const openTickets = openTicketCounts.reduce((sum, n) => sum + n, 0);

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 flex h-screen w-14 shrink-0 flex-col overflow-y-auto overflow-x-hidden border-r border-stone-200 bg-white px-2 py-6 lg:w-56 lg:px-4">
        <div className="mb-4 flex shrink-0 items-center gap-2 px-1 py-1 lg:px-2">
          <Wordmark href="/admin" collapsible />
        </div>
        <AdminNav openTickets={openTickets} />
      </aside>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

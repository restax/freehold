import { withTenant } from "@freehold/db";
import { removeSampleData } from "@/lib/actions/sample-data";
import { listTenants } from "@/lib/session";
import { requireTenant } from "@/lib/tenant";
import { btnGhost, card } from "@/lib/ui";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const { tenantId, session } = await requireTenant();
  const tenants = await listTenants();
  const tenant = tenants.find((t) => t.id === tenantId);
  const sampleCount = await withTenant(tenantId, async (tx) => {
    const [transactions, contacts] = await Promise.all([
      tx.transaction.count({ where: { isSample: true } }),
      tx.contact.count({ where: { isSample: true } }),
    ]);
    return transactions + contacts;
  });

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Settings</h1>

      <section className={card}>
        <h2 className="mb-2 font-medium">Workspace</h2>
        <p className="text-sm">
          <span className="text-stone-500">Name:</span> {tenant?.name}
        </p>
        <p className="text-sm">
          <span className="text-stone-500">Signed in as:</span> {session.user.email}
        </p>
      </section>

      <section className={card}>
        <h2 className="mb-2 font-medium">Sample data</h2>
        {sampleCount > 0 ? (
          <form action={removeSampleData} className="flex items-center gap-3">
            <p className="text-sm text-stone-500">
              This workspace contains sample records (marked “(Sample)”).
            </p>
            <button type="submit" className={btnGhost}>
              Remove all sample data
            </button>
          </form>
        ) : (
          <p className="text-sm text-stone-500">No sample data in this workspace.</p>
        )}
      </section>

      <section className={card}>
        <h2 className="mb-2 font-medium">System health</h2>
        <p className="text-sm text-stone-500">
          Version 0.0.1 (Stage 01). Include this page in self-host support requests.
        </p>
      </section>
    </div>
  );
}

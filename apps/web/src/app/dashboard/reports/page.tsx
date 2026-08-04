import { ChartBar } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { SectionCard } from "@/components/section-card";
import { requireTenant } from "@/lib/tenant";

export const dynamic = "force-dynamic";

/**
 * Report index. One entry today; built as a list rather than a redirect
 * straight to the transaction report so a second report type later has
 * somewhere to land without restructuring the nav.
 */
export default async function ReportsPage() {
  await requireTenant({ allowGuest: true });

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-8 sm:px-6">
      <div>
        <h1 className="text-xl font-semibold">Reports</h1>
        <p className="mt-1 text-sm text-stone-500">
          Point-in-time views of your workspace you can send or schedule.
        </p>
      </div>

      <SectionCard title="Available reports" bodyClassName="p-0">
        <Link
          href="/dashboard/reports/transactions"
          className="flex items-center gap-3 p-4 transition-colors hover:bg-stone-50"
        >
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-700">
            <ChartBar size={18} weight="fill" aria-hidden />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-medium">Transaction status</span>
            <span className="block text-xs text-stone-500">
              Every file by pipeline stage, with volume and overdue tasks called out
            </span>
          </span>
        </Link>
      </SectionCard>
    </main>
  );
}

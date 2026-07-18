import { prisma } from "@freehold/db";

export const dynamic = "force-dynamic";

async function dbOk(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

const PLACEHOLDERS = [
  {
    title: "Transactions",
    body: "No transactions yet. Transaction management lands in Stage 01.",
  },
  { title: "Contacts", body: "No contacts yet. The CRM lands in Stage 01." },
  {
    title: "Clients",
    body: "No clients yet. Add the agents and brokerages you serve in Stage 01.",
  },
];

export default async function DashboardPage() {
  const db = await dbOk();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Dashboard</h1>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {PLACEHOLDERS.map((card) => (
          <section
            key={card.title}
            className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm"
          >
            <h2 className="mb-1 font-medium">{card.title}</h2>
            <p className="text-sm text-stone-500">{card.body}</p>
          </section>
        ))}
      </div>

      <section className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
        <h2 className="mb-2 font-medium">System health</h2>
        <ul className="flex flex-col gap-1 text-sm">
          <li>
            Database:{" "}
            {db ? (
              <span className="text-brand-600">connected</span>
            ) : (
              <span className="text-red-600">unreachable</span>
            )}
          </li>
          <li className="text-stone-500">Version: 0.0.0 (Stage 00 skeleton)</li>
        </ul>
        <p className="mt-2 text-xs text-stone-400">
          Self-host support: include a screenshot of this panel when reporting an issue.
        </p>
      </section>
    </div>
  );
}

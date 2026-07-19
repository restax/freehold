import { withTenant } from "@freehold/db";
import { DangerDelete } from "@/components/danger-delete";
import { EmptyState } from "@/components/empty-state";
import { createContact, deleteContact } from "@/lib/actions/contacts";
import { fmtDate } from "@/lib/format";
import { requireTenant } from "@/lib/tenant";
import { btn, card, input, label, summaryLink, td, th, trHover } from "@/lib/ui";

export const dynamic = "force-dynamic";

const CATEGORIES = [
  "Buyer",
  "Seller",
  "Agent",
  "Lender",
  "Title",
  "Inspector",
  "Attorney",
  "Vendor",
  "Other",
];

export default async function ContactsPage() {
  const { tenantId } = await requireTenant();
  const contacts = await withTenant(tenantId, (tx) =>
    tx.contact.findMany({ orderBy: [{ category: "asc" }, { name: "asc" }] }),
  );

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Contacts</h1>

      <details className={card}>
        <summary className={summaryLink}>New contact</summary>
        <form action={createContact} className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <label className={label}>
            Name *
            <input name="name" required className={input} />
          </label>
          <label className={label}>
            Email
            <input name="email" type="email" className={input} />
          </label>
          <label className={label}>
            Phone
            <input name="phone" className={input} />
          </label>
          <label className={label}>
            Category
            <select name="category" className={input} defaultValue="Other">
              {CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label className={label}>
            Rating (1–5)
            <select name="rating" className={input} defaultValue="">
              <option value="">—</option>
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {"★".repeat(n)}
                </option>
              ))}
            </select>
          </label>
          <label className={label}>
            Next touch date
            <input name="touchDate" type="date" className={input} />
          </label>
          <div className="flex items-end">
            <button type="submit" className={btn}>
              Add contact
            </button>
          </div>
        </form>
      </details>

      <section className={card}>
        {contacts.length === 0 ? (
          <EmptyState
            title="No contacts yet"
            hint='Add the people you work with — agents, lenders, title reps, inspectors — then attach them to transactions as parties. Open "New contact" above to start.'
          />
        ) : (
          <table className="w-full">
            <thead>
              <tr>
                <th className={th}>Name</th>
                <th className={th}>Category</th>
                <th className={th}>Email</th>
                <th className={th}>Phone</th>
                <th className={th}>Rating</th>
                <th className={th}>Touch date</th>
                <th className={th} />
              </tr>
            </thead>
            <tbody>
              {contacts.map((c) => (
                <tr key={c.id} className={trHover}>
                  <td className={`${td} font-medium`}>{c.name}</td>
                  <td className={td}>{c.category}</td>
                  <td className={td}>{c.email ?? "—"}</td>
                  <td className={td}>{c.phone ?? "—"}</td>
                  <td className={td}>{c.rating ? "★".repeat(c.rating) : "—"}</td>
                  <td className={td}>{fmtDate(c.touchDate)}</td>
                  <td className={td}>
                    <DangerDelete
                      compact
                      action={deleteContact}
                      label="Delete"
                      description="Removes this contact from your CRM."
                      hidden={{ id: c.id }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

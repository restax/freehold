import { PartyRole, TransactionSide, TransactionStatus, withTenant } from "@freehold/db";
import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteDocument, uploadDocument } from "@/lib/actions/documents";
import {
  deleteEnvelope,
  markEnvelopeSigned,
  refreshEnvelope,
  sendForSignature,
} from "@/lib/actions/esign";
import { runExtraction } from "@/lib/actions/extractions";
import { addParty, removeParty } from "@/lib/actions/parties";
import { applyActionPlan, createTask, deleteTask, toggleTask } from "@/lib/actions/tasks";
import { generateDocument } from "@/lib/actions/templates";
import {
  deleteTransaction,
  removeCustomField,
  setCustomField,
  updateTransaction,
} from "@/lib/actions/transactions";
import { fmtDate, fmtMoney, ROLE_LABEL, SIDE_LABEL, STATUS_LABEL } from "@/lib/format";
import { requireTenant } from "@/lib/tenant";
import { btn, btnDanger, btnGhost, card, input, label } from "@/lib/ui";

export const dynamic = "force-dynamic";

const STATUSES = Object.values(TransactionStatus);
const SIDES = Object.values(TransactionSide);
const ROLES = Object.values(PartyRole);

export default async function TransactionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { tenantId } = await requireTenant();
  const { id } = await params;

  const data = await withTenant(tenantId, async (tx) => {
    const txn = await tx.transaction.findUnique({
      where: { id },
      include: {
        client: true,
        parties: { include: { contact: true }, orderBy: { createdAt: "asc" } },
        tasks: { orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] },
        documents: {
          orderBy: { createdAt: "desc" },
          select: { id: true, filename: true, contentType: true, sizeBytes: true, createdAt: true },
        },
        extractions: {
          orderBy: { createdAt: "desc" },
          include: { _count: { select: { fields: true } } },
        },
        envelopes: {
          orderBy: { createdAt: "desc" },
          include: { document: { select: { filename: true } } },
        },
      },
    });
    if (!txn) return null;
    const [contacts, clients, plans, templates] = await Promise.all([
      tx.contact.findMany({ orderBy: { name: "asc" } }),
      tx.client.findMany({ orderBy: { name: "asc" } }),
      tx.actionPlan.findMany({
        orderBy: { name: "asc" },
        include: { _count: { select: { tasks: true } } },
      }),
      tx.docTemplate.findMany({ orderBy: { name: "asc" } }),
    ]);
    return { txn, contacts, clients, plans, templates };
  });
  if (!data) notFound();
  const { txn, contacts, clients, plans, templates } = data;

  const customFields = (txn.customFields as Record<string, string> | null) ?? {};
  const today = fmtDate(new Date());
  const openCount = txn.tasks.filter((t) => t.status === "OPEN").length;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/dashboard/transactions" className="text-sm text-stone-500 hover:underline">
            ← Transactions
          </Link>
          <h1 className="text-xl font-semibold">{txn.propertyAddress}</h1>
          <p className="text-sm text-stone-500">
            {[txn.city, txn.state, txn.zip].filter(Boolean).join(", ") || "No location set"} ·{" "}
            {SIDE_LABEL[txn.side]} · {fmtMoney(txn.purchasePrice)}
          </p>
        </div>
        <form action={deleteTransaction}>
          <input type="hidden" name="id" value={txn.id} />
          <button type="submit" className={btnDanger}>
            Delete transaction
          </button>
        </form>
      </div>

      <section className={card}>
        <h2 className="mb-3 font-medium">Details</h2>
        <form action={updateTransaction} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <input type="hidden" name="id" value={txn.id} />
          <label className={`${label} lg:col-span-2`}>
            Property address
            <input name="propertyAddress" defaultValue={txn.propertyAddress} className={input} />
          </label>
          <label className={label}>
            Client
            <select name="clientId" defaultValue={txn.clientId ?? ""} className={input}>
              <option value="">—</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className={label}>
            Status
            <select name="status" defaultValue={txn.status} className={input}>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </label>
          <label className={label}>
            City
            <input name="city" defaultValue={txn.city ?? ""} className={input} />
          </label>
          <label className={label}>
            State
            <input name="state" defaultValue={txn.state ?? ""} maxLength={2} className={input} />
          </label>
          <label className={label}>
            ZIP
            <input name="zip" defaultValue={txn.zip ?? ""} className={input} />
          </label>
          <label className={label}>
            Side
            <select name="side" defaultValue={txn.side} className={input}>
              {SIDES.map((s) => (
                <option key={s} value={s}>
                  {SIDE_LABEL[s]}
                </option>
              ))}
            </select>
          </label>
          <label className={label}>
            Purchase price ($)
            <input
              name="purchasePrice"
              inputMode="numeric"
              defaultValue={txn.purchasePrice ?? ""}
              className={input}
            />
          </label>
          <label className={label}>
            Contract date
            <input
              name="contractDate"
              type="date"
              defaultValue={txn.contractDate ? fmtDate(txn.contractDate) : ""}
              className={input}
            />
          </label>
          <label className={label}>
            Close date
            <input
              name="closeDate"
              type="date"
              defaultValue={txn.closeDate ? fmtDate(txn.closeDate) : ""}
              className={input}
            />
          </label>
          <label className={`${label} lg:col-span-3`}>
            Notes
            <input name="notes" defaultValue={txn.notes ?? ""} className={input} />
          </label>
          <div className="flex items-end">
            <button type="submit" className={btn}>
              Save changes
            </button>
          </div>
        </form>
      </section>

      <section className={card}>
        <h2 className="mb-3 font-medium">Custom fields</h2>
        {Object.keys(customFields).length > 0 && (
          <ul className="mb-3 flex flex-col gap-1">
            {Object.entries(customFields).map(([k, v]) => (
              <li key={k} className="flex items-center gap-2 text-sm">
                <span className="font-medium">{k}:</span> <span>{v}</span>
                <form action={removeCustomField}>
                  <input type="hidden" name="id" value={txn.id} />
                  <input type="hidden" name="key" value={k} />
                  <button type="submit" className="text-xs text-stone-400 hover:text-red-600">
                    remove
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
        <form action={setCustomField} className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="id" value={txn.id} />
          <label className={label}>
            Field
            <input name="key" placeholder="MLS #" className={input} />
          </label>
          <label className={label}>
            Value
            <input name="value" placeholder="MLS-102938" className={input} />
          </label>
          <button type="submit" className={btnGhost}>
            Add field
          </button>
        </form>
      </section>

      <section className={card}>
        <h2 className="mb-3 font-medium">Parties</h2>
        {txn.parties.length === 0 ? (
          <p className="mb-3 text-sm text-stone-500">No parties attached yet.</p>
        ) : (
          <ul className="mb-4 flex flex-col gap-1">
            {txn.parties.map((p) => (
              <li key={p.id} className="flex items-center gap-3 text-sm">
                <span className="w-36 shrink-0 text-stone-500">{ROLE_LABEL[p.role]}</span>
                <span className="font-medium">{p.contact.name}</span>
                <span className="text-stone-500">{p.contact.email ?? p.contact.phone ?? ""}</span>
                <form action={removeParty} className="ml-auto">
                  <input type="hidden" name="id" value={p.id} />
                  <input type="hidden" name="transactionId" value={txn.id} />
                  <button type="submit" className="text-xs text-stone-400 hover:text-red-600">
                    remove
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
        <form action={addParty} className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="transactionId" value={txn.id} />
          <label className={label}>
            Contact
            <select name="contactId" className={input} defaultValue="">
              <option value="" disabled>
                Choose…
              </option>
              {contacts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className={label}>
            Role
            <select name="role" className={input} defaultValue="BUYER">
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r]}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className={btnGhost}>
            Add party
          </button>
        </form>
        {contacts.length === 0 && (
          <p className="mt-2 text-xs text-stone-400">
            No contacts yet —{" "}
            <Link href="/dashboard/contacts" className="text-brand-600 hover:underline">
              add some first
            </Link>
            .
          </p>
        )}
      </section>

      <section className={card}>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-medium">
            Tasks <span className="text-sm text-stone-400">({openCount} open)</span>
          </h2>
          {plans.length > 0 && (
            <form action={applyActionPlan} className="flex items-center gap-2">
              <input type="hidden" name="transactionId" value={txn.id} />
              <select name="planId" className={input} defaultValue={plans[0]?.id}>
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p._count.tasks})
                  </option>
                ))}
              </select>
              <button type="submit" className={btnGhost}>
                Apply plan
              </button>
            </form>
          )}
        </div>
        {txn.tasks.length === 0 ? (
          <p className="mb-3 text-sm text-stone-500">
            No tasks yet — add one below or apply an action plan.
          </p>
        ) : (
          <ul className="mb-4 flex flex-col">
            {txn.tasks.map((t) => {
              const done = t.status === "DONE";
              const overdue = !done && t.dueDate && fmtDate(t.dueDate) < today;
              return (
                <li
                  key={t.id}
                  className="flex items-center gap-3 border-b border-stone-100 py-2 last:border-0"
                >
                  <form action={toggleTask}>
                    <input type="hidden" name="id" value={t.id} />
                    <input type="hidden" name="transactionId" value={txn.id} />
                    <button
                      type="submit"
                      title={done ? "Reopen" : "Mark done"}
                      className={`flex h-5 w-5 items-center justify-center rounded border text-xs ${
                        done
                          ? "border-brand-600 bg-brand-600 text-white"
                          : "border-stone-300 hover:border-brand-600"
                      }`}
                    >
                      {done ? "✓" : ""}
                    </button>
                  </form>
                  <span
                    className={`w-24 shrink-0 text-sm ${overdue ? "font-medium text-red-600" : "text-stone-500"}`}
                  >
                    {fmtDate(t.dueDate)}
                  </span>
                  <span className={`text-sm ${done ? "text-stone-400 line-through" : ""}`}>
                    {t.title}
                  </span>
                  <form action={deleteTask} className="ml-auto">
                    <input type="hidden" name="id" value={t.id} />
                    <input type="hidden" name="transactionId" value={txn.id} />
                    <button type="submit" className="text-xs text-stone-300 hover:text-red-600">
                      delete
                    </button>
                  </form>
                </li>
              );
            })}
          </ul>
        )}
        <form action={createTask} className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="transactionId" value={txn.id} />
          <label className={`${label} min-w-64 flex-1`}>
            New task
            <input name="title" placeholder="Order home warranty" className={input} />
          </label>
          <label className={label}>
            Due
            <input name="dueDate" type="date" className={input} />
          </label>
          <button type="submit" className={btnGhost}>
            Add task
          </button>
        </form>
      </section>

      <section className={card}>
        <h2 className="mb-1 font-medium">Documents &amp; contract extraction</h2>
        <p className="mb-3 text-sm text-stone-500">
          Upload the purchase contract and let AI pull every key date and figure — page-cited, and
          nothing is saved until you confirm it.
        </p>
        {!process.env.ANTHROPIC_API_KEY && (
          <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            No <code>ANTHROPIC_API_KEY</code> is configured — extraction runs will fail until one is
            added to <code>.env</code>.
          </p>
        )}
        {txn.documents.length > 0 && (
          <ul className="mb-4 flex flex-col">
            {txn.documents.map((doc) => (
              <li
                key={doc.id}
                className="flex flex-wrap items-center gap-3 border-b border-stone-100 py-2 last:border-0"
              >
                <a
                  href={`/api/documents/${doc.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-brand-600 hover:underline"
                >
                  {doc.filename}
                </a>
                <span className="text-xs text-stone-400">
                  {(doc.sizeBytes / 1024).toFixed(0)} KB · {fmtDate(doc.createdAt)}
                </span>
                {doc.contentType === "application/pdf" && (
                  <form action={runExtraction}>
                    <input type="hidden" name="documentId" value={doc.id} />
                    <button type="submit" className={btnGhost}>
                      Extract contract data
                    </button>
                  </form>
                )}
                <form action={deleteDocument} className="ml-auto">
                  <input type="hidden" name="id" value={doc.id} />
                  <input type="hidden" name="transactionId" value={txn.id} />
                  <button type="submit" className="text-xs text-stone-300 hover:text-red-600">
                    delete
                  </button>
                </form>
                <details className="w-full">
                  <summary className="cursor-pointer text-xs text-brand-600">
                    Send for signature
                  </summary>
                  <form
                    action={sendForSignature}
                    className="mt-2 flex flex-wrap items-end gap-2 rounded-lg bg-stone-50 p-3"
                  >
                    <input type="hidden" name="documentId" value={doc.id} />
                    <label className={label}>
                      Signer 1 name *
                      <input name="signer1Name" required className={input} />
                    </label>
                    <label className={label}>
                      Signer 1 email *
                      <input name="signer1Email" type="email" required className={input} />
                    </label>
                    <label className={label}>
                      Signer 2 name
                      <input name="signer2Name" className={input} />
                    </label>
                    <label className={label}>
                      Signer 2 email
                      <input name="signer2Email" type="email" className={input} />
                    </label>
                    <button type="submit" className={btnGhost}>
                      Send
                    </button>
                  </form>
                </details>
              </li>
            ))}
          </ul>
        )}
        <form action={uploadDocument} className="mb-4 flex flex-wrap items-end gap-2">
          <input type="hidden" name="transactionId" value={txn.id} />
          <label className={label}>
            Upload document (PDF, max 10 MB)
            <input
              name="file"
              type="file"
              accept="application/pdf,.pdf"
              required
              className={input}
            />
          </label>
          <button type="submit" className={btnGhost}>
            Upload
          </button>
        </form>
        {templates.length > 0 && (
          <form action={generateDocument} className="mb-4 flex flex-wrap items-end gap-2">
            <input type="hidden" name="transactionId" value={txn.id} />
            <label className={label}>
              Generate from template
              <select name="templateId" className={input} defaultValue={templates[0]?.id}>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" className={btnGhost}>
              Generate PDF
            </button>
          </form>
        )}
        {txn.envelopes.length > 0 && (
          <div className="mb-4">
            <h3 className="mb-1 text-sm font-medium text-stone-600">Signature envelopes</h3>
            <ul className="flex flex-col">
              {txn.envelopes.map((env) => {
                const signers = (env.signers as Array<{ name: string; email: string }>) ?? [];
                return (
                  <li
                    key={env.id}
                    className="flex flex-wrap items-center gap-3 border-b border-stone-100 py-2 text-sm last:border-0"
                  >
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${
                        env.status === "COMPLETED"
                          ? "bg-emerald-100 text-emerald-800"
                          : env.status === "SENT"
                            ? "bg-amber-100 text-amber-800"
                            : env.status === "ERROR" || env.status === "DECLINED"
                              ? "bg-red-100 text-red-700"
                              : "bg-stone-200 text-stone-600"
                      }`}
                    >
                      {env.status.toLowerCase()}
                    </span>
                    <span className="font-medium">{env.document.filename}</span>
                    <span className="text-stone-500">
                      {env.provider.toLowerCase()} · {signers.map((s) => s.name).join(", ")}
                    </span>
                    {env.error && <span className="text-xs text-red-600">{env.error}</span>}
                    <span className="ml-auto flex items-center gap-2">
                      {env.provider === "MANUAL" && env.status === "SENT" && (
                        <form action={markEnvelopeSigned}>
                          <input type="hidden" name="id" value={env.id} />
                          <button type="submit" className={btnGhost}>
                            Mark signed
                          </button>
                        </form>
                      )}
                      {env.provider !== "MANUAL" && env.externalId && (
                        <form action={refreshEnvelope}>
                          <input type="hidden" name="id" value={env.id} />
                          <button type="submit" className={btnGhost}>
                            Refresh status
                          </button>
                        </form>
                      )}
                      <form action={deleteEnvelope}>
                        <input type="hidden" name="id" value={env.id} />
                        <input type="hidden" name="transactionId" value={txn.id} />
                        <button type="submit" className="text-xs text-stone-300 hover:text-red-600">
                          delete
                        </button>
                      </form>
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
        {txn.extractions.length > 0 && (
          <div>
            <h3 className="mb-1 text-sm font-medium text-stone-600">Extraction runs</h3>
            <ul className="flex flex-col">
              {txn.extractions.map((ex) => (
                <li
                  key={ex.id}
                  className="flex items-center gap-3 border-b border-stone-100 py-2 text-sm last:border-0"
                >
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      ex.status === "READY"
                        ? "bg-amber-100 text-amber-800"
                        : ex.status === "APPLIED"
                          ? "bg-emerald-100 text-emerald-800"
                          : ex.status === "FAILED"
                            ? "bg-red-100 text-red-700"
                            : "bg-stone-200 text-stone-600"
                    }`}
                  >
                    {ex.status === "READY" ? "Needs review" : ex.status.toLowerCase()}
                  </span>
                  <span className="text-stone-500">
                    {fmtDate(ex.createdAt)} · {ex._count.fields} fields · {ex.model}
                  </span>
                  <Link
                    href={`/dashboard/transactions/${txn.id}/extractions/${ex.id}`}
                    className="ml-auto text-brand-600 hover:underline"
                  >
                    {ex.status === "READY" ? "Review & apply" : "View"}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}

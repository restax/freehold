import { prisma } from "@freehold/db";
import { Megaphone } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CriticalMessageTriggerFields } from "@/components/critical-message-trigger-fields";
import { SaveMenu } from "@/components/save-menu";
import { SectionCard } from "@/components/section-card";
import {
  createCriticalMessage,
  deleteCriticalMessage,
  updateCriticalMessage,
} from "@/lib/actions/critical-messages-admin";
import { isOperator } from "@/lib/operator";
import { btn, btnGhost, input, label, tableWrap, td, th, trHover } from "@/lib/ui";

export const dynamic = "force-dynamic";

const TRIGGER_LABEL: Record<string, string> = {
  IMMEDIATE: "Immediately",
  HAS_SAMPLE_DATA: "While sample data exists",
  FIFTH_REAL_TRANSACTION: "At the 5th real transaction",
  DAYS_AFTER_MESSAGE: "Days after another message",
};

/**
 * The composer for the tenant-facing broadcast widget (nav footer, right
 * above Report an issue). Content is platform-wide — no tenant, no RLS —
 * so this is operator-only, same gate as every other /admin page.
 */
export default async function AdminMessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ new?: string; edit?: string }>;
}) {
  if (!(await isOperator())) notFound();
  const { new: newParam, edit: editId } = await searchParams;

  const messages = await prisma.criticalMessage.findMany({
    orderBy: [{ urgent: "desc" }, { createdAt: "desc" }],
    include: {
      triggerAfterMessage: { select: { title: true } },
      _count: { select: { dismissals: true } },
      dismissals: {
        take: 20,
        orderBy: { dismissedAt: "desc" },
        include: { member: { include: { user: { select: { name: true, email: true } } } } },
      },
    },
  });

  const editing = editId ? messages.find((m) => m.id === editId) : undefined;
  const showComposer = newParam === "1" || Boolean(editing);
  const otherMessages = messages
    .filter((m) => m.id !== editing?.id)
    .map((m) => ({ id: m.id, title: m.title }));

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/admin" className="text-sm text-brand-600 hover:underline">
            ← Admin
          </Link>
          <h1 className="mt-1 text-xl font-semibold">Critical messages</h1>
          <p className="text-sm text-stone-500">
            Broadcasts shown in every workspace's left nav, above Report an issue, until each member
            closes them.
          </p>
        </div>
        {!showComposer && (
          <Link href="/admin/messages?new=1" className={btn}>
            + New message
          </Link>
        )}
      </div>

      {showComposer && (
        <SectionCard
          title={editing ? "Edit message" : "New message"}
          icon={<Megaphone size={15} weight="fill" aria-hidden />}
          action={
            <Link href="/admin/messages" className="text-xs text-stone-500 hover:text-stone-800">
              Cancel
            </Link>
          }
        >
          <form
            id="critical-message-form"
            action={editing ? updateCriticalMessage : createCriticalMessage}
            className="flex flex-col gap-3"
          >
            {editing && <input type="hidden" name="id" value={editing.id} />}
            <label className={label}>
              Title
              <input name="title" required defaultValue={editing?.title ?? ""} className={input} />
            </label>
            <label className={label}>
              Body
              <textarea
                name="body"
                required
                rows={3}
                defaultValue={editing?.body ?? ""}
                className={`${input} resize-y`}
              />
            </label>
            <label className={label}>
              Link (optional)
              <input
                name="linkUrl"
                type="url"
                placeholder="https://"
                defaultValue={editing?.linkUrl ?? ""}
                className={input}
              />
            </label>
            <label className="flex items-center gap-2 text-sm font-medium text-stone-700">
              <input name="urgent" type="checkbox" defaultChecked={editing?.urgent ?? false} />
              Urgent — more prominent styling, sorts first
            </label>
            <CriticalMessageTriggerFields
              defaultTrigger={editing?.trigger ?? "IMMEDIATE"}
              defaultAfterMessageId={editing?.triggerAfterMessageId ?? ""}
              defaultDelayDays={editing?.triggerDelayDays?.toString() ?? "5"}
              otherMessages={otherMessages}
            />
            <div className="mt-1">
              {editing ? (
                <SaveMenu
                  formId="critical-message-form"
                  deleteAction={deleteCriticalMessage}
                  deleteLabel="Delete message"
                  deleteDescription="Removes this message and every member's dismissal record for it."
                  hidden={{ id: editing.id }}
                />
              ) : (
                <button type="submit" className={btn}>
                  Save
                </button>
              )}
            </div>
          </form>
        </SectionCard>
      )}

      <SectionCard title="All messages" count={messages.length} bodyClassName="">
        {messages.length === 0 ? (
          <p className="p-4 text-sm text-stone-400">Nothing posted yet.</p>
        ) : (
          <div className={tableWrap}>
            <table className="w-full text-left">
              <thead>
                <tr>
                  <th className={th}>Title</th>
                  <th className={th}>Trigger</th>
                  <th className={th}>Urgent</th>
                  <th className={th}>Read by</th>
                  <th className={th} />
                </tr>
              </thead>
              <tbody>
                {messages.map((m) => (
                  <tr key={m.id} className={trHover}>
                    <td className={`${td} max-w-xs`}>
                      <p className="truncate font-medium text-stone-800">{m.title}</p>
                      <p className="truncate text-xs text-stone-400">{m.body}</p>
                    </td>
                    <td className={td}>
                      {TRIGGER_LABEL[m.trigger]}
                      {m.trigger === "DAYS_AFTER_MESSAGE" && (
                        <span className="block text-xs text-stone-400">
                          {m.triggerDelayDays}d after "{m.triggerAfterMessage?.title ?? "—"}"
                        </span>
                      )}
                    </td>
                    <td className={td}>
                      {m.urgent ? (
                        <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">
                          Urgent
                        </span>
                      ) : (
                        <span className="text-stone-300">—</span>
                      )}
                    </td>
                    <td className={td}>
                      {m._count.dismissals === 0 ? (
                        <span className="text-stone-300">0</span>
                      ) : (
                        <details>
                          <summary className="cursor-pointer select-none font-medium text-brand-700 hover:text-brand-600">
                            {m._count.dismissals}
                          </summary>
                          <ul className="mt-1.5 flex flex-col gap-0.5 text-xs text-stone-500">
                            {m.dismissals.map((d) => (
                              <li key={d.id}>
                                {d.member.user.name || d.member.user.email} —{" "}
                                {d.dismissedAt.toLocaleDateString()}
                              </li>
                            ))}
                          </ul>
                        </details>
                      )}
                    </td>
                    <td className={td}>
                      <Link
                        href={`/admin/messages?edit=${m.id}`}
                        className={`${btnGhost} inline-block`}
                      >
                        Edit
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </main>
  );
}
